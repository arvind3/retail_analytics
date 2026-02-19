const InsightCard = ({ title, items }: { title: string; items: string[] }) => (
  <div className="kpi-card p-5">
    <div className="text-sm font-semibold text-ink-800">{title}</div>
    <ul className="mt-3 space-y-2 text-sm text-ink-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-accent-500"></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default InsightCard;
