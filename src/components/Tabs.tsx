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
        className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
          active === item.id
            ? 'border-accent-500 bg-accent-500 text-white'
            : 'border-ink-200 bg-white/80 text-ink-600 hover:border-accent-300'
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);

export default Tabs;
