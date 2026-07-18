import { describe, expect, it } from "vitest";
import { shareCrumbs } from "./gallery";

describe("shareCrumbs", () => {
  it("is just the folder name at the root", () => {
    expect(shareCrumbs("photos/2024/", "photos/2024/")).toEqual([
      { label: "2024", prefix: "photos/2024/" },
    ]);
  });

  it("uses the whole prefix as the label for a single-segment root", () => {
    expect(shareCrumbs("photos/", "photos/")).toEqual([
      { label: "photos", prefix: "photos/" },
    ]);
  });

  it("builds a trail relative to the shared root", () => {
    expect(shareCrumbs("photos/2024/", "photos/2024/events/paris/")).toEqual([
      { label: "2024", prefix: "photos/2024/" },
      { label: "events", prefix: "photos/2024/events/" },
      { label: "paris", prefix: "photos/2024/events/paris/" },
    ]);
  });

  it("falls back to the root crumb when the current prefix is off-root", () => {
    expect(shareCrumbs("photos/", "docs/")).toEqual([
      { label: "photos", prefix: "photos/" },
    ]);
  });
});
