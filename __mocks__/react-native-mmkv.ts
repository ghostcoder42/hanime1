/**
 * In-memory mock of react-native-mmkv for Jest (the native module can't load
 * under node/jsdom). Persists for the lifetime of the module so storage.ts
 * reads/writes work in store tests.
 */
const store: Record<string, string> = {};

const instance = {
  getString: (key: string) => (key in store ? store[key] : undefined),
  getNumber: (key: string) => (key in store ? Number(store[key]) : undefined),
  getBoolean: (key: string) => (key in store ? store[key] === 'true' : undefined),
  set: (key: string, value: string | number | boolean) => {
    store[key] = String(value);
  },
  delete: (key: string) => {
    delete store[key];
  },
  contains: (key: string) => key in store,
  getAllKeys: () => Object.keys(store),
  clearAll: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
};

export const createMMKV = () => instance;

export const useMMKVString = () => ['', jest.fn()];
export const useMMKVBoolean = () => [false, jest.fn()];
export const useMMKVNumber = () => [0, jest.fn()];

export const __store = store;
