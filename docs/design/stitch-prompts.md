# Stitch UI Prompts — Restory (old photo restoration)

Reusable prompts for generating the UI in **Google Stitch** (via the Stitch MCP
or the web app). Working product name: **Restory** (restore + story) — swap freely.

**How to use:** create/apply the **Design System** (below) first so every screen
shares one look, then run each screen prompt with `generate_screen_from_text`.
Each screen prompt is self-contained (it restates the style) so it also works
standalone if you skip the design system.

Platforms: **Web** prompts target desktop/responsive web; **Mobile** prompts
target a phone app (React Native).

---

## Design System prompt

> Design system for **Restory**, a premium AI photo-restoration app that brings
> old, damaged, and faded photographs back to life. Mood: warm, trustworthy,
> nostalgic-meets-modern — a "digital photo studio" where the user's photo is
> always the hero and the UI chrome stays quiet.
>
> **Theme:** dark-canvas first (deep graphite / near-black backgrounds so photos
> pop), with a matching light mode on warm off-white/cream surfaces. Support both.
>
> **Colors:** primary accent warm amber/gold (~#E8A33D) evoking sepia and warmth;
> backgrounds deep charcoal (~#0F0F12) in dark / warm cream (~#FAF6EF) in light;
> text soft off-white in dark / near-black in light; success green, error coral,
> muted graphite for secondary text. Use amber only for primary actions and key
> highlights — never as large fills.
>
> **Typography:** a characterful serif display for the wordmark and big headlines
> (e.g. Fraunces); a clean neutral sans for all UI text (e.g. Inter). Generous
> headline sizes, comfortable body line-height.
>
> **Shape & feel:** generously rounded corners (16–20px on cards, pill buttons),
> soft diffused shadows, subtle film-grain texture on large surfaces, roomy
> spacing. Thin, rounded line icons.
>
> **Signature component:** a before/after image comparison slider with a draggable
> vertical handle and small "Before"/"After" labels in opposite corners.
>
> Accessible contrast in both themes; large tap targets on mobile.

---

## Web screens

### W1 — Landing / Upload (home)
> Desktop web landing page for **Restory**, an AI old-photo restoration tool.
> Dark warm graphite background with subtle film grain. Top: minimal transparent
> nav bar — serif wordmark "Restory" on the left; "How it works" and "Gallery"
> links plus a small light/dark theme toggle on the right. Center hero: a large
> serif headline "Bring old photos back to life", a one-line sans subhead beneath
> it, then a big prominent drag-and-drop upload zone — rounded dashed amber-tinted
> border, cloud-upload icon, text "Drag a photo here, or click to browse", and a
> small "JPG, PNG, HEIC · up to 20 MB" note. Below the upload zone, a single row
> of three small rounded before/after example thumbnails as social proof. Quiet
> minimal footer. Amber accent reserved for the upload icon and the browse action.

### W2 — Restore options / configure
> Desktop web configuration screen for Restory, shown after a photo is selected.
> Two-column layout on a dark warm background. Left column: a large rounded
> preview of the selected photo with a small floating "Analysis" chip row
> overlaid on top ("B&W", "2 faces", "Heavy blur"). Right column: an options
> panel in a rounded card — a segmented toggle at top "Auto (recommended) /
> Manual"; when Manual is active show: two selectable model cards side by side
> ("GFPGAN — natural" and "CodeFormer — robust"), a "Fidelity" slider labelled
> "Natural ← → Faithful", an "Upscale" segmented control (2× / 4×), and a
> "Colorize" toggle with a subtle "B&W detected" hint. Auto-chosen values appear
> pre-filled. A large amber pill primary button "Restore photo" at the bottom of
> the panel, with a secondary "Choose a different photo" text link.

### W3 — Processing
> Desktop web processing screen for Restory. Centered rounded card on a dark warm
> canvas. The input photo is shown dimmed with an animated shimmer/scan-line
> overlay sweeping across it. Below the image, a horizontal step indicator with
> four stages — "Analyzing", "Restoring faces", "Upscaling", "Finishing" — the
> current step highlighted in amber with a slim progress bar. One line of live
> status text underneath ("Detected 2 faces · using CodeFormer at high fidelity").
> A small "~15s remaining" estimate and a quiet "Cancel" text link. Calm, minimal.

### W4 — Result (hero screen)
> Desktop web result screen for Restory — the centerpiece. A large full-width
> before/after image comparison slider with a draggable vertical handle and small
> "Before"/"After" labels in opposite corners, on a dark warm background. A
> compact bar above the slider shows the filename on the left and a quality badge
> chip on the right ("Quality ↑ 62%"). Below the slider, a "What we did" row of
> small chips (e.g. "Face restoration", "CodeFormer", "Upscaled 4×", "Colorized").
> An action row: a primary amber pill "Download", a secondary outline "Restore
> again", and a tertiary text "Save to gallery". A subtle zoom control on the
> comparison. Elegant, image-forward.

### W5 — Gallery / History
> Desktop web gallery screen for Restory. A responsive grid (masonry-style) of
> past restorations on a dark warm background. Each card shows the restored photo
> thumbnail with rounded corners, the filename, a small date, and tiny chips for
> the models used; on hover the card reveals a quick before/after peek. Top bar:
> serif title "Your restorations", a search field, and a sort dropdown. Friendly
> empty-state illustration and "Restore your first photo" call-to-action when the
> gallery is empty. Clicking a card opens the result view.

### W6 — Batch / album queue  *(fast-follow F1, optional)*
> Desktop web batch-processing queue for Restory. A responsive grid of uploaded
> photo cards on a dark warm background; each card shows a thumbnail with a
> circular status ring — queued (grey), processing (animated amber), done (green
> check), or failed (coral) — and a mini progress bar. A summary bar pinned at the
> top: "12 photos · 8 done · 3 processing · 1 failed" with an overall progress
> bar and a primary "Download all (.zip)" button. Failed cards show a small
> "Retry" action. Clean, scannable, status-first.

---

## Mobile screens (React Native app)

### M1 — Home / capture
> Mobile app home screen for Restory, an AI old-photo restoration app. Dark warm
> graphite background with subtle grain. Top app bar: serif wordmark "Restory"
> left, a small settings/profile icon right. Center: two large rounded action
> cards stacked or side by side — "Take a photo" (camera icon) and "Choose from
> gallery" (image icon), the primary one accented in amber. Below: a horizontally
> scrollable "Recent" strip of past restoration thumbnails with a "See all" link.
> A bottom tab bar with three items: Home, Gallery, Settings. Large tap targets.

### M2 — Options (bottom sheet)
> Mobile app restore-options screen for Restory. The selected photo fills the top
> two-thirds of the screen on a dark background. A rounded bottom sheet slides up
> over it containing: a small "Analysis" chip row ("B&W", "2 faces", "Heavy
> blur"); a segmented "Auto (recommended) / Manual" control; when Manual, two
> compact model cards ("GFPGAN — natural", "CodeFormer — robust"), a "Fidelity"
> slider (Natural ↔ Faithful), an "Upscale" segmented control (2× / 4×), and a
> "Colorize" toggle with a "B&W detected" hint. A full-width amber pill "Restore"
> button pinned to the bottom of the sheet. Thumb-friendly spacing.

### M3 — Processing
> Mobile app processing screen for Restory. Full-screen: the input photo with an
> animated shimmer/scan overlay. Centered, a circular progress indicator in amber;
> beneath the image a compact stage stepper — "Analyzing → Faces → Upscale →
> Finishing" — current step highlighted. A single line of live status text
> ("Using CodeFormer at high fidelity"), a small "~15s" estimate, and a quiet
> "Cancel" link. Calm and focused.

### M4 — Result
> Mobile app result screen for Restory. A large before/after image comparison
> slider fills most of the screen (draggable handle, "Before"/"After" corner
> labels), on a dark warm background. A collapsible "What we did" chip row near
> the top ("CodeFormer", "4×", "Colorized") and a quality badge. A bottom action
> bar with three large icon buttons: "Save" (to camera roll), "Share", and
> "Restore again". Swipe-down-to-dismiss affordance at the top. Image-forward,
> minimal chrome.

### M5 — Gallery
> Mobile app gallery screen for Restory. A two-column grid of restored photo
> thumbnails with rounded corners and a small date label on a dark warm
> background. Top bar with serif title "Your photos". Tapping a thumbnail opens
> the result view. Pull-to-refresh. Friendly empty state with a "Restore your
> first photo" button. Bottom tab bar (Home, Gallery, Settings) with Gallery
> active.

---

## Running these with the Stitch MCP (later)

1. `create_project` → a project for Restory.
2. `create_design_system` (or `create_design_system_from_design_md`) → paste the
   **Design System prompt** above.
3. `generate_screen_from_text` once per screen prompt (W1–W6, M1–M5), passing the
   project + design system so screens share styling.
4. `generate_variants` on the hero screens (W1, W4, M4) to explore alternatives.
5. Export to code/Figma when you're happy; feed into the `web/` and `mobile/`
   builds during M2/M3.

**Priority order to generate:** W1 → W4 → W3 → W2 → W5 (web core), then
M1 → M4 → M3 → M2 → M5 (mobile core). W6 only when building batch (F1).
