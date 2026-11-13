import { describe, expect, it } from 'vitest';
import { formatShortDuration } from './time';

describe('formatShortDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [60, '1m'],
    [90, '1m 30s'],
    [3600, '1h'],
    [3900, '1h 5m'],
  ])('%i -> %s', (s, text) => {
    expect(formatShortDuration(s)).toBe(text);
  });
});
