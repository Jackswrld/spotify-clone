import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { VideoDockService } from './video-dock.service';

/** A document whose visibility tests can change. */
function fakeDocument() {
  const listeners: (() => void)[] = [];
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    body: document.body,
    createElement: (tag: string) => document.createElement(tag),
    addEventListener: (type: string, fn: () => void) => {
      if (type === 'visibilitychange') listeners.push(fn);
    },
    removeEventListener: () => undefined,
    setVisibility(v: DocumentVisibilityState) {
      doc.visibilityState = v;
      listeners.forEach((fn) => fn());
    },
  };
  return doc;
}

function box(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `width:${width}px;height:${height}px`;
  document.body.appendChild(el);
  return el;
}

describe('VideoDockService', () => {
  const created: HTMLElement[] = [];
  afterEach(() => created.splice(0).forEach((el) => el.remove()));

  function setup() {
    const doc = fakeDocument();
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: doc }] });
    return { dock: TestBed.inject(VideoDockService), doc };
  }

  it('creates one host element in the body', () => {
    const { dock } = setup();
    expect(dock.host.isConnected).toBeTrue();
    created.push(dock.host);
  });

  it('active slot is the highest priority slot at least 200x200', () => {
    const { dock } = setup();
    created.push(dock.host);
    const small = box(150, 150);
    const panel = box(288, 288);
    const sheet = box(300, 300);
    created.push(small, panel, sheet);
    dock.registerSlot(small, 9);
    const offPanel = dock.registerSlot(panel, 2);
    expect(dock.activeSlot()).toBe(panel);
    const offSheet = dock.registerSlot(sheet, 3);
    expect(dock.activeSlot()).toBe(sheet);
    offSheet();
    expect(dock.activeSlot()).toBe(panel);
    offPanel();
    expect(dock.activeSlot()).toBeNull();
  });

  it('canShow is false when the page is hidden', () => {
    const { dock, doc } = setup();
    created.push(dock.host);
    expect(dock.canShow()).toBeTrue(); // floating card available
    doc.setVisibility('hidden');
    expect(dock.canShow()).toBeFalse();
    doc.setVisibility('visible');
    expect(dock.canShow()).toBeTrue();
  });

  it('canShow is false when the floating card is closed and no slot is active', () => {
    const { dock } = setup();
    created.push(dock.host);
    dock.floatingClosed.set(true);
    expect(dock.canShow()).toBeFalse();
    const panel = box(288, 288);
    created.push(panel);
    dock.registerSlot(panel, 2);
    expect(dock.canShow()).toBeTrue();
  });
});
