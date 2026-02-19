import { describe, expect, it } from 'vitest';
import { formatBytes, formatCurrency, formatDurationMs, formatNumber } from '../../src/lib/format';

describe('format helpers', () => {
  it('formats numbers', () => {
    expect(formatNumber(1200)).toBe('1,200');
  });

  it('formats currency', () => {
    expect(formatCurrency(2500)).toContain('$');
  });

  it('formats bytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('formats durations', () => {
    expect(formatDurationMs(250)).toBe('250 ms');
  });
});
