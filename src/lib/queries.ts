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
    title: 'Weekly Net Sales Momentum',
    description: 'Weekly net sales with prior-year reference using a 52-week offset.',
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
    title: 'Basket Size Distribution',
    description: 'Distribution of basket spend to understand trip-value dynamics.',
    tables: ['transactions'],
    sql: `WITH baskets AS (
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
ORDER BY bucket;`
  },
  {
    id: 'top-departments',
    title: 'Category Revenue Concentration',
    description: 'Top categories ranked by net sales contribution for Pareto analysis.',
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
    title: 'Promotion Impact',
    description: 'Net sales impact from promoted versus non-promoted baskets.',
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
    title: 'Customer Value Segments',
    description: 'Recency, frequency, and spend quartiles across customer households.',
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
    title: 'Customer Cohort Retention',
    description: 'Retention trends by weekly customer cohort across the first 12 weeks.',
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
    title: 'Top Basket Affinity Pairs',
    description: 'Most frequent category pairs purchased together in the same basket.',
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
  p1.product_category AS product_a,
  p2.product_category AS product_b,
  product_pairs.baskets_together
FROM product_pairs
JOIN products p1 ON product_pairs.product_a = p1.product_id
JOIN products p2 ON product_pairs.product_b = p2.product_id
ORDER BY baskets_together DESC
LIMIT 20;`
  },
  {
    id: 'campaign-lift',
    title: 'Campaign Incremental Lift',
    description: 'Campaign-window lift versus pre-campaign baseline performance.',
    tables: ['transactions', 'campaigns', 'campaign_descriptions'],
    sql: `WITH campaign_sales AS (
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
LIMIT 20;`
  }
];
