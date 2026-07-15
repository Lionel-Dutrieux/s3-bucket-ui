-- CreateTable
CREATE TABLE "shares" (
    "id" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "password_hash" TEXT,
    "revoked_at" TIMESTAMPTZ(3),
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shares_source_id_idx" ON "shares"("source_id");

-- CreateIndex
CREATE INDEX "shares_created_by_id_idx" ON "shares"("created_by_id");

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
