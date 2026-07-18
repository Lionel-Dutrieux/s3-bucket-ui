-- CreateTable
CREATE TABLE "drop_links" (
    "id" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "password_hash" TEXT,
    "revoked_at" TIMESTAMPTZ(3),
    "max_files" INTEGER,
    "max_size_mb" INTEGER,
    "note" TEXT,
    "uploads_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drop_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drop_links_source_id_idx" ON "drop_links"("source_id");

-- CreateIndex
CREATE INDEX "drop_links_created_by_id_idx" ON "drop_links"("created_by_id");

-- AddForeignKey
ALTER TABLE "drop_links" ADD CONSTRAINT "drop_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
