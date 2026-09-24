import { describe, expect, it } from "vitest";
import { getDemoShowtimes } from "./demo-data";
import { parseSaved, toggleSaved } from "./saved";

const showtimes = getDemoShowtimes(new Date("2026-09-23T12:00:00Z"));

describe("parseSaved", () => {
  it("keeps films that are no longer listed", () => {
    const saved = parseSaved(JSON.stringify([{ movieId: "gone", title: "Gone Film", theatre: "Rio Theatre" }]), showtimes);
    expect(saved).toEqual([{ movieId: "gone", title: "Gone Film", theatre: "Rio Theatre" }]);
  });

  it("upgrades legacy ids when the film is listed and drops them when it is not", () => {
    const saved = parseSaved(JSON.stringify(["perfect-days", "unknown-id"]), showtimes);
    expect(saved).toEqual([{ movieId: "perfect-days", title: "Perfect Days", theatre: "VIFF Centre" }]);
  });

  it("ignores garbage", () => {
    expect(parseSaved("not json", showtimes)).toEqual([]);
    expect(parseSaved(JSON.stringify({ movieId: "x" }), showtimes)).toEqual([]);
    expect(parseSaved(JSON.stringify([{ title: "no id" }, 42, null]), showtimes)).toEqual([]);
  });
});

describe("toggleSaved", () => {
  const film = { movieId: "the-shining", title: "The Shining", theatre: "Hollywood Theatre" };
  it("adds then removes", () => {
    const added = toggleSaved([], film);
    expect(added).toEqual([film]);
    expect(toggleSaved(added, film)).toEqual([]);
  });
});
