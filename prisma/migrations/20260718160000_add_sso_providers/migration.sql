-- SSO identity providers registered through the better-auth SSO plugin
-- (@better-auth/sso). Replaces the single env/DB-configured genericOAuth
-- provider: IdPs now live in this table, one row per provider.
CREATE TABLE "sso_providers" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "oidc_config" TEXT,
    "saml_config" TEXT,
    "user_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "organization_id" TEXT,

    CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sso_providers_provider_id_key" ON "sso_providers"("provider_id");

-- AddForeignKey (the registering admin; SET NULL so deleting them keeps the IdP)
ALTER TABLE "sso_providers" ADD CONSTRAINT "sso_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- NOTE: legacy accounts from the old genericOAuth provider carry
-- provider_id = 'oidc'. They are NOT relinked here — no SSO provider row exists
-- yet at migration time, so the target provider_id is unknown. The relinking is
-- done one-shot when an admin registers the FIRST SSO provider (see
-- relinkLegacyOidcAccounts in src/lib/dal/sso.ts): the accounts keep their
-- stable IdP subject (account_id), so pointing them at the new provider_id
-- preserves every existing account without relying on email-based linking.
