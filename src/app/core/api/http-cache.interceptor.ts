import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';

const TRENDING_TTL_MS = 3 * 60_000;
const DEFAULT_TTL_MS = 10 * 60_000;

const cache = new Map<string, { expires: number; response: HttpResponse<unknown> }>();

/** Test helper; also useful if the app ever needs a hard refresh. */
export function clearHttpCache(): void {
  cache.clear();
}

/** In-memory, per-session cache for GET requests. Keeps the app inside API rate limits. */
export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);

  const key = req.urlWithParams;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return of(hit.response.clone());
  if (hit) cache.delete(key);

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.ok) {
        const ttl = key.includes('/trending') ? TRENDING_TTL_MS : DEFAULT_TTL_MS;
        cache.set(key, { expires: Date.now() + ttl, response: event });
      }
    }),
  );
};
