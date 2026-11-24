import { TestBed } from '@angular/core/testing';
import { VideoSlot } from './video-slot';
import { VideoDockService } from '../../state/video-dock.service';

describe('VideoSlot', () => {
  it('registers with the dock while it exists and unregisters when destroyed', () => {
    const dock = { registerSlot: jasmine.createSpy('registerSlot'), relayout: jasmine.createSpy('relayout') };
    const unregister = jasmine.createSpy('unregister');
    dock.registerSlot.and.returnValue(unregister);
    TestBed.configureTestingModule({ providers: [{ provide: VideoDockService, useValue: dock }] });
    const fixture = TestBed.createComponent(VideoSlot);
    fixture.componentRef.setInput('priority', 3);
    fixture.detectChanges();
    expect(dock.registerSlot).toHaveBeenCalledWith(fixture.nativeElement, 3);
    fixture.destroy();
    expect(unregister).toHaveBeenCalled();
  });

  it('is at least 200px and square', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(VideoSlot);
    fixture.componentRef.setInput('priority', 2);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const style = getComputedStyle(fixture.nativeElement);
    expect(style.minWidth).toBe('200px');
    expect(style.aspectRatio).toBe('1 / 1');
    fixture.nativeElement.remove();
    TestBed.inject(VideoDockService).host.remove();
  });
});
