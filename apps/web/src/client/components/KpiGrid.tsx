type KpiGridProps = {
  items: Array<{
    label: string;
    value: number;
  }>;
};

export function KpiGrid({ items }: KpiGridProps) {
  return (
    <div className="kpi-grid">
      {items.map((item) => (
        <article key={item.label} className="kpi-card">
          <div className="kpi-value">{item.value}</div>
          <div className="kpi-label">{item.label}</div>
        </article>
      ))}
    </div>
  );
}
