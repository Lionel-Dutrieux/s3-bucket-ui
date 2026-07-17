import { describe, expect, it } from "vitest";
import {
  fieldProvenance,
  resolveOidcConfig,
  resolveSmtpConfig,
} from "./resolve";

const smtpEnv = {
  host: "mail.env.example",
  port: 587,
  secure: false,
  user: undefined,
  password: undefined,
  from: "Env <env@example.com>",
};

describe("resolveSmtpConfig", () => {
  it("returns env values when no DB override exists", () => {
    expect(resolveSmtpConfig({}, smtpEnv)).toEqual({
      host: "mail.env.example",
      port: 587,
      secure: false,
      user: null,
      password: null,
      from: "Env <env@example.com>",
    });
  });

  it("overrides field by field — DB wins only where set", () => {
    const config = resolveSmtpConfig(
      { host: "mail.db.example", port: "465", secure: "true" },
      smtpEnv,
    );
    expect(config).toMatchObject({
      host: "mail.db.example",
      port: 465,
      secure: true,
      from: "Env <env@example.com>", // env fallback preserved
    });
  });

  it("is null when neither DB nor env provide host+from", () => {
    expect(resolveSmtpConfig({}, { ...smtpEnv, host: undefined })).toBeNull();
    expect(
      resolveSmtpConfig(
        { host: "mail.db.example" },
        { ...smtpEnv, host: undefined, from: undefined },
      ),
    ).toBeNull();
  });

  it("DB alone is enough (no env at all)", () => {
    const config = resolveSmtpConfig(
      { host: "db.example", from: "DB <db@example.com>" },
      {
        host: undefined,
        port: 587,
        secure: false,
        user: undefined,
        password: undefined,
        from: undefined,
      },
    );
    expect(config).toMatchObject({ host: "db.example", port: 587 });
  });
});

const oidcEnv = {
  discoveryUrl: "https://idp.example/.well-known/openid-configuration",
  clientId: "env-client",
  clientSecret: "env-secret",
  providerLabel: "SSO",
  scopes: "openid profile email groups",
  groupsClaim: "groups",
};

describe("resolveOidcConfig", () => {
  it("returns env trio when DB is empty", () => {
    expect(resolveOidcConfig({}, oidcEnv)).toMatchObject({
      clientId: "env-client",
      providerLabel: "SSO",
    });
  });

  it("null when the resolved trio is incomplete", () => {
    expect(
      resolveOidcConfig({}, { ...oidcEnv, clientSecret: undefined }),
    ).toBeNull();
    // DB completes a partial env
    expect(
      resolveOidcConfig(
        { clientSecret: "db-secret" },
        { ...oidcEnv, clientSecret: undefined },
      ),
    ).toMatchObject({ clientSecret: "db-secret" });
  });
});

describe("fieldProvenance", () => {
  it("classifies db / env / unset", () => {
    expect(fieldProvenance("x", "y")).toBe("db");
    expect(fieldProvenance(undefined, "y")).toBe("env");
    expect(fieldProvenance(undefined, undefined)).toBe("unset");
  });
});
