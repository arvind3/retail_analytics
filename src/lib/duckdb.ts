import * as duckdb from '@duckdb/duckdb-wasm';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { fetchWithProgress } from './cache';
import { getMetadata } from './metadata';
import { getDbState, setDbState } from './dbState';

const tableFiles: Record<string, string> = {
  households: 'households.parquet',
  products: 'products.parquet',
  transactions: 'transactions.parquet',
  coupons: 'coupons.parquet',
  coupon_redemptions: 'coupon_redemptions.parquet',
  campaigns: 'campaigns.parquet',
  campaign_descriptions: 'campaign_descriptions.parquet'
};

const syntheticTableSql: Record<string, string> = {
  households: `CREATE TABLE IF NOT EXISTS households AS
SELECT * FROM (VALUES
  (1001, '35-49K'),
  (1002, '50-74K'),
  (1003, '75-99K'),
  (1004, '25-34K'),
  (1005, '100-124K'),
  (1006, '150K+'),
  (1007, 'Under 25K'),
  (1008, '75-99K')
) AS t(household_id, income);`,
  products: `CREATE TABLE IF NOT EXISTS products AS
SELECT * FROM (VALUES
  (2001, 'GROCERY', 'Snacks'),
  (2002, 'GROCERY', 'Beverages'),
  (2003, 'DAIRY', 'Yogurt'),
  (2004, 'PRODUCE', 'Fresh Fruit'),
  (2005, 'MEAT', 'Poultry'),
  (2006, 'HOUSEHOLD', 'Cleaning'),
  (2007, 'FROZEN', 'Frozen Meals'),
  (2008, 'BAKERY', 'Bread'),
  (2009, 'DELI', 'Ready Meals'),
  (2010, 'PERSONAL CARE', 'Shampoo')
) AS t(product_id, department, product_category);`,
  transactions: `CREATE TABLE IF NOT EXISTS transactions AS
SELECT
  basket_id,
  household_id,
  product_id,
  sales_value,
  coupon_disc,
  coupon_match_disc,
  week,
  day,
  CAST(transaction_date AS DATE) AS transaction_date
FROM (VALUES
  (1, 1001, 2001, 12.5, -0.5, -0.2, 1, 1, '2020-01-05'),
  (2, 1001, 2002, 8.2, 0.0, 0.0, 2, 8, '2020-01-12'),
  (3, 1001, 2001, 15.1, -1.0, -0.5, 6, 39, '2020-02-09'),
  (3, 1001, 2003, 5.4, 0.0, 0.0, 6, 39, '2020-02-09'),
  (4, 1002, 2002, 9.0, 0.0, 0.0, 1, 3, '2020-01-07'),
  (5, 1002, 2002, 14.0, -0.8, -0.3, 7, 45, '2020-02-15'),
  (5, 1002, 2008, 3.5, 0.0, 0.0, 7, 45, '2020-02-15'),
  (6, 1003, 2005, 16.5, 0.0, 0.0, 5, 33, '2020-02-02'),
  (7, 1003, 2005, 22.0, -2.0, -1.0, 10, 70, '2020-03-10'),
  (7, 1003, 2004, 6.8, 0.0, 0.0, 10, 70, '2020-03-10'),
  (8, 1004, 2006, 10.4, 0.0, 0.0, 9, 63, '2020-03-03'),
  (9, 1004, 2006, 18.0, -1.5, -0.2, 14, 98, '2020-04-07'),
  (9, 1004, 2001, 4.8, 0.0, 0.0, 14, 98, '2020-04-07'),
  (10, 1001, 2004, 7.9, 0.0, 0.0, 18, 126, '2020-05-10'),
  (11, 1001, 2003, 13.2, -1.2, 0.0, 23, 161, '2020-06-14'),
  (11, 1001, 2008, 4.1, 0.0, 0.0, 23, 161, '2020-06-14'),
  (12, 1002, 2006, 11.2, 0.0, 0.0, 12, 84, '2020-03-24'),
  (13, 1003, 2007, 9.9, 0.0, 0.0, 16, 112, '2020-04-21'),
  (14, 1004, 2009, 12.1, 0.0, 0.0, 20, 140, '2020-05-19'),
  (15, 1005, 2008, 6.2, 0.0, 0.0, 14, 97, '2020-04-10'),
  (16, 1005, 2008, 11.6, -0.6, -0.4, 18, 126, '2020-05-06'),
  (16, 1005, 2003, 3.7, 0.0, 0.0, 18, 126, '2020-05-06'),
  (17, 1005, 2005, 19.5, 0.0, 0.0, 22, 154, '2020-06-01'),
  (18, 1006, 2004, 5.9, 0.0, 0.0, 15, 105, '2020-04-14'),
  (19, 1006, 2008, 9.4, -0.7, -0.2, 19, 133, '2020-05-13'),
  (19, 1006, 2002, 4.6, 0.0, 0.0, 19, 133, '2020-05-13'),
  (20, 1006, 2010, 14.9, 0.0, 0.0, 25, 175, '2020-06-28'),
  (21, 1007, 2001, 7.3, 0.0, 0.0, 8, 56, '2020-02-26'),
  (22, 1007, 2007, 8.8, 0.0, 0.0, 17, 119, '2020-04-28'),
  (22, 1007, 2002, 2.9, 0.0, 0.0, 17, 119, '2020-04-28'),
  (23, 1007, 2009, 13.4, 0.0, 0.0, 24, 168, '2020-06-21'),
  (24, 1008, 2005, 12.7, 0.0, 0.0, 6, 42, '2020-02-12'),
  (25, 1008, 2005, 17.8, -1.1, -0.5, 11, 77, '2020-03-17'),
  (25, 1008, 2006, 6.3, 0.0, 0.0, 11, 77, '2020-03-17'),
  (26, 1008, 2004, 5.1, 0.0, 0.0, 21, 147, '2020-05-26')
) AS t(
  basket_id,
  household_id,
  product_id,
  sales_value,
  coupon_disc,
  coupon_match_disc,
  week,
  day,
  transaction_date
);`,
  coupons: `CREATE TABLE IF NOT EXISTS coupons AS
SELECT * FROM (VALUES
  ('C100', 501, 2001),
  ('C101', 501, 2002),
  ('C102', 502, 2005),
  ('C103', 503, 2006),
  ('C104', 504, 2008),
  ('C105', 505, 2003)
) AS t(coupon_upc, campaign_id, product_id);`,
  coupon_redemptions: `CREATE TABLE IF NOT EXISTS coupon_redemptions AS
SELECT * FROM (VALUES
  (1001, 'C100', 501),
  (1002, 'C101', 501),
  (1003, 'C102', 502),
  (1004, 'C103', 503),
  (1005, 'C104', 504),
  (1001, 'C105', 505),
  (1006, 'C104', 504),
  (1008, 'C102', 502)
) AS t(household_id, coupon_upc, campaign_id);`,
  campaigns: `CREATE TABLE IF NOT EXISTS campaigns AS
SELECT * FROM (VALUES
  (501, 1001),
  (501, 1002),
  (502, 1003),
  (503, 1004),
  (504, 1005),
  (505, 1001),
  (504, 1006),
  (502, 1008)
) AS t(campaign_id, household_id);`,
  campaign_descriptions: `CREATE TABLE IF NOT EXISTS campaign_descriptions AS
SELECT
  campaign_id,
  campaign_type,
  CAST(start_date AS DATE) AS start_date,
  CAST(end_date AS DATE) AS end_date
FROM (VALUES
  (501, 'Type A', '2020-02-01', '2020-02-28'),
  (502, 'Type B', '2020-03-01', '2020-03-31'),
  (503, 'Type C', '2020-04-01', '2020-04-30'),
  (504, 'Type A', '2020-05-01', '2020-05-31'),
  (505, 'Type B', '2020-06-01', '2020-06-30')
) AS t(campaign_id, campaign_type, start_date, end_date);`
};

export const getAvailableTables = async () => {
  const metadata = await getMetadata();
  const tables = Object.keys(metadata.tables || {});
  if (tables.length === 0) {
    return Object.keys(tableFiles);
  }
  return tables.filter((table) => tableFiles[table]);
};

const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: mvpWasm,
    mainWorker: mvpWorker
  },
  eh: {
    mainModule: ehWasm,
    mainWorker: ehWorker
  }
};

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;
let connPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

const loadedTables = new Set<string>();
const loadPromises = new Map<string, Promise<void>>();
const progressByTable = new Map<string, number>();
const parquetMagic = [80, 65, 82, 49];

const hasMagicBytes = (buffer: Uint8Array, offset: number) =>
  parquetMagic.every((byte, index) => buffer[offset + index] === byte);

const isParquetBuffer = (buffer: Uint8Array) =>
  buffer.length >= 8 &&
  hasMagicBytes(buffer, 0) &&
  hasMagicBytes(buffer, buffer.length - parquetMagic.length);

const shouldUseSyntheticFallback = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch|No magic bytes found|Invalid parquet payload/i.test(message);
};

const clearProgress = (table: string, subtractLoadedBytes = false) => {
  const loaded = progressByTable.get(table) ?? 0;
  progressByTable.delete(table);
  if (!subtractLoadedBytes || loaded <= 0) {
    return;
  }
  const current = getDbState();
  setDbState({ loadedBytes: Math.max(0, current.loadedBytes - loaded) });
};

const loadSyntheticTable = async (table: string, conn: duckdb.AsyncDuckDBConnection) => {
  const sql = syntheticTableSql[table];
  if (!sql) {
    throw new Error(`No synthetic dataset available for ${table}`);
  }
  await conn.query(sql);
};

export const initDuckDB = async () => {
  if (!dbPromise) {
    dbPromise = (async () => {
      setDbState({ status: 'loading', message: 'Initializing DuckDB-WASM' });
      const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      const metadata = await getMetadata();
      setDbState({ status: 'ready', message: 'DuckDB ready', totalBytes: metadata.total_bytes });
      return db;
    })().catch((error) => {
      setDbState({ status: 'error', message: error.message ?? 'DuckDB init failed' });
      throw error;
    });
  }
  return dbPromise;
};

export const getConnection = async () => {
  if (!connPromise) {
    connPromise = (async () => {
      const db = await initDuckDB();
      return db.connect();
    })();
  }
  return connPromise;
};

const reportProgress = (table: string, loaded: number) => {
  const previous = progressByTable.get(table) ?? 0;
  const delta = loaded - previous;
  if (delta <= 0) {
    return;
  }
  progressByTable.set(table, loaded);
  const current = getDbState();
  setDbState({ loadedBytes: current.loadedBytes + delta });
};

const datasetPrefix = import.meta.env.VITE_DATASET_PATH || 'data/parquet';
const getTableUrl = (fileName: string) =>
  `${import.meta.env.BASE_URL}${datasetPrefix}/${fileName}`;

export const ensureTables = async (tables: string[]) => {
  await initDuckDB();
  const tasks = tables
    .filter((table) => !loadedTables.has(table))
    .map((table) => {
      if (loadPromises.has(table)) {
        return loadPromises.get(table)!;
      }
      const fileName = tableFiles[table];
      if (!fileName) {
        throw new Error(`Missing file mapping for table ${table}`);
      }
      const promise = (async () => {
        setDbState({ status: 'loading', message: `Loading ${table}` });
        const db = await initDuckDB();
        const conn = await getConnection();
        try {
          const url = getTableUrl(fileName);
          const buffer = await fetchWithProgress(url, (loaded) => reportProgress(table, loaded));
          if (!isParquetBuffer(buffer)) {
            throw new Error(`Invalid parquet payload for ${fileName}`);
          }
          await db.registerFileBuffer(fileName, buffer);
          await conn.query(`CREATE TABLE IF NOT EXISTS ${table} AS SELECT * FROM parquet_scan('${fileName}')`);
          loadedTables.add(table);
          clearProgress(table);
          const current = getDbState();
          setDbState({
            status: 'ready',
            message: `Loaded ${table}`,
            loadedTables: Array.from(loadedTables),
            loadedBytes: current.loadedBytes
          });
          return;
        } catch (error) {
          if (!shouldUseSyntheticFallback(error)) {
            clearProgress(table, true);
            throw error;
          }
          clearProgress(table, true);
          await loadSyntheticTable(table, conn);
          loadedTables.add(table);
          const current = getDbState();
          setDbState({
            status: 'ready',
            message: `Loaded ${table} (synthetic fallback)`,
            loadedTables: Array.from(loadedTables),
            loadedBytes: current.loadedBytes
          });
        }
      })().finally(() => {
        loadPromises.delete(table);
      });
      loadPromises.set(table, promise);
      return promise;
    });

  await Promise.all(tasks);
};

export type QueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  elapsedMs: number;
  rowCount: number;
  scannedRows: number | null;
  memoryBytes: number | null;
};

export const runQuery = async (sql: string): Promise<QueryResult> => {
  const conn = await getConnection();
  const start = performance.now();
  const result = await conn.query(sql);
  const elapsedMs = performance.now() - start;
  const rows = result.toArray().map((row) => row as Record<string, unknown>);
  const columns = result.schema.fields.map((field) => field.name);
  const rowCount = rows.length;
  const memoryBytes = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    ?.usedJSHeapSize ?? null;
  setDbState({ lastQueryMs: elapsedMs, lastRowCount: rowCount, memoryBytes });
  return { columns, rows, elapsedMs, rowCount, scannedRows: null, memoryBytes };
};
