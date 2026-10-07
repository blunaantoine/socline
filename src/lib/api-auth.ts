// Client-side fetch interceptor: attaches the signed session token as an
// `Authorization: Bearer` header to same-origin /api/ requests.
//
// WHY: when the app runs inside a cross-site iframe (preview panels, embeds),
// browsers do NOT attach SameSite=Lax cookies to requests initiated from the
// iframe — cookie-only auth then fails with 401 ("Session expirée") right
// after a successful login. The login response already returns the signed
// session token, which the auth store persists in localStorage
// (key: `socline-auth`); we simply send it back on every API call as a
// fallback mechanism. The server (src/lib/auth.ts → getSessionFromRequest)
// accepts either the cookie or this header.

const AUTH_STORAGE_KEY = 'socline-auth';

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: unknown } };
    const token = parsed?.state?.token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function isSameOriginApiUrl(url: string): boolean {
  try {
    // Relative URLs ("/api/...") are always same-origin.
    if (url.startsWith('/')) return url.startsWith('/api/');
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

let installed = false;

export function installApiAuthInterceptor(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (isSameOriginApiUrl(url)) {
        const token = readStoredToken();
        if (token) {
          // Merge existing headers (Request body headers + init headers).
          const headers = new Headers(
            input instanceof Request ? input.headers : undefined
          );
          if (init?.headers) {
            new Headers(init.headers).forEach((value, key) => {
              headers.set(key, value);
            });
          }

          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);

            if (input instanceof Request) {
              // Preserve the Request (body, method…) with upgraded headers.
              return originalFetch(new Request(input, { headers }), init);
            }
            return originalFetch(input, { ...init, headers });
          }
        }
      }
    } catch {
      // Never break the app because of the interceptor — fall through to a
      // plain fetch with the original arguments.
    }

    return originalFetch(input as RequestInfo, init);
  };
}

// Install as early as possible: module evaluation happens before any
// component renders or fires effects, so no request can slip through
// without the header. Idempotent — safe to call again.
if (typeof window !== 'undefined') {
  installApiAuthInterceptor();
}
