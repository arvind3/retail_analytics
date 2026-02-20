import { useEffect, useState } from 'react';
import { getMetadata } from '../lib/metadata';
import { useDbState } from '../lib/dbState';
import { formatBytes } from '../lib/format';

const DataStatus = () => {
  const dbState = useDbState();
  const [source, setSource] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const generatedDate = generatedAt ? new Date(generatedAt) : null;
  const displayGeneratedAt =
    generatedDate && !Number.isNaN(generatedDate.getTime())
      ? generatedDate.toLocaleString()
      : 'Not available';
  const engineStatus =
    dbState.status === 'ready'
      ? 'Operational'
      : dbState.status === 'loading'
        ? 'Preparing analysis'
        : dbState.status === 'error'
          ? 'Attention required'
          : 'Standing by';

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
          Retail Dataset
        </div>
        <div className="text-sm font-semibold text-ink-800">{source}</div>
        <div className="text-xs text-ink-500">Last refresh {displayGeneratedAt}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
          Analytics Engine
        </div>
        <div
          className="text-sm font-semibold text-ink-800"
          data-testid="duckdb-status"
        >
          {engineStatus}
        </div>
        <div className="text-xs text-ink-500">{dbState.message || 'In-browser execution active'}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
          Data Footprint
        </div>
        <div className="text-sm font-semibold text-ink-800">
          {formatBytes(dbState.loadedBytes)} / {formatBytes(dbState.totalBytes)}
        </div>
        <div className="text-xs text-ink-500">
          {dbState.loadedTables.length} tables ready for analysis
        </div>
      </div>
    </div>
  );
};

export default DataStatus;
