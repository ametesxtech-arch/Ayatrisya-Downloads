import { useState, useEffect, useCallback } from 'react';

// In-memory isolated store keyed by blockId
const blockStateStore = new Map<string, unknown>();
const listeners = new Map<string, Set<(val: unknown) => void>>();

export function getInteractiveBlockState<T>(blockId: string, defaultValue: T): T {
  if (!blockStateStore.has(blockId)) {
    blockStateStore.set(blockId, defaultValue);
  }
  return blockStateStore.get(blockId) as T;
}

export function setInteractiveBlockState<T>(blockId: string, nextValue: T | ((prev: T) => T)): void {
  const prev = blockStateStore.get(blockId) as T;
  const resolved = typeof nextValue === 'function' ? (nextValue as (prev: T) => T)(prev) : nextValue;
  blockStateStore.set(blockId, resolved);

  const set = listeners.get(blockId);
  if (set) {
    for (const listener of set) {
      try {
        listener(resolved);
      } catch {}
    }
  }
}

/**
 * React hook to access and mutate state for a specific interactive block.
 * Retains user selections and submissions even when messages list rerenders.
 */
export function useInteractiveBlockState<T>(
  blockId: string,
  defaultValue: T
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(() => getInteractiveBlockState<T>(blockId, defaultValue));

  useEffect(() => {
    let set = listeners.get(blockId);
    if (!set) {
      set = new Set();
      listeners.set(blockId, set);
    }
    const listener = (val: unknown) => setState(val as T);
    set.add(listener);

    // Sync in case store changed before mount
    const current = getInteractiveBlockState<T>(blockId, defaultValue);
    setState(current);

    return () => {
      set?.delete(listener);
      if (set?.size === 0) listeners.delete(blockId);
    };
  }, [blockId, defaultValue]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setInteractiveBlockState<T>(blockId, next);
    },
    [blockId]
  );

  const reset = useCallback(() => {
    setInteractiveBlockState<T>(blockId, defaultValue);
  }, [blockId, defaultValue]);

  return [state, update, reset];
}

/**
 * Resets all interactive state (e.g. on new chat or full clear)
 */
export function clearAllInteractiveBlockStates(): void {
  blockStateStore.clear();
  listeners.clear();
}
