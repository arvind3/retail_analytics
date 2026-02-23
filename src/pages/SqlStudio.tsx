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
  { id: 'none', label: 'No Visual' },
  { id: 'bar', label: 'Column' },
  { id: 'line', label: 'Trend' }
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
      <section className="chart-card p-6">
        <h2 className="text-lg font-semibold text-slate-50">Decision Lab</h2>
        <p className="mt-1 text-sm text-slate-400">
          Explore business questions instantly with in-browser SQL and convert results into
          decision-ready evidence.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              What You Are Seeing
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Curated analysis templates plus free-form SQL against the full in-session retail
              dataset.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Why It Matters
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Enables leaders and analysts to validate assumptions immediately without waiting on a
              backend analytics queue.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              How To Interpret
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Use templates for common decisions, then refine filters and segments to isolate
              action-ready opportunities.
            </p>
          </div>
        </div>
      </section>

      <div className="chart-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Analyst Workspace</h2>
            <p className="text-sm text-slate-500">
              Run high-speed in-memory analysis with DuckDB-WASM. Business templates included.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {chartTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setChartType(type.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all duration-150 ${
                  chartType === type.id
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-white/[0.10] bg-white/[0.04] text-slate-400 hover:border-indigo-600 hover:text-slate-200'
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
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
            <div className="font-semibold text-slate-200">Selected analysis template: {activeQuery.title}</div>
            <div>{activeQuery.description}</div>
          </div>

          <textarea
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            className="min-h-[200px] w-full rounded-xl border border-white/[0.08] bg-[#0D1425] p-4 font-mono text-sm text-slate-300 focus:border-indigo-600 focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              className="rounded-full bg-indigo-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
            >
              Run analysis
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-white/[0.10] bg-white/[0.04] px-5 py-2 text-sm font-semibold text-slate-300 transition hover:border-indigo-600 hover:text-slate-100"
            >
              Copy link
            </button>
            {result ? (
              <div className="text-xs text-slate-500">
                Runtime {formatDurationMs(result.elapsedMs)} · Rows returned {formatNumber(result.rowCount)} · Data in session{' '}
                {formatBytes(dbState.loadedBytes)} · Browser memory{' '}
                {result.memoryBytes ? formatBytes(result.memoryBytes) : 'n/a'} · Rows scanned{' '}
                {result.scannedRows ?? 'n/a'}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? <LoadingPanel label="Running analysis" /> : null}
      {error ? (
        <div className="chart-card p-6 text-sm text-slate-400">
          Analysis failed: {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-6">
          {chartOption ? (
            <div className="chart-card p-6">
              <Chart option={chartOption} height={320} />
              <p className="mt-4 border-t border-white/[0.06] pt-3 text-sm text-slate-400">
                Business interpretation: Use this view to quickly validate trend direction and
                magnitude before deciding on deeper investigation.
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
