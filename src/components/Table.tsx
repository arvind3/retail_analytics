const Table = ({
  columns,
  rows,
  maxHeight = 360
}: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  maxHeight?: number;
}) => (
  <div className="overflow-auto rounded-xl border border-ink-100" style={{ maxHeight }}>
    <table className="min-w-full text-left text-sm">
      <thead className="bg-ink-100/60 text-xs uppercase tracking-wide text-ink-600">
        <tr>
          {columns.map((col) => (
            <th key={col} className="px-4 py-3 font-semibold">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-100">
        {rows.map((row, idx) => (
          <tr key={idx} className="bg-white/80">
            {columns.map((col) => (
              <td key={`${idx}-${col}`} className="px-4 py-2 text-ink-700">
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
