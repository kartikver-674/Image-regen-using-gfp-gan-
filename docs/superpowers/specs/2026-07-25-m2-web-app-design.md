# M2 — Web App — Design Spec

**Date:** 2026-07-25
**Status:** Approved (design), pending implementation plan
**Author:** kartikver-674
**Builds on:** M1 (smart engine + local FastAPI job API), merged to `main`.

## Summary

Build `web/` — a React frontend that consumes the existing local job API to
restore old photos and show a before/after result. The engine and API already
exist; this milestone is the demo-facing UI plus the one API change needed to
let a browser call it (CORS).

**Decisions locked in this brainstorm:**
- Stack: **React + Vite + TypeScript + Tailwind + `react-compare-slider`**;
  one extra dep, `react-router-dom`. TypeScript is used to type the API
  contract (cheap insurance against integration drift).
- Navigation/state: **React Router + plain React hooks** (no state library).
  Custom `usePollJob` and `useHistory` hooks; a small context to carry the
  selected `File` between routes.
- History: **localStorage metadata + server result URLs** (no image blobs).
- CORS: **add `CORSMiddleware` to the API** (the real cross-origin fix), rather
  than a dev-only Vite proxy. Frontend uses one code path: an env-configured
  API base URL, always prefixed onto the API's relative result URLs.

## Scope

**IN:** upload, options (auto + manual: model / fidelity / upscale), processing
with progress, before/after slider result, download, local gallery/history,
wired to the async job flow, CORS fix, dark/light theme.

**OUT (recorded, later milestones/fast-follows):** mobile app (M3), batch/album
(F1), real colorization wiring (F2 — a cosmetic toggle only), auth/cloud history
(F3), scratch inpainting (F4), IQA quality score (F5), Modal deployment.

## The API this consumes (already built, `api/restore_api/`)

Async job API. Restoration runs on CPU, ~30–60 s/image. Contract:

```
POST /jobs   (multipart/form-data)
  file:    <image>
  options: JSON string { mode:"auto"|"manual", model?:"gfpgan"|"codeformer",
                         fidelity?:0..1, upscale?:2|4, background_upscale?:bool }
  -> 202 { "job_id": "<uuid>" }

GET /jobs/{job_id}
  -> { status:"queued"|"running"|"done"|"error", error:str|null,
       result: null | { restored_url, faces[], analysis{...}, routing{...},
                        device, elapsed_s } }

GET /results/{job_id}/{path}     # static image files (incl. the original upload)
GET /healthz                     # { ok:true }
```

- `RestoreOptions` fields are exactly `mode, model, fidelity, upscale,
  background_upscale`. **There is no `colorize` field** — sending one 422s.
- Result URLs are **relative** (`/results/{id}/...`); prefix with the API base.
- The original upload is written untouched to `results/{id}/{filename}` and is
  served statically — this is the **"before"** image. (Downscaling for
  processing happens in-memory only; the on-disk original is full-res.)
- Upload cap: 25 MB (`MAX_UPLOAD_BYTES = 26214400`). Per-job timeout 300 s.

## Two honesty constraints (the Stitch mocks assume data the API does not give)

1. **No live rationale/analysis during processing.** `GET /jobs/{id}` returns
   only `queued|running|done|error` — `analysis` and `routing.rationale` arrive
   *only* in the `done` payload. Therefore:
   - The Processing step indicator ("Analyzing → Faces → Upscaling →
     Finishing") is **cosmetic / time-based**, not backed by real server stage
     events. Marked with a `ponytail:` comment; upgrade path is SSE/websocket
     streaming from the API later.
   - In **manual** mode the Processing screen may honestly echo the user's own
     choices ("Using CodeFormer, high fidelity"). The **real** rationale +
     analysis chips render on the **Result** screen once the job is `done`.
2. **No quality score.** W4's "Quality ↑ 62%" badge is dropped — IQA is F5, out
   of scope; fabricating a number is dishonest. The "What we did" chips are
   derived from the real `routing`/`analysis` payload only.

## CORS fix (do this first)

Add `fastapi.middleware.cors.CORSMiddleware` to
`api/restore_api/app.py:create_app`. Allowed origins from an env var
(`RESTORE_CORS_ORIGINS`, comma-separated), default `http://localhost:5173`. No
credentials (no auth in M2). Allow all methods/headers. Add a short API test
asserting the `Access-Control-Allow-Origin` header is present for the dev origin.

## Frontend structure

```
web/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js  postcss.config.js
├── tsconfig*.json
├── .env.example                 # VITE_API_BASE_URL=http://localhost:8000
└── src/
    ├── main.tsx                 # Router + ThemeProvider mount
    ├── App.tsx                  # <Routes>, shared layout/nav
    ├── api.ts                   # createJob(file, opts) · getJob(id) · resolveUrl(rel)
    ├── types.ts                 # Job, JobResult, Analysis, Routing, RestoreOptions, HistoryEntry
    ├── theme.tsx                # dark/light context, persisted in localStorage
    ├── UploadContext.tsx        # carries selected { file, previewUrl } across routes
    ├── hooks/
    │   ├── usePollJob.ts        # poll GET /jobs/{id} every ~1.2s until done|error
    │   └── useHistory.ts        # localStorage-backed gallery CRUD (add/remove/list)
    ├── routes/
    │   ├── Upload.tsx           # W1 — landing + drag/drop upload
    │   ├── Options.tsx          # W2 — auto/manual options
    │   ├── Processing.tsx       # W3 — cosmetic stepper + poll
    │   ├── Result.tsx           # W4 — before/after slider + chips + download
    │   └── Gallery.tsx          # W5 — grid from history
    ├── components/
    │   ├── UploadZone.tsx       # dashed drop target, file validation
    │   ├── BeforeAfter.tsx      # react-compare-slider wrapper w/ Before/After labels
    │   ├── StepIndicator.tsx    # 4-stage cosmetic progress
    │   ├── Chip.tsx  Chips.tsx  # "what we did" / analysis chips
    │   ├── AnalysisChips.tsx    # B&W / N faces / blur (from result.analysis)
    │   └── ThemeToggle.tsx
    └── index.css                # Tailwind + tokens + static grain layer + shimmer keyframes
```

## Data flow

1. **Upload (W1):** drag/drop or browse. Client-side validate: is an image and
   `≤ 25 MB` (server is the final authority — 413/422 surfaced as an error).
   Store `{ file, previewUrl: URL.createObjectURL(file) }` in `UploadContext`;
   navigate to `/options`.
2. **Options (W2):** show the preview (client object URL). Segmented
   **Auto / Manual**. Manual reveals: two model cards (GFPGAN "natural" /
   CodeFormer "robust"); a **Fidelity** slider (Natural↔Faithful) enabled only
   for CodeFormer; a **2× / 4× Upscale** segmented control. A **Colorize**
   toggle is present but **cosmetic** — disabled with a "B&W detected —
   colorization coming soon (F2)" hint; it is **never** included in the options
   payload. On "Restore photo": build `RestoreOptions`, `POST /jobs` with
   `options` as a **JSON string** in the multipart form; navigate to
   `/processing/:jobId`. (No analysis chips here — analysis is not available
   pre-restore.)
3. **Processing (W3):** `usePollJob(jobId)` polls every ~1.2 s. Show the dimmed
   preview with a CSS shimmer sweep, the cosmetic 4-stage stepper, and (manual
   mode) the user's chosen config as status text. On `error` show the message +
   a "Try again" link. On `done`: save a `HistoryEntry` and navigate to
   `/result/:jobId`.
4. **Result (W4):** load the entry from history by `jobId`. `BeforeAfter`
   slider: before = `resolveUrl(/results/{jobId}/{name})`, after =
   `resolveUrl(result.restored_url)` (top-level field, not under `routing`).
   A filename bar above; below, "What we
   did" chips from `routing`/`analysis` and the `routing.rationale` sentence.
   Actions: **Download** (fetch after-image blob → object URL → `<a download>`;
   cross-origin `<a download>` alone is unreliable), **Restore again** (→
   `/`), the entry is already saved (no separate "save to gallery" needed;
   surface "View in gallery" instead).
5. **Gallery (W5):** grid from `useHistory().list()`. Each card: restored
   thumbnail, filename, date, model chips. Empty state with static grain + a
   "Restore your first photo" CTA. Click → `/result/:jobId`.

## localStorage schema

Key `restory.history` → JSON array, newest first:

```ts
type HistoryEntry = {
  jobId: string
  name: string          // uploaded filename (basename)
  date: string          // ISO, stamped client-side at save
  beforeUrl: string     // relative: /results/{jobId}/{name}
  afterUrl: string      // relative: result.restored_url
  analysis: Analysis
  routing: Routing
  elapsedS: number
  device: string
}
```

**Relative** URLs are stored and resolved with the API base at render time (so
changing `VITE_API_BASE_URL` doesn't invalidate history). No image blobs.
**Ceiling (`ponytail:`):** entries break if the API's `results/` dir is wiped —
acceptable for a local single-user tool; cross-device/persistent history is F3.

## Design system (implement from the Stitch reference)

- Dark-first: charcoal `#0F0F12` bg, soft off-white text. Light: cream
  `#FAF6EF`, near-black text. Theme toggle persisted; default dark.
- Amber `#E8A33D` accent — primary actions / key highlights only, never large
  fills. Success green, error coral, graphite secondary text.
- Fraunces (serif) for wordmark + headlines; Inter for all UI text (Google
  Fonts `<link>`, zero dep).
- Rounded (16–20px cards, pill buttons), soft shadows, roomy spacing, thin line
  icons.
- **Texture policy:** subtle *static* film grain only on Upload + empty Gallery
  (no photo shown). Never over photos. Processing uses a lightweight CSS shimmer
  sweep. **No WebGL / animated shaders anywhere.**
- Signature component: the before/after comparison slider (draggable vertical
  handle, corner Before/After labels).
- Accessible contrast in both themes; keyboard-operable controls; `alt` text.

Stitch project "Restory Design System Web": create the design system, then
generate W1→W4→W3→W2→W5 as a **visual reference** to implement in React (Stitch
output is not shipped as-is).

## Testing

- **One vitest file** over the pure money-path helpers where a contract
  mismatch silently breaks everything: `resolveUrl` (relative→absolute),
  the options-JSON builder (auto vs manual; never emits `colorize`), and
  `useHistory` add/dedupe/list. No component/E2E test framework.
- **Primary verification: a real end-to-end run** — start the API, run the web
  app (`npm run dev`), upload a real photo, watch it poll, confirm the
  before/after slider, chips, rationale, download, and that the gallery persists
  across reload. This is the acceptance gate before claiming done.

## New / changed files

```
api/restore_api/app.py                 (+ CORSMiddleware, env origins)
api/tests/test_api.py                  (+ CORS header assertion)
web/**                                 (new — structure above)
docs/design/stitch-prompts.md          (unchanged; source of screen prompts)
```

## Risks

1. **Slider alignment** — after-image is upscaled (2×/4×) vs full-res before;
   uniform scale preserves aspect, so the slider (which scales both to the
   container) aligns. Confirmed against pipeline resize logic.
2. **CPU latency** — 30–60 s/image; the poll UI + timeout handling cover it. A
   long job that hits the 300 s server timeout surfaces as an `error` status.
3. **HEIC** — browsers may not preview HEIC and the server's OpenCV read may not
   decode it. Accept jpg/png as the reliable path; HEIC is best-effort (server
   error surfaced). Copy says "JPG, PNG".
```
