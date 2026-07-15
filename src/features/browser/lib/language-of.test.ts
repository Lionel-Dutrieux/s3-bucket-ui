import { describe, expect, it } from "vitest";
import { languageOf } from "./language-of";

describe("languageOf", () => {
  it("maps known extensions to shiki lang ids", () => {
    expect(languageOf("app.ts")).toBe("typescript");
    expect(languageOf("Component.tsx")).toBe("tsx");
    expect(languageOf("script.py")).toBe("python");
    expect(languageOf("main.rs")).toBe("rust");
    expect(languageOf("deploy.ps1")).toBe("powershell");
    expect(languageOf("config.YML")).toBe("yaml");
  });

  it("falls back to text for unknown extensions", () => {
    expect(languageOf("notes.txt")).toBe("text");
    expect(languageOf("no-extension")).toBe("text");
  });
});
