import { gradientFor } from './gradient';

describe('gradientFor', () => {
  it('is deterministic and differs by seed', () => {
    expect(gradientFor('abc')).toBe(gradientFor('abc'));
    expect(gradientFor('abc')).not.toBe(gradientFor('abd'));
    expect(gradientFor('abc')).toMatch(/^linear-gradient\(135deg, hsl\(/);
  });

  it('handles an empty seed', () => {
    expect(gradientFor('')).toMatch(/^linear-gradient\(135deg, hsl\(/);
  });
});
