'use client';
import React, { useEffect, useRef, useMemo, useState, useImperativeHandle, forwardRef } from 'react';
import { CartelWar, ViolenceHotspot, TraffickingRoute, VIOLENCE_INDEX, CartelAttack, MassViolenceSite, DrugBust, CARTEL_ATTACKS, DRUG_BUSTS, CARTEL_WARS } from '@/lib/data';

interface TerritoryEntry { cartelId:string; control:string; color:string; opacity:number; leaderId?:string }
interface Props {
  territoryData: Record<string, TerritoryEntry[]>;
  activeWars: CartelWar[];
  activeHotspots: ViolenceHotspot[];
  activeRoutes: TraffickingRoute[];
  activeAttacks: CartelAttack[];
  activeSites: MassViolenceSite[];
  activeBusts: DrugBust[];
  layerMode: string;
  year: number;
  selectedState: string | null;
  cartelFilter: string | null;
  onStateHover: (code:string|null, x:number, y:number) => void;
  onStateClick: (code:string) => void;
  onAttackClick: (attack:CartelAttack) => void;
  onSiteClick: (site:MassViolenceSite) => void;
  onBustClick: (bust:DrugBust) => void;
  onWarClick: (war:CartelWar) => void;
  onHotspotClick?: (hotspot:ViolenceHotspot) => void;
  onRouteClick?: (route:TraffickingRoute) => void;
  selectedRoute?: string | null;
  selectedHotspot?: string | null;
  bloodTrailPersonId?: string | null;
}

export interface MexicoMapHandle {
  flyTo: (lat:number, lng:number, zoom?:number) => void;
}

const CARTEL_COLORS: Record<string,string> = {
  proto_sinaloa:'#5a1a1a', gulf_proto:'#1a2a5a', guadalajara:'#8B1A1A',
  sinaloa:'#C8282D', chapitos:'#FF6B35', tijuana:'#E8612A', juarez:'#D4A017',
  sonora_caro:'#8B4513', gulf:'#1A6B8A', zetas:'#2D5A27', beltran_leyva:'#7B3F8C',
  cjng:'#E63946', la_familia:'#2E8B57', knights_templar:'#8B6914', cdg_factions:'#1B4F72',
};

const STATE_CODES = ['AGU','BCN','BCS','CAM','CHH','CHP','COA','COL','CMX','DUR','GRO','GUA',
  'HID','JAL','MEX','MIC','MOR','NAY','NLE','OAX','PUE','QUE','ROO','SIN','SLP','SON','TAB','TAM','TLA','VER','YUC','ZAC'];

const TOOLTIP_CSS = `
.ctt.leaflet-tooltip {
  background: #0d0d1f !important;
  border: 1px solid #2a2a45 !important;
  border-radius: 6px !important;
  padding: 0 !important;
  box-shadow: 0 6px 24px rgba(0,0,0,0.85) !important;
  white-space: nowrap !important;
  max-width: none !important;
  pointer-events: none;
}
.ctt.leaflet-tooltip::before { display: none !important; }
.ctt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
}
.ctt-row + .ctt-row { border-top: 1px solid #1a1a30; }
.ctt-title { font-weight:700; font-size:12px; color:#fff; flex:1; }
.ctt-pill  { font-size:10px; color:#666; background:#161625; border-radius:3px; padding:2px 7px; flex-shrink:0; }
.ctt-stat  { font-size:11px; color:#f87171; font-weight:700; flex-shrink:0; }
.ctt-green { color:#4ade80; }
`;

function computeFills(
  td: Record<string, TerritoryEntry[]>,
  lm: string, yr: number, cf: string|null
): Record<string, {color:string; opacity:number}> {
  const out: Record<string, {color:string; opacity:number}> = {};
  for (const code of STATE_CODES) {
    if (lm === 'hotspots') {
      const data = (VIOLENCE_INDEX as any)[code];
      if (data) {
        const years = Object.keys(data).map(Number).sort((a,b)=>a-b);
        let v = 0;
        if (yr <= years[0]) v = data[years[0]];
        else if (yr >= years[years.length-1]) v = data[years[years.length-1]];
        else {
          const lo = years.filter(y=>y<=yr).pop()!;
          const hi = years.filter(y=>y>yr)[0];
          v = data[lo] + (data[hi]-data[lo])*(yr-lo)/(hi-lo);
        }
        const r = Math.round(80+v*175), g2 = Math.round(10+(1-v)*30), b2 = Math.round(10+(1-v)*20);
        out[code] = { color:`rgb(${r},${g2},${b2})`, opacity: v>0.05 ? 0.3+v*0.65 : 0.08 };
      } else {
        out[code] = { color:'#1a1a2e', opacity:0.08 };
      }
    } else {
      const entries = td[code] || [];
      if (!entries.length) { out[code] = { color:'#1a1a2e', opacity:0.08 }; continue; }
      const top = [...entries].sort((a,b)=>b.opacity-a.opacity)[0];
      const dimmed = cf && top.cartelId !== cf;
      out[code] = { color:top.color, opacity: dimmed ? 0.04 : top.opacity };
    }
  }
  return out;
}

function featureStyle(code:string, fills:Record<string,{color:string;opacity:number}>, sel:string|null) {
  const fill = fills[code] || { color:'#1a1a2e', opacity:0.08 };
  return {
    fillColor: fill.color, fillOpacity: fill.opacity,
    color: code===sel ? '#ffffff' : '#2a2a4a',
    weight: code===sel ? 2.5 : 0.8,
    opacity: code===sel ? 1 : 0.6,
  };
}

// Compact horizontal tooltip: [title] [pill badge] [stat]
function makeTT(title:string, pill:string, stat?:string, statClass='ctt-stat') {
  const s = stat ? `<span class="${statClass}">${stat}</span>` : '';
  return `<div class="ctt-row"><span class="ctt-title">${title}</span><span class="ctt-pill">${pill}</span>${s}</div>`;
}

const MexicoMap = forwardRef<MexicoMapHandle, Props>(function MexicoMap({
  territoryData, activeWars, activeHotspots, activeRoutes, selectedHotspot, bloodTrailPersonId, selectedRoute,
  activeAttacks, activeSites, activeBusts,
  layerMode, year, selectedState, cartelFilter,
  onStateHover, onStateClick, onAttackClick, onSiteClick, onBustClick, onWarClick, onHotspotClick, onRouteClick,
}: Props, ref) {
  const mapDivRef     = useRef<HTMLDivElement>(null);
  const leafletRef    = useRef<any>(null);
  const mapRef        = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, zoom = 8) => {
      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
      }
    }
  }));
  const stateLayerRef = useRef<any>(null);
  const markersRef    = useRef<any>(null);
  const routesRef     = useRef<any>(null);
  const initRef       = useRef(false);
  const [geoReady, setGeoReady] = useState(false);

  const stateFills = useMemo(
    () => computeFills(territoryData, layerMode, year, cartelFilter),
    [territoryData, layerMode, year, cartelFilter]
  );

  const fillsRef = useRef(stateFills);
  fillsRef.current = stateFills;
  const selRef = useRef(selectedState);
  selRef.current = selectedState;

  function applyFills() {
    const layer = stateLayerRef.current;
    if (!layer) return;
    layer.eachLayer((lyr:any) => {
      const code = lyr.feature?.properties?.state_code || '';
      lyr.setStyle(featureStyle(code, fillsRef.current, selRef.current));
    });
  }
  useEffect(() => { applyFills(); }, [stateFills, selectedState, geoReady]); // eslint-disable-line

  // ── ONE-TIME INIT ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current || !mapDivRef.current) return;
    initRef.current = true;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id='leaflet-css'; link.rel='stylesheet';
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('ctt-css')) {
      const s = document.createElement('style');
      s.id='ctt-css'; s.textContent=TOOLTIP_CSS;
      document.head.appendChild(s);
    }

    const getLeaflet = (): Promise<any> => {
      if ((window as any).L?.map) return Promise.resolve((window as any).L);
      return new Promise((resolve, reject) => {
        // If script tag already exists, just poll for L to be ready
        if (document.querySelector('script[data-leaflet]')) {
          const t = setInterval(() => { if ((window as any).L?.map) { clearInterval(t); resolve((window as any).L); } }, 30);
          setTimeout(() => { clearInterval(t); reject(new Error('Leaflet load timeout')); }, 10000);
          return;
        }
        const el = document.createElement('script');
        el.setAttribute('data-leaflet','1');
        el.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        el.onload = () => {
          const t = setInterval(() => { if ((window as any).L?.map) { clearInterval(t); resolve((window as any).L); } }, 20);
          setTimeout(() => { clearInterval(t); reject(new Error('Leaflet init timeout')); }, 10000);
        };
        el.onerror = () => reject(new Error('Leaflet script failed'));
        document.head.appendChild(el);
      });
    };

    (async () => {
      let L: any;
      try { L = await getLeaflet(); }
      catch(e) { console.error('Leaflet load failed:', e); initRef.current=false; return; }

      const div = mapDivRef.current;
      if (!div || mapRef.current) return;

      // Clear any stale Leaflet instance on this div (HMR safety)
      if ((div as any)._leaflet_id != null) {
        try { (div as any)._leaflet = undefined; (div as any)._leaflet_id = undefined; div.innerHTML=''; } catch {}
      }

      leafletRef.current = L;

      const map = L.map(div, {
        center:[23.5,-102.5], zoom:5,
        zoomControl:true, attributionControl:true, minZoom:4, maxZoom:13,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:'© OpenStreetMap © CARTO', subdomains:'abcd', maxZoom:19,
      }).addTo(map);

      mapRef.current     = map;
      markersRef.current = L.layerGroup().addTo(map);
      routesRef.current  = L.layerGroup().addTo(map);

      // ── Load GeoJSON from local /public/mexico-states.geojson ─────────────
      let geojson: any = null;
      try {
        const res = await fetch('/mexico-states.geojson');
        if (res.ok) geojson = await res.json();
        else console.error('GeoJSON fetch failed:', res.status);
      } catch(e) { console.error('GeoJSON fetch error:', e); }

      if (!geojson?.features?.length) {
        console.error('GeoJSON missing or empty');
        return;
      }

      const stateLayer = L.geoJSON(geojson, {
        style: (feature:any) => {
          const code = feature?.properties?.state_code || '';
          return featureStyle(code, fillsRef.current, selRef.current);
        },
        onEachFeature: (feature:any, lyr:any) => {
          const code = feature?.properties?.state_code || '';
          lyr.on({
            mouseover: (e:any) => {
              onStateHover(code, e.originalEvent.clientX, e.originalEvent.clientY);
              lyr.setStyle({ weight:2, color:'#ffffff99' });
            },
            mouseout: () => {
              onStateHover(null,0,0);
              lyr.setStyle(featureStyle(code, fillsRef.current, selRef.current));
            },
            click: () => onStateClick(code),
          });
        },
      }).addTo(map);

      stateLayerRef.current = stateLayer;
      setGeoReady(true);
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current=null; stateLayerRef.current=null;
        markersRef.current=null; routesRef.current=null;
        leafletRef.current=null; initRef.current=false;
        setGeoReady(false);
      }
    };
  }, []); // eslint-disable-line

  // ── MARKERS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const L  = leafletRef.current;
    const ml = markersRef.current;
    const rl = routesRef.current;
    if (!L || !ml) return;

    ml.clearLayers();
    if (rl) rl.clearLayers();

    const mkIcon = (emoji:string, sz:number, glow?:string) => L.divIcon({
      html:`<div style="font-size:${sz}px;line-height:1;filter:${glow?`drop-shadow(0 0 6px ${glow})`:'none'};cursor:pointer;user-select:none">${emoji}</div>`,
      className:'', iconSize:[sz,sz], iconAnchor:[sz/2,sz/2],
    });

    activeAttacks.forEach(a => {
      if (!a.lat||!a.lng) return;
      const sz = a.significance==='critical'?24:a.significance==='high'?20:15;
      const glow = a.significance==='critical'?'#ef4444':a.significance==='high'?'#f97316':undefined;
      const m = L.marker([a.lat,a.lng],{icon:mkIcon('⚔',sz,glow)});
      m.on('click',()=>onAttackClick(a));
      m.bindTooltip(makeTT(a.title,`${a.year} · ${a.stateCode}`,a.killed?`☠ ${a.killed.toLocaleString()}`:undefined),{className:'ctt',sticky:true});
      ml.addLayer(m);
    });

    const siteEmoji: Record<string,string> = {body_dump:'🔵',mass_grave:'⚫',burn_site:'🔥',hanging:'🔗',dismemberment:'💜'};
    activeSites.forEach(s => {
      if (!s.lat||!s.lng) return;
      const m = L.marker([s.lat,s.lng],{icon:mkIcon(siteEmoji[s.type]||'💀',18,'#dc2626')});
      m.on('click',()=>onSiteClick(s));
      m.bindTooltip(makeTT(s.title,`${s.year} · ${s.stateCode}`,s.victims?`${s.victims.toLocaleString()} victims`:undefined),{className:'ctt',sticky:true});
      ml.addLayer(m);
    });

    activeBusts.forEach(b => {
      if (!b.lat||!b.lng) return;
      const sz = b.significance==='critical'?22:b.significance==='high'?18:14;
      const kg = b.drugs?.reduce((acc:number,d:any)=>acc+d.kg,0)||0;
      const seizure = kg ? `💊 ${kg>=1000?(kg/1000).toFixed(1)+'t':kg+'kg'}` : undefined;
      const m = L.marker([b.lat,b.lng],{icon:mkIcon('💊',sz,b.significance==='critical'?'#4ade80':undefined)});
      m.on('click',()=>onBustClick(b));
      m.bindTooltip(makeTT(b.title,`${b.year} · ${b.stateCode}`,seizure,'ctt-stat ctt-green'),{className:'ctt',sticky:true});
      ml.addLayer(m);
    });

    activeWars.forEach(w => {
      if (!w.lat||!w.lng) return;
      const yrs = w.endYear?`${w.startYear}–${w.endYear}`:`${w.startYear}–now`;
      const deaths = w.estimatedDeaths?`☠ ~${w.estimatedDeaths.toLocaleString()}`:undefined;
      const m = L.marker([w.lat,w.lng],{icon:mkIcon('🔥',26,'#f97316')});
      m.on('click',()=>onWarClick(w));
      m.bindTooltip(makeTT(w.title,yrs,deaths),{className:'ctt',sticky:true});
      ml.addLayer(m);
    });

    if (layerMode==='hotspots') {
      activeHotspots.forEach(h => {
        if (!h.lat||!h.lng) return;
        const isSelected = h.id === selectedHotspot;
        const size = isSelected ? 32 : 22;
        const icon = isSelected
          ? L.divIcon({ className:'', html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,100,0,0.3);border:2px solid #ff6400;display:flex;align-items:center;justify-content:center;font-size:${size*0.6}px;animation:hotspot-pulse 1s infinite alternate">🔴</div>`, iconSize:[size,size], iconAnchor:[size/2,size/2] })
          : mkIcon('🔴', size, '#ef4444');
        const m = L.marker([h.lat,h.lng],{icon, zIndexOffset: isSelected ? 1000 : 0});
        m.bindTooltip(makeTT(h.name,`${h.stateCode} · ${h.startYear}–${h.endYear||'now'}`,`${Math.round(h.intensity*100)}% index`),{className:'ctt',sticky:true});
        m.on('click', () => { if (onHotspotClick) onHotspotClick(h); });
        ml.addLayer(m);
      });
    }

    if (rl) {
      activeRoutes.forEach(r => {
        if (!r.waypoints?.length||r.waypoints.length<2) return;
        const lls = r.waypoints.map((p:[number,number])=>[p[1],p[0]]);
        const color = CARTEL_COLORS[r.cartelId]||'#888';
        const isSelected = r.id === selectedRoute;
        const weight = r.volume==='massive' ? 4 : r.volume==='high' ? 3 : 2;
        const dash = r.type==='air' ? '4,10' : r.type==='sea' ? '10,8' : undefined;

        // Glow layer (wider, low opacity)
        L.polyline(lls,{
          color, weight: weight+4, opacity: isSelected ? 0.35 : 0.15,
          dashArray: dash, interactive: false,
        }).addTo(rl);

        // Main line
        const line = L.polyline(lls,{
          color, weight: isSelected ? weight+2 : weight,
          opacity: isSelected ? 1 : 0.8,
          dashArray: dash,
        });

        line.bindTooltip(makeTT(
          r.name,
          `${r.cartelId.replace('_',' ').toUpperCase()} · ${r.type.toUpperCase()}`,
          r.volume.toUpperCase(),
          r.volume==='massive'?'ctt-stat':r.volume==='high'?'ctt-stat':'ctt-pill'
        ),{className:'ctt',sticky:true});

        line.on('click', () => { if (onRouteClick) onRouteClick(r); });
        line.addTo(rl);

        // Direction arrow at midpoint
        const mid = lls[Math.floor(lls.length/2)];
        const prev = lls[Math.floor(lls.length/2)-1];
        if (mid && prev) {
          const angle = Math.atan2(
            (mid as number[])[0]-(prev as number[])[0],
            (mid as number[])[1]-(prev as number[])[1]
          ) * 180/Math.PI;
          L.marker(mid as any,{
            icon: L.divIcon({
              className:'',
              html:`<div style="color:${color};font-size:${isSelected?14:10}px;opacity:${isSelected?1:0.7};transform:rotate(${angle}deg);line-height:1">➤</div>`,
              iconSize:[14,14], iconAnchor:[7,7],
            }),
            interactive:false,
          }).addTo(rl);
        }
      });
    }
  }, [activeAttacks,activeSites,activeBusts,activeWars,activeHotspots,activeRoutes,layerMode,selectedHotspot,bloodTrailPersonId,selectedRoute]); // eslint-disable-line

  // ── Blood trail overlay ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Remove existing blood trail layer
    if ((map as any)._bloodTrailLayer) {
      (map as any)._bloodTrailLayer.remove();
      (map as any)._bloodTrailLayer = null;
    }
    if (!bloodTrailPersonId) return;

    const btl = (window as any).L?.layerGroup().addTo(map);
    (map as any)._bloodTrailLayer = btl;
    if (!btl) return;

    const L = (window as any).L;
    if (!L) return;

    // All attacks involving this person
    CARTEL_ATTACKS.filter(a => a.personIds?.includes(bloodTrailPersonId)).forEach(a => {
      if (!a.lat || !a.lng) return;
      const circle = L.circleMarker([a.lat, a.lng], {
        radius: 10, color: '#ff0000', fillColor: '#ff0000', fillOpacity: 0.7,
        weight: 2, opacity: 1,
      });
      circle.bindTooltip(`⚔️ ${a.title} (${a.year})`, {className:'ctt',sticky:true});
      btl.addLayer(circle);
    });

    // All busts involving this person
    DRUG_BUSTS.filter(b => b.personIds?.includes(bloodTrailPersonId)).forEach(b => {
      if (!b.lat || !b.lng) return;
      const circle = L.circleMarker([b.lat, b.lng], {
        radius: 9, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.7,
        weight: 2, opacity: 1,
      });
      circle.bindTooltip(`💊 ${b.title} (${b.year})`, {className:'ctt',sticky:true});
      btl.addLayer(circle);
    });

    // Wars involving this person — draw as pulsing region
    CARTEL_WARS.filter(w => w.personIds?.includes(bloodTrailPersonId)).forEach(w => {
      if (!w.lat || !w.lng) return;
      const circle = L.circleMarker([w.lat, w.lng], {
        radius: 18, color: '#f97316', fillColor: '#f97316', fillOpacity: 0.2,
        weight: 2, opacity: 0.8, dashArray: '4,4',
      });
      circle.bindTooltip(`🔥 ${w.title}`, {className:'ctt',sticky:true});
      btl.addLayer(circle);
    });

    return () => {
      if ((map as any)._bloodTrailLayer) {
        (map as any)._bloodTrailLayer.remove();
        (map as any)._bloodTrailLayer = null;
      }
    };
  }, [bloodTrailPersonId]); // eslint-disable-line

  return <div ref={mapDivRef} style={{width:'100%',height:'100%',background:'#0a0a16'}} />;
});

export default MexicoMap;
