import { useEffect, useState } from 'react';
import { getMetadata } from '../lib/metadata';
import { useDbState } from '../lib/dbState';
import { formatBytes } from '../lib/format';

const DataStatus = () => {
  const dbState = useDbState();
  const [source, setSource] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');

  useEffect(() => {
    getMetadata().then((metadata) => {
      setSource(metadata.source || 'completejourney');
      setGeneratedAt(metadata.generated_at || '');
    });
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-white/80 px-5 py-4 shadow-soft">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
          Dataset
        </div>
        <div className="text-sm font-semibold text-ink-800">{source}</div>
        <div className="text-xs text-ink-500">Generated {generatedAt || '—'}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
          DuckDB
        </div>
        <div
          className="text-sm font-semibold text-ink-800"
          data-testid="duckdb-status"
        >
          {dbState.status === 'ready' ? 'Ready' : dbState.status}
        </div>
        <div className="text-xs text-ink-500">{dbState.message}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
          Data Loaded
        </div>
        <div className="text-sm font-semibold text-ink-800">
          {formatBytes(dbState.loadedBytes)} / {formatBytes(dbState.totalBytes)}
        </div>
        <div className="text-xs text-ink-500">
          {dbState.loadedTables.length} tables in memory
        </div>
      </div>
    </div>
  );
};

export default DataStatus;
