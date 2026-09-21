const DEFAULT_TIMEOUT_MS = 15_000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export interface HttpOptions {
  timeoutMs?: number;
  attempts?: number;
}

async function get(url: URL, options: HttpOptions = {}): Promise<Response> {
  const attempts = options.attempts ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/json;q=0.9,*/*;q=0.1",
          "user-agent": "VancouverIndieCinema/0.1 (+schedule aggregator; read-only)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });

      if (response.ok) return response;
      if (!RETRYABLE.has(response.status) || attempt === attempts) {
        throw new Error(`GET ${url} failed with ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }

    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }

  throw lastError instanceof Error ? lastError : new Error(`GET ${url} failed`);
}

export async function fetchText(url: URL, options?: HttpOptions): Promise<string> {
  return (await get(url, options)).text();
}

export async function fetchJson(url: URL, options?: HttpOptions): Promise<unknown> {
  return (await get(url, options)).json();
}
