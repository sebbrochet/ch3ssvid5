import { describe, it, expect } from 'vitest';
import { resolveEvalDisplay } from './evalDisplay';

describe('resolveEvalDisplay', () => {
  it('returns undefined when no stored eval', () => {
    expect(resolveEvalDisplay(false, undefined, undefined)).toBeUndefined();
  });

  it('returns stored eval', () => {
    expect(resolveEvalDisplay(false, undefined, '0.54')).toBe('0.54');
  });

  it('returns stored eval even with live engine eval', () => {
    expect(resolveEvalDisplay(true, '-1.2', '0.54')).toBe('0.54');
  });

  it('returns stored eval when engine is enabled', () => {
    expect(resolveEvalDisplay(true, '-1.2', '0.54')).toBe('0.54');
  });

  it('returns undefined when engine has eval but no stored eval', () => {
    expect(resolveEvalDisplay(true, '-1.2', undefined)).toBeUndefined();
  });

  it('returns undefined when no eval available', () => {
    expect(resolveEvalDisplay(true, undefined, undefined)).toBeUndefined();
  });
});
