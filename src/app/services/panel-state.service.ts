import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PanelStateService {
  // BehaviorSubject stores the latest open/closed value so new subscribers get it immediately.
  readonly isPanelOpen$ = new BehaviorSubject<boolean>(true);

  togglePanel(): void {
    this.isPanelOpen$.next(!this.isPanelOpen$.value);
  }

  setPanelState(state: boolean): void {
    this.isPanelOpen$.next(state);
  }
}
