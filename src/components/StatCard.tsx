const StatCard = ({
  label,
  value,
  trend,
  helper
}: {
  label: string;
  value: string;
  trend?: string;
  helper?: string;
}) => (
  <div className="kpi-card p-5">
    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">{label}</div>
    <div className="mt-3 text-2xl font-semibold text-ink-900">{value}</div>
    {trend ? <div className="mt-1 text-sm text-accent-600">{trend}</div> : null}
    {helper ? <div className="mt-2 text-xs text-ink-500">{helper}</div> : null}
  </div>
);

export default StatCard;
