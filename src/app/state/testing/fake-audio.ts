/** Minimal stand-in for HTMLAudioElement. */
export class FakeAudio {
  src = '';
  currentTime = 0;
  duration = NaN;
  volume = 1;
  muted = false;
  paused = true;
  preload = '';
  private listeners = new Map<string, ((e: Event) => void)[]>();

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {}
  addEventListener(type: string, fn: (e: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeAttribute(name: string): void {
    if (name === 'src') this.src = '';
  }
  dispatch(type: string): void {
    (this.listeners.get(type) ?? []).forEach((fn) => fn(new Event(type)));
  }
}

