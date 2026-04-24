// Node.js v22+ has experimental localStorage that exists but is broken when
// --localstorage-file is not provided a valid path. Patch it for safe SSR.
export async function register() {
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem !== 'function') {
    const store = new Map<string, string>();
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, String(value)),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
        get length() {
          return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
      },
      writable: true,
      configurable: true,
    });
  }
}
