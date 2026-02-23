const InsightCard = ({ title, items }: { title: string; items: string[] }) => (
  <div className="kpi-card p-5">
    <div className="text-sm font-semibold text-slate-200">{title}</div>
    <ul className="mt-3 space-y-2 text-sm text-slate-400">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default InsightCard;
