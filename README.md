# Portfolio Tool

A timeline-based portfolio planner for museum exhibition and gallery
redevelopment projects. Built for the Royal Alberta Museum to plan, schedule,
and print-share long-range project portfolios across multiple galleries.

## What it does

- **Multi-lane timeline.** Each gallery is its own swimlane. Projects sit on
  collision-free tracks within their lane so overlapping work stacks cleanly.
- **Two gallery types.**
  - *Temporary* lanes hold normal start/end exhibitions.
  - *Permanent* lanes (e.g. Natural History South) are amber-tinted in the
    sidebar and default new projects to **completion-milestone** mode — a
    single red diamond marker rather than a date range.
- **Phased project bars.** Each project shows its preparation phases (Idea →
  Content → Design → Implementation) flowing into the active window, with an
  optional post-phase (e.g. Deinstall). Phase labels sit above their bars and
  dependency arrows trace the handoffs between them.
- **Location milestones.** Double-click any gallery's milestone row to drop
  a diamond or flag marker (e.g. board reviews, openings, holidays). Labels
  auto-stagger above and below to avoid collisions. Galleries with no
  location milestones automatically collapse the row to a thin divider so
  empty rows don't take vertical space.
- **Per-project milestones.** Each project carries its own milestone list,
  rendered inline beneath the project bar on its own track (icon + label).
  Edit them in the Detail panel's **Project Milestones** section using the
  same six-icon, seven-color palette as gallery milestones.
- **Search + status filter.** Filter projects by title/ID/description and
  by status (Proposed / In Development / Open to Public / Closed).
- **Direct manipulation.**
  - *Long-press drag* (400 ms) on a project bar to move it.
  - *Edge drag* on a project bar's left/right edge to reschedule
    start/end dates.
  - *Edge drag* on the right edge of any phase bar to resize that phase's
    duration. Subsequent phases reflow live during the drag.
  - At the 1-year preset and tighter zooms, dotted weekly grid lines appear
    and drags snap to the nearest Monday. Hold **Alt** while dragging to
    disable weekly snapping.
- **Collapsible lanes.** Click the chevron beside any gallery name to
  collapse it to a thin header strip — useful for focusing on one or two
  active galleries without the others taking vertical space. A toolbar
  button collapses or expands all lanes at once. Collapse state is
  session-scoped (resets on reload) and is preserved in print output, so
  printed plans show only the lanes you currently have open.

## Print

Designed around **11×17 landscape** ledger paper by default, with a print
options dialog for audience-specific output.

- The toolbar print button opens profile-based print options instead of
  immediately invoking the browser dialog. Built-in profiles cover executive
  summary, project-team detail, and gallery-operations handoff views.
- Print profiles can choose ledger or letter sizing, landscape or portrait
  orientation, included statuses, lane behavior (current collapsed state,
  expand all, or selected lanes only), and whether to include summary/legend
  aids.
- The portfolio shell is auto-scaled in the `beforeprint` handler using a
  shared print layout utility so the full timeline fits on one page when
  possible.
- A **preferred readable scale of 0.75** is disclosed in the UI, while a hard
  **minimum scale of 0.4** allows one-page exports when explicitly requested.
  If the output drops below the preferred threshold, the print header includes
  a readable-scale warning.
- Print color is forced on (`print-color-adjust: exact`) so phase fills,
  status colors, and gallery accents render in hard copy.
- A print-only header strip appears above the timeline showing the
  organisation name, selected profile, generated timestamp, date range,
  project count, visible/collapsed lanes, status filters, paper profile,
  optional summary counts, and optional phase/status legends.

## Settings

A second tab covers organisation-level configuration:

- **Organization name** (rendered in the header).
- **Phase types** — colour + label for each phase, plus the active-window and
  post-phase markers used by the timeline renderer.
- **Locations & galleries** — add, rename, set TEMP vs PERM, and remove. The
  PERM toggle determines whether new projects in that lane default to
  milestone mode and whether the lane gets the amber permanent-redevelopment
  styling.

## Sync

Optional cross-device persistence via **GitHub Gist** using a personal access
token (PAT). Without sync, all data stays in the browser's `localStorage`
under the keys defined in `src/constants.ts`.

## Stack

- **React 19** + **TypeScript**
- **Vite 6** build / dev server
- **Zustand** for state
- **Tailwind CSS** (via CDN in `index.html`)
- **Lucide React** for icons
- No animation library — interactions use plain CSS transitions for a
  faster, calmer feel that prints predictably.

## Project layout

```
index.html                 Vite entry; loads Tailwind via CDN
index.tsx                  App shell, header, timeline rendering, settings tab
index.css                  Print-only stylesheet (page size, scale, overflow)
src/
  constants.ts             Storage keys, layout constants, status styles,
                           Alberta statutory-holiday helper
  types.ts                 Exhibition, Gallery, PhaseType, LocationMilestone
  store/useStore.ts        Zustand store
  hooks/
    useMuseumSync.ts       LocalStorage <-> Gist sync, schema migration
    useMuseumActions.ts    CRUD helpers (gallery rename, project duplicate,…)
  lib/
    dateUtils.ts           Date <-> ISO conversion, timeline positioning
    layoutEngine.ts        Collision-free track allocation per lane
    githubGist.ts          Gist read/write
  components/
    DetailPanel.tsx        Right-side project editor (status, dates, phases)
    GithubAuthModal.tsx    PAT entry + gist linking
```

## Running locally

```sh
npm install
npm run dev
```

## Deploying

A GitHub Actions workflow (`deploy.yml`) builds and publishes to GitHub
Pages. The Vite `base` is set to the repository name so asset paths resolve
correctly under the Pages subpath.
