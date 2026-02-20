import { ReactNode } from 'react';
import { QueryResult } from '../lib/duckdb';
import { formatBytes, formatDurationMs, formatNumber } from '../lib/format';
import { useDbState } from '../lib/dbState';

const ChartCard = ({
  title,
  subtitle,
  soWhat,
  meta,
  children,
  testId
}: {
  title: string;
  subtitle?: string;
  soWhat: string;
  meta?: QueryResult | null;
  children: ReactNode;
  testId?: string;
}) => {
  const dbState = useDbState();
  return (
    <div className="chart-card p-6" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
          {subtitle ? <p className="text-sm text-ink-500">{subtitle}</p> : null}
        </div>
        {meta ? (
          <div className="text-right text-xs text-ink-500">
            <div>Refresh latency: {formatDurationMs(meta.elapsedMs)}</div>
            <div>Rows returned: {formatNumber(meta.rowCount)}</div>
            <div>Data in session: {formatBytes(dbState.loadedBytes)}</div>
          </div>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
      <p className="mt-4 text-sm text-ink-600">Business interpretation: {soWhat}</p>
    </div>
  );
};

export default ChartCard;
