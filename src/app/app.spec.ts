import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { APP_CONFIG } from './core/config';
import { FakeMedia, installFakeMatchMedia } from './state/testing-media';

const TEST_CONFIG = {
  audiusBaseUrl: 'https://audius.test/v1',
  audiusAppName: 'test-app',
  audiusApiKey: '',
  lastFmApiKey: '',
  lrclibClient: 'test',
};

describe('App', () => {
  let media: FakeMedia;
  afterEach(() => media.restore());

  function create(width: number) {
    media = installFakeMatchMedia(width);
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: TEST_CONFIG },
      ],
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders nav, sidebar, main and player regions on desktop', () => {
    const el = create(1280);
    expect(el.querySelector('.shell-nav')).toBeTruthy();
    expect(el.querySelector('.shell-sidebar')).toBeTruthy();
    expect(el.querySelector('.shell-main router-outlet')).toBeTruthy();
    expect(el.querySelector('.shell-player')).toBeTruthy();
    expect(el.querySelector('.shell-tabbar')).toBeNull();
  });

  it('renders the tab bar and no sidebar on phone', () => {
    const el = create(375);
    expect(el.querySelector('.shell-tabbar')).toBeTruthy();
    expect(el.querySelector('.shell-sidebar')).toBeNull();
    expect(el.querySelector('.shell-panel')).toBeNull();
  });
});
