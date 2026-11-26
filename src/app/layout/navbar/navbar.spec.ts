import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Navbar } from './navbar';

@Component({ template: '' })
class Blank {}

describe('Navbar search box', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([{ path: 'search', component: Blank }, { path: 'home', component: Blank }])],
    });
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const input = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#global-search')!;
    const type = (value: string) => {
      input().value = value;
      input().dispatchEvent(new Event('input'));
      tick(300); // the search waits for typing to pause
      tick();
      fixture.detectChanges();
    };
    return { fixture, input, type, router: TestBed.inject(Router) };
  }

  it('keeps spaces between words ("Michael Jackson", not "MichaelJackson")', fakeAsync(() => {
    const t = setup();
    t.type('Michael ');
    expect(t.router.url).toBe('/search?q=Michael');
    expect(t.input().value).toBe('Michael ');
    t.type('Michael Jackson');
    expect(t.router.url).toBe('/search?q=Michael%20Jackson');
    expect(t.input().value).toBe('Michael Jackson');
  }));

  it('shows the search from the address bar after navigating elsewhere', fakeAsync(() => {
    const t = setup();
    t.type('Michael ');
    t.router.navigateByUrl('/search?q=Adele');
    tick();
    t.fixture.detectChanges();
    expect(t.input().value).toBe('Adele');
    t.router.navigateByUrl('/home');
    tick();
    t.fixture.detectChanges();
    expect(t.input().value).toBe('');
  }));
});
