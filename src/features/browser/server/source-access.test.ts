import { beforeEach, describe, expect, it, vi } from "vitest";

// getTranslations(namespace) -> t(key) resolving to the full "namespace.key"
// so tests can assert which i18n key was picked without real messages.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(
    async (namespace: string) => (key: string) => `${namespace}.${key}`,
  ),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  currentUser: vi.fn(),
  currentAdmin: vi.fn(),
}));

const requireSourceAccess = vi.fn();
vi.mock("@/lib/auth/access", () => ({
  requireSourceAccess: (id: string) => requireSourceAccess(id),
}));

const filesClient = { marker: "files" };
const getFilesClient = vi.fn((_source: unknown) => filesClient);
vi.mock("@/lib/storage/client", () => ({
  getFilesClient: (source: unknown) => getFilesClient(source),
}));

import { ActionError } from "@/lib/safe-action";
import { sourceAccessMiddleware } from "./source-access";

const source = { id: "s1", provider: "aws" };

// Invokes a middleware built by sourceAccessMiddleware the way next-safe-action
// would: with the validated parsedInput and a spyable `next`.
function run(
  middleware: ReturnType<typeof sourceAccessMiddleware>,
  sourceId = "s1",
) {
  const next = vi.fn(async (opts?: { ctx?: object }) => ({
    success: true as const,
    ctx: opts?.ctx,
  }));
  const result = middleware({
    parsedInput: { sourceId },
    clientInput: { sourceId },
    bindArgsParsedInputs: [],
    bindArgsClientInputs: [],
    ctx: {},
    metadata: { actionName: "test" },
    next,
    // biome-ignore lint/suspicious/noExplicitAny: minimal shim of the mw opts
  } as any);
  return { next, result };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSourceAccess.mockResolvedValue({
    source,
    access: { canEdit: true, canDelete: true },
  });
});

describe("sourceAccessMiddleware", () => {
  it("throws sourceNotFound when the source is inaccessible", async () => {
    requireSourceAccess.mockResolvedValue(null);
    const { result } = run(sourceAccessMiddleware({}));
    await expect(result).rejects.toBeInstanceOf(ActionError);
    await expect(result).rejects.toThrow("browser.errors.sourceNotFound");
  });

  it("denies with deniedKey when edit is required but not granted", async () => {
    requireSourceAccess.mockResolvedValue({
      source,
      access: { canEdit: false, canDelete: true },
    });
    const { next, result } = run(
      sourceAccessMiddleware({
        need: { edit: true },
        deniedKey: "browser.errors.actionFailed",
      }),
    );
    await expect(result).rejects.toBeInstanceOf(ActionError);
    await expect(result).rejects.toThrow("browser.errors.actionFailed");
    expect(next).not.toHaveBeenCalled();
  });

  it("denies with deniedKey when delete is required but not granted", async () => {
    requireSourceAccess.mockResolvedValue({
      source,
      access: { canEdit: true, canDelete: false },
    });
    const { next, result } = run(
      sourceAccessMiddleware({
        need: { delete: true },
        deniedKey: "browser.errors.actionFailed",
      }),
    );
    await expect(result).rejects.toBeInstanceOf(ActionError);
    await expect(result).rejects.toThrow("browser.errors.actionFailed");
    expect(next).not.toHaveBeenCalled();
  });

  it("passes source, files and access on ctx when access is granted", async () => {
    const { next, result } = run(
      sourceAccessMiddleware({
        need: { edit: true },
        deniedKey: "browser.errors.actionFailed",
      }),
    );
    await result;
    expect(getFilesClient).toHaveBeenCalledWith(source);
    expect(next).toHaveBeenCalledWith({
      ctx: {
        source,
        files: filesClient,
        access: { canEdit: true, canDelete: true },
      },
    });
  });

  it("allows read-only access when no capability is required", async () => {
    requireSourceAccess.mockResolvedValue({
      source,
      access: { canEdit: false, canDelete: false },
    });
    const { next, result } = run(sourceAccessMiddleware({}));
    await result;
    expect(next).toHaveBeenCalledWith({
      ctx: {
        source,
        files: filesClient,
        access: { canEdit: false, canDelete: false },
      },
    });
  });
});
