import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  emptyState,
  loading,
  rowKey = 'id',
}: {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  loading?: ReactNode;
  rowKey?: string;
}) {
  if (loading) return <>{loading}</>;
  if (data.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-base-700">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`table-header ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={String((row as Record<string, unknown>)[rowKey] ?? i)}
              onClick={() => onRowClick?.(row)}
              className={`table-row ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`table-cell ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.className ?? ''}`}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
