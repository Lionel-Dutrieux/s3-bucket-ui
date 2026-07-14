/*
  Warnings:

  - You are about to drop the column `allow_delete` on the `sources` table. All the data in the column will be lost.
  - You are about to drop the column `allow_upload` on the `sources` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sources" DROP COLUMN "allow_delete",
DROP COLUMN "allow_upload";
