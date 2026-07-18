import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// getTranslations(namespace) -> t(key) resolving to the full "namespace.key"
// so tests can assert which i18n key was picked without real messages.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(
    async (namespace: string) => (key: string) => `${namespace}.${key}`,
  ),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const currentUser = vi.fn();
const currentAdmin = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  currentUser: () => currentUser(),
  currentAdmin: () => currentAdmin(),
}));

import {
  ActionError,
  actionClient,
  adminActionClient,
  authActionClient,
} from "./safe-action";

const user = { id: "u1", role: "user" } as never;
const admin = { id: "a1", role: "admin" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(user);
  currentAdmin.mockResolvedValue(admin);
});

describe("actionClient error handling", () => {
  it("returns the ActionError message as serverError", async () => {
    const boom = actionClient
      .metadata({ actionName: "test.boom" })
      .inputSchema(z.object({}))
      .action(async () => {
        throw new ActionError("visible message");
      });
    expect((await boom({})).serverError).toBe("visible message");
  });

  it("returns the generic i18n message for unknown errors", async () => {
    const boom = actionClient
      .metadata({ actionName: "test.boom" })
      .inputSchema(z.object({}))
      .action(async () => {
        throw new Error("db exploded");
      });
    const result = await boom({});
    expect(result.serverError).toBe("common.actionFailed");
    expect(result.serverError).not.toContain("db exploded");
  });

  it("resolves metadata.failureKey for unknown errors when provided", async () => {
    const boom = actionClient
      .metadata({
        actionName: "test.boom",
        failureKey: "admin.errors.createGroupFailed",
      })
      .inputSchema(z.object({}))
      .action(async () => {
        throw new Error("db exploded");
      });
    expect((await boom({})).serverError).toBe("admin.errors.createGroupFailed");
  });

  it("returns flattened validationErrors for bad input", async () => {
    const body = vi.fn();
    const action = actionClient
      .metadata({ actionName: "test.validate" })
      .inputSchema(z.object({ name: z.string() }))
      .action(async () => {
        body();
      });
    const result = await action({ name: 123 } as never);
    expect(result.validationErrors).toBeDefined();
    // flattened shape exposes fieldErrors
    expect(result.validationErrors?.fieldErrors).toBeDefined();
    expect(body).not.toHaveBeenCalled();
  });
});

describe("adminActionClient", () => {
  it("rejects non-admins with notAuthorized", async () => {
    currentAdmin.mockResolvedValue(null);
    const action = adminActionClient
      .metadata({ actionName: "admin.test" })
      .inputSchema(z.object({}))
      .action(async () => "ok");
    expect((await action({})).serverError).toBe("admin.errors.notAuthorized");
  });

  it("revalidates the layout after success", async () => {
    const action = adminActionClient
      .metadata({ actionName: "admin.test" })
      .inputSchema(z.object({}))
      .action(async () => "ok");
    await action({});
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("skips revalidation when metadata.revalidate === false", async () => {
    const action = adminActionClient
      .metadata({ actionName: "admin.test", revalidate: false })
      .inputSchema(z.object({}))
      .action(async () => "ok");
    await action({});
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not revalidate on failure", async () => {
    const action = adminActionClient
      .metadata({ actionName: "admin.test" })
      .inputSchema(z.object({}))
      .action(async () => {
        throw new ActionError("nope");
      });
    await action({});
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("exposes the admin on ctx", async () => {
    const action = adminActionClient
      .metadata({ actionName: "admin.test" })
      .inputSchema(z.object({}))
      .action(async ({ ctx }) => ctx.admin.id);
    expect((await action({})).data).toBe("a1");
  });
});

describe("authActionClient", () => {
  it("rejects anonymous callers", async () => {
    currentUser.mockResolvedValue(null);
    const action = authActionClient
      .metadata({ actionName: "auth.test" })
      .inputSchema(z.object({}))
      .action(async () => "ok");
    expect((await action({})).serverError).toBe("common.notAuthenticated");
  });

  it("exposes the user on ctx", async () => {
    const action = authActionClient
      .metadata({ actionName: "auth.test" })
      .inputSchema(z.object({}))
      .action(async ({ ctx }) => ctx.user.id);
    expect((await action({})).data).toBe("u1");
  });
});
