import "server-only";
import { cache } from "react";
import { decrypt, encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export interface SourceSummary {
  id: string;
  name: string;
  bucket: string;
  provider: string;
}

export interface Source extends SourceSummary {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SourceInput {
  name: string;
  provider: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// cache() deduplicates reads within one server render — the layout and the
// page both ask for sources without hitting SQLite twice.
export const listSources = cache(async (): Promise<SourceSummary[]> => {
  return prisma.source.findMany({
    select: { id: true, name: true, bucket: true, provider: true },
    orderBy: { name: "asc" },
  });
});

export const getSource = cache(async (id: string): Promise<Source | null> => {
  const row = await prisma.source.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    bucket: row.bucket,
    provider: row.provider,
    endpoint: row.endpoint,
    accessKeyId: decrypt(row.accessKeyId),
    secretAccessKey: decrypt(row.secretAccessKey),
  };
});

export async function createSource(input: SourceInput): Promise<string> {
  const row = await prisma.source.create({
    data: {
      ...input,
      accessKeyId: encrypt(input.accessKeyId),
      secretAccessKey: encrypt(input.secretAccessKey),
    },
  });
  return row.id;
}

export async function updateSource(
  id: string,
  input: SourceInput
): Promise<void> {
  await prisma.source.update({
    where: { id },
    data: {
      ...input,
      accessKeyId: encrypt(input.accessKeyId),
      secretAccessKey: encrypt(input.secretAccessKey),
    },
  });
}

export async function deleteSource(id: string): Promise<void> {
  await prisma.source.deleteMany({ where: { id } });
}
