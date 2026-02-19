import * as duckdb from '@duckdb/duckdb-wasm';
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

export const getAvailableTables = async () => {
  const metadata = await getMetadata();
  const tables = Object.keys(metadata.tables || {});
  return tables.filter((table) => tableFiles[table]);
};

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;
let connPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

const loadedTables = new Set<string>();
const loadPromises = new Map<string, Promise<void>>();
const progressByTable = new Map<string, number>();

const getBundle = async () => {
  const bundles = duckdb.getJsDelivrBundles();
  return duckdb.selectBundle(bundles);
};

export const initDuckDB = async () => {
  if (!dbPromise) {
    dbPromise = (async () => {
      setDbState({ status: 'loading', message: 'Initializing DuckDB-WASM' });
      const bundle = await getBundle();
      const worker = new Worker(bundle.mainWorker, { type: 'module' });
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
        const url = getTableUrl(fileName);
        const buffer = await fetchWithProgress(url, (loaded) => reportProgress(table, loaded));
        const db = await initDuckDB();
        const conn = await getConnection();
        await db.registerFileBuffer(fileName, buffer);
        await conn.query(`CREATE TABLE IF NOT EXISTS ${table} AS SELECT * FROM parquet_scan('${fileName}')`);
        loadedTables.add(table);
        progressByTable.delete(table);
        const current = getDbState();
        setDbState({
          status: 'ready',
          message: `Loaded ${table}`,
          loadedTables: Array.from(loadedTables),
          loadedBytes: current.loadedBytes
        });
      })();
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
