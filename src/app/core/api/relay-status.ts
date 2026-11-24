import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';

export type RelayStatus = 'unknown' | 'ok' | 'down';

/** Whether the local music relay is reachable, and whether YouTube playback is set up. */
@Injectable({ providedIn: 'root' })
export class RelayStatusService {
  private readonly http = inject(HttpClient);
  private readonly _status = signal<RelayStatus>('unknown');
  private readonly _youtubeKey = signal(false);

  readonly status: Signal<RelayStatus> = this._status.asReadonly();
  readonly youtubeReady = computed(() => this._status() === 'ok' && this._youtubeKey());

  constructor() {
    this.recheck();
  }

  recheck(): void {
    this.http.get<{ ok: boolean; youtubeKey: boolean }>('/api/health').subscribe({
      next: (r) => {
        this._status.set(r?.ok ? 'ok' : 'down');
        this._youtubeKey.set(r?.youtubeKey === true);
      },
      error: () => {
        this._status.set('down');
        this._youtubeKey.set(false);
      },
    });
  }
}
