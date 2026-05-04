# Scheduler Tool

Single-user portfolio scheduling tool for managing exhibition timelines within a phased process flow. Designed for 11×17 landscape print output.

## Features

- Multi-gallery swimlane timeline with drag-to-reschedule project bars
- Permanent and temporary gallery types, distinguished visually
- Per-project phase pipelines (pre- and post-phases) with custom durations and colors
- Per-gallery milestones with diamond/flag markers and color tags
- Conflict detection across overlapping projects in the same gallery
- GitHub Gist sync for cross-device persistence (optional, single-user)
- Local storage backup with automatic legacy-data migration
- Print stylesheet tuned for 11×17 landscape paper

## Tech Stack

- React 19 + TypeScript
- Vite 6 build tool
- Zustand state store
- Tailwind CSS (via CDN)
- Motion (Framer Motion successor) for animations
- Lucide React icons
- date-fns for date math

## Getting Started

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:5173`. Open the URL in your browser.

## Build

```bash
npm run build
npm run preview
```

Output goes to `dist/`. The build is configured for deployment under `/SchedulerTool/` (see `vite.config.ts` `base`); change this if your repo or path differs.

## Deployment

A GitHub Pages workflow is provided at `.github/workflows/deploy.yml`. It builds and publishes `dist/` to the `gh-pages` branch on every push to `main`.

To use it:
1. In repo settings, enable GitHub Pages and point it at the `gh-pages` branch.
2. If your repo name is not `SchedulerTool`, update the `base` field in `vite.config.ts`.

## Project Structure

```
.
├── index.html              # Vite entry HTML
├── index.tsx               # Main React app component
├── index.css               # Print stylesheet
├── src/
│   ├── components/         # DetailPanel, GithubAuthModal
│   ├── hooks/              # useMuseumSync, useMuseumActions
│   ├── lib/                # dateUtils, layoutEngine, githubGist
│   ├── store/              # Zustand store (useStore)
│   ├── constants.ts        # Defaults and layout constants
│   └── types.ts            # Shared type definitions
└── .github/workflows/
    └── deploy.yml          # GitHub Pages deploy
```

## Optional GitHub Gist Sync

To sync data across devices, click **SYNC** in the app header and provide a GitHub Personal Access Token with `gist` scope. The app stores credentials in browser localStorage only — nothing leaves your browser except calls directly to the GitHub Gist API.
