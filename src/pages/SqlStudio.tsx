import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Chart from '../components/Chart';
import LoadingPanel from '../components/LoadingPanel';
import Table from '../components/Table';
import Tabs from '../components/Tabs';
import { ensureTables, getAvailableTables, runQuery, QueryResult } from '../lib/duckdb';
import { prebuiltQueries } from '../lib/queries';
import { formatBytes, formatDurationMs, formatNumber } from '../lib/format';
import { useDbState } from '../lib/dbState';

const chartTypes = [
  { id: 'none', label: 'No Chart' },
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' }
] as const;

type ChartType = (typeof chartTypes)[number]['id'];

const SqlStudio = () => {
  const dbState = useDbState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeId, setActiveId] = useState(prebuiltQueries[0].id);
  const [sql, setSql] = useState(prebuiltQueries[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<ChartType>('none');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const queryParam = searchParams.get('query');
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const match = prebuiltQueries.find((q) => q.id === tabParam);
      if (match) {
        setActiveId(match.id);
        setSql(match.sql);
      }
    }
    if (queryParam) {
      setSql(queryParam);
    }
  }, [searchParams]);

  const activeQuery = useMemo(
    () => prebuiltQueries.find((query) => query.id === activeId) ?? prebuiltQueries[0],
    [activeId],
  );

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const tablesToLoad =
        sql === activeQuery.sql ? activeQuery.tables : await getAvailableTables();
      await ensureTables(tablesToLoad);
      const nextResult = await runQuery(sql);
      setResult(nextResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    const params = new URLSearchParams();
    params.set('tab', activeId);
    params.set('query', sql);
    const baseHash = window.location.hash.split('?')[0] || '#/sql-studio';
    const url = `${window.location.origin}${window.location.pathname}${baseHash}?${params.toString()}`;
    await navigator.clipboard.writeText(url);
  };

  const chartOption = useMemo(() => {
    if (!result || chartType === 'none' || result.columns.length < 2) {
      return null;
    }
    const [xKey, yKey] = result.columns;
    const seriesData = result.rows.map((row) => Number(row[yKey] ?? 0));
    return {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: result.rows.map((row) => row[xKey]) },
      yAxis: { type: 'value' },
      series: [
        {
          type: chartType,
          data: seriesData
        }
      ]
    };
  }, [chartType, result]);

  return (
    <div className="space-y-6">
      <div className="chart-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">SQL Studio</h2>
            <p className="text-sm text-ink-500">
              Run analytical SQL in-memory with DuckDB-WASM. Prebuilt business queries included.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {chartTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setChartType(type.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  chartType === type.id
                    ? 'border-accent-500 bg-accent-500 text-white'
                    : 'border-ink-200 bg-white/80 text-ink-600'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <Tabs
            items={prebuiltQueries.map((query) => ({ id: query.id, label: query.title }))}
            active={activeId}
            onChange={(id) => {
              const selected = prebuiltQueries.find((query) => query.id === id)!;
              setActiveId(id);
              setSql(selected.sql);
              setSearchParams({ tab: id, query: selected.sql });
            }}
          />
          <div className="rounded-xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-600">
            <div className="font-semibold text-ink-800">{activeQuery.title}</div>
            <div>{activeQuery.description}</div>
          </div>

          <textarea
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            className="min-h-[200px] w-full rounded-xl border border-ink-200 bg-white/90 p-4 font-mono text-sm text-ink-700"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              className="rounded-full bg-accent-500 px-6 py-2 text-sm font-semibold text-white"
            >
              Run query
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-ink-200 bg-white/80 px-5 py-2 text-sm font-semibold text-ink-700"
            >
              Copy link
            </button>
            {result ? (
              <div className="text-xs text-ink-500">
                Query time {formatDurationMs(result.elapsedMs)} · Rows {formatNumber(result.rowCount)} · Data loaded{' '}
                {formatBytes(dbState.loadedBytes)} · Memory{' '}
                {result.memoryBytes ? formatBytes(result.memoryBytes) : 'n/a'} · Rows scanned{' '}
                {result.scannedRows ?? 'n/a'}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? <LoadingPanel label="Running query" /> : null}
      {error ? (
        <div className="chart-card p-6 text-sm text-ink-600">
          Query failed: {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-6">
          {chartOption ? (
            <div className="chart-card p-6">
              <Chart option={chartOption} height={320} />
              <p className="mt-4 text-sm text-ink-600">
                So what? A quick visual check to validate the shape of your query output.
              </p>
            </div>
          ) : null}
          <div className="chart-card p-6">
            <Table columns={result.columns} rows={result.rows} maxHeight={420} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SqlStudio;
