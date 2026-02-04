/**
 * Table Component
 * Reusable table component with sorting and pagination
 */

import React from "react";
import { clsx } from "clsx";
import { ChevronUp, ChevronDown } from "lucide-react";

const Table = ({
  columns,
  data,
  sortable = false,
  sortColumn,
  sortDirection,
  onSort,
  className = "",
  emptyMessage = "No data available",
}) => {
  const handleSort = (column) => {
    if (!sortable || !column.sortable || !onSort) return;

    const newDirection =
      sortColumn === column.key && sortDirection === "asc" ? "desc" : "asc";

    onSort(column.key, newDirection);
  };

  return (
    <div
      className={clsx(
        "overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg",
        className,
      )}
    >
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx(
                  "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                  sortable &&
                    column.sortable &&
                    "cursor-pointer hover:bg-gray-100",
                  column.className,
                )}
                onClick={() => handleSort(column)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.title}</span>
                  {sortable && column.sortable && (
                    <div className="flex flex-col">
                      <ChevronUp
                        className={clsx(
                          "h-3 w-3",
                          sortColumn === column.key && sortDirection === "asc"
                            ? "text-gray-900"
                            : "text-gray-400",
                        )}
                      />
                      <ChevronDown
                        className={clsx(
                          "h-3 w-3 -mt-1",
                          sortColumn === column.key && sortDirection === "desc"
                            ? "text-gray-900"
                            : "text-gray-400",
                        )}
                      />
                    </div>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-12 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(
                      "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
                      column.cellClassName,
                    )}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
