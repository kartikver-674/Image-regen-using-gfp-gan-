import type { HistoryEntry } from './types'

const KEY = 'restory.history'

export function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function save(list: HistoryEntry[]) { localStorage.setItem(KEY, JSON.stringify(list)) }

export function addEntry(e: HistoryEntry): HistoryEntry[] {
  const list = [e, ...loadHistory().filter(x => x.jobId !== e.jobId)]
  save(list); return list
}
export function removeEntry(jobId: string): HistoryEntry[] {
  const list = loadHistory().filter(x => x.jobId !== jobId)
  save(list); return list
}
