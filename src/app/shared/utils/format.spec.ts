import { formatCount, formatTime } from './format';

describe('formatTime', () => {
  it('formats seconds as m:ss and h:mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(61.9)).toBe('1:01');
    expect(formatTime(3725)).toBe('1:02:05');
  });

  it('returns 0:00 for NaN and negatives', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('formatCount', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1500)).toBe('1.5K');
    expect(formatCount(2_300_000)).toBe('2.3M');
    expect(formatCount(1000)).toBe('1K');
  });
});
