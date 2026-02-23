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
        ? 'Preparing'
        : dbState.status === 'error'
          ? 'Error'
          : 'Standby';

  const statusColor =
    dbState.status === 'ready'
      ? 'bg-emerald-500'
      : dbState.status === 'loading'
        ? 'bg-amber-400'
        : dbState.status === 'error'
          ? 'bg-rose-500'
          : 'bg-slate-500';

  useEffect(() => {
    getMetadata().then((metadata) => {
      setSource(metadata.source || 'completejourney');
      setGeneratedAt(metadata.generated_at || '');
    });
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
      {/* Engine status dot + label */}
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
        <span
          className="text-xs font-semibold text-slate-300"
          data-testid="duckdb-status"
        >
          {engineStatus}
        </span>
      </div>

      {/* Dataset info — hidden on small screens */}
      <div className="hidden items-center gap-1 sm:flex">
        <span className="text-xs text-slate-500">{source || '—'}</span>
        <span className="text-xs text-slate-600">·</span>
        <span className="text-xs text-slate-500">
          {formatBytes(dbState.loadedBytes)}
        </span>
        {dbState.loadedTables.length > 0 && (
          <>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">
              {dbState.loadedTables.length} tables
            </span>
          </>
        )}
      </div>

      {/* Refresh timestamp — desktop only */}
      <div className="hidden items-center gap-1 lg:flex">
        <span className="text-xs text-slate-600">Updated</span>
        <span className="text-xs text-slate-500">{displayGeneratedAt}</span>
      </div>
    </div>
  );
};

export default DataStatus;
