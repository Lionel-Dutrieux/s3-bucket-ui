-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'r2',
    "endpoint" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "access_key_id" TEXT NOT NULL,
    "secret_access_key" TEXT NOT NULL,
    "allow_upload" BOOLEAN NOT NULL DEFAULT false,
    "allow_delete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "source_id" UUID,
    "source_name" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "detail" TEXT,
    "actor" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operations_created_at_idx" ON "operations"("created_at");
