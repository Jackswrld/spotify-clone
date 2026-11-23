import { Component, input, output } from '@angular/core';

/** Friendly failure message with an optional Retry button. */
@Component({
  selector: 'app-error-state',
  template: `
    <div class="error" role="alert">
      <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
      <p>{{ message() }}</p>
      @if (showRetry()) {
        <button type="button" class="retry" (click)="retry.emit()">Retry</button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 24px;
      color: var(--text-muted);
      text-align: center;
    }
    i {
      font-size: 24px;
    }
    .retry {
      border: 1px solid var(--text-muted);
      border-radius: 999px;
      padding: 6px 18px;
      background: none;
      color: var(--text);
      font-weight: 700;
      cursor: pointer;
      &:hover {
        border-color: var(--text);
      }
    }
  `,
})
export class ErrorState {
  readonly message = input("Something went wrong.");
  readonly showRetry = input(true);
  readonly retry = output<void>();
}
