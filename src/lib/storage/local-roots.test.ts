import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkLocalRoot, localFsRoots } from "@/lib/storage/local-roots";

let base: string;
const originalEnv = process.env.LOCAL_FS_ROOTS;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "local-roots-"));
});

afterEach(async () => {
  process.env.LOCAL_FS_ROOTS = originalEnv;
  if (originalEnv === undefined) delete process.env.LOCAL_FS_ROOTS;
  await rm(base, { recursive: true, force: true });
});

describe("localFsRoots", () => {
  it("returns [] when the variable is unset", () => {
    delete process.env.LOCAL_FS_ROOTS;
    expect(localFsRoots()).toEqual([]);
  });

  it("splits on commas, trims, drops empties and resolves paths", () => {
    process.env.LOCAL_FS_ROOTS = ` ${base} , ,${base}${path.sep}sub `;
    expect(localFsRoots()).toEqual([
      path.resolve(base),
      path.resolve(base, "sub"),
    ]);
  });
});

describe("checkLocalRoot", () => {
  it("fails with 'disabled' when no roots are configured", async () => {
    delete process.env.LOCAL_FS_ROOTS;
    expect(await checkLocalRoot(base)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("accepts an allowed root itself and returns its canonical real path", async () => {
    process.env.LOCAL_FS_ROOTS = base;
    expect(await checkLocalRoot(base)).toEqual({
      ok: true,
      value: await realpath(base),
    });
  });

  it("rejects a subdirectory of an allowed root — only exact roots are pickable", async () => {
    process.env.LOCAL_FS_ROOTS = base;
    const sub = path.join(base, "team", "photos");
    await mkdir(sub, { recursive: true });
    expect(await checkLocalRoot(sub)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("rejects a path outside every allowed root", async () => {
    const allowed = path.join(base, "allowed");
    const outside = path.join(base, "outside");
    await mkdir(allowed);
    await mkdir(outside);
    process.env.LOCAL_FS_ROOTS = allowed;
    expect(await checkLocalRoot(outside)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("rejects ../ traversal that escapes the allowed root", async () => {
    const allowed = path.join(base, "allowed");
    await mkdir(allowed);
    process.env.LOCAL_FS_ROOTS = allowed;
    const sneaky = path.join(allowed, "..", "allowed-sibling");
    await mkdir(path.join(base, "allowed-sibling"));
    expect(await checkLocalRoot(sneaky)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("rejects a sibling whose name shares the allowed root as a prefix", async () => {
    const allowed = path.join(base, "data");
    const sibling = path.join(base, "data-secret");
    await mkdir(allowed);
    await mkdir(sibling);
    process.env.LOCAL_FS_ROOTS = allowed;
    expect(await checkLocalRoot(sibling)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("rejects a symlink inside an allowed root pointing outside it", async () => {
    const allowed = path.join(base, "allowed");
    const secret = path.join(base, "secret");
    await mkdir(allowed);
    await mkdir(secret);
    await writeFile(path.join(secret, "f.txt"), "x");
    process.env.LOCAL_FS_ROOTS = allowed;
    const link = path.join(allowed, "escape");
    try {
      await symlink(secret, link, "dir");
    } catch {
      return; // symlink creation needs privileges on some Windows setups — skip
    }
    expect(await checkLocalRoot(link)).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("fails with 'unreachable' when the directory does not exist", async () => {
    process.env.LOCAL_FS_ROOTS = base;
    expect(await checkLocalRoot(path.join(base, "missing"))).toEqual({
      ok: false,
      reason: "unreachable",
    });
  });
});
