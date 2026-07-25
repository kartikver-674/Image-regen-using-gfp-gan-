import { useEffect, useState } from 'react'
import { getJob } from '../api'
import type { JobStatus } from '../types'

// ponytail: fixed 1.2s client poll — the API exposes no push/SSE, so this is the
// only progress signal. Upgrade to SSE/websocket streaming if sub-stage progress matters.
export function usePollJob(jobId: string | null) {
  const [state, setState] = useState<JobStatus>({ status: 'queued', error: null, result: null })
  useEffect(() => {
    if (!jobId) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const s = await getJob(jobId)
        if (!alive) return
        setState(s)
        if (s.status === 'done' || s.status === 'error') return
      } catch (e) {
        if (!alive) return
        setState({ status: 'error', error: String(e), result: null }); return
      }
      timer = setTimeout(tick, 1200)
    }
    tick()
    return () => { alive = false; clearTimeout(timer) }
  }, [jobId])
  return state
}
