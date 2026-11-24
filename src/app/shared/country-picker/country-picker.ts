import { Component, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { CHART_COUNTRIES } from '../../core/countries';
import { safeStorage } from '../../state/safe-storage';

const KEY = 'catalog.country';
const allowed = (c: unknown): c is string => typeof c === 'string' && (CHART_COUNTRIES as readonly string[]).includes(c);

/** "en-NG" → "ng" when Apple publishes charts there, otherwise "us". */
export function defaultCountry(language: string | undefined): string {
  const region = (language ?? '').split('-')[1]?.toLowerCase();
  return allowed(region) ? region : 'us';
}

/** The country for charts and catalog search. Remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class CountryService {
  private readonly _country = signal<string>(
    (() => {
      const saved = safeStorage.get<unknown>(KEY, null);
      return allowed(saved) ? saved : defaultCountry(typeof navigator !== 'undefined' ? navigator.language : undefined);
    })(),
  );
  readonly country: Signal<string> = this._country.asReadonly();
  readonly countryName = computed(() => regionName(this._country()));

  set(country: string): void {
    if (!allowed(country)) return;
    this._country.set(country);
    safeStorage.set(KEY, country);
  }
}

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code.toUpperCase();
  }
}

@Component({
  selector: 'app-country-picker',
  template: `
    <label class="picker">
      <i class="fa-solid fa-earth-africa" aria-hidden="true"></i>
      <select aria-label="Country" [value]="countries.country()" (change)="countries.set($any($event.target).value)">
        @for (c of options; track c.code) {
          <option [value]="c.code" [selected]="c.code === countries.country()">{{ c.name }}</option>
        }
      </select>
    </label>
  `,
  styles: `
    .picker {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      min-height: 36px;
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--text-muted);
      font-size: 13px;
    }
    select {
      border: 0;
      background: transparent;
      color: var(--text);
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }
    option {
      background: var(--surface-2);
    }
  `,
})
export class CountryPicker {
  protected readonly countries = inject(CountryService);
  protected readonly options = CHART_COUNTRIES.map((code) => ({ code, name: regionName(code) })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
