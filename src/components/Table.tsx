const Table = ({
  columns,
  rows,
  maxHeight = 360
}: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  maxHeight?: number;
}) => (
  <div className="overflow-auto rounded-xl border border-white/[0.08]" style={{ maxHeight }}>
    <table className="min-w-full text-left text-sm">
      <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400 sticky top-0">
        <tr>
          {columns.map((col) => (
            <th key={col} className="px-4 py-3 font-semibold">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.05]">
        {rows.map((row, idx) => (
          <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
            {columns.map((col) => (
              <td key={`${idx}-${col}`} className="px-4 py-2 text-slate-300">
                {String(row[col] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Table;
