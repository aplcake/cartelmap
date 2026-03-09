# 🗺️ Cartel Atlas v2

Interactive historical map of Mexican drug cartel territorial control, trafficking routes, violence hotspots, and organizational genealogy — from 1975 to 2024.

## Quick Start

```bash
cd cartel-atlas
npm install
npm run dev
# Open: http://localhost:3000
```

**Requirements:**
- Node.js 18+
- Internet connection (map loads GeoJSON from CDN on first render)

---

## What's Inside

### Page 1: Territorial Map (`/map`)

**4 Display Modes:**

| Mode | What it shows |
|------|---------------|
| 🗺️ **Territorial Control** | States colored by dominant cartel, with contested areas semi-transparent |
| 🔴 **Violence Index** | Red heatmap driven by SNSP homicide data. Hotspot circles show active conflict zones |
| ➡️ **Trafficking Routes** | Animated drug corridors (Pacific, Gulf, Golden Triangle, Zetas eastern route, CJNG fentanyl) |
| ⭐ **Events Timeline** | Geo-pinned events — click dots on timeline to jump to year |

**Controls:**
- **Drag the slider** — or click year labels — to move through 1975–2024
- **▶ PLAY** — auto-animates forward through time at ~3.5 years/second
- **Colored dots** on the slider = critical/high significance events (click to jump)
- **Click any state** → right panel shows controlling cartel, all factions, description

### Page 2: Family Tree (`/family-tree`)

- Full organizational genealogy
- Solid gray lines = spawned from
- Red dashed lines = split/schism
- Active cartels pulse green
- Click any node → full panel with founders, history, drugs, timeline of all events

---

## Data Coverage

### Cartels (12)
Guadalajara Cartel • Sinaloa Cartel • Tijuana Cartel (AFO) • Juárez Cartel • Gulf Cartel • Los Zetas • Beltrán-Leyva Organization • CJNG • La Familia Michoacana • Knights Templar • Los Chapitos • Gulf Cartel Factions

### Trafficking Routes (7)
- Pacific Corridor (El Chapo Highway) — massive volume, Sinaloa
- Gulf Corridor — maritime, CDG
- Golden Triangle Production Zone — Sinaloa/DUR/CHH
- Gulf-to-US Eastern Route — Zetas era
- CJNG Fentanyl Pipeline — Manzanillo → Guadalajara → Tijuana
- Air Corridor (Lord of the Skies) — Amado Carrillo's 727s
- Tijuana–San Diego Corridor — AFO

### Violence Hotspots (16)
Ciudad Juárez • Culiacán • San Fernando (massacres) • Matamoros/Reynosa • Monterrey • Acapulco • Tierra Caliente • Zacatecas • Tijuana • Veracruz Port • Nogales/Sonora • Lázaro Cárdenas Port • Iguala (Ayotzinapa) • Nuevo Laredo • Morelos • Guanajuato

### Historical Events (40+)
From Operation Condor (1975) through the Sinaloa Civil War (2024)

---

## All Data in `lib/data.ts`

To add events, routes, hotspots or correct territorial data — edit `lib/data.ts` directly. Well-commented TypeScript interfaces at the top.

---

## Sources

DEA Intelligence Reports · InSight Crime · Wikipedia · UNODC · SNSP (Mexican homicide data) · Stratfor · Justice in Mexico (USSD)

---

*Educational/research use only. All data from publicly available sources.*
