'use client';
import { useState, Suspense, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import PersonPanel from '@/components/PersonPanel';
import { Person,
  TERRITORY_PERIODS, CARTELS, PEOPLE, CARTEL_WARS, VIOLENCE_HOTSPOTS,
  TRAFFICKING_ROUTES, MEXICO_STATES, CARTEL_ATTACKS, CartelAttack,
  MASS_VIOLENCE_SITES, MassViolenceSite, MUNICIPAL_DATA, getEraForYear,
  DRUG_BUSTS, DrugBust, CartelWar, ViolenceHotspot, TraffickingRoute
} from '@/lib/data';

import type { MexicoMapHandle } from '@/components/MexicoMap';
const MexicoMap = dynamic(() => import('@/components/MexicoMap'), {
  ssr: false,
  loading: () => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#666',fontSize:14}}>
      Loading map…
    </div>
  ),
});

const CARTEL_COLORS: Record<string,string> = {
  proto_sinaloa:'#5a1a1a', gulf_proto:'#1a2a5a', guadalajara:'#8B1A1A',
  sinaloa:'#C8282D', chapitos:'#FF6B35', tijuana:'#E8612A', juarez:'#D4A017',
  sonora_caro:'#8B4513', gulf:'#1A6B8A', zetas:'#2D5A27', beltran_leyva:'#7B3F8C',
  cjng:'#E63946', la_familia:'#2E8B57', knights_templar:'#8B6914', cdg_factions:'#1B4F72',
};
const CONTROL_OPACITY: Record<string,number> = { dominant:0.75, partial:0.45, contested:0.30 };

type LayerMode = 'territory'|'wars'|'hotspots'|'routes'|'attacks'|'sites'|'busts';

const LAYER_BUTTONS: {id:LayerMode; label:string; emoji:string}[] = [
  {id:'territory', label:'Territory',     emoji:'🗺'},
  {id:'attacks',   label:'Attacks',       emoji:'⚔️'},
  {id:'sites',     label:'Mass Violence', emoji:'💀'},
  {id:'busts',     label:'Busts',         emoji:'💊'},
  {id:'wars',      label:'Wars',          emoji:'🔥'},
  {id:'hotspots',  label:'Hotspots',      emoji:'📊'},
  {id:'routes',    label:'Routes',        emoji:'🚚'},
];

function MapPageInner() {
  const [year, setYear] = useState(2010);
  const [playing, setPlaying] = useState(false);
  const [showAll, setShowAll] = useState(false);  // "All" mode — ignore year filter
  const [layerMode, setLayerMode] = useState<LayerMode>('territory');
  const [selectedCartelFilter, setSelectedCartelFilter] = useState<string|null>(null);
  const [selectedState, setSelectedState] = useState<string|null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<string|null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string|null>(null);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [bloodTrailPersonId, setBloodTrailPersonId] = useState<string|null>(null);
  const searchParams = useSearchParams();
  useEffect(() => {
    const c = searchParams.get('cartel');
    if (c && CARTELS.find(x => x.id === c)) setSelectedCartelFilter(c);
  }, []); // eslint-disable-line
  const mapRef = useRef<MexicoMapHandle>(null);
  const hotspotListRef = useRef<HTMLDivElement>(null);
  const [hoveredState, setHoveredState] = useState<string|null>(null);
  const [tooltip, setTooltip] = useState<{x:number;y:number;content:string}|null>(null);
  const [selectedAttack, setSelectedAttack] = useState<CartelAttack|null>(null);
  const [selectedSite, setSelectedSite] = useState<MassViolenceSite|null>(null);
  const [selectedBust, setSelectedBust] = useState<DrugBust|null>(null);
  const [selectedWar, setSelectedWar] = useState<CartelWar|null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── PLAY / PAUSE (useEffect, not useMemo) ───────────────────
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => {
      setYear((y: any) => {
        if (y >= 2026) {
          setPlaying(false);
          return 2026;
        }
        return y + 1;
      });
    }, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  // Stop playing when user manually moves slider
  function handleYearChange(v: number) {
    setPlaying(false);
    setYear(v);
  }

  // ── DATA DERIVATIONS ─────────────────────────────────────────
  const territoryData = useMemo(() => {
    const map: Record<string,{cartelId:string;control:string;leaderId?:string;color:string;opacity:number}[]> = {};
    TERRITORY_PERIODS
      .filter(t => t.startYear <= year && t.endYear >= year)
      .forEach(t => {
        if (!map[t.stateCode]) map[t.stateCode] = [];
        map[t.stateCode].push({
          cartelId: t.cartelId, control: t.control, leaderId: t.leaderId,
          color: CARTEL_COLORS[t.cartelId] || '#555',
          opacity: CONTROL_OPACITY[t.control] || 0.4,
        });
      });
    return map;
  }, [year]);

  const activeWars     = useMemo(() => CARTEL_WARS.filter((w: CartelWar) => w.startYear <= year && (!w.endYear || w.endYear >= year)), [year]);
  const activeHotspots = useMemo(() => VIOLENCE_HOTSPOTS.filter((h: ViolenceHotspot) => h.startYear <= year && h.endYear >= year), [year]);
  const activeRoutes   = useMemo(() => TRAFFICKING_ROUTES.filter((r: TraffickingRoute) => r.startYear <= year && r.endYear >= year), [year]);

  // Attacks: "All" shows everything; normal shows ±1 year window
  const activeAttacks = useMemo(() =>
    showAll
      ? CARTEL_ATTACKS
      : CARTEL_ATTACKS.filter(a => Math.abs(a.year - year) <= 1),
  [year, showAll]);

  // Busts: same logic
  const activeBusts = useMemo(() =>
    showAll
      ? DRUG_BUSTS
      : DRUG_BUSTS.filter(b => Math.abs(b.year - year) <= 1),
  [year, showAll]);

  // Mass violence sites: show events within ±2 years of slider (like attacks/busts).
  // "All" shows everything regardless of year.
  const activeSites = useMemo(() =>
    showAll
      ? MASS_VIOLENCE_SITES
      : MASS_VIOLENCE_SITES.filter(s => Math.abs(s.year - year) <= 2),
  [year, showAll]);

  const activeCartels = useMemo(() => {
    const ids = new Set(TERRITORY_PERIODS.filter(t => t.startYear <= year && t.endYear >= year).map(t => t.cartelId));
    return CARTELS.filter(c => ids.has(c.id));
  }, [year]);

  // ── TOOLTIP ──────────────────────────────────────────────────
  function getStateInfo(code: string): string {
    if (layerMode === 'hotspots') {
      const spots = activeHotspots.filter((h: any) => h.stateCode === code);
      return spots.length > 0
        ? spots.map((h: any) => `🔥 ${h.name}\n${h.cause.slice(0,90)}…`).join('\n\n')
        : 'No major violence hotspot this year';
    }
    const entries = territoryData[code] || [];
    if (!entries.length) return 'No major cartel presence';
    return entries.map((e: any) => {
      const c = CARTELS.find(x => x.id === e.cartelId);
      const l = e.leaderId ? PEOPLE.find(p => p.id === e.leaderId) : null;
      return `${c?.shortName || e.cartelId} (${e.control})${l ? ` — ${l.name}` : ''}`;
    }).join('\n');
  }

  // ── WHAT TO PASS TO MAP ───────────────────────────────────────
  // Territory fills only in territory/hotspot modes; other modes get dark background
  const mapTerritoryData = (layerMode === 'territory' || layerMode === 'hotspots') ? territoryData : {};

  // Cartel filter applies to ALL layers — not just territories
  const cf = selectedCartelFilter;
  const filterByCartel = <T extends {cartelId?:string; attackerCartelId?:string; targetCartelId?:string}>(arr: T[]): T[] => {
    if (!cf) return arr;
    return arr.filter((x: any) =>
      x.cartelId === cf ||
      x.attackerCartelId === cf ||
      x.targetCartelId === cf
    );
  };

  const mapAttacks = layerMode === 'attacks' ? filterByCartel(activeAttacks) : [];
  const mapSites   = layerMode === 'sites'   ? filterByCartel(activeSites)   : [];
  const mapBusts   = layerMode === 'busts'   ? filterByCartel(activeBusts)   : [];
  const mapWars: CartelWar[]    = layerMode === 'wars'    ? (cf ? activeWars.filter((w: CartelWar) => w.cartel1===cf||w.cartel2===cf) : activeWars) : [];
  const mapRoutes  = layerMode === 'routes'  ? (cf ? activeRoutes.filter((r: any) => r.cartelId===cf) : activeRoutes) : [];

  // ── RENDER ───────────────────────────────────────────────────
  const era = getEraForYear(year);
  const hasSelection = Boolean(selectedState || selectedAttack || selectedSite || selectedBust || selectedWar);

  return (
    <>
    <div style={{background:'#0a0a16',minHeight:'100vh',color:'#fff',fontFamily:'system-ui,sans-serif',display:'flex',flexDirection:'column',height:isMobile?'auto':'100vh',overflow:isMobile?'auto':'hidden'}}>

      {/* ── HEADER ── */}
      <div style={{background:'#0f0f1f',borderBottom:'1px solid #333',padding:isMobile?'8px 10px':'8px 16px',display:'flex',alignItems:'center',gap:isMobile?8:14,flexShrink:0,flexWrap:'wrap',justifyContent:isMobile?'space-between':'flex-start'}}>
        <Link href="/" style={{color:'#666',textDecoration:'none',fontSize:12}}>← Home</Link>
        {!isMobile && <Link href="/family-tree" style={{color:'#666',textDecoration:'none',fontSize:12}}>Family Trees</Link>}
        {!isMobile && <Link href="/timeline" style={{color:'#666',textDecoration:'none',fontSize:12}}>Timeline</Link>}
        {!isMobile && <div style={{flex:1}}/>}
        <h1 style={{margin:0,fontSize:isMobile?12:15,fontWeight:700,color:'#C8282D',letterSpacing:isMobile?0.6:0}}>{isMobile ? 'CARTEL ATLAS' : 'CARTEL ATLAS — Territory Map 1930–2026'}</h1>
        {!isMobile && <div style={{flex:1}}/>}
        {!isMobile && <div style={{fontSize:11,color:'#666'}}>{activeCartels.length} cartels · {year}</div>}
      </div>

      {/* ── CONTROLS ── */}
      <div style={{background:'#0d0d1d',borderBottom:'1px solid #1f1f30',padding:isMobile?'6px 10px':'8px 16px',display:'flex',alignItems:'center',gap:isMobile?6:14,flexShrink:0,flexWrap:'wrap'}}>
        {/* Desktop timeline controls */}
        {!isMobile && (
          <>
            <button
              onClick={() => { if (year >= 2026) { setYear(1930); setPlaying(true); } else setPlaying((p: any) => !p); }}
              style={{padding:'4px 14px',borderRadius:6,border:'1px solid #C8282D',
                background:playing?'#C8282D':'transparent',color:'#fff',fontSize:12,cursor:'pointer',minWidth:76}}
            >{playing ? '⏸ Pause' : '▶ Play'}</button>

            <input type="range" min={1930} max={2026} value={year}
              onChange={(e: any) => handleYearChange(Number(e.target.value))}
              style={{width:200,accentColor:'#C8282D'}} />
            <span style={{fontSize:20,fontWeight:800,color:'#C8282D',minWidth:48}}>{year}</span>

            {era && (
              <span style={{fontSize:10,color:'#aaa',background:`${era.color}22`,border:`1px solid ${era.color}44`,
                borderRadius:4,padding:'2px 8px',whiteSpace:'nowrap'}}>{era.label}</span>
            )}
          </>
        )}

        {isMobile && !hasSelection && (
          <button
            onClick={() => setMobileControlsOpen((v: any) => !v)}
            style={{padding:'4px 9px',borderRadius:6,border:'1px solid #2a2a3a',background:'#111',color:'#bbb',fontSize:10,cursor:'pointer',marginLeft:'auto'}}
          >☰ Controls</button>
        )}

        {/* ALL toggle — only shown on layers where it has effect */}
        {!isMobile && !['hotspots','routes','territory','wars'].includes(layerMode) && (
          <button onClick={() => setShowAll((s: any) => !s)}
            style={{padding:isMobile?'3px 8px':'4px 12px',borderRadius:6,
              border:`1px solid ${showAll?'#f59e0b':'#2a2a3a'}`,
              background:showAll?'#f59e0b22':'transparent',
              color:showAll?'#f59e0b':'#666',fontSize:isMobile?10:11,cursor:'pointer',fontWeight:showAll?700:400,marginLeft:isMobile?'auto':0}}>
            {showAll ? '✦ ALL' : '✦ All'}
          </button>
        )}

        {/* Layer buttons */}
        <div style={{display:'flex',gap:5,marginLeft:isMobile?0:'auto',flexWrap:'nowrap',width:isMobile?'100%':undefined,overflowX:isMobile?'auto':'visible',paddingBottom:isMobile?2:0}}>
          {LAYER_BUTTONS.map(b => (
            <button key={b.id} onClick={() => setLayerMode(b.id)}
              style={{padding:isMobile?'4px 8px':'4px 10px',borderRadius:6,
                border:`1px solid ${layerMode===b.id?'#C8282D':'#2a2a3a'}`,
                background:layerMode===b.id?'#C8282D22':'transparent',
                color:layerMode===b.id?'#fff':'#777',fontSize:isMobile?10:11,cursor:'pointer',whiteSpace:'nowrap'}}>
              {b.emoji} {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN: MAP + SIDEBAR ── */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 272px',gridTemplateRows:isMobile?(hasSelection?'52vh auto':'1fr'):'1fr',flex:1,overflow:'hidden',minHeight:0,paddingBottom:isMobile?88:0}}>

        {/* Map */}
        <div style={{position:'relative',background:'#0a0a16',overflow:'hidden',minHeight:isMobile?(hasSelection?'52vh':'78vh'):'auto'}}>
          <MexicoMap
            ref={mapRef}
            bloodTrailPersonId={bloodTrailPersonId}
            territoryData={mapTerritoryData}
            activeWars={mapWars}
            activeHotspots={activeHotspots}
            activeRoutes={mapRoutes}
            activeAttacks={mapAttacks}
            activeSites={mapSites}
            activeBusts={mapBusts}
            layerMode={layerMode}
            year={year}
            selectedState={selectedState}
            cartelFilter={selectedCartelFilter}
            onStateHover={(code: any, x: any, y: any) => {
              setHoveredState(code);
              if (code) setTooltip({x, y, content: getStateInfo(code)});
              else setTooltip(null);
            }}
            onStateClick={(code: any) => {
              setSelectedState((s: any) => s === code ? null : code);
              if (isMobile) setMobileControlsOpen(false);
              setSelectedAttack(null); setSelectedSite(null); setSelectedBust(null);
              // In hotspot mode: scroll sidebar to matching hotspot
              if (layerMode === 'hotspots') {
                const match = activeHotspots.find((h: any) => h.stateCode === code);
                if (match) {
                  setSelectedHotspot(match.id);
                  setTimeout(() => {
                    document.getElementById(`hotspot-${match.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }
              }
            }}
            onAttackClick={(a: any) => { setSelectedAttack((x: any) => x?.id===a.id?null:a); setSelectedSite(null); setSelectedBust(null); setSelectedWar(null); setSelectedState(null); }}
            onSiteClick={(s: any) => { setSelectedSite((x: any) => x?.id===s.id?null:s); setSelectedAttack(null); setSelectedBust(null); setSelectedWar(null); setSelectedState(null); }}
            onBustClick={(b: any) => { setSelectedBust((x: any) => x?.id===b.id?null:b); setSelectedAttack(null); setSelectedSite(null); setSelectedWar(null); setSelectedState(null); }}
            onWarClick={(w: any) => { setSelectedWar((x: any) => x?.id===w.id?null:w); setSelectedAttack(null); setSelectedSite(null); setSelectedBust(null); setSelectedState(null); }}
            selectedRoute={selectedRoute}
            onRouteClick={(r: any) => setSelectedRoute((x: any) => x===r.id ? null : r.id)}
            selectedHotspot={selectedHotspot}
            onHotspotClick={(h: any) => {
              setSelectedHotspot((x: any) => x===h.id ? null : h.id);
              // Fly map to hotspot location
              mapRef.current?.flyTo(h.lat, h.lng, 7);
            }}
          />

          {/* Map tooltip */}
          {tooltip && (
            <div style={{position:'absolute',left:tooltip.x+12,top:tooltip.y-8,
              background:'#0f0f1fee',border:'1px solid #2a2a3a',borderRadius:8,
              padding:'8px 12px',fontSize:11,color:'#eee',maxWidth:240,
              pointerEvents:'none',zIndex:1000,whiteSpace:'pre-line',lineHeight:1.6}}>
              {hoveredState && <div style={{fontWeight:700,color:'#C8282D',marginBottom:3}}>
                {MEXICO_STATES[hoveredState]?.name || hoveredState}
              </div>}
              {tooltip.content}
            </div>
          )}


        </div>

        {/* ── SIDEBAR ── */}
        <div style={{
          background:'#0a0a1a',
          borderLeft:isMobile?'none':'1px solid #1a1a2e',
          borderTop:isMobile?'1px solid #1a1a2e':'none',
          overflowY:'auto',
          display:isMobile && !hasSelection ? 'none' : 'flex',
          flexDirection:'column',
          fontSize:12,
          maxHeight:isMobile?'100vh':'none',
          ...(isMobile && hasSelection ? {position:'fixed', inset:'0', zIndex:1300, borderTop:'none'} : {}),
        }}>

          {/* Detail panel */}
          {(selectedState || selectedAttack || selectedSite || selectedBust || selectedWar) ? (
            <div style={{flex:1,overflowY:'auto'}}>
              {isMobile && hasSelection && (
                <div style={{position:'sticky',top:0,zIndex:10,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'#0d0d1d',borderBottom:'1px solid #1f1f30'}}>
                  <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1}}>Detail View</div>
                  <button onClick={() => { setSelectedState(null); setSelectedAttack(null); setSelectedSite(null); setSelectedBust(null); setSelectedWar(null); }} style={{background:'none',border:'1px solid #333',color:'#aaa',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>Close</button>
                </div>
              )}

              {/* STATE detail */}
              {selectedState && !selectedAttack && !selectedSite && !selectedBust && (() => {
                const stateName = MEXICO_STATES[selectedState]?.name || selectedState;
                const era = getEraForYear(year);
                const rulers = TERRITORY_PERIODS.filter(t =>
                  t.stateCode === selectedState && t.startYear <= year && t.endYear >= year
                ).sort((a,b) => ({dominant:0,partial:1,contested:2}[a.control]||3)-({dominant:0,partial:1,contested:2}[b.control]||3));
                const allRulers = TERRITORY_PERIODS.filter(t => t.stateCode === selectedState).sort((a,b)=>a.startYear-b.startYear);
                const munis = (MUNICIPAL_DATA[selectedState]||[]).filter(m=>m.startYear<=year&&m.endYear>=year)
                  .sort((a,b)=>({dominant:0,partial:1,contested:2}[a.control]||3)-({dominant:0,partial:1,contested:2}[b.control]||3));
                return (
                  <div>
                    <div style={{background:'#C8282D18',borderBottom:'1px solid #C8282D33',padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{stateName}</div>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                          <span style={{fontSize:12,color:'#C8282D',fontWeight:700}}>{year}</span>
                          {era && <span style={{fontSize:10,color:'#aaa',background:`${era.color}22`,border:`1px solid ${era.color}44`,borderRadius:4,padding:'1px 6px'}}>{era.label}</span>}
                        </div>
                      </div>
                      <button onClick={()=>setSelectedState(null)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:16}}>✕</button>
                    </div>
                    <div style={{padding:'12px 14px'}}>
                      {rulers.length > 0 && (
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>In Control — {year}</div>
                          {rulers.map((r,i) => {
                            const c = CARTELS.find(x=>x.id===r.cartelId);
                            const l = r.leaderId ? PEOPLE.find(p=>p.id===r.leaderId) : null;
                            const col = CARTEL_COLORS[r.cartelId]||'#555';
                            return (
                              <div key={i} style={{background:'#111',borderRadius:6,padding:'8px 10px',marginBottom:5,borderLeft:`3px solid ${col}`}}>
                                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:l?3:0}}>
                                  <div style={{width:8,height:8,borderRadius:'50%',background:col,flexShrink:0}}/>
                                  <span style={{fontSize:12,fontWeight:700,color:'#eee'}}>{c?.shortName||r.cartelId}</span>
                                  <span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:`${col}33`,color:col,border:`1px solid ${col}44`,marginLeft:'auto'}}>{r.control}</span>
                                </div>
                                {l && (
                                  <div
                                    onClick={() => { setSelectedPerson(l); setBloodTrailPersonId(l.id); }}
                                    style={{fontSize:10,color:'#C8282D',marginLeft:14,cursor:'pointer',textDecoration:'underline',textDecorationColor:'#C8282D55'}}
                                    title="View profile"
                                  >👤 {l.name}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {munis.length > 0 && (
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Key Municipalities — {year}</div>
                          {munis.map((m,i) => {
                            const col = CARTEL_COLORS[m.cartelId]||'#555';
                            const c = CARTELS.find(x=>x.id===m.cartelId);
                            return (
                              <div key={i} style={{display:'flex',gap:8,marginBottom:5,padding:'6px 9px',background:'#111',borderRadius:6,borderLeft:`3px solid ${col}`}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
                                    <span style={{fontSize:11,fontWeight:700,color:'#eee'}}>{m.name}</span>
                                    <span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:`${col}33`,color:col,border:`1px solid ${col}44`,flexShrink:0}}>{m.control}</span>
                                    <span style={{fontSize:9,color:'#555',marginLeft:'auto'}}>{c?.shortName}</span>
                                  </div>
                                  {m.notes && <div style={{fontSize:10,color:'#777',lineHeight:1.4}}>{m.notes}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{fontSize:10,color:'#444',textTransform:'uppercase',marginBottom:7,letterSpacing:1}}>Full History</div>
                      {allRulers.map((r,i) => {
                        const c = CARTELS.find(x=>x.id===r.cartelId);
                        const col = CARTEL_COLORS[r.cartelId]||'#555';
                        const active = r.startYear<=year && r.endYear>=year;
                        return (
                          <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,opacity:active?1:0.4}}>
                            <div style={{width:5,height:5,borderRadius:'50%',background:col,flexShrink:0}}/>
                            <span style={{fontSize:10,color:active?'#ccc':'#555'}}>{r.startYear}–{r.endYear} · <span style={{color:active?col:'#555'}}>{c?.shortName}</span> · {r.control}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ATTACK detail */}
              {selectedAttack && (() => {
                const a = selectedAttack;
                const attacker = CARTELS.find(c=>c.id===a.attackerCartelId);
                const target   = CARTELS.find(c=>c.id===a.targetCartelId);
                const people   = (a.personIds||[]).map((id:string)=>PEOPLE.find(p=>p.id===id)).filter(Boolean);
                const typeColor: Record<string,string> = {
                  assassination:'#dc2626',massacre:'#991b1b',ambush:'#ea580c',
                  bombing:'#d97706',kidnapping:'#7c3aed',territorial:'#2563eb',retaliation:'#be185d',
                };
                const tc = typeColor[a.type]||'#555';
                return (
                  <div>
                    <div style={{background:`${tc}18`,borderBottom:`1px solid ${tc}33`,padding:'12px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div style={{flex:1,paddingRight:8}}>
                          <div style={{display:'flex',gap:5,alignItems:'center',marginBottom:6}}>
                            <span style={{fontSize:9,background:'#3a1010',color:'#ef4444',borderRadius:4,padding:'2px 6px',fontWeight:700,textTransform:'uppercase'}}>Attack</span>
                            <span style={{fontSize:9,background:`${tc}22`,color:tc,borderRadius:4,padding:'2px 6px',textTransform:'uppercase'}}>{a.type}</span>
                            {a.significance==='critical' && <span style={{fontSize:9,background:'#dc2626',color:'#fff',borderRadius:4,padding:'2px 6px',fontWeight:700}}>CRITICAL</span>}
                          </div>
                          <div style={{fontSize:13,fontWeight:700,color:'#fff',lineHeight:1.3,marginBottom:3}}>{a.title}</div>
                          <div style={{fontSize:10,color:'#666'}}><span style={{color:'#C8282D',fontWeight:700}}>{a.year}</span>{a.month?`/${String(a.month).padStart(2,'0')}`:''}  · {a.stateCode}</div>
                        </div>
                        <button onClick={()=>setSelectedAttack(null)} style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:16}}>✕</button>
                      </div>
                    </div>
                    <div style={{padding:'12px 14px'}}>
                      {a.killed && (
                        <div style={{background:'#1a0808',border:'1px solid #5a1a1a',borderRadius:7,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                          <div style={{fontSize:26,fontWeight:900,color:'#ef4444'}}>{a.killed.toLocaleString()}</div>
                          <div style={{fontSize:11,color:'#f87171'}}>killed</div>
                        </div>
                      )}
                      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
                        {attacker && <span style={{fontSize:10,background:`${CARTEL_COLORS[a.attackerCartelId!]||'#555'}22`,border:`1px solid ${CARTEL_COLORS[a.attackerCartelId!]||'#555'}44`,color:'#ddd',borderRadius:5,padding:'2px 7px'}}>⚡ {attacker.shortName}</span>}
                        {target && <span style={{fontSize:10,background:'#1a1a2e',border:'1px solid #2a2a3a',color:'#999',borderRadius:5,padding:'2px 7px'}}>🎯 {target.shortName}</span>}
                      </div>
                      <div style={{fontSize:12,color:'#ccc',lineHeight:1.7,marginBottom:12}}>{a.description}</div>
                      {people.length>0 && (
                        <div>
                          <div style={{fontSize:10,color:'#444',textTransform:'uppercase',marginBottom:7}}>Key People</div>
                          {people.map((p:any) => (
                            <div key={p.id}
                              onClick={() => { setSelectedPerson(p); setBloodTrailPersonId(p.id); }}
                              style={{display:'flex',gap:8,alignItems:'center',background:'#111',borderRadius:6,padding:'6px 10px',marginBottom:5,cursor:'pointer',border:'1px solid transparent',transition:'border-color 0.15s'}}
                              onMouseEnter={(e: any) =>(e.currentTarget.style.borderColor='#C8282D55')}
                              onMouseLeave={(e: any) =>(e.currentTarget.style.borderColor='transparent')}>
                              <span style={{fontSize:13}}>{p.status==='killed'?'✕':p.status==='arrested'?'⚖':'👤'}</span>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,fontWeight:700,color:'#fff'}}>{p.name}</div>
                                {p.alias?.[0] && <div style={{fontSize:9,color:'#666',fontStyle:'italic'}}>"{p.alias[0]}"</div>}
                              </div>
                              <span style={{fontSize:10,color:'#C8282D'}}>→</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {a.wikipediaUrl && <a href={a.wikipediaUrl} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',marginTop:8,fontSize:11,color:'#6b9fff',textDecoration:'none',border:'1px solid #2a4a8a',borderRadius:5,padding:'4px 10px'}}>📖 Wikipedia</a>}
                    </div>
                  </div>
                );
              })()}

              {/* SITE detail */}
              {selectedSite && !selectedAttack && (() => {
                const s = selectedSite;
                const cartel = CARTELS.find(c=>c.id===s.cartelId);
                const typeColor: Record<string,string> = { body_dump:'#3b82f6',mass_grave:'#1d4ed8',burn_site:'#f97316',hanging:'#6366f1',dismemberment:'#8b5cf6' };
                const tc = typeColor[s.type]||'#555';
                return (
                  <div>
                    <div style={{background:`${tc}18`,borderBottom:`1px solid ${tc}33`,padding:'12px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div style={{flex:1,paddingRight:8}}>
                          <div style={{display:'flex',gap:5,alignItems:'center',marginBottom:6}}>
                            <span style={{fontSize:9,background:'#1e3a5f',color:'#60a5fa',borderRadius:4,padding:'2px 6px',fontWeight:700,textTransform:'uppercase'}}>Mass Violence</span>
                            <span style={{fontSize:9,background:`${tc}22`,color:tc,borderRadius:4,padding:'2px 6px',textTransform:'uppercase'}}>{s.type.replace('_',' ')}</span>
                          </div>
                          <div style={{fontSize:13,fontWeight:700,color:'#fff',lineHeight:1.3,marginBottom:3}}>{s.title}</div>
                          <div style={{fontSize:10,color:'#666'}}><span style={{color:'#C8282D',fontWeight:700}}>{s.year}</span> · {s.stateCode}</div>
                        </div>
                        <button onClick={()=>setSelectedSite(null)} style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:16}}>✕</button>
                      </div>
                    </div>
                    <div style={{padding:'12px 14px'}}>
                      {s.victims && (
                        <div style={{background:'#1a0808',border:'1px solid #5a1a1a',borderRadius:7,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                          <div style={{fontSize:26,fontWeight:900,color:'#ef4444'}}>{s.victims.toLocaleString()}</div>
                          <div style={{fontSize:11,color:'#f87171'}}>victims documented</div>
                        </div>
                      )}
                      {cartel && <div style={{marginBottom:10}}><span style={{fontSize:10,background:`${CARTEL_COLORS[s.cartelId]||'#555'}22`,border:`1px solid ${CARTEL_COLORS[s.cartelId]||'#555'}44`,color:'#ddd',borderRadius:5,padding:'2px 7px'}}>⚡ {cartel.shortName}</span></div>}
                      <div style={{fontSize:12,color:'#ccc',lineHeight:1.7,marginBottom:12}}>{s.description}</div>
                      {s.found && (
                        <div style={{background:'#111',borderRadius:6,padding:'8px 11px',marginBottom:10,borderLeft:'2px solid #333'}}>
                          <div style={{fontSize:9,color:'#444',textTransform:'uppercase',marginBottom:3}}>How Discovered</div>
                          <div style={{fontSize:11,color:'#999',lineHeight:1.5}}>{s.found}</div>
                        </div>
                      )}
                      {(s as any).wikipediaUrl && <a href={(s as any).wikipediaUrl} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',marginTop:4,fontSize:11,color:'#6b9fff',textDecoration:'none',border:'1px solid #2a4a8a',borderRadius:5,padding:'4px 10px'}}>📖 Wikipedia</a>}
                    </div>
                  </div>
                );
              })()}

              {/* BUST detail */}
              {selectedBust && (() => {
                const b = selectedBust;
                const cartel = CARTELS.find(c=>c.id===b.cartelId);
                const totalKg = b.drugs?.reduce((s: any,d: any)=>s+d.kg,0)||0;
                const totalVal = b.drugs?.reduce((s: any,d: any)=>s+(d.streetValueUSD||0),0)||0;
                return (
                  <div>
                    <div style={{background:'#0a1a0a',borderBottom:'1px solid #1a4a1a',padding:'12px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div style={{flex:1,paddingRight:8}}>
                          <div style={{display:'flex',gap:5,alignItems:'center',marginBottom:6}}>
                            <span style={{fontSize:9,background:'#0a2a0a',color:'#4ade80',borderRadius:4,padding:'2px 6px',fontWeight:700,textTransform:'uppercase'}}>Drug Bust</span>
                            {b.significance==='critical' && <span style={{fontSize:9,background:'#4ade80',color:'#000',borderRadius:4,padding:'2px 6px',fontWeight:700}}>CRITICAL</span>}
                          </div>
                          <div style={{fontSize:13,fontWeight:700,color:'#fff',lineHeight:1.3,marginBottom:3}}>{b.title}</div>
                          <div style={{fontSize:10,color:'#666'}}><span style={{color:'#4ade80',fontWeight:700}}>{b.year}</span> · {b.stateCode}</div>
                        </div>
                        <button onClick={()=>setSelectedBust(null)} style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:16}}>✕</button>
                      </div>
                    </div>
                    <div style={{padding:'12px 14px'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
                        {totalKg>0 && <div style={{background:'#0a1a0a',borderRadius:6,padding:'8px',textAlign:'center',border:'1px solid #1a4a1a'}}>
                          <div style={{fontSize:18,fontWeight:800,color:'#4ade80'}}>{totalKg>=1000?`${(totalKg/1000).toFixed(1)}t`:`${totalKg}kg`}</div>
                          <div style={{fontSize:9,color:'#666'}}>drugs seized</div>
                        </div>}
                        {totalVal>0 && <div style={{background:'#1a1400',borderRadius:6,padding:'8px',textAlign:'center',border:'1px solid #3a3000'}}>
                          <div style={{fontSize:18,fontWeight:800,color:'#fbbf24'}}>${totalVal>=1e9?`${(totalVal/1e9).toFixed(1)}B`:`${(totalVal/1e6).toFixed(0)}M`}</div>
                          <div style={{fontSize:9,color:'#666'}}>street value</div>
                        </div>}
                        {b.cashUSD && <div style={{background:'#1a1400',borderRadius:6,padding:'8px',textAlign:'center',border:'1px solid #3a3000'}}>
                          <div style={{fontSize:18,fontWeight:800,color:'#fbbf24'}}>${b.cashUSD>=1e9?`${(b.cashUSD/1e9).toFixed(1)}B`:`${(b.cashUSD/1e6).toFixed(0)}M`}</div>
                          <div style={{fontSize:9,color:'#666'}}>cash seized</div>
                        </div>}
                        {b.arrests && <div style={{background:'#160a1a',borderRadius:6,padding:'8px',textAlign:'center',border:'1px solid #3a1a4a'}}>
                          <div style={{fontSize:18,fontWeight:800,color:'#a78bfa'}}>{b.arrests.toLocaleString()}</div>
                          <div style={{fontSize:9,color:'#666'}}>arrested</div>
                        </div>}
                        {b.gunsSeized && <div style={{background:'#1a0808',borderRadius:6,padding:'8px',textAlign:'center',border:'1px solid #4a1a1a'}}>
                          <div style={{fontSize:18,fontWeight:800,color:'#ef4444'}}>{b.gunsSeized.toLocaleString()}</div>
                          <div style={{fontSize:9,color:'#666'}}>weapons</div>
                        </div>}
                        {b.labs && <div style={{background:'#111',borderRadius:6,padding:'8px',textAlign:'center',border:'1px solid #222'}}>
                          <div style={{fontSize:18,fontWeight:800,color:'#fb923c'}}>{b.labs}</div>
                          <div style={{fontSize:9,color:'#666'}}>labs destroyed</div>
                        </div>}
                      </div>
                      {cartel && <div style={{marginBottom:10}}><span style={{fontSize:10,background:`${CARTEL_COLORS[b.cartelId??'']||'#555'}22`,border:`1px solid ${CARTEL_COLORS[b.cartelId??'']||'#555'}44`,color:'#ddd',borderRadius:5,padding:'2px 7px'}}>⚡ {cartel.shortName}</span></div>}
                      {b.drugs && b.drugs.length>0 && (
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,color:'#444',textTransform:'uppercase',marginBottom:5}}>Drug Breakdown</div>
                          {b.drugs.map((d: any,i: any) => (
                            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #1a1a2e',fontSize:11}}>
                              <span style={{color:'#888',textTransform:'capitalize'}}>{d.type}</span>
                              <span style={{color:'#4ade80'}}>{d.kg>=1000?`${(d.kg/1000).toFixed(1)}t`:`${d.kg}kg`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{fontSize:11,color:'#aaa',lineHeight:1.65,marginBottom:10}}>{b.description}</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:4}}>
                        <span style={{fontSize:10,color:'#666',background:'#111',borderRadius:4,padding:'2px 7px',border:'1px solid #222'}}>
                          {(b as any).agency?.includes('DEA') ? '🦅 ' : '🇲🇽 '}{(b as any).agency}
                        </span>
                        {(b as any).operationName && (
                          <span style={{fontSize:10,color:'#6b9fff',background:'#0a1a3a',borderRadius:4,padding:'2px 7px',border:'1px solid #1a3a7a'}}>
                            OP: {(b as any).operationName}
                          </span>
                        )}
                        {(b as any).indictment && (
                          <span style={{fontSize:10,color:'#ef4444',background:'#1a0808',borderRadius:4,padding:'2px 7px',border:'1px solid #4a1a1a'}}>⚖ US INDICTMENT</span>
                        )}
                        {(b as any).extradition && (
                          <span style={{fontSize:10,color:'#f59e0b',background:'#1a1208',borderRadius:4,padding:'2px 7px',border:'1px solid #4a3a08'}}>✈ EXTRADITED</span>
                        )}
                        {(b as any).usSentenceYears && (
                          <span style={{fontSize:10,color:'#888',background:'#111',borderRadius:4,padding:'2px 7px',border:'1px solid #222'}}>
                            {(b as any).usSentenceYears >= 999 ? 'Life + 30yrs' : `${(b as any).usSentenceYears}yr sentence`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── WAR DETAIL PANEL ── */}
              {selectedWar && (() => {
                const w = selectedWar;
                const c1 = CARTELS.find(c=>c.id===w.cartel1);
                const c2 = CARTELS.find(c=>c.id===w.cartel2);
                const years = w.endYear ? `${w.startYear} – ${w.endYear}` : `${w.startYear} – present`;
                return (
                  <div style={{padding:'14px 16px',borderTop:'1px solid #1a1a2e',flex:1,overflowY:'auto'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#f97316',lineHeight:1.3,paddingRight:8}}>🔥 {w.title}</div>
                      <button onClick={()=>setSelectedWar(null)} style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:16,flexShrink:0}}>✕</button>
                    </div>
                    <div style={{fontSize:11,color:'#888',marginBottom:10}}>{years}</div>
                    <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
                      {c1 && <div style={{background:'#111',border:`1px solid ${CARTEL_COLORS[w.cartel1]||'#333'}`,color:CARTEL_COLORS[w.cartel1]||'#aaa',borderRadius:4,padding:'3px 8px',fontSize:11,fontWeight:600}}>{c1.name}</div>}
                      <div style={{color:'#555',fontSize:12,alignSelf:'center'}}>vs</div>
                      {c2 && <div style={{background:'#111',border:`1px solid ${CARTEL_COLORS[w.cartel2]||'#333'}`,color:CARTEL_COLORS[w.cartel2]||'#aaa',borderRadius:4,padding:'3px 8px',fontSize:11,fontWeight:600}}>{c2.name}</div>}
                    </div>
                    {w.estimatedDeaths && (
                      <div style={{background:'#1a0a0a',border:'1px solid #3a1212',borderRadius:6,padding:'8px 12px',marginBottom:12}}>
                        <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Estimated Deaths</div>
                        <div style={{fontSize:20,fontWeight:700,color:'#ef4444'}}>~{w.estimatedDeaths.toLocaleString()}</div>
                      </div>
                    )}
                    <div style={{fontSize:12,color:'#bbb',lineHeight:1.7,marginBottom:12}}>{w.description}</div>
                    {w.outcome && (
                      <div style={{background:'#0a120a',border:'1px solid #1a2a1a',borderRadius:6,padding:'8px 12px',marginBottom:12}}>
                        <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Outcome</div>
                        <div style={{fontSize:11,color:'#7dc97d',lineHeight:1.5}}>{w.outcome}</div>
                      </div>
                    )}
                    {w.states?.length > 0 && (
                      <div style={{marginTop:8,marginBottom:12}}>
                        <div style={{fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>States Affected</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                          {w.states.map((s: any) => <span key={s} style={{background:'#111',border:'1px solid #222',borderRadius:3,padding:'2px 6px',fontSize:10,color:'#666'}}>{s}</span>)}
                        </div>
                      </div>
                    )}
                    {(w.personIds?.length ?? 0) > 0 && (() => {
                      const warPeople = (w.personIds||[]).map((id:string)=>PEOPLE.find(p=>p.id===id)).filter(Boolean);
                      if (!warPeople.length) return null;
                      return (
                        <div style={{marginTop:4}}>
                          <div style={{fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Key Figures</div>
                          {warPeople.map((p:any) => (
                            <div key={p.id}
                              onClick={() => { setSelectedPerson(p); setBloodTrailPersonId(p.id); }}
                              style={{display:'flex',gap:8,alignItems:'center',background:'#111',borderRadius:6,padding:'6px 10px',marginBottom:5,cursor:'pointer',border:'1px solid transparent',transition:'border-color 0.15s'}}
                              onMouseEnter={(e: any) =>(e.currentTarget.style.borderColor='#C8282D55')}
                              onMouseLeave={(e: any) =>(e.currentTarget.style.borderColor='transparent')}>
                              <div style={{width:26,height:26,borderRadius:'50%',background:CARTEL_COLORS[p.cartelIds?.[(p.cartelIds||[]).length-1]]||'#555',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flexShrink:0}}>
                                {p.status==='killed'?'✕':p.status==='arrested'?'⚖':p.status==='deceased'?'†':'●'}
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,fontWeight:700,color:'#fff'}}>{p.name}</div>
                                {p.alias?.[0] && <div style={{fontSize:9,color:'#666',fontStyle:'italic'}}>"{p.alias[0]}"</div>}
                              </div>
                              <span style={{fontSize:10,color:'#C8282D'}}>→</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ── DEFAULT SIDEBAR (no selection) ── */
            <div style={{padding:'12px 14px',flex:1,overflowY:'auto'}}>

              {/* Active layer info */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>
                  {layerMode==='territory'?`Territory — ${year}`:layerMode==='attacks'?`Attacks — ${showAll?'All':year} (${activeAttacks.length})`:layerMode==='sites'?`Mass Violence Sites (${activeSites.length})`:layerMode==='busts'?`Drug Busts — ${showAll?'All':year} (${activeBusts.length})`:layerMode==='wars'?`Active Wars — ${year}`:layerMode==='hotspots'?`Violence Index — ${year}`:layerMode==='routes'?`Routes — ${year} (${activeRoutes.length})`:''}
                </div>
                <div style={{fontSize:10,color:'#333'}}>Click on map or list to explore</div>
              </div>

              {/* ─ ATTACKS list ─ */}
              {layerMode==='attacks' && activeAttacks.length>0 && (
                <div style={{marginBottom:14}}>
                  {activeAttacks
                    .slice().sort((a: any,b: any) => (b.killed||0)-(a.killed||0))
                    .map((a: any) => {
                      const att = CARTELS.find(c=>c.id===a.attackerCartelId);
                      return (
                        <div key={a.id} onClick={()=>{setSelectedAttack(a);setSelectedSite(null);setSelectedBust(null);setSelectedState(null);if(a.lat&&a.lng)mapRef.current?.flyTo(a.lat,a.lng,8);}}
                          style={{background:'#111',borderRadius:6,padding:'8px 10px',marginBottom:5,borderLeft:`2px solid ${a.significance==='critical'?'#dc2626':a.significance==='high'?'#f97316':'#333'}`,cursor:'pointer'}}>
                          <div style={{fontSize:11,fontWeight:700,color:'#ddd',marginBottom:2}}>{a.title}</div>
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            <span style={{fontSize:9,color:'#666'}}>{a.year}</span>
                            {att && <span style={{fontSize:9,color:CARTEL_COLORS[a.attackerCartelId!]||'#666'}}>{att.shortName}</span>}
                            {a.killed && <span style={{fontSize:9,color:'#ef4444',marginLeft:'auto'}}>☠ {a.killed.toLocaleString()}</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* ─ SITES list ─ */}
              {layerMode==='sites' && activeSites.length>0 && (
                <div style={{marginBottom:14}}>
                  {activeSites
                    .slice().sort((a: any,b: any)=>(b.victims||0)-(a.victims||0))
                    .map((s: any) => (
                      <div key={s.id} onClick={()=>{setSelectedSite(s);setSelectedAttack(null);setSelectedBust(null);setSelectedState(null);if(s.lat&&s.lng)mapRef.current?.flyTo(s.lat,s.lng,8);}}
                        style={{background:'#111',borderRadius:6,padding:'8px 10px',marginBottom:5,borderLeft:'2px solid #3b82f6',cursor:'pointer'}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#ddd',marginBottom:2}}>{s.title}</div>
                        <div style={{display:'flex',gap:6}}>
                          <span style={{fontSize:9,color:'#666'}}>{s.year}</span>
                          <span style={{fontSize:9,color:'#888'}}>{s.type.replace('_',' ')}</span>
                          {s.victims && <span style={{fontSize:9,color:'#ef4444',marginLeft:'auto'}}>☠ {s.victims.toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* ─ BUSTS list ─ */}
              {layerMode==='busts' && activeBusts.length>0 && (
                <div style={{marginBottom:14}}>
                  {activeBusts
                    .slice().sort((a: any,b: any)=>{
                      const akg = a.drugs?.reduce((s: any,d: any)=>s+d.kg,0)||0;
                      const bkg = b.drugs?.reduce((s: any,d: any)=>s+d.kg,0)||0;
                      return bkg-akg;
                    })
                    .map((bust: any) => {
                      const kg = bust.drugs?.reduce((s: any,d: any)=>s+d.kg,0)||0;
                      const val = bust.drugs?.reduce((s: any,d: any)=>s+(d.streetValueUSD||0),0)||0;
                      return (
                        <div key={bust.id} onClick={()=>{setSelectedBust(bust);setSelectedAttack(null);setSelectedSite(null);setSelectedState(null);if(bust.lat&&bust.lng)mapRef.current?.flyTo(bust.lat,bust.lng,8);}}
                          style={{background:'#111',borderRadius:6,padding:'8px 10px',marginBottom:5,borderLeft:`2px solid ${bust.significance==='critical'?'#4ade80':'#1a3a1a'}`,cursor:'pointer'}}>
                          <div style={{fontSize:11,fontWeight:700,color:'#ddd',marginBottom:2}}>{bust.title}</div>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                            <span style={{fontSize:9,color:'#666'}}>{bust.year}</span>
                            {kg>0 && <span style={{fontSize:9,color:'#4ade80'}}>💊 {kg>=1000?`${(kg/1000).toFixed(1)}t`:`${kg}kg`}</span>}
                            {val>0 && <span style={{fontSize:9,color:'#fbbf24'}}>${val>=1e9?`${(val/1e9).toFixed(1)}B`:`${(val/1e6).toFixed(0)}M`}</span>}
                            {bust.arrests && <span style={{fontSize:9,color:'#a78bfa'}}>⚖{bust.arrests.toLocaleString()}</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* ─ WARS list ─ */}
              {layerMode==='wars' && activeWars.length>0 && (
                <div style={{marginBottom:14}}>
                  {activeWars.map((w: CartelWar) => {
                    const c1 = CARTELS.find(c=>c.id===w.cartel1);
                    const c2 = CARTELS.find(c=>c.id===w.cartel2);
                    const isSelected = (selectedWar as CartelWar|null)?.id === w.id;
                    return (
                      <div key={w.id} onClick={()=>{setSelectedWar((x: CartelWar|null)=>x?.id===w.id?null:w);setSelectedAttack(null);setSelectedSite(null);setSelectedBust(null);setSelectedState(null);if(w.lat&&w.lng)mapRef.current?.flyTo(w.lat,w.lng,6);}}
                        style={{background:isSelected?'#1f1a0a':'#1a1a2e',borderRadius:6,padding:'8px 10px',marginBottom:5,
                          borderLeft:`2px solid ${isSelected?'#f97316':'#C8282D'}`,cursor:'pointer',
                          transition:'background 0.15s'}}>
                        <div style={{fontSize:11,fontWeight:700,color:isSelected?'#f97316':'#fff',marginBottom:3}}>{w.title}</div>
                        <div style={{fontSize:10,color:'#666',marginBottom:4}}>
                          {c1?.name||w.cartel1} <span style={{color:'#444'}}>vs</span> {c2?.name||w.cartel2}
                          <span style={{marginLeft:8,color:'#555'}}>{w.startYear}–{w.endYear||'now'}</span>
                        </div>
                        {w.estimatedDeaths && <div style={{fontSize:10,color:'#ef4444',fontWeight:600}}>☠ ~{w.estimatedDeaths.toLocaleString()} deaths</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ─ HOTSPOTS list ─ */}
              {layerMode==='hotspots' && activeHotspots.length>0 && (
                <div ref={hotspotListRef} style={{marginBottom:14}}>
                  {activeHotspots.sort((a: any,b: any)=>b.intensity-a.intensity).map((h: any) => (
                    <div
                      key={h.id}
                      id={`hotspot-${h.id}`}
                      onClick={() => {
                        setSelectedHotspot((x: any) => x===h.id ? null : h.id);
                        mapRef.current?.flyTo(h.lat, h.lng, 7);
                      }}
                      style={{
                        background: selectedHotspot===h.id ? '#2a1a3e' : '#1a1a2e',
                        borderRadius:6, padding:'8px 10px', marginBottom:5,
                        borderLeft:`2px solid rgba(255,80,0,${h.intensity})`,
                        cursor:'pointer',
                        outline: selectedHotspot===h.id ? '1px solid rgba(255,80,0,0.5)' : 'none',
                        transition:'background 0.15s',
                      }}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                        <div style={{fontSize:11,fontWeight:700,color: selectedHotspot===h.id ? '#ff9050' : '#fff'}}>{h.name}</div>
                        <div style={{fontSize:10,color:'#f59e0b'}}>{Math.round(h.intensity*100)}%</div>
                      </div>
                      <div style={{fontSize:10,color:'#888',lineHeight:1.4}}>{h.cause.slice(0,120)}{h.cause.length>120?'…':''}</div>
                      {selectedHotspot===h.id && (
                        <div style={{marginTop:6,fontSize:10,color:'#aaa',lineHeight:1.5,borderTop:'1px solid #2a2a4a',paddingTop:6}}>
                          {h.cause}
                          {h.lat && <div style={{marginTop:4,color:'#555',fontSize:9}}>📍 {h.lat.toFixed(2)}°N, {Math.abs(h.lng).toFixed(2)}°W</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ─ ROUTES list ─ */}
              {layerMode==='routes' && activeRoutes.length>0 && (
                <div style={{marginBottom:14}}>
                  {activeRoutes.map((r: any) => {
                    const c = CARTELS.find(x=>x.id===r.cartelId);
                    const col = CARTEL_COLORS[r.cartelId]||'#555';
                    const isSelected = selectedRoute === r.id;
                    return (
                      <div key={r.id}
                        onClick={() => setSelectedRoute((x: any) => x===r.id ? null : r.id)}
                        style={{background: isSelected ? '#1a1a3e' : '#111',borderRadius:6,padding:'8px 10px',marginBottom:5,
                          borderLeft:`3px solid ${col}`,cursor:'pointer',
                          outline: isSelected ? `1px solid ${col}55` : 'none',
                          transition:'all 0.15s'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                          <span style={{fontSize:11}}>{r.type==='air'?'✈':r.type==='sea'?'🚢':'🚚'}</span>
                          <div style={{fontSize:11,fontWeight:700,color: isSelected ? '#fff' : '#ddd',flex:1,lineHeight:1.3}}>{r.name}</div>
                          <div style={{fontSize:9,padding:'1px 5px',borderRadius:3,
                            background: r.volume==='massive'?'#ef444433':r.volume==='high'?'#f59e0b33':'#55555533',
                            color: r.volume==='massive'?'#ef4444':r.volume==='high'?'#f59e0b':'#888',
                            fontWeight:700,flexShrink:0}}>{r.volume.toUpperCase()}</div>
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <span style={{fontSize:10,color:col,fontWeight:600}}>{c?.shortName}</span>
                          <span style={{fontSize:9,color:'#555'}}>{r.startYear}–{r.endYear===2026?'now':r.endYear}</span>
                          <span style={{fontSize:9,color:'#444'}}>{r.drugType.join(', ')}</span>
                        </div>
                        {isSelected && (
                          <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${col}33`,fontSize:11,color:'#aaa',lineHeight:1.6}}>
                            {r.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ─ CARTEL FILTER ─ */}
              <div style={{marginTop:8}}>
                <div style={{fontSize:10,color:'#333',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Cartel Filter — {year}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:14}}>
                  <button onClick={()=>setSelectedCartelFilter(null)}
                    style={{padding:'2px 7px',borderRadius:4,border:`1px solid ${!selectedCartelFilter?'#C8282D':'#222'}`,
                      background:!selectedCartelFilter?'#C8282D22':'transparent',color:'#888',fontSize:9,cursor:'pointer'}}>All</button>
                  {activeCartels.map((c: any) => (
                    <button key={c.id} onClick={()=>setSelectedCartelFilter((f: any) =>f===c.id?null:c.id)}
                      style={{padding:'2px 7px',borderRadius:4,
                        border:`1px solid ${selectedCartelFilter===c.id?(CARTEL_COLORS[c.id]||'#555'):'#222'}`,
                        background:selectedCartelFilter===c.id?`${CARTEL_COLORS[c.id]||'#555'}22`:'transparent',
                        color:selectedCartelFilter===c.id?'#fff':'#666',fontSize:9,cursor:'pointer'}}>
                      {c.shortName}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─ TERRITORY LEGEND ─ */}
              {layerMode==='territory' && (
                <div>
                  <div style={{fontSize:10,color:'#333',textTransform:'uppercase',letterSpacing:1,marginBottom:7}}>Control Legend</div>
                  {[{label:'Dominant',op:0.75},{label:'Partial',op:0.45},{label:'Contested',op:0.30}].map(l => (
                    <div key={l.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                      <div style={{width:22,height:12,background:`rgba(200,40,45,${l.op})`,borderRadius:2,border:'1px solid #C8282D44'}}/>
                      <span style={{fontSize:10,color:'#666'}}>{l.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>


    {isMobile && mobileControlsOpen && !hasSelection && (
      <div style={{position:'fixed',left:10,right:10,bottom:96,zIndex:1250,background:'#0f0f1ff2',border:'1px solid #2a2a3a',borderRadius:10,padding:'10px 10px 12px',backdropFilter:'blur(8px)',boxShadow:'0 -8px 30px rgba(0,0,0,0.4)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div style={{fontSize:10,color:'#777',textTransform:'uppercase',letterSpacing:1}}>Map Controls</div>
          <button onClick={() => setMobileControlsOpen(false)} style={{background:'none',border:'none',color:'#666',fontSize:14,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:8}}>
          {LAYER_BUTTONS.map(b => (
            <button key={`sheet-${b.id}`} onClick={() => { setLayerMode(b.id); setMobileControlsOpen(false); }}
              style={{padding:'4px 8px',borderRadius:6,border:`1px solid ${layerMode===b.id?'#C8282D':'#2a2a3a'}`,
                background:layerMode===b.id?'#C8282D22':'transparent',color:layerMode===b.id?'#fff':'#777',fontSize:10,cursor:'pointer',whiteSpace:'nowrap'}}>
              {b.emoji} {b.label}
            </button>
          ))}
        </div>
        {!['hotspots','routes','territory','wars'].includes(layerMode) && (
          <button onClick={() => setShowAll((s: any) => !s)}
            style={{padding:'4px 9px',borderRadius:6,border:`1px solid ${showAll?'#f59e0b':'#2a2a3a'}`,
              background:showAll?'#f59e0b22':'transparent',color:showAll?'#f59e0b':'#666',fontSize:10,cursor:'pointer',fontWeight:showAll?700:400,marginBottom:8}}>
            {showAll ? '✦ ALL events' : '✦ Show all events'}
          </button>
        )}
        <div style={{fontSize:10,color:'#777',marginBottom:6}}>Cartel filter</div>
        <div style={{display:'flex',gap:6,overflowX:'auto'}}>
          <button onClick={() => setSelectedCartelFilter(null)} style={{padding:'3px 8px',borderRadius:6,border:`1px solid ${!selectedCartelFilter?'#C8282D':'#2a2a3a'}`,background:!selectedCartelFilter?'#C8282D22':'transparent',color:!selectedCartelFilter?'#fff':'#666',fontSize:10,cursor:'pointer',whiteSpace:'nowrap'}}>All</button>
          {activeCartels.map((c: any) => (
            <button key={`mcf-${c.id}`} onClick={() => setSelectedCartelFilter((f: any) => f===c.id?null:c.id)}
              style={{padding:'3px 8px',borderRadius:6,border:`1px solid ${selectedCartelFilter===c.id?(CARTEL_COLORS[c.id]||'#555'):'#2a2a3a'}`,
                background:selectedCartelFilter===c.id?`${CARTEL_COLORS[c.id]||'#555'}22`:'transparent',color:selectedCartelFilter===c.id?'#fff':'#666',fontSize:10,cursor:'pointer',whiteSpace:'nowrap'}}>
              {c.shortName}
            </button>
          ))}
        </div>
      </div>
    )}


    {isMobile && !hasSelection && (
      <div style={{position:'fixed',left:0,right:0,bottom:0,zIndex:1200,background:'#0d0d1df2',backdropFilter:'blur(8px)',borderTop:'1px solid #2a2a3a',padding:'8px 12px 10px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <button
            onClick={() => { if (year >= 2026) { setYear(1930); setPlaying(true); } else setPlaying((p: any) => !p); }}
            style={{padding:'4px 10px',borderRadius:6,border:'1px solid #C8282D',background:playing?'#C8282D':'transparent',color:'#fff',fontSize:12,cursor:'pointer'}}
          >{playing ? '⏸' : '▶'}</button>
          <span style={{fontSize:18,fontWeight:800,color:'#C8282D',minWidth:48,textAlign:'center'}}>{year}</span>
          {era && <span style={{fontSize:10,color:'#aaa',background:`${era.color}22`,border:`1px solid ${era.color}44`,borderRadius:4,padding:'2px 6px',whiteSpace:'nowrap'}}>{era.label}</span>}
        </div>
        <input
          type='range'
          min={1930}
          max={2026}
          value={year}
          onChange={(e: any) => handleYearChange(Number(e.target.value))}
          style={{width:'100%',accentColor:'#C8282D'}}
        />
      </div>
    )}

    {/* ── PERSON PANEL (slide-over) ── */}
    <PersonPanel
      person={selectedPerson}
      onClose={() => { setSelectedPerson(null); setBloodTrailPersonId(null); }}
      onSelect={(p) => { setSelectedPerson(p); setBloodTrailPersonId(p.id); }}
      onOpen={(p) => setBloodTrailPersonId(p.id)}
    />
    </>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div style={{background:'#080810',minHeight:'100vh'}}/>}>
      <MapPageInner />
    </Suspense>
  );
}
