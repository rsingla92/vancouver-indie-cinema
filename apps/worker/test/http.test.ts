import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchText, HttpError } from "../src/http.js";

const url = new URL("https://example.test/schedule");

afterEach(() => vi.unstubAllGlobals());

describe("fetchText", () => {
  it("does not retry a non-retryable status", async () => {
    const fetchMock = vi.fn(async () => new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchText(url)).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures and returns the eventual success", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchText(url)).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after the configured number of attempts", async () => {
    const fetchMock = vi.fn(async () => new Response("busy", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchText(url, { attempts: 2 })).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchJson", () => {
  it("parses a JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    await expect(fetchJson(url)).resolves.toEqual({ ok: true });
  });
});
