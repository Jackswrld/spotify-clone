import { TestBed } from '@angular/core/testing';
import { CountryPicker, CountryService, defaultCountry } from './country-picker';

describe('CountryService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('defaults from the browser language region when allowed, else us', () => {
    expect(defaultCountry('en-NG')).toBe('ng');
    expect(defaultCountry('fr-FR')).toBe('fr');
    expect(defaultCountry('en')).toBe('us');
    expect(defaultCountry('xx-ZZ')).toBe('us');
  });

  it('remembers the chosen country', () => {
    TestBed.inject(CountryService).set('gh');
    TestBed.resetTestingModule();
    expect(TestBed.inject(CountryService).country()).toBe('gh');
  });

  it('ignores an unknown stored country', () => {
    localStorage.setItem('catalog.country', JSON.stringify('zz'));
    expect(['us', defaultCountry(navigator.language)]).toContain(TestBed.inject(CountryService).country());
  });

  it('the picker lists allowed countries by name and changes the country', () => {
    const fixture = TestBed.createComponent(CountryPicker);
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
    expect(select.options.length).toBe(30);
    expect(select.getAttribute('aria-label')).toBe('Country');
    select.value = 'ng';
    select.dispatchEvent(new Event('change'));
    expect(TestBed.inject(CountryService).country()).toBe('ng');
  });
});
