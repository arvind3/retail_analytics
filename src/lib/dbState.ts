import { useSyncExternalStore } from 'react';

export type DbStatus = 'idle' | 'loading' | 'ready' | 'error';

export type DbState = {
  status: DbStatus;
  message?: string;
  loadedTables: string[];
  loadedBytes: number;
  totalBytes: number;
  lastQueryMs?: number;
  lastRowCount?: number;
  lastScannedRows?: number | null;
  memoryBytes?: number | null;
};

let state: DbState = {
  status: 'idle',
  loadedTables: [],
  loadedBytes: 0,
  totalBytes: 0,
  lastScannedRows: null,
  memoryBytes: null
};

const listeners = new Set<() => void>();

export const setDbState = (partial: Partial<DbState>) => {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
};

export const getDbState = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useDbState = () => useSyncExternalStore(subscribe, getDbState, getDbState);
