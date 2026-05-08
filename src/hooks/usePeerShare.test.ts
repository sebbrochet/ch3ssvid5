import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePeerShare, usePeerReceive } from './usePeerShare';

describe('usePeerShare', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => usePeerShare());
    expect(result.current.shareStatus).toBe('idle');
    expect(result.current.shareCode).toBe('');
    expect(result.current.shareError).toBe('');
  });

  it('generates a 4-digit code when sharing starts', () => {
    const { result } = renderHook(() => usePeerShare());
    act(() => {
      result.current.startSharing({ name: 'Test', pgn: '1. e4 *' });
    });
    expect(result.current.shareCode).toMatch(/^\d{4}$/);
    expect(result.current.shareStatus).toBe('waiting');
    // Cleanup
    act(() => {
      result.current.stopSharing();
    });
  });

  it('generates different codes on each share', () => {
    const { result } = renderHook(() => usePeerShare());
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.startSharing({ name: 'Test', pgn: '1. e4 *' });
      });
      codes.add(result.current.shareCode);
      act(() => {
        result.current.stopSharing();
      });
    }
    // At least some codes should be different (probabilistic but very likely)
    expect(codes.size).toBeGreaterThan(1);
  });

  it('resets state when sharing is stopped', () => {
    const { result } = renderHook(() => usePeerShare());
    act(() => {
      result.current.startSharing({ name: 'Test', pgn: '1. e4 *' });
    });
    expect(result.current.shareStatus).toBe('waiting');
    act(() => {
      result.current.stopSharing();
    });
    expect(result.current.shareStatus).toBe('idle');
    expect(result.current.shareCode).toBe('');
  });
});

describe('usePeerReceive', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => usePeerReceive());
    expect(result.current.receiveStatus).toBe('idle');
    expect(result.current.receiveError).toBe('');
    expect(result.current.receivedData).toBeNull();
  });

  it('transitions to connecting state when code is submitted', () => {
    const { result } = renderHook(() => usePeerReceive());
    act(() => {
      result.current.connectToCode('1234');
    });
    expect(result.current.receiveStatus).toBe('connecting');
    // Cleanup
    act(() => {
      result.current.cancelReceive();
    });
  });

  it('resets state when cancelled', () => {
    const { result } = renderHook(() => usePeerReceive());
    act(() => {
      result.current.connectToCode('1234');
    });
    act(() => {
      result.current.cancelReceive();
    });
    expect(result.current.receiveStatus).toBe('idle');
    expect(result.current.receiveError).toBe('');
    expect(result.current.receivedData).toBeNull();
  });
});
