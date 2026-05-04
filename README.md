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
  auto-stagger above and below to avoid collisions.
- **Search + status filter.** Filter projects by title/ID/description and
  by status (Proposed / In Development / Open to Public / Closed).
- **Long-press drag.** Hold a project bar to drag it horizontally; release
  to commit the new dates.
- **Collapsible lanes.** Click the chevron beside any gallery name to
  collapse it to a thin header strip — useful for focusing on one or two
  active galleries without the others taking vertical space. A toolbar
  button collapses or expands all lanes at once. Collapse state is
  session-scoped (resets on reload) and is preserved in print output, so
  printed plans show only the lanes you currently have open.

## Print

Designed for **11×17 landscape** ledger paper (`@page { size: 17in 11in }`).

- The portfolio shell is auto-scaled in the `beforeprint` handler so the full
  timeline fits on one page when possible.
- A **minimum scale of 0.75** prevents the smallest UI text from shrinking
  below readability. If the portfolio is too tall to fit at that floor, it
  spills to a second page rather than becoming illegible.
- Print color is forced on (`print-color-adjust: exact`) so phase fills,
  status colors, and gallery accents render in hard copy.
- A print-only header strip appears above the timeline showing the
  organisation name, print date, project count, and how many lanes (if
  any) are collapsed in the current view.

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
