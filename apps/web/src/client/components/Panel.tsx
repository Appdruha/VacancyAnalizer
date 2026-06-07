import type { ReactNode } from "react";

type PanelProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
};

export function Panel({ title, subtitle, className = "", children }: PanelProps) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title ? <h2 className="panel-title">{title}</h2> : null}
      {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
      {children}
    </section>
  );
}
