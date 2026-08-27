import "@testing-library/jest-dom/vitest";

/**
 * Node >= 22 exposes an experimental built-in `localStorage` that shadows the
 * jsdom Storage object under Vitest and is missing standard methods like
 * `clear`. Replace it with an in-memory spec-compliant polyfill so storage
 * behaviour is identical across Node versions.
 */
const nativeStorage = globalThis.localStorage as Storage | undefined;
if (!nativeStorage || typeof nativeStorage.clear !== "function") {
  class MemoryStorage implements Storage {
    private map = new Map<string, string>();
    get length() {
      return this.map.size;
    }
    key(index: number): string | null {
      return Array.from(this.map.keys())[index] ?? null;
    }
    getItem(key: string): string | null {
      return this.map.has(key) ? (this.map.get(key) as string) : null;
    }
    setItem(key: string, value: string) {
      this.map.set(key, String(value));
    }
    removeItem(key: string) {
      this.map.delete(key);
    }
    clear() {
      this.map.clear();
    }
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
