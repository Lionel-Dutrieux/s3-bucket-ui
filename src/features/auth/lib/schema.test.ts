import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
  twoFactorChallengeSchema,
} from "./schema";

describe("signInSchema", () => {
  it("accepts a valid email and password", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(
      signInSchema.safeParse({ email: "nope", password: "x" }).success,
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts a valid registration", () => {
    expect(
      signUpSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "supersecret",
      }).success,
    ).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(
      signUpSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "short",
      }).success,
    ).toBe(false);
  });

  it("trims the name and rejects blank names", () => {
    const parsed = signUpSchema.safeParse({
      name: "  Ada  ",
      email: "ada@example.com",
      password: "supersecret",
    });
    expect(parsed.success && parsed.data.name).toBe("Ada");
    expect(
      signUpSchema.safeParse({
        name: "   ",
        email: "ada@example.com",
        password: "supersecret",
      }).success,
    ).toBe(false);
  });
});

describe("profileSchema", () => {
  it("rejects names over 100 characters", () => {
    expect(profileSchema.safeParse({ name: "a".repeat(101) }).success).toBe(
      false,
    );
  });
});

describe("changePasswordSchema", () => {
  it("requires a current password and an 8+ char new one", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "newsecret",
      }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "newsecret",
      }).success,
    ).toBe(false);
  });
});

describe("twoFactorChallengeSchema", () => {
  it("accepts a 6-digit code with a trust flag", () => {
    expect(
      twoFactorChallengeSchema.safeParse({ code: "123456", trustDevice: false })
        .success,
    ).toBe(true);
  });

  it("rejects codes shorter than 6 characters", () => {
    expect(
      twoFactorChallengeSchema.safeParse({ code: "123", trustDevice: false })
        .success,
    ).toBe(false);
  });
});
