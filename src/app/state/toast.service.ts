import { Injectable, Signal, signal } from '@angular/core';

/** One short message at a time, shown above the player. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _message = signal<string | null>(null);
  readonly message: Signal<string | null> = this._message.asReadonly();
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(text: string, ms = 4000): void {
    clearTimeout(this.timer);
    this._message.set(text);
    this.timer = setTimeout(() => this._message.set(null), ms);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this._message.set(null);
  }
}
