const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://pause-api-seven.vercel.app';

// Simple in-memory GET cache to avoid redundant API calls on tab switches
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30_000; // 30 seconds — fresh enough for health data

// In-flight request deduplication
const inflight = new Map<string, Promise<unknown>>();

export async function apiRequest(
  endpoint: string,
  token: string | null,
  options?: RequestInit & { skipCache?: boolean }
) {
  const isGet = !options?.method || options.method === 'GET';
  const cacheKey = isGet ? endpoint : null;

  // Return cached data for GET requests if still fresh
  if (cacheKey && !options?.skipCache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  // Deduplicate identical in-flight GET requests
  if (cacheKey && inflight.has(cacheKey)) {
    return inflight.get(cacheKey);
  }

  // Invalidate cache on mutations (POST/PUT/DELETE)
  if (!isGet) {
    cache.clear();
  }

  const request = (async () => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `API error: ${res.status}`);
    }

    const data = await res.json();

    // Cache successful GET responses
    if (cacheKey) {
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  })();

  // Track in-flight request
  if (cacheKey) {
    inflight.set(cacheKey, request);
    request.finally(() => inflight.delete(cacheKey));
  }

  return request;
}

/** Clear the API cache — useful after mutations or sign-out */
export function clearApiCache() {
  cache.clear();
}
