import { useDbState } from '../lib/dbState';
import { formatBytes } from '../lib/format';

const LoadingPanel = ({ label }: { label: string }) => {
  const dbState = useDbState();
  const progress = dbState.totalBytes
    ? Math.min(1, dbState.loadedBytes / dbState.totalBytes)
    : 0;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#131929] p-6">
      <div className="text-sm font-semibold text-slate-200">{label}</div>
      <div className="mt-2 text-xs text-slate-500">{dbState.message}</div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {formatBytes(dbState.loadedBytes)} loaded into the analysis session
      </div>
    </div>
  );
};

export default LoadingPanel;
