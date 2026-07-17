import { describe, expect, it } from "vitest";
import { twoFactorRequiredFor } from "./two-factor-policy";

describe("twoFactorRequiredFor", () => {
  describe("policy = off", () => {
    it("never requires 2FA", () => {
      expect(twoFactorRequiredFor({ role: "admin" }, "off")).toBe(false);
      expect(twoFactorRequiredFor({ role: "user" }, "off")).toBe(false);
      expect(twoFactorRequiredFor({ role: null }, "off")).toBe(false);
    });
  });

  describe("policy = admins", () => {
    it("requires 2FA only for admins", () => {
      expect(twoFactorRequiredFor({ role: "admin" }, "admins")).toBe(true);
      expect(twoFactorRequiredFor({ role: "user" }, "admins")).toBe(false);
      expect(twoFactorRequiredFor({ role: null }, "admins")).toBe(false);
    });
  });

  describe("policy = all", () => {
    it("always requires 2FA", () => {
      expect(twoFactorRequiredFor({ role: "admin" }, "all")).toBe(true);
      expect(twoFactorRequiredFor({ role: "user" }, "all")).toBe(true);
      expect(twoFactorRequiredFor({ role: null }, "all")).toBe(true);
    });
  });
});
