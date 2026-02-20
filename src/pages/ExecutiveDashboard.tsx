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
    WHEN (ABS(coupon_disc) + ABS(coupon_match_disc)) > 0 THEN 'Coupon Used'
    ELSE 'No Coupon'
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
      const promoRow = promoResult.rows.find((row) => row.promo_flag === 'Coupon Used') as
        | Record<string, unknown>
        | undefined;
      const promoShare = promoRow
        ? Number(promoRow.revenue ?? 0) /
          promoResult.rows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0)
        : 0;

        setInsights([
          topDept
            ? `Top department: ${topDept.department} driving ${formatCurrencyShort(
                Number(topDept.revenue ?? 0),
              )} in sales.`
            : 'Top department contribution is stable across the portfolio.',
          `Average basket value sits at ${formatCurrency(Number(kpiRow.avg_basket ?? 0))}, signaling
         strong spend per trip.`,
          `Coupons influence ${formatPercent(promoShare)} of sales, with redemption rate at ${formatPercent(
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
        Failed to load dashboard data: {error}
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
        <LoadingPanel label="Preparing Executive Dashboard" />
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
    legend: { data: ['Revenue', 'YoY-ish'], bottom: 0 },
    xAxis: {
      type: 'category',
      data: revenueTrend.rows.map((row) => Number(row.week))
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Revenue',
        type: 'line',
        smooth: true,
        data: revenueTrend.rows.map((row) => Number(row.revenue ?? 0))
      },
      {
        name: 'YoY-ish',
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
    legend: { data: ['Revenue', 'Cumulative %'], bottom: 0 },
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
        name: 'Revenue',
        type: 'bar',
        data: topDepartments.rows.map((row) => Number(row.revenue ?? 0))
      },
      {
        name: 'Cumulative %',
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Revenue"
          value={formatCurrencyShort(kpis.revenue)}
          trend="Weekly sales momentum"
        />
        <StatCard
          label="Baskets"
          value={formatCompact(kpis.baskets)}
          helper="Unique basket trips"
        />
        <StatCard label="Households" value={formatCompact(kpis.households)} helper="Active shoppers" />
        <StatCard
          label="Avg Basket"
          value={formatCurrency(kpis.avgBasket)}
          helper="Average trip spend"
        />
        <StatCard
          label="Redemption Rate"
          value={formatPercent(kpis.redemptionRate)}
          helper="Coupons redeemed"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Weekly Revenue Trend"
          subtitle="Current period vs 52-week offset"
          soWhat="Momentum remains the north-star KPI for leadership. Track where weekly demand starts to drift."
          meta={revenueTrend}
          testId="chart-revenue"
        >
          <Chart option={revenueOption} height={320} />
        </ChartCard>
        <ChartCard
          title="Basket Value Distribution"
          subtitle="Spend per trip across all households"
          soWhat="Basket dispersion highlights whether growth is coming from more trips or bigger trips."
          meta={basketDist}
        >
          <Chart option={basketOption} height={320} />
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Top Departments with Pareto"
          subtitle="Department contribution to total revenue"
          soWhat="A small set of departments drives most revenue; this directs trade and supply focus."
          meta={topDepartments}
        >
          <Chart option={paretoOption} height={320} />
        </ChartCard>
        <ChartCard
          title="Promo Effectiveness"
          subtitle="Coupon-impacted revenue vs baseline"
          soWhat="Coupons are shifting significant revenue, signaling a lever for targeted margin strategy."
          meta={promoEffect}
        >
          <Chart option={promoOption} height={320} />
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="RFM Segmentation"
          subtitle="Recency vs frequency distribution"
          soWhat="The heatmap makes it clear where loyalty programs should prioritize high-frequency, recent shoppers."
          meta={rfmHeatmap}
        >
          <Chart option={rfmOption} height={320} />
        </ChartCard>
        <InsightCard title="Executive Insights" items={insights} />
      </section>
    </div>
  );
};

export default ExecutiveDashboard;
