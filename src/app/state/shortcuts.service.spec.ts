import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ShortcutsService } from './shortcuts.service';
import { PlayerService } from './player.service';
import { LayoutService } from './layout.service';

function setup(mode: 'desktop' | 'phone' = 'desktop') {
  const player = {
    time: signal(30),
    toggle: jasmine.createSpy('toggle'),
    seek: jasmine.createSpy('seek'),
    next: jasmine.createSpy('next'),
    previous: jasmine.createSpy('previous'),
    toggleMute: jasmine.createSpy('toggleMute'),
  };
  const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: PlayerService, useValue: player },
      { provide: LayoutService, useValue: { mode: signal(mode) } },
      { provide: Router, useValue: router },
    ],
  });
  const service = TestBed.inject(ShortcutsService);
  service.start();
  return { player, router, service };
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('ShortcutsService', () => {
  const cleanup: HTMLElement[] = [];
  afterEach(() => {
    TestBed.inject(ShortcutsService).stop();
    cleanup.splice(0).forEach((el) => el.remove());
  });

  function add<T extends HTMLElement>(el: T): T {
    document.body.appendChild(el);
    cleanup.push(el);
    return el;
  }

  it('Space toggles, ArrowRight seeks +5, ArrowLeft -5, Shift+ArrowRight next, m mutes', () => {
    const { player } = setup();
    expect(press(' ').defaultPrevented).toBeTrue();
    expect(player.toggle).toHaveBeenCalledTimes(1);
    press('ArrowRight');
    expect(player.seek).toHaveBeenCalledWith(35);
    press('ArrowLeft');
    expect(player.seek).toHaveBeenCalledWith(25);
    press('ArrowRight', { shiftKey: true });
    expect(player.next).toHaveBeenCalled();
    press('ArrowLeft', { shiftKey: true });
    expect(player.previous).toHaveBeenCalled();
    press('m');
    expect(player.toggleMute).toHaveBeenCalled();
  });

  it('ignores keys while typing in an input, textarea or contenteditable', () => {
    const { player } = setup();
    const input = add(document.createElement('input'));
    const area = add(document.createElement('textarea'));
    const editable = add(document.createElement('div'));
    editable.setAttribute('contenteditable', 'true');
    for (const target of [input, area, editable]) {
      press(' ', {}, target);
      press('m', {}, target);
      press('ArrowRight', {}, target);
    }
    expect(player.toggle).not.toHaveBeenCalled();
    expect(player.toggleMute).not.toHaveBeenCalled();
    expect(player.seek).not.toHaveBeenCalled();
  });

  it('ignores Space on a focused button so it does not fire twice', () => {
    const { player } = setup();
    const button = add(document.createElement('button'));
    const event = press(' ', {}, button);
    expect(player.toggle).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBeFalse();
  });

  it('ignores keys with ctrl/meta/alt', () => {
    const { player } = setup();
    press('m', { ctrlKey: true });
    press('ArrowRight', { metaKey: true });
    press(' ', { altKey: true });
    expect(player.toggleMute).not.toHaveBeenCalled();
    expect(player.seek).not.toHaveBeenCalled();
    expect(player.toggle).not.toHaveBeenCalled();
  });

  it('stops listening when its injector is destroyed', () => {
    const { player } = setup();
    TestBed.resetTestingModule();
    const event = press('m');
    expect(player.toggleMute).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBeFalse();
    setup(); // re-create so afterEach can stop it
  });

  it('leaves unhandled keys alone', () => {
    setup();
    expect(press('a').defaultPrevented).toBeFalse();
  });

  it('/ focuses #global-search', () => {
    setup();
    const search = add(document.createElement('input'));
    search.id = 'global-search';
    const event = press('/');
    expect(document.activeElement).toBe(search);
    expect(event.defaultPrevented).toBeTrue();
  });

  it('/ navigates to search on phone', () => {
    const { router } = setup('phone');
    press('/');
    expect(router.navigate).toHaveBeenCalledWith(['/search']);
  });
});
