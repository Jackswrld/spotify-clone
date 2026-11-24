import { exactKey, normalise } from './title';

describe('title keys', () => {
  it('normalise keeps non-Latin letters and drops accents, brackets and feat.', () => {
    expect(normalise('夜に駆ける')).toBe('夜に駆ける');
    expect(normalise('Кино')).toBe('кино');
    expect(normalise('Béyoncé')).toBe('beyonce');
    expect(normalise('Calm Down (feat. Selena Gomez) [Remix]')).toBe('calm down');
  });

  it('exactKey keeps non-Latin letters and only drops feat.', () => {
    expect(exactKey('좋은 날')).toBe('좋은 날');
    expect(exactKey('Calm Down (Remix)')).not.toBe(exactKey('Calm Down'));
    expect(exactKey('Calm Down (feat. Selena Gomez)')).toBe(exactKey('calm down'));
  });
});
