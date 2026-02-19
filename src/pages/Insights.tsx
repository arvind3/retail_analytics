import { useEffect, useState } from 'react';
import Chart from '../components/Chart';
import ChartCard from '../components/ChartCard';
import Skeleton from '../components/Skeleton';
import LoadingPanel from '../components/LoadingPanel';
import Table from '../components/Table';
import { ensureTables, runQuery, QueryResult } from '../lib/duckdb';
import { formatPercent } from '../lib/format';

const Insights = () => {
  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<QueryResult | null>(null);
  const [redeemByDept, setRedeemByDept] = useState<QueryResult | null>(null);
  const [redeemByIncome, setRedeemByIncome] = useState<QueryResult | null>(null);
  const [campaignLift, setCampaignLift] = useState<QueryResult | null>(null);
  const [crossSell, setCrossSell] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await ensureTables(['transactions']);

      const cohortSql = `WITH first_week AS (
  SELECT household_id, MIN(week) AS cohort_week
  FROM transactions
  GROUP BY household_id
),
activity AS (
  SELECT t.household_id, t.week, f.cohort_week
  FROM transactions t
  JOIN first_week f ON t.household_id = f.household_id
),
cohort_activity AS (
  SELECT cohort_week, week - cohort_week AS week_offset, COUNT(DISTINCT household_id) AS active_households
  FROM activity
  GROUP BY cohort_week, week_offset
),
cohort_size AS (
  SELECT cohort_week, COUNT(DISTINCT household_id) AS cohort_size
  FROM first_week
  GROUP BY cohort_week
),
cohort_base AS (
  SELECT MAX(cohort_week) AS max_week FROM first_week
)
SELECT
  c.cohort_week,
  c.week_offset,
  c.active_households,
  s.cohort_size,
  c.active_households::DOUBLE / s.cohort_size AS retention
FROM cohort_activity c
JOIN cohort_size s ON c.cohort_week = s.cohort_week
JOIN cohort_base b ON c.cohort_week >= (b.max_week - 12)
WHERE c.week_offset BETWEEN 0 AND 12
ORDER BY c.cohort_week, c.week_offset;`;

      const redeemDeptSql = `SELECT
  p.department,
  COUNT(*) AS redemptions
FROM coupon_redemptions r
JOIN coupons c ON r.coupon_upc = c.coupon_upc AND r.campaign_id = c.campaign_id
JOIN products p ON c.product_id = p.product_id
GROUP BY p.department
ORDER BY redemptions DESC
LIMIT 10;`;

      const redeemIncomeSql = `SELECT
  COALESCE(h.income, 'Unknown') AS income_band,
  COUNT(*) AS redemptions
FROM coupon_redemptions r
JOIN households h ON r.household_id = h.household_id
GROUP BY income_band
ORDER BY redemptions DESC
LIMIT 10;`;

      const campaignSql = `WITH campaign_sales AS (
  SELECT c.campaign_id, SUM(t.sales_value) AS campaign_sales
  FROM campaigns c
  JOIN campaign_descriptions d ON c.campaign_id = d.campaign_id
  JOIN transactions t
    ON t.household_id = c.household_id
    AND CAST(t.transaction_date AS DATE) BETWEEN CAST(d.start_date AS DATE) AND CAST(d.end_date AS DATE)
  GROUP BY c.campaign_id
),
baseline_sales AS (
  SELECT c.campaign_id, SUM(t.sales_value) AS baseline_sales
  FROM campaigns c
  JOIN campaign_descriptions d ON c.campaign_id = d.campaign_id
  JOIN transactions t
    ON t.household_id = c.household_id
    AND CAST(t.transaction_date AS DATE) BETWEEN
      CAST(d.start_date AS DATE) - INTERVAL 28 DAY AND CAST(d.start_date AS DATE) - INTERVAL 1 DAY
  GROUP BY c.campaign_id
)
SELECT
  c.campaign_id,
  d.campaign_type,
  campaign_sales.campaign_sales,
  baseline_sales.baseline_sales,
  (campaign_sales.campaign_sales / NULLIF(baseline_sales.baseline_sales, 0)) - 1 AS lift
FROM campaigns c
JOIN campaign_descriptions d ON c.campaign_id = d.campaign_id
LEFT JOIN campaign_sales ON c.campaign_id = campaign_sales.campaign_id
LEFT JOIN baseline_sales ON c.campaign_id = baseline_sales.campaign_id
ORDER BY lift DESC NULLS LAST
LIMIT 12;`;

      const crossSellSql = `WITH basket_items AS (
  SELECT basket_id, product_id
  FROM transactions
  GROUP BY basket_id, product_id
),
product_pairs AS (
  SELECT
    a.product_id AS product_a,
    b.product_id AS product_b,
    COUNT(*) AS baskets_together
  FROM basket_items a
  JOIN basket_items b ON a.basket_id = b.basket_id AND a.product_id < b.product_id
  GROUP BY 1, 2
)
SELECT
  p1.commodity AS product_a,
  p2.commodity AS product_b,
  product_pairs.baskets_together
FROM product_pairs
JOIN products p1 ON product_pairs.product_a = p1.product_id
JOIN products p2 ON product_pairs.product_b = p2.product_id
ORDER BY baskets_together DESC
LIMIT 20;`;

        const cohortResult = await runQuery(cohortSql);

        if (cancelled) {
          return;
        }

        setCohort(cohortResult);
        setLoading(false);

        const [deptResult, incomeResult, campaignResult, crossSellResult] = await Promise.all([
          (async () => {
            await ensureTables(['coupons', 'coupon_redemptions', 'products']);
            return runQuery(redeemDeptSql);
          })(),
          (async () => {
            await ensureTables(['coupon_redemptions', 'households']);
            return runQuery(redeemIncomeSql);
          })(),
          (async () => {
            await ensureTables(['campaigns', 'campaign_descriptions']);
            return runQuery(campaignSql);
          })(),
          (async () => {
            await ensureTables(['products']);
            return runQuery(crossSellSql);
          })()
        ]);

        if (cancelled) {
          return;
        }

        setRedeemByDept(deptResult);
        setRedeemByIncome(incomeResult);
        setCampaignLift(campaignResult);
        setCrossSell(crossSellResult);
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="chart-card p-6 text-sm text-ink-600">
        Failed to load insights: {error}
      </div>
    );
  }

  if (loading && !cohort) {
    return (
      <div className="space-y-6">
        <LoadingPanel label="Loading Customer & Promotion Insights" />
        <Skeleton height="320px" />
        <Skeleton height="320px" />
      </div>
    );
  }

  const cohortWeeks = cohort
    ? Array.from(new Set(cohort.rows.map((row) => Number(row.cohort_week)))).sort((a, b) => a - b)
    : [];
  const weekOffsets = cohort
    ? Array.from(new Set(cohort.rows.map((row) => Number(row.week_offset)))).sort((a, b) => a - b)
    : [];

  const cohortOption = cohort
    ? {
        tooltip: {
          formatter: (params: { value: [number, number, number] }) =>
            `${formatPercent(params.value[2])} retention`
        },
        xAxis: { type: 'category', data: weekOffsets.map((val) => `W+${val}`) },
        yAxis: { type: 'category', data: cohortWeeks.map((val) => `Week ${val}`) },
        visualMap: {
          min: 0,
          max: 1,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0
        },
        series: [
          {
            type: 'heatmap',
            data: cohort.rows.map((row) => [
              weekOffsets.indexOf(Number(row.week_offset)),
              cohortWeeks.indexOf(Number(row.cohort_week)),
              Number(row.retention)
            ])
          }
        ]
      }
    : null;

  const deptOption = redeemByDept
    ? {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: redeemByDept.rows.map((row) => row.department) },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: redeemByDept.rows.map((row) => row.redemptions) }]
      }
    : null;

  const incomeOption = redeemByIncome
    ? {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: redeemByIncome.rows.map((row) => row.income_band) },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: redeemByIncome.rows.map((row) => row.redemptions) }]
      }
    : null;

  const campaignOption = campaignLift
    ? {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: campaignLift.rows.map((row) => row.campaign_id) },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'bar',
            data: campaignLift.rows.map((row) => Number(row.lift ?? 0))
          }
        ]
      }
    : null;

  return (
    <div className="space-y-6">
      {cohort && cohortOption ? (
        <ChartCard
          title="Household Retention Cohorts"
          subtitle="New vs repeat buyers across the first 12 weeks"
          soWhat="Retention decay highlights where early life-cycle interventions are needed."
          meta={cohort}
          testId="chart-cohort"
        >
          <Chart option={cohortOption} height={320} />
        </ChartCard>
      ) : (
        <LoadingPanel label="Loading retention cohorts" />
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        {redeemByDept && deptOption ? (
          <ChartCard
            title="Coupon Redemption by Department"
            subtitle="Where coupons convert the most"
            soWhat="Promo funds should concentrate on departments with the highest redemption velocity."
            meta={redeemByDept}
          >
            <Chart option={deptOption} height={320} />
          </ChartCard>
        ) : (
          <Skeleton height="320px" />
        )}
        {redeemByIncome && incomeOption ? (
          <ChartCard
            title="Coupon Redemption by Income Segment"
            subtitle="Household segment response"
            soWhat="Segment response indicates which income cohorts are most promotion-sensitive."
            meta={redeemByIncome}
          >
            <Chart option={incomeOption} height={320} />
          </ChartCard>
        ) : (
          <Skeleton height="320px" />
        )}
      </section>

      {campaignLift && campaignOption ? (
        <ChartCard
          title="Campaign Purchase Lift (Proxy)"
          subtitle="Campaign window vs prior 4-week baseline"
          soWhat="Campaign lift highlights which programs drive incremental spend, not just redistribution."
          meta={campaignLift}
        >
          <Chart option={campaignOption} height={320} />
        </ChartCard>
      ) : (
        <Skeleton height="320px" />
      )}

      {crossSell ? (
        <ChartCard
          title="Top Cross-Sell Pairs"
          subtitle="Most frequent co-occurring products in baskets"
          soWhat="Cross-sell pairs guide merchandising adjacency and bundle strategies."
          meta={crossSell}
        >
          <Table columns={crossSell.columns} rows={crossSell.rows} />
        </ChartCard>
      ) : (
        <Skeleton height="320px" />
      )}
    </div>
  );
};

export default Insights;
