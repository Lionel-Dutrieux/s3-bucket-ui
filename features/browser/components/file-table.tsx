"use client";

import {
  flexRender,
  type Header,
  type Table as TableInstance,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { BrowserEntry } from "@/features/browser/entries";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * List view over the shared TanStack Table instance. Rows are re-partitioned
 * folders-first after sorting so the grouping survives both directions.
 */
export function FileTable({ table }: { table: TableInstance<BrowserEntry> }) {
  const rows = table.getRowModel().rows;
  const ordered = [
    ...rows.filter((row) => row.original.kind === "folder"),
    ...rows.filter((row) => row.original.kind === "file"),
  ];

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={header.column.columnDef.meta?.headClassName}
              >
                {header.isPlaceholder ? null : header.column.getCanSort() ? (
                  <SortButton header={header} />
                ) : (
                  flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {ordered.map((row) => (
          <TableRow key={row.id} className="group">
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cell.column.columnDef.meta?.cellClassName}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SortButton({ header }: { header: Header<BrowserEntry, unknown> }) {
  const sorted = header.column.getIsSorted();
  const Icon = !sorted
    ? ChevronsUpDown
    : sorted === "asc"
      ? ArrowUp
      : ArrowDown;
  const label = flexRender(header.column.columnDef.header, header.getContext());
  const alignRight =
    header.column.columnDef.meta?.cellClassName?.includes("text-right");

  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className={cn(
        "inline-flex h-full w-full items-center gap-1 hover:text-foreground",
        alignRight && "justify-end",
        sorted && "text-foreground",
      )}
      aria-label={`Sort by ${header.column.id}`}
    >
      {label}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} aria-hidden />
    </button>
  );
}
