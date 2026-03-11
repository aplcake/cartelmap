# Cartel Atlas

An interactive, research-oriented atlas of Mexican organized crime history from **1930 to 2026**.

Cartel Atlas combines territorial mapping, conflict timelines, organizational genealogy, personnel profiles, and key incident data into one Next.js application. It is designed for exploratory analysis and educational use—not for operational or law-enforcement decision making.

---

## Table of Contents

- [What this project does](#what-this-project-does)
- [Core features](#core-features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Data model and editing](#data-model-and-editing)
- [Deployment notes](#deployment-notes)
- [Design principles](#design-principles)
- [Data sources](#data-sources)
- [Disclaimer](#disclaimer)

---

## What this project does

Cartel Atlas provides a unified view of:

- **Territorial control over time** (state + municipal context)
- **Cartel wars and violent incidents** (attacks, mass-violence sites)
- **Drug-bust markers and trafficking routes**
- **Cartel genealogy and fragmentation chains**
- **People, role timelines, mentors, and blood relatives**
- **Long-form historical event timeline with filters**

The goal is to make long time-horizon cartel evolution easier to study than scattered articles and static maps.

---

## Core features

### 1) Interactive Map (`/map`)

- Year slider with play/pause through the full range
- Layer switching for territory, wars, hotspots, routes, attacks, sites, and busts
- Click-to-inspect detail panels for states and incidents
- Mobile-specific UI (controls sheet + full-screen detail views)

### 2) Family Trees & Personnel (`/family-tree`)

- Curated bloodline groupings and mentor chains
- Cartel lineage spawn graph
- Searchable people directory with role timelines
- Deep person profiles (status, relatives, mentors, notable connections)

### 3) Timeline (`/timeline`)

- Multi-filter historical event browser (cartel, event type, significance, search)
- Decade grouping for fast scanning
- Event detail drill-down with linked people/cartels

### 4) Cartel Profiles (`/cartels`)

- Organization cards + detailed profile pane
- Member/leader/founder context
- Genealogy relationships (parent/spawned organizations)
- Financial/intelligence-style quick stats

### 5) Hitmen & Operators (`/hitmen`)

- Focused index of enforcement-linked figures
- Cross-links to incidents and full personnel profiles

---

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript + React
- **Styling:** Inline style system + Tailwind tooling present
- **Mapping/Data viz:** custom map components + D3/TopoJSON utilities
- **Performance telemetry:** Vercel Speed Insights

---

## Project structure

```text
app/
  page.tsx               # landing page
  map/page.tsx           # interactive map + controls
  family-tree/page.tsx   # trees, lineage graph, personnel explorer
  timeline/page.tsx      # historical timeline explorer
  cartels/page.tsx       # cartel profiles + stats
  hitmen/page.tsx        # operators/enforcers index

components/
  MexicoMap.tsx
  PersonPanel.tsx
  PersonPhoto.tsx
  CoffeeButton.tsx
  ...

lib/
  data.ts                # canonical dataset + interfaces

public/
  mexico-states.geojson
  municipios.geojson
```

---

## Getting started

### Prerequisites

- Node.js 18+
- npm 9+

### Local setup

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

---

## Available scripts

```bash
npm run dev     # start development server
npm run build   # production build
npm run start   # run production build locally
npm run lint    # run Next.js ESLint checks
```

---

## Data model and editing

Most domain data is centralized in **`lib/data.ts`**.

Typical update workflows:

1. Add/edit entities (cartels, people, events, wars, routes, attacks, sites, busts).
2. Ensure IDs referenced across sections remain consistent.
3. Validate chronology (start/end years) for timeline/map coherence.
4. Run `npm run build` to catch type/data breakage.

If you plan large research updates, prefer smaller commits grouped by entity type (e.g., “events batch”, “personnel corrections”).

---

## Deployment notes

- Designed to deploy cleanly on **Vercel**.
- Speed Insights is integrated in the root layout.
- If build output differs from local, verify Node/npm versions and lockfile consistency.

---

## Design principles

- **Research-first UX:** density without sacrificing navigability
- **Temporal clarity:** everything anchored in year-based progression
- **Cross-linking:** people ↔ cartels ↔ incidents ↔ territories
- **Mobile fallback:** key workflows remain usable on narrow screens

---

## Data sources

This project compiles public-source material, including but not limited to:

- Government/public safety reporting
- Investigative journalism
- Academic/security analysis
- Public reference datasets and encyclopedic sources

> Source quality varies by period and region; treat uncertain records as historically contested rather than definitive.

---

## Disclaimer

Cartel Atlas is for **educational and research purposes only**.

- It does **not** provide operational guidance.
- It may contain incomplete, conflicting, or evolving historical records.
- No claim is made that all entities/events are exhaustive or final.

If you spot errors, open an issue or submit a PR with source-backed corrections.

---

## Support

If Cartel Atlas is useful for your research, **a coffee is appreciated**: [ko-fi.com/aplcake](https://ko-fi.com/aplcake).
