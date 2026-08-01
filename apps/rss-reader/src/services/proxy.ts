const PROXIES = ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?url='];

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchError';
  }
}

export async function fetchFeedText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2_000));
    for (const proxy of PROXIES) {
      try {
        const res = await fetch(proxy + encodeURIComponent(url));
        if (!res.ok) {
          throw new FetchError(`Proxy responded ${res.status}`);
        }
        const text = await res.text();
        if (!text.trim()) throw new FetchError('Empty response');
        return text;
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError ?? new FetchError('Could not fetch feed');
}
