import { Component, inject } from '@angular/core';
import { ToastService } from '../../state/toast.service';

@Component({
  selector: 'app-toast',
  template: `
    <div class="toast-region" role="status" aria-live="polite">
      @if (toast.message(); as message) {
        <div class="toast">{{ message }}</div>
      }
    </div>
  `,
  styles: `
    .toast-region {
      position: fixed;
      left: 50%;
      bottom: calc(var(--player-h) + 16px);
      transform: translateX(-50%);
      z-index: 100;
      pointer-events: none;
    }
    :host-context([data-mode='phone']) .toast-region {
      bottom: calc(var(--tabbar-h) + var(--mini-h) + 16px);
    }
    .toast {
      max-width: min(90vw, 420px);
      padding: 10px 16px;
      border-radius: var(--radius-m);
      background: var(--text);
      color: var(--bg);
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 24px var(--scrim);
    }
  `,
})
export class Toast {
  protected readonly toast = inject(ToastService);
}
