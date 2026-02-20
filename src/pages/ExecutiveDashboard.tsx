import { useEffect, useState } from 'react';
import Chart from '../components/Chart';
import ChartCard from '../components/ChartCard';
import StatCard from '../components/StatCard';
import InsightCard from '../components/InsightCard';
import Skeleton from '../components/Skeleton';
import LoadingPanel from '../components/LoadingPanel';
import { ensureTables, runQuery, QueryResult } from '../lib/duckdb';
import {
  formatCompact,
  formatCurrency,
  formatCurrencyShort,
  formatPercent
} from '../lib/format';

const ExecutiveDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<{
    revenue: number;
    baskets: number;
    households: number;
    avgBasket: number;
    redemptionRate: number;
  } | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<QueryResult | null>(null);
  const [basketDist, setBasketDist] = useState<QueryResult | null>(null);
  const [topDepartments, setTopDepartments] = useState<QueryResult | null>(null);
  const [promoEffect, setPromoEffect] = useState<QueryResult | null>(null);
  const [rfmHeatmap, setRfmHeatmap] = useState<QueryResult | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await ensureTables([
          'transactions',
          'products',
          'coupons',
          'coupon_redemptions',
          'households'
        ]);

      const kpiSql = `WITH baskets AS (
  SELECT basket_id, SUM(sales_value) AS basket_sales
  FROM transactions
  GROUP BY basket_id
)
SELECT
  (SELECT SUM(sales_value) FROM transactions) AS revenue,
  (SELECT COUNT(DISTINCT basket_id) FROM transactions) AS baskets,
  (SELECT COUNT(DISTINCT household_id) FROM transactions) AS households,
  (SELECT AVG(basket_sales) FROM baskets) AS avg_basket,
  (SELECT COUNT(*) FROM coupon_redemptions) AS redemptions,
  (SELECT COUNT(*) FROM coupons) AS issued;`;

      const revenueSql = `WITH weekly AS (
  SELECT week, SUM(sales_value) AS revenue
  FROM transactions
  GROUP BY week
)
SELECT week, revenue, LAG(revenue, 52) OVER (ORDER BY week) AS revenue_prev_year
FROM weekly
ORDER BY week;`;

      const basketSql = `WITH baskets AS (
  SELECT basket_id, SUM(sales_value) AS basket_sales
  FROM transactions
  GROUP BY basket_id
),
stats AS (
  SELECT
    MIN(basket_sales) AS min_val,
    MAX(basket_sales) AS max_val,
    (MAX(basket_sales) - MIN(basket_sales)) / 12.0 AS bin_width
  FROM baskets
),
binned AS (
  SELECT
    CASE
      WHEN stats.bin_width = 0 THEN 0
      WHEN basket_sales = stats.max_val THEN 11
      ELSE CAST(FLOOR((basket_sales - stats.min_val) / stats.bin_width) AS INTEGER)
    END AS bucket,
    basket_sales
  FROM baskets, stats
)
SELECT
  bucket,
  MIN(basket_sales) AS bucket_min,
  MAX(basket_sales) AS bucket_max,
  COUNT(*) AS basket_count
FROM binned
GROUP BY bucket
ORDER BY bucket;`;

      const topDeptSql = `WITH dept AS (
  SELECT p.department, SUM(t.sales_value) AS revenue
  FROM transactions t
  JOIN products p ON t.product_id = p.product_id
  GROUP BY p.department
)
SELECT
  department,
  revenue,
  SUM(revenue) OVER () AS total_revenue,
  SUM(revenue) OVER (ORDER BY revenue DESC) AS cumulative_revenue
FROM dept
ORDER BY revenue DESC
LIMIT 12;`;

      const promoSql = `SELECT
  CASE
    WHEN (ABS(coupon_disc) + ABS(coupon_match_disc)) > 0 THEN 'Promotion Redeemed'
    ELSE 'No Promotion'
  END AS promo_flag,
  SUM(sales_value) AS revenue,
  COUNT(DISTINCT basket_id) AS baskets
FROM transactions
GROUP BY promo_flag
ORDER BY revenue DESC;`;

      const rfmSql = `WITH household_metrics AS (
  SELECT
    household_id,
    MAX(week) AS last_week,
    COUNT(DISTINCT basket_id) AS frequency,
    SUM(sales_value) AS monetary
  FROM transactions
  GROUP BY household_id
),
max_week AS (
  SELECT MAX(last_week) AS max_week FROM household_metrics
),
rfm AS (
  SELECT
    household_id,
    (max_week.max_week - household_metrics.last_week) AS recency,
    frequency,
    monetary
  FROM household_metrics, max_week
),
scored AS (
  SELECT
    household_id,
    NTILE(4) OVER (ORDER BY recency ASC) AS r,
    NTILE(4) OVER (ORDER BY frequency DESC) AS f,
    NTILE(4) OVER (ORDER BY monetary DESC) AS m
  FROM rfm
)
SELECT r, f, COUNT(*) AS households
FROM scored
GROUP BY r, f
ORDER BY r, f;`;

        const [kpiResult, revenueResult, basketResult, deptResult, promoResult, rfmResult] =
          await Promise.all([
            runQuery(kpiSql),
            runQuery(revenueSql),
            runQuery(basketSql),
            runQuery(topDeptSql),
            runQuery(promoSql),
            runQuery(rfmSql)
          ]);

        if (cancelled) {
          return;
        }

      const kpiRow = kpiResult.rows[0] as Record<string, number>;
      const redemptionRate =
        Number(kpiRow.redemptions ?? 0) / Math.max(Number(kpiRow.issued ?? 0), 1);

        setKpis({
          revenue: Number(kpiRow.revenue ?? 0),
          baskets: Number(kpiRow.baskets ?? 0),
          households: Number(kpiRow.households ?? 0),
          avgBasket: Number(kpiRow.avg_basket ?? 0),
          redemptionRate
        });

        setRevenueTrend(revenueResult);
        setBasketDist(basketResult);
        setTopDepartments(deptResult);
        setPromoEffect(promoResult);
        setRfmHeatmap(rfmResult);

      const topDept = deptResult.rows[0] as Record<string, unknown> | undefined;
      const promoRow = promoResult.rows.find((row) => row.promo_flag === 'Promotion Redeemed') as
        | Record<string, unknown>
        | undefined;
      const promoShare = promoRow
        ? Number(promoRow.revenue ?? 0) /
          promoResult.rows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0)
        : 0;

        setInsights([
          topDept
            ? `Leading category performance is concentrated in ${topDept.department}, generating ${formatCurrencyShort(
                Number(topDept.revenue ?? 0),
              )} in net sales.`
            : 'Category performance remains broadly distributed across the portfolio.',
          `Average basket value is ${formatCurrency(Number(kpiRow.avg_basket ?? 0))}, indicating healthy spend per shopping trip.`,
          `Promotions influence ${formatPercent(promoShare)} of net sales, with a redemption rate of ${formatPercent(
            redemptionRate,
          )}.`
        ]);

        setLoading(false);
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
        Unable to load the executive overview: {error}
      </div>
    );
  }

  if (
    loading ||
    !kpis ||
    !revenueTrend ||
    !basketDist ||
    !topDepartments ||
    !promoEffect ||
    !rfmHeatmap
  ) {
    return (
      <div className="space-y-6">
        <LoadingPanel label="Preparing Executive Overview" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton height="140px" />
          <Skeleton height="140px" />
          <Skeleton height="140px" />
          <Skeleton height="140px" />
        </div>
        <Skeleton height="320px" />
        <Skeleton height="320px" />
      </div>
    );
  }

  const revenueOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Net Sales', 'Prior-Year Reference'], bottom: 0 },
    xAxis: {
      type: 'category',
      data: revenueTrend.rows.map((row) => Number(row.week))
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Net Sales',
        type: 'line',
        smooth: true,
        data: revenueTrend.rows.map((row) => Number(row.revenue ?? 0))
      },
      {
        name: 'Prior-Year Reference',
        type: 'line',
        smooth: true,
        data: revenueTrend.rows.map((row) => Number(row.revenue_prev_year ?? 0))
      }
    ]
  };

  const basketOption = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: basketDist.rows.map((row) => `${Number(row.bucket_min).toFixed(0)}-${Number(row.bucket_max).toFixed(0)}`)
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: basketDist.rows.map((row) => Number(row.basket_count ?? 0))
      }
    ]
  };

  const paretoOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Category Sales', 'Cumulative Contribution'], bottom: 0 },
    xAxis: {
      type: 'category',
      data: topDepartments.rows.map((row) => row.department)
    },
    yAxis: [
      { type: 'value' },
      {
        type: 'value',
        min: 0,
        max: 1,
        axisLabel: { formatter: (value: number) => `${Math.round(value * 100)}%` }
      }
    ],
    series: [
      {
        name: 'Category Sales',
        type: 'bar',
        data: topDepartments.rows.map((row) => Number(row.revenue ?? 0))
      },
      {
        name: 'Cumulative Contribution',
        type: 'line',
        yAxisIndex: 1,
        data: topDepartments.rows.map(
          (row) => Number(row.cumulative_revenue) / Number(row.total_revenue),
        )
      }
    ]
  };

  const promoOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: promoEffect.rows.map((row) => row.promo_flag) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: promoEffect.rows.map((row) => Number(row.revenue ?? 0))
      }
    ]
  };

  const rfmOption = {
    tooltip: { trigger: 'item' },
    xAxis: { type: 'category', data: ['R1', 'R2', 'R3', 'R4'] },
    yAxis: { type: 'category', data: ['F1', 'F2', 'F3', 'F4'] },
    visualMap: {
      min: 0,
      max: Math.max(...rfmHeatmap.rows.map((row) => Number(row.households))),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0
    },
    series: [
      {
        type: 'heatmap',
        data: rfmHeatmap.rows.map((row) => [
          Number(row.r) - 1,
          Number(row.f) - 1,
          Number(row.households ?? 0)
        ])
      }
    ]
  };

  return (
    <div className="space-y-6">
      <section className="chart-card p-6">
        <h2 className="text-lg font-semibold text-ink-900">Executive Performance Brief</h2>
        <p className="mt-1 text-sm text-ink-600">
          A single decision view of net sales momentum, basket economics, category concentration,
          and promotion efficiency.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-ink-100 bg-white/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
              What You Are Seeing
            </div>
            <p className="mt-2 text-sm text-ink-600">
              Current business performance across sales, trips, customer activity, and promotional
              influence.
            </p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
              Why It Matters
            </div>
            <p className="mt-2 text-sm text-ink-600">
              These indicators reveal where growth is strong, where margin is pressured, and where
              intervention will have the highest impact.
            </p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
              How To Interpret
            </div>
            <p className="mt-2 text-sm text-ink-600">
              Start with net sales trend, then validate whether performance is driven by bigger
              baskets, stronger category mix, or better promotion conversion.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Net Sales"
          value={formatCurrencyShort(kpis.revenue)}
          trend="Overall sales momentum"
        />
        <StatCard
          label="Shopping Trips"
          value={formatCompact(kpis.baskets)}
          helper="Distinct completed baskets"
        />
        <StatCard
          label="Active Households"
          value={formatCompact(kpis.households)}
          helper="Customers purchasing in period"
        />
        <StatCard
          label="Average Basket Value"
          value={formatCurrency(kpis.avgBasket)}
          helper="Average spend per shopping trip"
        />
        <StatCard
          label="Promotion Redemption"
          value={formatPercent(kpis.redemptionRate)}
          helper="Share of issued promotions redeemed"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Weekly Net Sales Momentum"
          subtitle="Current period versus prior-year reference"
          soWhat="Use this trend to spot demand shifts early and react before margin or inventory risk compounds."
          meta={revenueTrend}
          testId="chart-revenue"
        >
          <Chart option={revenueOption} height={320} />
        </ChartCard>
        <ChartCard
          title="Basket Size Distribution"
          subtitle="Spend per trip across active households"
          soWhat="This view separates growth from trip frequency versus growth from spend depth per trip."
          meta={basketDist}
        >
          <Chart option={basketOption} height={320} />
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Category Revenue Concentration"
          subtitle="Category contribution and cumulative share of net sales"
          soWhat="Concentration indicates where commercial focus, supply priority, and assortment bets should be strongest."
          meta={topDepartments}
        >
          <Chart option={paretoOption} height={320} />
        </ChartCard>
        <ChartCard
          title="Promotion Impact on Sales"
          subtitle="Net sales split between promoted and non-promoted baskets"
          soWhat="Promotion contribution clarifies whether growth is sustainable demand or discount-driven volume."
          meta={promoEffect}
        >
          <Chart option={promoOption} height={320} />
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Customer Value Segments"
          subtitle="Recency versus frequency distribution"
          soWhat="Prioritize retention investment where high-frequency shoppers show declining recency."
          meta={rfmHeatmap}
        >
          <Chart option={rfmOption} height={320} />
        </ChartCard>
        <InsightCard title="Leadership Action Signals" items={insights} />
      </section>
    </div>
  );
};

export default ExecutiveDashboard;
