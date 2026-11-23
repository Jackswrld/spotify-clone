import { Signal, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';

export type Loadable<T> =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: null };

/**
 * Turns "input → request" into a signal with loading/ready/error states.
 * Changing `input` or calling `retry()` re-runs the request; stale responses
 * are dropped by switchMap. Must be called in an injection context.
 */
export function loadable<I, T>(
  input: Signal<I>,
  request: (value: I) => Observable<T>,
): { state: Signal<Loadable<T>>; retry: () => void } {
  const attempt = signal(0);
  const trigger = computed(() => ({ value: input(), attempt: attempt() }));

  const state = toSignal(
    toObservable(trigger).pipe(
      switchMap(({ value }) =>
        request(value).pipe(
          map((data) => ({ status: 'ready', data }) as Loadable<T>),
          catchError(() => of({ status: 'error', data: null } as Loadable<T>)),
          startWith({ status: 'loading', data: null } as Loadable<T>),
        ),
      ),
    ),
    { initialValue: { status: 'loading', data: null } as Loadable<T> },
  );

  return { state, retry: () => attempt.update((n) => n + 1) };
}
