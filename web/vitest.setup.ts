import { expect, afterEach } from 'vitest'

// jsdom should provide localStorage, but ensure it's available
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {}
  global.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const key in store) delete store[key] },
    key: (index: number) => Object.keys(store)[index] || null,
    length: Object.keys(store).length,
  } as any
}

afterEach(() => {
  localStorage.clear()
})
