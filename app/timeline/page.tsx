'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { HISTORICAL_EVENTS, CARTELS, PEOPLE, HistoricalEvent, ERA_LABELS, getEraForYear } from '@/lib/data';
import CoffeeButton from '@/components/CoffeeButton';

const CARTEL_COLORS: Record<string, string> = {
  proto_sinaloa:'#5a1a1a', gulf_proto:'#1a2a5a', guadalajara:'#8B1A1A',
  sinaloa:'#C8282D', chapitos:'#FF6B35', tijuana:'#E8612A', juarez:'#D4A017',
  sonora_caro:'#8B4513', gulf:'#1A6B8A', zetas:'#2D5A27', beltran_leyva:'#7B3F8C',
  cjng:'#E63946', la_familia:'#2E8B57', knights_templar:'#8B6914', cdg_factions:'#1B4F72',
};

const TYPE_ICONS: Record<string, string> = {
  founding:'🏛', war:'⚔', assassination:'🎯', arrest:'⚖', split:'💥',
  alliance:'🤝', massacre:'💀', death:'✕', escape:'🏃', operation:'🪖',
  bust:'💊',
};
const TYPE_COLORS: Record<string, string> = {
  founding:'#22c55e', war:'#ef4444', assassination:'#dc2626', arrest:'#f59e0b',
  split:'#f97316', alliance:'#3b82f6', massacre:'#991b1b', death:'#6b7280',
  escape:'#a855f7', operation:'#06b6d4', bust:'#4ade80',
};
const SIG_WEIGHT: Record<string, number> = { low:1, medium:2, high:3, critical:4 };

export default function TimelinePage() {
  const [filterCartel, setFilterCartel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSig, setFilterSig] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent|null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const filtered = useMemo(() => {
    return HISTORICAL_EVENTS.filter(ev => {
      if (filterCartel !== 'all' && !((ev.cartelIds||[])||[]).includes(filterCartel)) return false;
      if (filterType !== 'all' && ev.type !== filterType) return false;
      if (filterSig !== 'all' && ev.significance !== filterSig) return false;
      if (searchQuery && !ev.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !ev.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }).sort((a,b) => a.year !== b.year ? a.year - b.year : (a.month||0) - (b.month||0));
  }, [filterCartel, filterType, filterSig, searchQuery]);

  // Group by decade
  const byDecade = useMemo(() => {
    const map: Record<string, HistoricalEvent[]> = {};
    filtered.forEach((ev: any) => {
      const decade = Math.floor(ev.year / 10) * 10;
      const key = `${decade}s`;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [filtered]);
  const decades = Object.keys(byDecade).sort();

  return (
    <div style={{ background:'#0a0a16', minHeight:'100vh', color:'#fff', fontFamily:'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background:'#0f0f1f', borderBottom:'1px solid #333', padding:isMobile?'10px 12px':'12px 20px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <Link href="/" style={{ color:'#888', textDecoration:'none', fontSize:13 }}>← Home</Link>
        <Link href="/map" style={{ color:'#888', textDecoration:'none', fontSize:13 }}>🗺 Map</Link>
        <Link href="/family-tree" style={{ color:'#888', textDecoration:'none', fontSize:13 }}>🌳 Blood Ties</Link>
        <div style={{ flex:1 }}/>
        <h1 style={{ margin:0, fontSize:isMobile?13:16, fontWeight:700, color:'#C8282D' }}>CARTEL ATLAS — Timeline 1930–2026</h1>
        <div style={{ flex:1 }}/>
        <div style={{ color:'#666', fontSize:12 }}>{filtered.length} events</div>
      </div>

      {/* Filters */}
      <div style={{ background:'#0f0f1f', borderBottom:'1px solid #222', padding:isMobile?'10px 12px':'10px 20px', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <input placeholder="Search events…" value={searchQuery} onChange={(e: any) =>setSearchQuery(e.target.value)}
          style={{ background:'#1a1a2e', border:'1px solid #333', borderRadius:6, padding:'7px 10px', color:'#fff', fontSize:12, width:isMobile?'100%':200 }}/>
        
        <select value={filterCartel} onChange={(e: any) =>setFilterCartel(e.target.value)}
          style={{ background:'#1a1a2e', border:'1px solid #333', borderRadius:6, padding:'7px 8px', color:'#fff', fontSize:12, minWidth:isMobile?'calc(50% - 4px)':'auto', flex:isMobile?1:'unset' }}>
          <option value="all">All Cartels</option>
          {CARTELS.map(c=><option key={c.id} value={c.id}>{c.shortName}</option>)}
        </select>

        <select value={filterType} onChange={(e: any) =>setFilterType(e.target.value)}
          style={{ background:'#1a1a2e', border:'1px solid #333', borderRadius:6, padding:'7px 8px', color:'#fff', fontSize:12, minWidth:isMobile?'calc(50% - 4px)':'auto', flex:isMobile?1:'unset' }}>
          <option value="all">All Types</option>
          {Object.keys(TYPE_ICONS).map(t=><option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
        </select>

        <select value={filterSig} onChange={(e: any) =>setFilterSig(e.target.value)}
          style={{ background:'#1a1a2e', border:'1px solid #333', borderRadius:6, padding:'7px 8px', color:'#fff', fontSize:12, minWidth:isMobile?'calc(50% - 4px)':'auto', flex:isMobile?1:'unset' }}>
          <option value="all">All Significance</option>
          <option value="critical">🔴 Critical</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">⚪ Low</option>
        </select>

        <button onClick={()=>{setFilterCartel('all');setFilterType('all');setFilterSig('all');setSearchQuery('');}}
          style={{ padding:'7px 10px', borderRadius:6, border:'1px solid #444', background:'transparent', color:'#888', fontSize:12, cursor:'pointer' }}>
          Clear
        </button>

        {/* Type legend */}
        <div style={{ marginLeft:isMobile?0:'auto', width:isMobile?'100%':'auto', display:'flex', gap:8, flexWrap:'wrap' }}>
          {Object.entries(TYPE_ICONS).slice(0,6).map(([t,icon])=>(
            <span key={t} style={{ fontSize:10, color:'#888', display:'flex', alignItems:'center', gap:3 }}>
              {icon} {t}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 360px', height:isMobile?'auto':'calc(100vh - 110px)' }}>
        {/* Timeline */}
        <div style={{ overflowY:'auto', padding:isMobile?'12px':'20px 24px' }}>
          {decades.length === 0 && (
            <div style={{ textAlign:'center', color:'#555', padding:60, fontSize:16 }}>No events match filters</div>
          )}
          {decades.map(decade => {
            const events = byDecade[decade];
            const decadeNum = parseInt(decade);
            const era = getEraForYear(decadeNum);
            return (
              <div key={decade} style={{ marginBottom:32 }}>
                {/* Decade header */}
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ fontSize:24, fontWeight:900, color:'#444' }}>{decade}</div>
                  {era && (
                    <div style={{ padding:'3px 10px', borderRadius:12, background:`${era.color}33`, border:`1px solid ${era.color}66`, fontSize:11, color:'#ccc' }}>
                      {era.label}
                    </div>
                  )}
                  <div style={{ flex:1, height:1, background:'#222' }}/>
                  <div style={{ fontSize:11, color:'#555' }}>{events.length} events</div>
                </div>

                {/* Events */}
                <div style={{ position:'relative', paddingLeft:24 }}>
                  {/* Vertical line */}
                  <div style={{ position:'absolute', left:8, top:0, bottom:0, width:2, background:'#1a1a2e' }}/>
                  
                  {events.map((ev: any) => {
                    const typeColor = TYPE_COLORS[ev.type] || '#888';
                    const sigW = SIG_WEIGHT[ev.significance];
                    const isSelected = selectedEvent?.id === ev.id;
                    const mainCartelColor = ((ev.cartelIds||[])||[])[0] ? (CARTEL_COLORS[((ev.cartelIds||[])||[])[0]] || '#888') : '#888';
                    
                    return (
                      <div key={ev.id} onClick={()=>setSelectedEvent(isSelected?null:ev)}
                        style={{
                          position:'relative', marginBottom:12, padding:'10px 14px',
                          background: isSelected ? `${mainCartelColor}22` : '#111',
                          border: `1px solid ${isSelected ? mainCartelColor : sigW>=4?'#333':'#1e1e1e'}`,
                          borderLeft: `3px solid ${typeColor}`,
                          borderRadius:'0 8px 8px 0',
                          cursor:'pointer', transition:'all 0.15s',
                        }}>
                        {/* Timeline dot */}
                        <div style={{
                          position:'absolute', left:-20, top:14,
                          width: sigW>=4?14:sigW>=3?12:10, height: sigW>=4?14:sigW>=3?12:10,
                          borderRadius:'50%', background: typeColor,
                          border:`2px solid ${sigW>=4?'#fff':'#0a0a16'}`,
                          boxShadow: sigW>=4?`0 0 8px ${typeColor}`:'none',
                        }}/>

                        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                          <span style={{ fontSize:18, flexShrink:0, lineHeight:1 }}>{TYPE_ICONS[ev.type]||'•'}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                              <span style={{ fontSize:11, color:'#888', fontFamily:'monospace', fontWeight:700 }}>
                                {ev.year}{ev.month?`.${String(ev.month).padStart(2,'0')}`:''} 
                              </span>
                              <span style={{ fontSize:13, fontWeight:700, color: sigW>=4?'#fff':'#ddd' }}>{ev.title}</span>
                              {ev.significance==='critical'&&<span style={{ fontSize:10, background:'#dc2626', color:'#fff', padding:'1px 6px', borderRadius:10, fontWeight:700 }}>CRITICAL</span>}
                            </div>
                            <div style={{ fontSize:11, color:'#888', lineHeight:1.5 }}>
                              {isSelected ? ev.description : `${ev.description.slice(0,120)}${ev.description.length>120?'…':''}`}
                            </div>
                            {isSelected && ev.personIds && ev.personIds.length>0 && (
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                                {ev.personIds.map((pid: any) => {
                                  const p = PEOPLE.find(x=>x.id===pid);
                                  return p ? <span key={pid} style={{ fontSize:10, background:'#1a1a2e', border:'1px solid #333', borderRadius:10, padding:'2px 8px', color:'#ccc' }}>👤 {p.name}</span> : null;
                                })}
                              </div>
                            )}
                            <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                              {((ev.cartelIds||[])||[]).map((cid: any) => {
                                const c = CARTELS.find(x=>x.id===cid);
                                return c ? <span key={cid} style={{ fontSize:9, background:`${CARTEL_COLORS[cid]}33`, border:`1px solid ${CARTEL_COLORS[cid]}66`, color:'#ccc', borderRadius:4, padding:'1px 6px' }}>{c.shortName}</span> : null;
                              })}
                              {ev.stateCode && <span style={{ fontSize:9, color:'#666', padding:'1px 4px' }}>📍{ev.stateCode}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar — Era overview + selected event */}
        <div style={{ borderLeft:isMobile?'none':'1px solid #222', overflowY:'auto', background:'#0a0a16', display:isMobile?'none':'block' }}>
          {selectedEvent ? (
            <div style={{ padding:20 }}>
              <button onClick={()=>setSelectedEvent(null)} style={{ background:'transparent', border:'1px solid #333', color:'#888', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, marginBottom:16 }}>← Back</button>
              <div style={{ marginBottom:12 }}>
                <span style={{ fontSize:28 }}>{TYPE_ICONS[selectedEvent.type]||'•'}</span>
                {selectedEvent.significance==='critical'&&<span style={{ marginLeft:8, fontSize:11, background:'#dc2626', color:'#fff', padding:'2px 8px', borderRadius:10 }}>CRITICAL EVENT</span>}
              </div>
              <h2 style={{ color:'#fff', margin:'0 0 4px', fontSize:18 }}>{selectedEvent.title}</h2>
              <div style={{ color:'#888', fontSize:13, marginBottom:16 }}>
                {selectedEvent.year}{selectedEvent.month&&`.${String(selectedEvent.month).padStart(2,'0')}`}
                {selectedEvent.location&&` · ${selectedEvent.location}`}
                {selectedEvent.stateCode&&` · ${selectedEvent.stateCode}`}
              </div>
              <div style={{ color:'#ccc', fontSize:13, lineHeight:1.7, marginBottom:16 }}>{selectedEvent.description}</div>
              {selectedEvent.drugVolume && (
                <div style={{ marginBottom:16, padding:'10px 14px', background:'#0a1f0a', border:'1px solid #1a4a1a', borderRadius:8, display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18 }}>💊</span>
                  <div>
                    <div style={{ fontSize:10, color:'#4ade80', textTransform:'uppercase', marginBottom:2 }}>Seized / Volume</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{selectedEvent.drugVolume}</div>
                  </div>
                </div>
              )}
              {selectedEvent.personIds&&selectedEvent.personIds.length>0&&(
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', marginBottom:8 }}>Key People</div>
                  {selectedEvent.personIds.map((pid: any) =>{
                    const p = PEOPLE.find(x=>x.id===pid);
                    return p ? <div key={pid} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, background:'#1a1a2e', borderRadius:6, padding:'6px 10px' }}>
                      <div style={{ fontSize:16 }}>{p.status==='killed'?'✕':p.status==='arrested'?'⚖':'👤'}</div>
                      <div style={{flex:1}}><div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{p.name}</div><div style={{ fontSize:10, color:'#888' }}>{p.alias[0]}</div></div>
                      <div style={{display:'flex',gap:4,flexShrink:0}}>
                        {(p as any).wikipediaUrl && <a href={(p as any).wikipediaUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'#6b9fff',textDecoration:'none',border:'1px solid #2a4a8a',borderRadius:4,padding:'2px 6px'}}>📖</a>}
                        <a href={`/family-tree?person=${p.id}`} style={{fontSize:11,color:'#C8282D',textDecoration:'none',border:'1px solid #C8282D55',borderRadius:4,padding:'2px 6px'}}>🌳</a>
                      </div>
                    </div> : null;
                  })}
                </div>
              )}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', marginBottom:8 }}>Cartels Involved</div>
                {(selectedEvent.cartelIds||[]).map((cid: any) =>{
                  const c = CARTELS.find(x=>x.id===cid);
                  return c ? <div key={cid} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, background:'#111', borderRadius:5, padding:'5px 8px' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:CARTEL_COLORS[cid]||'#555', flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:'#ccc', flex:1 }}>{c.name}</span>
                    {(c as any).wikipediaUrl && <a href={(c as any).wikipediaUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:'#6b9fff',textDecoration:'none',border:'1px solid #2a4a8a',borderRadius:4,padding:'2px 6px',flexShrink:0}}>📖 Wiki</a>}
                  </div> : null;
                })}
              </div>
              <div style={{ background:'#111', borderRadius:8, padding:'10px 14px', border:'1px solid #222' }}>
                <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', marginBottom:6 }}>Significance</div>
                <div style={{ fontSize:12, color:'#ccc' }}>
                  {selectedEvent.significance==='critical'&&'🔴 Critical — fundamentally changed the cartel landscape'}
                  {selectedEvent.significance==='high'&&'🟠 High — major impact on cartel power dynamics'}
                  {selectedEvent.significance==='medium'&&'🟡 Medium — important but localized impact'}
                  {selectedEvent.significance==='low'&&'⚪ Low — notable but limited broader impact'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding:20 }}>
              <div style={{ fontSize:12, color:'#888', fontWeight:700, textTransform:'uppercase', marginBottom:16 }}>Era Overview</div>
              {ERA_LABELS.map(era=>{
                const eraEvents = HISTORICAL_EVENTS.filter(e=>e.year>=era.start&&e.year<=era.end);
                const criticals = eraEvents.filter(e=>e.significance==='critical');
                return (
                  <div key={era.label} style={{ marginBottom:12, padding:'10px 14px', background:'#111', borderRadius:8, border:`1px solid ${era.color}44`, borderLeft:`3px solid ${era.color}` }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:2 }}>{era.label}</div>
                    <div style={{ fontSize:10, color:'#888', marginBottom:6 }}>{era.start}–{era.end}</div>
                    <div style={{ fontSize:11, color:'#aaa' }}>{eraEvents.length} events · {criticals.length} critical</div>
                    {criticals.slice(0,2).map(e=>(
                      <div key={e.id} onClick={()=>setSelectedEvent(e)} style={{ fontSize:10, color:'#dc2626', marginTop:3, cursor:'pointer', display:'flex', gap:4 }}>
                        <span>↳</span><span>{e.title}</span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Stats */}
              <div style={{ marginTop:16, padding:'12px 14px', background:'#111', borderRadius:8, border:'1px solid #222' }}>
                <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', marginBottom:10 }}>Event Breakdown</div>
                {Object.entries(TYPE_ICONS).map(([type,icon])=>{
                  const count = HISTORICAL_EVENTS.filter(e=>e.type===type).length;
                  return count>0 ? (
                    <div key={type} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:14 }}>{icon}</span>
                      <div style={{ flex:1, height:4, background:'#222', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${(count/HISTORICAL_EVENTS.length)*100}%`, background:TYPE_COLORS[type]||'#888', borderRadius:2 }}/>
                      </div>
                      <span style={{ fontSize:11, color:'#888', width:30, textAlign:'right' }}>{count}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>




      <CoffeeButton
        bottom={isMobile ? 12 : 14}
        right={isMobile ? 12 : 372}
        size={isMobile ? 34 : 44}
      />

      {isMobile && selectedEvent && (
        <div style={{position:'fixed',inset:0,zIndex:1400,background:'#0a0a16'}}>
          <div style={{position:'sticky',top:0,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'#0f0f1f',borderBottom:'1px solid #222'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1}}>Event Detail</div>
            <button onClick={()=>setSelectedEvent(null)} style={{background:'none',border:'1px solid #333',color:'#aaa',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>Close</button>
          </div>
          <div style={{padding:12,height:'calc(100vh - 46px)',overflowY:'auto'}}>
            <div style={{color:'#ddd',fontSize:11,marginBottom:8}}>
              {selectedEvent.year}{selectedEvent.month&&`.${String(selectedEvent.month).padStart(2,'0')}`}
            </div>
            <h2 style={{margin:'0 0 8px',fontSize:20,color:'#fff'}}>{selectedEvent.title}</h2>
            <div style={{color:'#bbb',fontSize:14,lineHeight:1.7,marginBottom:10}}>{selectedEvent.description}</div>
            <button onClick={()=>setSelectedEvent(null)} style={{padding:'7px 10px',borderRadius:6,border:'1px solid #444',background:'transparent',color:'#888',fontSize:12,cursor:'pointer'}}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
