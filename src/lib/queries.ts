export type PrebuiltQuery = {
  id: string;
  title: string;
  description: string;
  sql: string;
  tables: string[];
};

export const prebuiltQueries: PrebuiltQuery[] = [
  {
    id: 'weekly-revenue',
    title: 'Weekly Revenue Trend (YoY-ish)',
    description: 'Weekly sales with prior-year comparison using a 52-week offset.',
    tables: ['transactions'],
    sql: `WITH weekly AS (
  SELECT week, SUM(sales_value) AS revenue
  FROM transactions
  GROUP BY week
),
comparison AS (
  SELECT week, revenue,
    LAG(revenue, 52) OVER (ORDER BY week) AS revenue_prev_year
  FROM weekly
)
SELECT week, revenue, revenue_prev_year
FROM comparison
ORDER BY week;`
  },
  {
    id: 'basket-distribution',
    title: 'Basket Value Distribution',
    description: 'Histogram of total basket spend for basket size profiling.',
    tables: ['transactions'],
    sql: `WITH baskets AS (
  SELECT basket_id, SUM(sales_value) AS basket_sales
  FROM transactions
  GROUP BY basket_id
),
params AS (
  SELECT MIN(basket_sales) AS min_val, MAX(basket_sales) AS max_val FROM baskets
)
SELECT
  width_bucket(basket_sales, params.min_val, params.max_val, 12) AS bucket,
  MIN(basket_sales) AS bucket_min,
  MAX(basket_sales) AS bucket_max,
  COUNT(*) AS basket_count
FROM baskets, params
GROUP BY bucket
ORDER BY bucket;`
  },
  {
    id: 'top-departments',
    title: 'Top Departments by Sales',
    description: 'Top departments ranked by total sales, used for Pareto views.',
    tables: ['transactions', 'products'],
    sql: `SELECT p.department, SUM(t.sales_value) AS revenue
FROM transactions t
JOIN products p ON t.product_id = p.product_id
GROUP BY p.department
ORDER BY revenue DESC
LIMIT 12;`
  },
  {
    id: 'promo-effectiveness',
    title: 'Promo Effectiveness',
    description: 'Sales impact from coupon usage compared to non-promo baskets.',
    tables: ['transactions'],
    sql: `SELECT
  CASE
    WHEN (ABS(coupon_disc) + ABS(coupon_match_disc)) > 0 THEN 'Coupon Used'
    ELSE 'No Coupon'
  END AS promo_flag,
  SUM(sales_value) AS revenue,
  COUNT(DISTINCT basket_id) AS baskets
FROM transactions
GROUP BY promo_flag
ORDER BY revenue DESC;`
  },
  {
    id: 'rfm-segmentation',
    title: 'RFM Segmentation Snapshot',
    description: 'Recency, frequency, monetary quartiles across households.',
    tables: ['transactions'],
    sql: `WITH household_metrics AS (
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
SELECT r, f, m, COUNT(*) AS households
FROM scored
GROUP BY r, f, m
ORDER BY r, f, m;`
  },
  {
    id: 'cohort-retention',
    title: 'Household Cohort Retention',
    description: 'Retention by weekly cohort for the first 12 weeks.',
    tables: ['transactions'],
    sql: `WITH first_week AS (
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
)
SELECT
  c.cohort_week,
  c.week_offset,
  c.active_households,
  s.cohort_size,
  c.active_households::DOUBLE / s.cohort_size AS retention
FROM cohort_activity c
JOIN cohort_size s ON c.cohort_week = s.cohort_week
WHERE c.week_offset BETWEEN 0 AND 12
ORDER BY c.cohort_week, c.week_offset;`
  },
  {
    id: 'cross-sell',
    title: 'Top Cross-Sell Pairs',
    description: 'Top co-occurring products in the same basket.',
    tables: ['transactions', 'products'],
    sql: `WITH basket_items AS (
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
LIMIT 20;`
  },
  {
    id: 'campaign-lift',
    title: 'Campaign Exposure Lift',
    description: 'Proxy lift comparing campaign window sales to pre-campaign baseline.',
    tables: ['transactions', 'campaigns'],
    sql: `WITH campaign_sales AS (
  SELECT c.campaign_id, SUM(t.sales_value) AS campaign_sales
  FROM campaigns c
  JOIN transactions t
    ON t.household_id = c.household_id
    AND t.day BETWEEN c.start_day AND c.end_day
  GROUP BY c.campaign_id
),
baseline_sales AS (
  SELECT c.campaign_id, SUM(t.sales_value) AS baseline_sales
  FROM campaigns c
  JOIN transactions t
    ON t.household_id = c.household_id
    AND t.day BETWEEN (c.start_day - 28) AND (c.start_day - 1)
  GROUP BY c.campaign_id
)
SELECT
  c.campaign_id,
  c.campaign_type,
  campaign_sales.campaign_sales,
  baseline_sales.baseline_sales,
  (campaign_sales.campaign_sales / NULLIF(baseline_sales.baseline_sales, 0)) - 1 AS lift
FROM campaigns c
LEFT JOIN campaign_sales ON c.campaign_id = campaign_sales.campaign_id
LEFT JOIN baseline_sales ON c.campaign_id = baseline_sales.campaign_id
ORDER BY lift DESC NULLS LAST
LIMIT 20;`
  }
];
