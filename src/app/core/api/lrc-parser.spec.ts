import { parseLrc } from './lrc-parser';

describe('parseLrc', () => {
  it('parses mm:ss.xx and mm:ss', () => {
    expect(parseLrc('[00:35.66] Look at the stars\n[01:02]Next')).toEqual([
      { time: 35.66, text: 'Look at the stars' },
      { time: 62, text: 'Next' },
    ]);
  });

  it('expands multiple timestamps on one line and sorts', () => {
    expect(parseLrc('[00:20.00]Chorus\n[00:10.00][00:30.00]Hook')).toEqual([
      { time: 10, text: 'Hook' },
      { time: 20, text: 'Chorus' },
      { time: 30, text: 'Hook' },
    ]);
  });

  it('ignores metadata tags and blank input', () => {
    expect(parseLrc('[ar:Coldplay]\n[ti:Yellow]\n[00:01.00]Look')).toEqual([{ time: 1, text: 'Look' }]);
    expect(parseLrc('')).toEqual([]);
    expect(parseLrc(null)).toEqual([]);
  });

  it('keeps empty-text lines as instrumental breaks', () => {
    expect(parseLrc('[00:05.00]\n[00:06.50]Go')).toEqual([
      { time: 5, text: '' },
      { time: 6.5, text: 'Go' },
    ]);
  });

  it('handles Windows line endings and three-digit fractions', () => {
    expect(parseLrc('[00:01.123]A\r\n[00:02.5]B')).toEqual([
      { time: 1.123, text: 'A' },
      { time: 2.5, text: 'B' },
    ]);
  });
});
