import { useState } from 'react'
import { addEntry, loadHistory, removeEntry } from '../historyStore'
import type { HistoryEntry } from '../types'

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory)
  return {
    entries,
    add: (e: HistoryEntry) => setEntries(addEntry(e)),
    remove: (jobId: string) => setEntries(removeEntry(jobId)),
  }
}
