import type { ReactNode } from "react";
import { Panel } from "./Panel.js";

type DataTableProps = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: ReactNode[][];
  className?: string;
};

export function DataTable({ title, subtitle, headers, rows, className }: DataTableProps) {
  const panelProps = className ? { title, subtitle, className } : { title, subtitle };

  return (
    <Panel {...panelProps}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="empty">
                  Данных пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
