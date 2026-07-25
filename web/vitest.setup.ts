import { afterEach } from 'vitest'

// vitest 4 + jsdom (Node 26) does not expose a Web Storage `localStorage`
// global, so provide a minimal in-memory one for tests.
class MemStorage {
  private store: Record<string, string> = {}
  get length() { return Object.keys(this.store).length }
  getItem(k: string) { return this.store[k] ?? null }
  setItem(k: string, v: string) { this.store[k] = String(v) }
  removeItem(k: string) { delete this.store[k] }
  clear() { this.store = {} }
  key(i: number) { return Object.keys(this.store)[i] ?? null }
}
globalThis.localStorage = new MemStorage() as unknown as Storage

afterEach(() => localStorage.clear())
