import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';

/** A suggestion that takes longer than this is skipped: the search goes ahead as typed. */
const WAIT_MS = 1500;

/** "Did you mean": a corrected spelling of a search ("micheal jackson" → "Michael Jackson"), or null. */
@Injectable({ providedIn: 'root' })
export class SpellingApi {
  private readonly http = inject(HttpClient);

  suggest(q: string): Observable<string | null> {
    return this.http
      .get<{ suggestion: string | null }>('/api/search/suggest', { params: new HttpParams().set('q', q) })
      .pipe(
        map((r) => r.suggestion ?? null),
        timeout(WAIT_MS),
        catchError(() => of(null)),
      );
  }
}
