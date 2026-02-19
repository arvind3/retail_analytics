import { useDbState } from '../lib/dbState';
import { formatBytes } from '../lib/format';

const LoadingPanel = ({ label }: { label: string }) => {
  const dbState = useDbState();
  const progress = dbState.totalBytes
    ? Math.min(1, dbState.loadedBytes / dbState.totalBytes)
    : 0;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white/80 p-6 shadow-soft">
      <div className="text-sm font-semibold text-ink-800">{label}</div>
      <div className="mt-2 text-xs text-ink-500">{dbState.message}</div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="h-full bg-accent-500" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mt-2 text-xs text-ink-500">
        {formatBytes(dbState.loadedBytes)} loaded
      </div>
    </div>
  );
};

export default LoadingPanel;
