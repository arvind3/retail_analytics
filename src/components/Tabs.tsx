const Tabs = ({
  items,
  active,
  onChange
}: {
  items: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => onChange(item.id)}
        className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-150 ${
          active === item.id
            ? 'border-indigo-500 bg-indigo-500 text-white'
            : 'border-white/[0.10] bg-white/[0.04] text-slate-400 hover:border-indigo-600 hover:text-slate-200'
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);

export default Tabs;
