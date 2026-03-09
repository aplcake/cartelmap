'use client';
import React from 'react';
import { PEOPLE, CARTELS, Person, NOTABLE_CONNECTIONS, CARTEL_ATTACKS, DRUG_BUSTS, CARTEL_WARS } from '@/lib/data';
import PersonPhoto from '@/components/PersonPhoto';

const CARTEL_COLORS: Record<string, string> = {
  proto_sinaloa:'#5a1a1a',gulf_proto:'#1a2a5a',guadalajara:'#8B1A1A',
  sinaloa:'#C8282D',chapitos:'#FF6B35',tijuana:'#E8612A',juarez:'#D4A017',
  sonora_caro:'#8B4513',gulf:'#1A6B8A',zetas:'#2D5A27',beltran_leyva:'#7B3F8C',
  cjng:'#E63946',la_familia:'#2E8B57',knights_templar:'#8B6914',cdg_factions:'#1B4F72',
};
const STATUS_COLOR: Record<string,string> = {
  active:'#22c55e',arrested:'#ef4444',killed:'#dc2626',deceased:'#6b7280',fugitive:'#f59e0b',
};
const STATUS_LABEL: Record<string,string> = {
  active:'Active',arrested:'Arrested',killed:'Killed',deceased:'Deceased',fugitive:'Fugitive',
};

function getPersonColor(p: Person) {
  return CARTEL_COLORS[(p.cartelIds||[])[(p.cartelIds||[]).length-1]] || '#555';
}

// ── Hotlink helper — scans text for known person names/aliases ─
function renderWithHotlinks(text: string, onSelect: (p: Person) => void): React.ReactNode {
  // Build sorted list of (name/alias → person) — longest first to avoid partial matches
  const entries: { term: string; person: Person }[] = [];
  PEOPLE.forEach(p => {
    [p.name, ...p.alias].forEach(term => {
      if (term.length > 4) entries.push({ term, person: p });
    });
  });
  entries.sort((a, b) => b.term.length - a.term.length);

  // Find all matches with their positions
  interface Match { start: number; end: number; person: Person; term: string }
  const matches: Match[] = [];
  const usedRanges: [number, number][] = [];

  for (const { term, person } of entries) {
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const i = text.toLowerCase().indexOf(term.toLowerCase(), searchFrom);
      if (i === -1) break;
      const end = i + term.length;
      const overlaps = usedRanges.some(([s, e]) => i < e && end > s);
      if (!overlaps) {
        matches.push({ start: i, end, person, term });
        usedRanges.push([i, end]);
      }
      searchFrom = i + 1;
    }
  }

  if (matches.length === 0) return text;

  matches.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) parts.push(text.slice(pos, m.start));
    const col = getPersonColor(m.person);
    parts.push(
      <span
        key={`${m.person.id}-${m.start}`}
        onClick={(e: any) => { e.stopPropagation(); onSelect(m.person); }}
        title={`${m.person.name} — click to view`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: '0px 5px', margin: '0 1px',
          background: `${col}25`, border: `1px solid ${col}55`,
          borderRadius: 8, cursor: 'pointer', color: col,
          fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle',
          fontSize: 'inherit',
        }}
        onMouseEnter={(e: any) => { e.currentTarget.style.background = `${col}44`; }}
        onMouseLeave={(e: any) => { e.currentTarget.style.background = `${col}25`; }}
      >👤 {m.term}</span>
    );
    pos = m.end;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return <>{parts}</>;
}


function PersonDetail({ person, onSelect }: { person: Person; onSelect: (p:Person)=>void }) {
  const color = getPersonColor(person);
  const relatives = (person.bloodRelatives||[]).map(r=>({rel:r,p:PEOPLE.find(x=>x.id===r.personId)})).filter(x=>x.p);
  const mentors  = (person.mentors||[]).map(id=>PEOPLE.find(x=>x.id===id)).filter(Boolean) as Person[];
  const mentored = PEOPLE.filter(p => p.mentors?.includes(person.id));

  // Timeline bar calculation
  const allYears = person.roles.flatMap(r => [r.startYear, r.endYear||2026]);
  const minYear = Math.min(...allYears, person.born||1965);
  const maxYear = Math.max(...allYears, person.died||2026);
  const span = Math.max(maxYear - minYear, 1);
  const barPct = (yr: number) => Math.max(0, Math.min(100, ((yr - minYear) / span) * 100));

  return (
    <div style={{background:'#0f0f1f',border:`2px solid ${color}`,borderRadius:12,padding:18,height:'100%',overflowY:'auto',boxSizing:'border-box'}}>

      {/* Header */}
      <div style={{display:'flex',gap:12,marginBottom:14}}>
        <PersonPhoto personId={person.id} personName={person.name} size={72} carousel={true} />
        <div style={{flex:1}}>
          <h2 style={{color:'#fff',margin:0,fontSize:16,lineHeight:1.3}}>{person.name}</h2>
          <div style={{color:'#aaa',fontSize:12,fontStyle:'italic',marginBottom:3}}>{person.alias.join(' / ')}</div>
          <div style={{color:STATUS_COLOR[person.status],fontSize:11,fontWeight:700}}>
            ● {STATUS_LABEL[person.status].toUpperCase()}{person.died&&(person.status==='killed'||person.status==='deceased')&&` — ${person.died}`}
          </div>
          {person.born&&<div style={{color:'#666',fontSize:11,marginTop:2}}>
            b. {person.born}{person.hometown&&` · ${person.hometown}`}
          </div>}
          {(person as any).netWorthUSD && (
            <div style={{color:'#f59e0b',fontSize:11,fontWeight:700,marginTop:3}}>
              💰 Est. peak net worth: ${((person as any).netWorthUSD/1e9).toFixed(1)}B USD
            </div>
          )}
        </div>
      </div>

      {/* Wikipedia */}
      {person.wikipediaUrl && (
        <a href={person.wikipediaUrl} target="_blank" rel="noopener noreferrer"
          style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginBottom:14,padding:'7px',background:'#1a2a4a',border:'1px solid #2a4a8a',borderRadius:7,color:'#6b9fff',fontSize:12,textDecoration:'none',fontWeight:600}}>
          📖 Read on Wikipedia
        </a>
      )}

      {/* Death */}
      {person.diedHow&&<div style={{background:'#2a1515',border:'1px solid #622',borderRadius:7,padding:'9px 12px',marginBottom:14,fontSize:12,color:'#faa',lineHeight:1.5}}>
        <div style={{fontSize:10,color:'#c55',textTransform:'uppercase',marginBottom:3}}>Cause of Death</div>
        {person.diedHow}
      </div>}

      {/* ── ROLE TIMELINE BARS ── */}
      <div style={{marginBottom:16}}>
        <div style={{color:'#666',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Career Timeline</div>
        {/* Year axis */}
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,paddingLeft:0}}>
          <span style={{fontSize:9,color:'#444'}}>{minYear}</span>
          <span style={{fontSize:9,color:'#444'}}>{Math.round((minYear+maxYear)/2)}</span>
          <span style={{fontSize:9,color:'#444'}}>{maxYear}</span>
        </div>
        <div style={{position:'relative',marginBottom:2}}>
          {/* Grid lines */}
          {[0,25,50,75,100].map(pct=>(
            <div key={pct} style={{position:'absolute',left:`${pct}%`,top:0,bottom:0,width:1,background:'#1e1e2e',zIndex:0}}/>
          ))}
          {/* Role bars */}
          {person.roles.map((r,i)=>{
            const c = CARTELS.find(x=>x.id===r.cartelId);
            const col = CARTEL_COLORS[r.cartelId]||'#555';
            const left = barPct(r.startYear);
            const right = barPct(r.endYear||2026);
            const width = Math.max(right - left, 2);
            return (
              <div key={i} style={{position:'relative',marginBottom:6}}>
                <div style={{fontSize:10,color:'#aaa',marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  <span style={{color:col,fontWeight:700}}>{c?.shortName}</span>
                  <span style={{color:'#666'}}> · {r.role}</span>
                </div>
                <div style={{position:'relative',height:12,background:'#1a1a2e',borderRadius:6,overflow:'hidden'}}>
                  <div style={{
                    position:'absolute',
                    left:`${left}%`,
                    width:`${width}%`,
                    height:'100%',
                    background:col,
                    borderRadius:4,
                    opacity:0.85,
                    transition:'all 0.2s'
                  }}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:1}}>
                  <span style={{fontSize:8,color:'#555'}}>{r.startYear}</span>
                  <span style={{fontSize:8,color:'#555'}}>{r.endYear||'present'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BLOOD RELATIVES ── */}
      {relatives.length>0&&<div style={{marginBottom:14}}>
        <div style={{color:'#666',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Blood Relatives in the Trade</div>
        {relatives.map(({rel,p})=>p?(
          <div key={rel.personId} onClick={()=>onSelect(p)}
            style={{display:'flex',gap:8,alignItems:'center',marginBottom:5,background:'#1a1a2e',borderRadius:6,padding:'7px 10px',cursor:'pointer',border:'1px solid transparent',transition:'border-color 0.15s'}}
            onMouseEnter={(e: any) =>(e.currentTarget.style.borderColor='#444')}
            onMouseLeave={(e: any) =>(e.currentTarget.style.borderColor='transparent')}>
            <div style={{width:28,height:28,borderRadius:'50%',background:getPersonColor(p),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>
              {p.status==='killed'?'✕':p.status==='arrested'?'⚖':p.status==='deceased'?'†':'●'}
            </div>
            <div style={{flex:1}}>
              <div style={{color:'#eee',fontSize:12,fontWeight:700}}>{p.name}</div>
              <div style={{color:'#888',fontSize:10}}>{rel.relation}</div>
            </div>
            <span style={{fontSize:10,color:'#555'}}>→</span>
          </div>
        ):null)}
      </div>}

      {/* ── MENTORS (trained by) ── */}
      {mentors.length>0&&<div style={{marginBottom:14}}>
        <div style={{color:'#666',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Trained By</div>
        {mentors.map(m=>(
          <div key={m.id} onClick={()=>onSelect(m)}
            style={{display:'flex',gap:8,alignItems:'center',marginBottom:5,background:'#1a1a2e',borderRadius:6,padding:'7px 10px',cursor:'pointer',border:'1px solid transparent',transition:'border-color 0.15s'}}
            onMouseEnter={(e: any) =>(e.currentTarget.style.borderColor='#444')}
            onMouseLeave={(e: any) =>(e.currentTarget.style.borderColor='transparent')}>
            <div style={{width:28,height:28,borderRadius:'50%',background:getPersonColor(m),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>
              {m.status==='killed'?'✕':m.status==='arrested'?'⚖':m.status==='deceased'?'†':'●'}
            </div>
            <div style={{flex:1}}>
              <div style={{color:'#eee',fontSize:12,fontWeight:700}}>{m.name}</div>
              <div style={{color:'#888',fontSize:10,fontStyle:'italic'}}>"{m.alias[0]}"</div>
            </div>
            <span style={{fontSize:10,color:'#4a8a4a'}}>mentor</span>
          </div>
        ))}
      </div>}

      {/* ── MENTORED (people this person trained) ── */}
      {mentored.length>0&&<div style={{marginBottom:14}}>
        <div style={{color:'#666',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>
          Mentored <span style={{color:'#4a8a4a',fontWeight:700}}>{mentored.length}</span> {mentored.length===1?'person':'people'}
        </div>
        {mentored.map(m=>(
          <div key={m.id} onClick={()=>onSelect(m)}
            style={{display:'flex',gap:8,alignItems:'center',marginBottom:5,background:'#111d11',border:'1px solid #1e3a1e',borderRadius:6,padding:'7px 10px',cursor:'pointer',transition:'border-color 0.15s'}}
            onMouseEnter={(e: any) =>(e.currentTarget.style.borderColor='#2d5a2d')}
            onMouseLeave={(e: any) =>(e.currentTarget.style.borderColor='#1e3a1e')}>
            <div style={{width:28,height:28,borderRadius:'50%',background:getPersonColor(m),display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>
              {m.status==='killed'?'✕':m.status==='arrested'?'⚖':m.status==='deceased'?'†':'●'}
            </div>
            <div style={{flex:1}}>
              <div style={{color:'#eee',fontSize:12,fontWeight:700}}>{m.name}</div>
              <div style={{color:'#888',fontSize:10,fontStyle:'italic'}}>"{m.alias[0]}"</div>
            </div>
            <span style={{fontSize:10,color:'#4a8a4a'}}>→ protégé</span>
          </div>
        ))}
      </div>}

      {/* ── NOTABLE CONNECTIONS ── */}
      {(() => {
        const connections = NOTABLE_CONNECTIONS.filter(nc => nc.connectionTo.includes(person.id));
        if (connections.length === 0) return null;
        const catEmoji: Record<string,string> = {
          politician:'🏛', entertainment:'🎬', music:'🎵', sports:'⚽',
          law_enforcement:'👮', business:'💼'
        };
        const statusColor: Record<string,string> = {
          convicted:'#ef4444', accused:'#f97316', investigated:'#eab308',
          documented:'#6b9fff', deceased:'#888'
        };
        return (
          <div style={{marginBottom:14}}>
            <div style={{color:'#666',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>
              Notable Connections <span style={{color:'#C8282D',fontWeight:700}}>{connections.length}</span>
            </div>
            {connections.map(nc => (
              <div key={nc.id} style={{marginBottom:8,background:'#111',borderRadius:7,overflow:'hidden',border:'1px solid #1e1e2e'}}>
                <div style={{padding:'9px 11px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:5}}>
                    <span style={{fontSize:16,flexShrink:0}}>{catEmoji[nc.category]||'•'}</span>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:2}}>
                        <span style={{fontSize:13,fontWeight:700,color:'#fff'}}>{nc.name}</span>
                        {nc.alias && <span style={{fontSize:10,color:'#888',fontStyle:'italic'}}>"{nc.alias}"</span>}
                        <span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:`${statusColor[nc.status]}22`,color:statusColor[nc.status],border:`1px solid ${statusColor[nc.status]}44`,flexShrink:0}}>{nc.status}</span>
                      </div>
                      <div style={{fontSize:10,color:'#888',marginBottom:4}}>{nc.role} · {nc.nationality}</div>
                      <div style={{fontSize:10,color:'#aaa',background:'#0a0a1a',borderRadius:4,padding:'4px 7px',marginBottom:4,fontStyle:'italic'}}>"{nc.connectionType}"</div>
                      <div style={{fontSize:11,color:'#ccc',lineHeight:1.6}}>{nc.description}</div>
                    </div>
                  </div>
                  {nc.wikipediaUrl && (
                    <a href={nc.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                      style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:4,fontSize:10,color:'#6b9fff',textDecoration:'none',border:'1px solid #2a4a8a',borderRadius:4,padding:'2px 7px'}}>
                      📖 Wikipedia
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── NOTES ── */}
      <div style={{background:'#111',borderRadius:7,padding:'10px 12px'}}>
        <div style={{color:'#666',fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Notes</div>
        <div style={{color:'#ccc',fontSize:12,lineHeight:1.7}}>{renderWithHotlinks(person.notes, onSelect)}</div>
      </div>
    </div>
  );
}


// ── Slide-over Panel wrapper ──────────────────────────────
interface PersonPanelProps {
  person: Person | null;
  onClose: () => void;
  onSelect: (p: Person) => void;
  onOpen?: (p: Person) => void;
}

export default function PersonPanel({ person, onClose, onSelect, onOpen }: PersonPanelProps) {
  React.useEffect(() => { if (person && onOpen) onOpen(person); }, [person?.id]); // eslint-disable-line
  if (!person) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:'fixed', inset:0, zIndex:900,
          background:'rgba(0,0,0,0.4)',
          backdropFilter:'blur(2px)',
        }}
      />
      {/* Panel */}
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, zIndex:901,
        width: 'min(420px, 92vw)',
        background:'#0a0a16',
        borderLeft:'1px solid #2a2a4a',
        overflowY:'auto',
        boxShadow:'-8px 0 32px rgba(0,0,0,0.7)',
        display:'flex', flexDirection:'column',
      }}>
        {/* Close button */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', borderBottom:'1px solid #1a1a2e', flexShrink:0,
        }}>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            <div style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:1}}>Person Profile</div>
            {(() => {
              const attacks = CARTEL_ATTACKS.filter((a:any) => a.personIds?.includes(person.id)).length;
              const busts   = DRUG_BUSTS.filter((b:any)   => b.personIds?.includes(person.id)).length;
              const wars    = CARTEL_WARS.filter((w:any)   => w.personIds?.includes(person.id)).length;
              const total = attacks + busts + wars;
              if (!total) return null;
              return (
                <div style={{fontSize:9,color:'#ef4444',letterSpacing:0.5}}>
                  🩸 {total} events on map — {attacks} attacks · {busts} busts · {wars} wars
                </div>
              );
            })()}
          </div>
          <button onClick={onClose} style={{
            background:'none', border:'none', color:'#666', fontSize:18,
            cursor:'pointer', padding:'0 4px', lineHeight:1,
          }}>✕</button>
        </div>
        <div style={{flex:1, padding:'14px 16px', overflowY:'auto'}}>
          <PersonDetail person={person} onSelect={onSelect} />
        </div>
      </div>
    </>
  );
}
