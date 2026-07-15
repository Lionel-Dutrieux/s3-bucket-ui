"use client";

import {
  flexRender,
  type Header,
  type Row,
  type Table as TableInstance,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEntryDnd } from "@/features/browser/components/dnd";
import {
  type EntryActionHandlers,
  EntryContextMenu,
} from "@/features/browser/components/entry-actions";
import type { BrowserEntry } from "@/features/browser/lib/entries";
import { cn } from "@/lib/utils";

export function FileTable({
  table,
  canMove,
}: {
  table: TableInstance<BrowserEntry>;
  canMove: boolean;
}) {
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
          <BrowserRow
            key={row.id}
            row={row}
            canMove={canMove}
            handlers={table.options.meta}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function BrowserRow({
  row,
  canMove,
  handlers,
}: {
  row: Row<BrowserEntry>;
  canMove: boolean;
  handlers?: EntryActionHandlers;
}) {
  const entry = row.original;
  const dnd = useEntryDnd({
    rowId: row.id,
    data: {
      target:
        entry.kind === "folder"
          ? { kind: "folder", prefix: entry.prefix }
          : { kind: "file", key: entry.key },
      label: entry.name,
      rowId: row.id,
    },
    droppablePrefix: entry.kind === "folder" ? entry.prefix : undefined,
    disabled: !canMove,
  });

  const tableRow = (
    <TableRow
      ref={canMove ? dnd.setNodeRef : undefined}
      className={cn(
        "group",
        canMove && "cursor-grab",
        dnd.isDragging && "opacity-40",
        dnd.isOver && "bg-primary/10 outline outline-2 outline-primary",
      )}
      {...(canMove ? dnd.attributes : {})}
      {...(canMove ? dnd.listeners : {})}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cell.column.columnDef.meta?.cellClassName}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );

  if (!handlers) return tableRow;
  return (
    <EntryContextMenu entry={entry} handlers={handlers}>
      {tableRow}
    </EntryContextMenu>
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
