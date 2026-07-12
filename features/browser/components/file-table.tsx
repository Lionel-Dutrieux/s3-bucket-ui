import Link from "next/link";
import { Download, Folder } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";
import { FileIcon } from "@/features/browser/components/file-icon";
import type { FileEntry, FolderEntry } from "@/features/browser/listing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function FileTable({
  sourceId,
  folders,
  files,
}: {
  sourceId: string;
  folders: FolderEntry[];
  files: FileEntry[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead className="w-28 text-right">Size</TableHead>
          <TableHead className="w-36 text-right">Modified</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {folders.map((folder) => (
          <TableRow key={folder.prefix} className="group">
            <TableCell className="p-0">
              <Link
                href={{
                  pathname: `/source/${sourceId}`,
                  query: { prefix: folder.prefix },
                }}
                className="flex h-12 items-center gap-3 px-2 font-medium"
              >
                <Folder
                  className="size-4 shrink-0 fill-amber-400/80 text-amber-500"
                  aria-hidden
                />
                <span className="truncate">{folder.name}</span>
              </Link>
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-muted-foreground">
              —
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-muted-foreground">
              —
            </TableCell>
            <TableCell />
          </TableRow>
        ))}
        {files.map((file) => {
          const downloadHref = `/source/${sourceId}/download?key=${encodeURIComponent(file.key)}`;
          return (
            <TableRow key={file.key} className="group">
              <TableCell className="p-0">
                <a
                  href={downloadHref}
                  className="flex h-12 items-center gap-3 px-2"
                  title={`Download ${file.name}`}
                >
                  <FileIcon name={file.name} className="size-4 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </a>
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {formatDate(file.lastModified)}
              </TableCell>
              <TableCell className="p-0 pr-2 text-right">
                <a
                  href={downloadHref}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Download ${file.name}`}
                >
                  <Download className="size-4" aria-hidden />
                </a>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
