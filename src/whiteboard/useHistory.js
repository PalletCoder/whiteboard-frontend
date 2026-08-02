import { useCallback, useRef, useState } from 'react';

const clone = (elements) => JSON.parse(JSON.stringify(elements));

/**
 * Undo/redo for the scene. The page records a committed snapshot after every
 * meaningful change; undo/redo return the snapshot to apply (or null).
 */
export function useHistory(initial = []) {
  const past = useRef([clone(initial)]);
  const future = useRef([]);
  const [, bump] = useState(0);
  const refresh = () => bump((v) => v + 1);

  const record = useCallback((snapshot) => {
    const last = past.current[past.current.length - 1];
    const next = clone(snapshot);
    if (JSON.stringify(last) === JSON.stringify(next)) return;
    past.current.push(next);
    if (past.current.length > 200) past.current.shift();
    future.current = [];
    refresh();
  }, []);

  const undo = useCallback(() => {
    if (past.current.length <= 1) return null;
    const current = past.current.pop();
    future.current.push(current);
    refresh();
    return clone(past.current[past.current.length - 1]);
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return null;
    const next = future.current.pop();
    past.current.push(next);
    refresh();
    return clone(next);
  }, []);

  const reset = useCallback((snapshot) => {
    past.current = [clone(snapshot)];
    future.current = [];
    refresh();
  }, []);

  return {
    record,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 1,
    canRedo: future.current.length > 0,
  };
}
