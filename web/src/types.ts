export type Analysis = {
  is_grayscale: boolean; blur_score: number; width: number; height: number;
  n_faces: number; min_face_size: number | null
}
export type Routing = {
  model_used: string; fidelity: number | null; upscale: number;
  background_upscale: boolean; rationale: string
  refine_model?: string | null; refine_fidelity?: number | null
}
export type JobResult = {
  restored_url: string
  faces: { index: number; cropped_url: string; restored_url: string; comparison_url: string }[]
  analysis: Analysis; routing: Routing; device: string; elapsed_s: number
}
export type JobStatus = {
  status: 'queued' | 'running' | 'done' | 'error'
  error: string | null
  result: JobResult | null
}
export type RestoreOptions = {
  mode: 'auto' | 'manual'
  model?: 'gfpgan' | 'codeformer' | 'hybrid'
  fidelity?: number
  upscale?: 2 | 4
  background_upscale?: boolean
}
export type HistoryEntry = {
  jobId: string; name: string; date: string
  beforeUrl: string; afterUrl: string
  analysis: Analysis; routing: Routing; elapsedS: number; device: string
}
