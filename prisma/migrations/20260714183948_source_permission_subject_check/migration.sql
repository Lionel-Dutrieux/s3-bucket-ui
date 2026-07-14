-- A grant's subject is exactly one of user_id / group_id (polymorphic subject
-- — Prisma PSL cannot express this invariant, so it lives in SQL).
ALTER TABLE "source_permissions" ADD CONSTRAINT "source_permissions_subject_check"
  CHECK (("user_id" IS NULL) <> ("group_id" IS NULL));
