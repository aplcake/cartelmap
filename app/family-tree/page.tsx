'use client';
import React, { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PEOPLE, CARTELS, Person, NOTABLE_CONNECTIONS, NotableConnection } from '@/lib/data';
import PersonPhoto from '@/components/PersonPhoto';
import CartelLogo from '@/components/CartelLogo';
import CoffeeButton from '@/components/CoffeeButton';

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

// ── Family tree definitions ───────────────────────────────
interface FamilyGroup {
  id: string;
  title: string;
  description: string;
  color: string;
  generations: Array<{
    label: string;
    members: Array<{ personId: string; note?: string; childrenOf?: string; relation?: string }>;
  }>;
  insight: string;
}

const FAMILY_GROUPS: FamilyGroup[] = [
  {
    id:'sinaloa_dynasty',
    title:'The Sinaloa Blood Dynasty',
    description:'Pedro Avilés → El Chapo (his nephew) → Los Chapitos (El Chapo\'s sons). Three generations of one family ruling Mexican drug trafficking.',
    color:'#C8282D',
    insight:'El Chapo entered the trade as a teenager working for his uncle Pedro Avilés. When Avilés was killed in 1978, the network eventually passed to his nephew — who built it into the largest drug empire in history. Now El Chapo\'s four sons run the fentanyl era.',
    generations:[
      { label:'Generation 0 — The Patriarch', members:[{personId:'aviles',note:'Pioneered aircraft smuggling 1965. Killed 1978.'}] },
      { label:'Generation 1 — The Empire Builder', members:[{personId:'chapo',note:'Avilés\' nephew. Inherited the trade, built global empire.',relation:'nephew of Avilés'},{personId:'mayo',note:'Co-leader, 35 years never arrested until 2024.'},{personId:'el_azul',note:'The peacemaker. Reported dead 2014.'}] },
      { label:'Generation 2 — Los Chapitos (El Chapo\'s Sons)', members:[
        {personId:'ivan_chapito',note:'Eldest. Leads military campaign 2024.',relation:'son of El Chapo'},
        {personId:'alfredo_chapito',note:'Second son.',relation:'son of El Chapo'},
        {personId:'ovidio',note:'"El Ratón." US custody.',relation:'son of El Chapo'},
        {personId:'joaquin_chapito',note:'Allegedly delivered El Mayo to US.',relation:'son of El Chapo'},
      ]},
    ],
  },
  {
    id:'felix_gallardo_empire',
    title:'Félix Gallardo & His Nephews (Tijuana)',
    description:'El Padrino\'s blood nephews — all seven Arellano Félix siblings — received the Tijuana corridor at the 1989 Acapulco division.',
    color:'#E8612A',
    insight:'When Félix Gallardo went to prison in 1989, he divided Mexico\'s drug corridors. His own blood nephews got Tijuana–San Diego, the world\'s busiest and most valuable crossing. Five of the seven brothers are now dead, arrested, or extradited. Only Enedina remains free.',
    generations:[
      { label:'The Godfather', members:[{personId:'felix_gallardo',note:'Arrested 1989. Divided Mexico from prison.'}] },
      { label:'His Nephews & Niece — The Arellano Félix Family', members:[
        {personId:'benjamin_af',note:'Strategic brain. Arrested 2002.',relation:'nephew'},
        {personId:'ramon_af',note:'Enforcer. Killed 2002.',relation:'nephew'},
        {personId:'eduardo_af',note:'Arrested 2008.',relation:'nephew'},
        {personId:'enedina_af',note:'Last one free — current head.',relation:'niece'},
        {personId:'fj_af',note:'Arrested by Coast Guard 2006.',relation:'nephew'},
        {personId:'fr_af',note:'Killed at birthday party 2023.',relation:'nephew'},
      ]},
    ],
  },
  {
    id:'fonseca_dynasty',
    title:'Fonseca → Carrillo Fuentes (Juárez)',
    description:'"Don Neto" Fonseca\'s nephews inherited the Juárez corridor — building the 1990s most profitable empire, then losing it catastrophically.',
    color:'#D4A017',
    insight:'Fonseca Carrillo was the eldest founding partner of the Guadalajara Cartel. His nephews Amado and Vicente received the Juárez plaza in 1989. Amado built it to $25B/year and died changing his face. Vicente lost 11,000 lives trying to hold it against Sinaloa.',
    generations:[
      { label:'The Elder Patriarch', members:[{personId:'fonseca',note:'Co-founded Guadalajara Cartel. In house arrest (90s).'}] },
      { label:'His Nephews — The Juárez Bosses', members:[
        {personId:'amado_cf',note:'"Lord of the Skies." $25B peak. Died plastic surgery 1997.',relation:'nephew'},
        {personId:'vicente_cf',note:'"El Viceroy." Led catastrophic war vs Sinaloa. Arrested 2014.',relation:'nephew'},
      ]},
    ],
  },
  {
    id:'gulf_lineage',
    title:'Gulf Cartel Lineage — Bootleggers to Cocaine Lords',
    description:'From Prohibition to the cocaine age to fragmented chaos — three generations of Tamaulipas organized crime.',
    color:'#1A6B8A',
    insight:'Nepomuceno Guerra started smuggling alcohol during US Prohibition in the 1930s. His nephew García Ábrego turned it into a cocaine empire in the 1980s. Then the Cárdenas Guillén brothers took over — and created Los Zetas, which ultimately destroyed them.',
    generations:[
      { label:'The Original Patriarch (1930s)', members:[{personId:'nepomuceno',note:'Prohibition bootlegger. Built Matamoros network. Died 2001.'}] },
      { label:'The Cocaine Era', members:[{personId:'garcia_abrego',note:'First FBI Top Ten drug lord. 11 life sentences.',relation:'nephew of Nepomuceno'}] },
      { label:'The Cárdenas Guillén Brothers', members:[
        {personId:'osiel',note:'Created Los Zetas. Arrested 2003.',relation:'brother'},
        {personId:'antonio_cg',note:'"Tony Tormenta." Killed by Marines Nov 2010.',relation:'brother'},
        {personId:'mario_cg',note:'"El Gordo." Arrested 2012.',relation:'brother'},
      ]},
    ],
  },
  {
    id:'zetas_trevino',
    title:'Treviño Morales Brothers (Zetas)',
    description:'Two brothers from Nuevo Laredo who took Los Zetas to peak brutality and peak collapse.',
    color:'#2D5A27',
    insight:'Z-40 (Miguel Ángel) built the Zetas\' extortion empire and was known for burning people alive in oil drums. His arrest in July 2013 — while returning to see his newborn — effectively ended the unified Los Zetas. His brother Z-42 lasted two more years before arrest.',
    generations:[
      { label:'The Founders (GAFE Deserters)', members:[{personId:'lazca',note:'Z-3. Co-founded Zetas from GAFE special forces. Killed 2012, body stolen.'}] },
      { label:'The Treviño Brothers', members:[
        {personId:'z40',note:'Z-40. Arrested July 2013 near his newborn.',relation:'brother'},
        {personId:'z42',note:'Z-42. Took over after Z-40. Arrested 2015.',relation:'brother'},
      ]},
    ],
  },
  {
    id:'beltran_leyva',
    title:'Beltrán-Leyva Brothers (BLO)',
    description:'Three brothers who built Sinaloa\'s enforcement arm for 20 years, then turned against it when El Chapo allegedly betrayed one of them.',
    color:'#7B3F8C',
    insight:'Alfredo\'s January 2008 arrest — widely believed to have been orchestrated by El Chapo himself — caused three brothers to declare war on their former allies. Arturo was killed in December 2009, his body publicly displayed. Their Guerrero networks seeded what became CJNG.',
    generations:[
      { label:'The Three Brothers', members:[
        {personId:'arturo_bl',note:'"El Barbas." Supreme Leader. Killed Cuernavaca Dec 2009.',relation:'brother'},
        {personId:'hector_bl',note:'"El H." Led BLO after Arturo. Arrested 2014, died in prison 2018.',relation:'brother'},
        {personId:'alfredo_bl',note:'"El Mochomo." His 2008 arrest started the split.',relation:'brother'},
      ]},
    ],
  },
  {
    id:'cjng_family',
    title:'CJNG — El Mencho & His Network',
    description:'El Mencho built CJNG through marriage into the Valencia crime family and his brother\'s financial operations. Killed Feb 22, 2026.',
    color:'#E63946',
    insight:'El Mencho was an avocado farmer\'s son who married into the Valencia crime family (Milenio Cartel), giving him his first criminal network. His brother Don Rodo ran money laundering. El Mencho was killed February 22, 2026 in Tapalpa — triggering blockades across 20 Mexican states.',
    generations:[
      { label:'The Leader — KILLED FEB 22, 2026', members:[{personId:'mencho',note:'Founder. Killed in Tapalpa operation with US intelligence support.'}] },
      { label:'His Family Network', members:[
        {personId:'abraham_mencho',note:'"Don Rodo." Money laundering. Recaptured Feb 2025.',relation:'brother'},
      ]},
    ],
  },
  {
    id:'caro_quintero',
    title:'Caro Quintero Brothers (Sonora)',
    description:'Rafael co-founded the Guadalajara Cartel. His brother Miguel received the Sonora corridor at the 1989 division.',
    color:'#8B4513',
    insight:'Two brothers from Badiraguato: Rafael ordered Kiki Camarena\'s murder, served 28 years, was released on a technicality, then recaptured in 2022 and extradited to the US in 2025. Miguel ran the Sonora corridor from 1989 until his 2001 arrest.',
    generations:[
      { label:'The Brothers', members:[
        {personId:'caro_quintero',note:'Ordered Camarena murder 1985. Extradited to US 2025.',relation:'brother'},
        {personId:'miguel_cq',note:'Ran Sonora corridor 1989–2001. Arrested 2001.',relation:'brother'},
      ]},
    ],
  },
  {
    id:'mentor_chain',
    title:'The Mentor Chain — How It All Started',
    description:'Every major Mexican drug lord from the 1970s–1990s traces to one man: Pedro Avilés. He trained the entire second generation from the mountains of Sinaloa.',
    color:'#8B1A1A',
    insight:'Pedro Avilés is the root of the entire modern Mexican drug trade. He trained Fonseca, Caro Quintero, and Félix Gallardo — who together built the Guadalajara Cartel. And his own nephew El Chapo went on to be the most powerful drug lord in history. All roads lead back to Badiraguato, Sinaloa.',
    generations:[
      { label:'The Root — Pedro Avilés (1965–1978)', members:[{personId:'aviles',note:'Trained the entire next generation. Killed 1978.'}] },
      { label:'His Students — Who Built the Modern Cartels', members:[
        {personId:'caro_quintero',note:'Trained by Avilés. Built Guadalajara Cartel marijuana ops.',relation:'mentee'},
        {personId:'fonseca',note:'Trained by Avilés. Senior Guadalajara partner.',relation:'mentee'},
        {personId:'felix_gallardo',note:'Trained by Avilés. Became El Padrino.',relation:'mentee'},
        {personId:'chapo',note:'Avilés\' own nephew. Became greatest drug lord in history.',relation:'nephew + mentee'},
      ]},
    ],
  },
];

// ── PersonCard ───────────────────────────────────────────
function PersonCard({ person, onSelect, selected }: { person: Person; onSelect: (p: Person) => void; selected: boolean; key?: React.Key }) {
  const color = getPersonColor(person);
  const sc = STATUS_COLOR[person.status];
  return (
    <div onClick={()=>onSelect(person)} style={{
      background: selected?`${color}33`:'#1a1a2e',
      border:`2px solid ${selected?color:'#2a2a4a'}`,
      borderRadius:8,padding:'10px 12px',cursor:'pointer',
      minWidth:160,maxWidth:200,transition:'all 0.15s',
    }}>
      <div style={{display:'flex',gap:8,marginBottom:6}}>
        <PersonPhoto personId={person.id} personName={person.name} size={44} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:sc,flexShrink:0}}/>
            <div style={{fontWeight:700,fontSize:12,color:'#fff',lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{person.name}</div>
          </div>
          {person.alias[0] && <div style={{fontSize:10,color:'#aaa',fontStyle:'italic',marginBottom:2}}>"{person.alias[0]}"</div>}
          <div style={{fontSize:10,color:sc,fontWeight:700}}>{STATUS_LABEL[person.status]}</div>
        </div>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:2}}>
        {(person.cartelIds||[]).slice(-2).map(cid=>{
          const c=CARTELS.find(x=>x.id===cid);
          return c?<span key={cid} style={{fontSize:9,background:`${CARTEL_COLORS[cid]||'#555'}33`,border:`1px solid ${CARTEL_COLORS[cid]||'#555'}66`,color:'#ccc',borderRadius:3,padding:'1px 4px'}}>{c.shortName}</span>:null;
        })}
      </div>
    </div>
  );
}

// ── PersonDetail ─────────────────────────────────────────
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

// ── Cartel Lineage Spawn Tree ─────────────────────────────
function CartelLineageView({ selectedPerson, onSelectPerson, isMobile }: { selectedPerson: Person|null; onSelectPerson: (p:Person)=>void; isMobile: boolean }) {
  const [hoveredCartel, setHoveredCartel] = useState<string|null>(null);
  const [selectedCartel, setSelectedCartel] = useState<string|null>(null);

  // Layout: manually position each cartel node in a generational grid
  // x = era column (0–4), y = row within column
  const NODE_POSITIONS: Record<string, {x:number; y:number}> = {
    gulf_proto:     {x:0, y:0},
    proto_sinaloa:  {x:0, y:3},
    guadalajara:    {x:1, y:2},
    gulf:           {x:2, y:0},
    tijuana:        {x:2, y:1},
    juarez:         {x:2, y:2},
    sonora_caro:    {x:2, y:3},
    sinaloa:        {x:3, y:2},
    zetas:          {x:3, y:0},
    beltran_leyva:  {x:3, y:3},
    la_familia:     {x:3, y:4},
    cjng:           {x:4, y:1},
    chapitos:       {x:4, y:2},
    knights_templar:{x:4, y:4},
    cdg_factions:   {x:4, y:0},
  };

  const COL_X = [80, 240, 400, 580, 760];
  const ROW_H = 90;
  const ROW_OFFSET = 60;
  const NODE_W = 130;
  const NODE_H = 56;
  const SVG_W = 920;
  const SVG_H = 520;

  function nodeX(id: string) {
    const pos = NODE_POSITIONS[id];
    return pos ? COL_X[pos.x] : 400;
  }
  function nodeY(id: string) {
    const pos = NODE_POSITIONS[id];
    return pos ? ROW_OFFSET + pos.y * ROW_H : 200;
  }
  function nodeCX(id: string) { return nodeX(id) + NODE_W / 2; }
  function nodeCY(id: string) { return nodeY(id) + NODE_H / 2; }

  // Build edges from parentCartels data
  const edges: {from:string; to:string}[] = [];
  CARTELS.forEach(c => {
    (c.parentCartels||[]).forEach(parent => {
      if (NODE_POSITIONS[parent] && NODE_POSITIONS[c.id]) {
        edges.push({from: parent, to: c.id});
      }
    });
  });

  const activeCartel = selectedCartel ? CARTELS.find(c => c.id === selectedCartel) : null;
  const activeLeaders = activeCartel
    ? PEOPLE.filter(p => ((p.cartelIds||[])||[]).includes(activeCartel.id) && p.roles.some(r => r.cartelId === activeCartel.id && ['Founder','Boss','Co-Founder','Supreme Leader','Co-founder'].some(t => r.role.includes(t))))
    : [];

  const ERA_COLS = [
    {label:'1930s–1964', sub:'Prohibition Era'},
    {label:'1965–1989', sub:'Guadalajara Fed.'},
    {label:'1989–2003', sub:'Fragmentation'},
    {label:'2003–2015', sub:'Drug War Era'},
    {label:'2015–2026', sub:'CJNG / Fentanyl'},
  ];

  return (
    <div style={{display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 340px', height:isMobile?'auto':'calc(100vh - 49px)'}}>
      {/* SVG canvas */}
      <div style={{overflowY:'auto', overflowX:'auto', padding:isMobile?12:24, background:'#0a0a12'}}>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Cartel Spawn Tree — 1930 to 2026</div>
          <div style={{fontSize:11, color:'#666'}}>Arrows show which cartels spawned which. Click any node for details.</div>
        </div>

        <svg width={SVG_W} height={SVG_H} style={{display:'block', overflow:'visible'}}>
          {/* Era column headers */}
          {ERA_COLS.map((era, i) => (
            <g key={i}>
              <rect x={COL_X[i] - 10} y={0} width={NODE_W + 20} height={40}
                fill={`rgba(200,40,45,0.06)`} rx={6}
                stroke="#C8282D" strokeWidth={0.5} strokeOpacity={0.3}/>
              <text x={COL_X[i] + NODE_W/2} y={14} textAnchor="middle"
                fill="#C8282D" fontSize={9} fontWeight={700}>{era.label}</text>
              <text x={COL_X[i] + NODE_W/2} y={28} textAnchor="middle"
                fill="#555" fontSize={8}>{era.sub}</text>
            </g>
          ))}

          {/* Edges — drawn first so nodes render on top */}
          {edges.map(({from, to}, i) => {
            const x1 = nodeCX(from) + NODE_W * 0.4;
            const y1 = nodeCY(from);
            const x2 = nodeCX(to) - NODE_W * 0.4;
            const y2 = nodeCY(to);
            const mx = (x1 + x2) / 2;
            const fromCol = CARTEL_COLORS[from] || '#555';
            const toCol = CARTEL_COLORS[to] || '#555';
            const isHovered = hoveredCartel === from || hoveredCartel === to;
            const isSelected = selectedCartel === from || selectedCartel === to;
            const highlight = isSelected || isHovered;
            return (
              <g key={i}>
                <defs>
                  <linearGradient id={`grad-${from}-${to}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={fromCol} stopOpacity={highlight ? 0.9 : 0.4}/>
                    <stop offset="100%" stopColor={toCol} stopOpacity={highlight ? 0.9 : 0.4}/>
                  </linearGradient>
                  <marker id={`arrow-${from}-${to}`} markerWidth="6" markerHeight="6"
                    refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill={toCol} fillOpacity={highlight ? 1 : 0.5}/>
                  </marker>
                </defs>
                <path
                  d={`M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={`url(#grad-${from}-${to})`}
                  strokeWidth={highlight ? 2.5 : 1.2}
                  markerEnd={`url(#arrow-${from}-${to})`}
                  style={{transition:'stroke-width 0.15s'}}
                />
              </g>
            );
          })}

          {/* Cartel nodes */}
          {CARTELS.filter(c => NODE_POSITIONS[c.id]).map(c => {
            const x = nodeX(c.id);
            const y = nodeY(c.id);
            const col = CARTEL_COLORS[c.id] || '#555';
            const isHovered = hoveredCartel === c.id;
            const isSelected = selectedCartel === c.id;
            const dim = !hoveredCartel && !selectedCartel ? false :
                        (hoveredCartel && hoveredCartel !== c.id && !edges.some(e => (e.from===hoveredCartel && e.to===c.id)||(e.to===hoveredCartel && e.from===c.id))) ||
                        (selectedCartel && selectedCartel !== c.id && !edges.some(e => (e.from===selectedCartel && e.to===c.id)||(e.to===selectedCartel && e.from===c.id)));

            return (
              <g key={c.id}
                style={{cursor:'pointer', opacity: dim ? 0.25 : 1, transition:'opacity 0.2s'}}
                onMouseEnter={()=>setHoveredCartel(c.id)}
                onMouseLeave={()=>setHoveredCartel(null)}
                onClick={()=>setSelectedCartel((s: any) => s===c.id ? null : c.id)}>
                {/* Glow for active/selected */}
                {(isSelected || isHovered) && (
                  <rect x={x-4} y={y-4} width={NODE_W+8} height={NODE_H+8}
                    rx={10} fill={col} fillOpacity={0.12}
                    stroke={col} strokeWidth={1} strokeOpacity={0.5}/>
                )}
                <rect x={x} y={y} width={NODE_W} height={NODE_H}
                  rx={7}
                  fill={isSelected ? `${col}33` : '#0f0f1f'}
                  stroke={col}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeOpacity={isSelected ? 1 : 0.7}
                />
                {/* Status dot */}
                <circle cx={x + NODE_W - 12} cy={y + 12} r={4}
                  fill={c.status==='active'?'#22c55e':c.status==='fragmented'?'#f59e0b':'#6b7280'}/>
                {/* Logo (foreignObject) */}
                <foreignObject x={x + NODE_W - 36} y={y + 20} width={28} height={28}>
                  <CartelLogo cartelId={c.id} cartelName={c.shortName} color={col} size={28} />
                </foreignObject>
                {/* Name */}
                <text x={x + 10} y={y + 20} fill="#fff" fontSize={11} fontWeight={700}>{c.shortName}</text>
                {/* Years */}
                <text x={x + 10} y={y + 34} fill={col} fontSize={9} opacity={0.8}>
                  {c.foundedYear}–{c.dissolvedYear||'present'}
                </text>
                {/* Drug tags */}
                <text x={x + 10} y={y + 47} fill="#666" fontSize={8}>
                  {c.primaryDrugs.slice(0,2).join(' · ')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{display:'flex', gap:20, marginTop:16, flexWrap:'wrap'}}>
          {[{col:'#22c55e',label:'Active'},{col:'#f59e0b',label:'Fragmented'},{col:'#6b7280',label:'Dissolved'}].map(l=>(
            <div key={l.label} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#888'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:l.col}}/>
              {l.label}
            </div>
          ))}
          <div style={{fontSize:11,color:'#555',marginLeft:'auto'}}>→ arrow = spawned from</div>
        </div>
      </div>

      {/* Detail panel */}
      <div style={{borderLeft:'1px solid #222', overflowY:'auto', padding:14, background:'#0a0a16'}}>
        {activeCartel ? (
          <div>
            <div style={{background:`${CARTEL_COLORS[activeCartel.id]||'#555'}18`,borderBottom:`1px solid ${CARTEL_COLORS[activeCartel.id]||'#555'}33`,padding:'12px 14px',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <CartelLogo cartelId={activeCartel.id} cartelName={activeCartel.shortName} color={CARTEL_COLORS[activeCartel.id]||'#555'} size={52} />
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>{activeCartel.name}</div>
                  <div style={{fontSize:11,color:'#888',marginTop:2}}>{activeCartel.foundedYear}–{activeCartel.dissolvedYear||'present'} · {activeCartel.headquarters}</div>
                </div>
              </div>
              <div style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,padding:'2px 7px',borderRadius:4,
                background: activeCartel.status==='active'?'#14532d':activeCartel.status==='fragmented'?'#451a03':'#1f2937',
                color: activeCartel.status==='active'?'#4ade80':activeCartel.status==='fragmented'?'#fb923c':'#9ca3af',
                border:`1px solid ${activeCartel.status==='active'?'#166534':activeCartel.status==='fragmented'?'#7c2d12':'#374151'}`
              }}>
                ● {activeCartel.status.toUpperCase()}
              </div>
            </div>

            <div style={{padding:'0 14px'}}>
              <div style={{fontSize:12,color:'#ccc',lineHeight:1.7,marginBottom:14}}>{activeCartel.description}</div>

              {/* Parent cartels */}
              {(activeCartel.parentCartels||[]).length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:7}}>Spawned From</div>
                  {(activeCartel.parentCartels||[]).map(pid => {
                    const p = CARTELS.find(c=>c.id===pid);
                    if (!p) return null;
                    const col = CARTEL_COLORS[pid]||'#555';
                    return <div key={pid} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',background:`${col}18`,border:`1px solid ${col}33`,borderRadius:6,marginBottom:5,cursor:'pointer'}} onClick={()=>setSelectedCartel(pid)}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:col,flexShrink:0}}/>
                      <span style={{fontSize:12,color:'#eee',fontWeight:600}}>{p.shortName}</span>
                      <span style={{fontSize:10,color:'#666',marginLeft:'auto'}}>{p.foundedYear}–{p.dissolvedYear||'present'}</span>
                    </div>;
                  })}
                </div>
              )}

              {/* Spawned cartels */}
              {(activeCartel.spawnedCartels||[]).length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:7}}>Spawned</div>
                  {(activeCartel.spawnedCartels||[]).map(sid => {
                    const s = CARTELS.find(c=>c.id===sid);
                    if (!s) return null;
                    const col = CARTEL_COLORS[sid]||'#555';
                    return <div key={sid} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',background:`${col}18`,border:`1px solid ${col}33`,borderRadius:6,marginBottom:5,cursor:'pointer'}} onClick={()=>setSelectedCartel(sid)}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:col,flexShrink:0}}/>
                      <span style={{fontSize:12,color:'#eee',fontWeight:600}}>{s.shortName}</span>
                      <span style={{fontSize:10,color:s.status==='active'?'#4ade80':s.status==='fragmented'?'#f59e0b':'#666',marginLeft:'auto'}}>{s.status}</span>
                    </div>;
                  })}
                </div>
              )}

              {/* Primary drugs */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:7}}>Primary Drugs</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {activeCartel.primaryDrugs.map(d=>(
                    <span key={d} style={{fontSize:11,padding:'2px 8px',background:'#1a1a2e',border:'1px solid #333',borderRadius:5,color:'#aaa',textTransform:'capitalize'}}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Key founders/leaders */}
              {activeLeaders.length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:7}}>Key Figures</div>
                  {activeLeaders.slice(0,6).map(p=>(
                    <div key={p.id} onClick={()=>onSelectPerson(p)}
                      style={{display:'flex',gap:8,alignItems:'center',background:'#1a1a2e',borderRadius:6,padding:'6px 10px',marginBottom:5,cursor:'pointer',border:'1px solid transparent',transition:'border-color 0.15s'}}
                      onMouseEnter={(e: any) =>(e.currentTarget.style.borderColor='#444')}
                      onMouseLeave={(e: any) =>(e.currentTarget.style.borderColor='transparent')}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:getPersonColor(p),display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flexShrink:0}}>
                        {p.status==='killed'?'✕':p.status==='arrested'?'⚖':p.status==='deceased'?'†':'●'}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{p.name}</div>
                        <div style={{fontSize:10,color:'#888',fontStyle:'italic'}}>"{p.alias[0]}"</div>
                      </div>
                      <span style={{fontSize:9,color:STATUS_COLOR[p.status]}}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeCartel.wikipediaUrl && (
                <a href={activeCartel.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                  style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px',background:'#1a2a4a',border:'1px solid #2a4a8a',borderRadius:7,color:'#6b9fff',fontSize:12,textDecoration:'none',fontWeight:600}}>
                  📖 Wikipedia
                </a>
              )}
            </div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:300,color:'#555',textAlign:'center',gap:12}}>
            <div style={{fontSize:40}}>🔗</div>
            <div style={{fontSize:13,color:'#888'}}>Click any cartel node</div>
            <div style={{fontSize:11}}>See its origin, what it spawned,<br/>and key figures</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────
function FamilyTreePageInner() {
  const [activeGroup, setActiveGroup] = useState('sinaloa_dynasty');
  const [selectedPerson, setSelectedPerson] = useState<Person|null>(null);
  const [viewMode, setViewMode] = useState<'trees'|'all'|'lineage'>('trees');
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const searchParams = useSearchParams();
  const group = FAMILY_GROUPS.find(g=>g.id===activeGroup)!;

  // Deep-link: /family-tree?person=chapo → auto-select that person
  useEffect(() => {
    const personId = searchParams.get('person');
    if (personId) {
      const p = PEOPLE.find(x => x.id === personId);
      if (p) {
        setSelectedPerson(p);
        setViewMode('all');
      }
    }
  }, [searchParams]);;

  const filteredPeople = PEOPLE.filter(p=>
    !search||p.name.toLowerCase().includes(search.toLowerCase())||p.alias.some(a=>a.toLowerCase().includes(search.toLowerCase()))
  ).sort((a,b)=>(a.born||9999)-(b.born||9999));

  return (
    <div style={{background:'#0a0a16',minHeight:'100vh',color:'#fff',fontFamily:'system-ui,sans-serif'}}>
      {/* Header */}
      <div style={{background:'#0f0f1f',borderBottom:'1px solid #333',padding:isMobile?'10px 12px':'10px 20px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <Link href="/" style={{color:'#888',textDecoration:'none',fontSize:13}}>← Home</Link>
        <Link href="/map" style={{color:'#888',textDecoration:'none',fontSize:13}}>Map</Link>
        <Link href="/timeline" style={{color:'#888',textDecoration:'none',fontSize:13}}>Timeline</Link>
        <div style={{flex:1}}/>
        <h1 style={{margin:0,fontSize:isMobile?13:15,fontWeight:700,color:'#C8282D'}}>CARTEL ATLAS — Family Trees & Personnel</h1>
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',width:isMobile?'100%':'auto'}}>
          {(['trees','lineage','all'] as const).map(m=>(
            <button key={m} onClick={()=>setViewMode(m)} style={{padding:isMobile?'5px 9px':'4px 12px',borderRadius:6,border:`1px solid ${viewMode===m?'#C8282D':'#333'}`,background:viewMode===m?'#C8282D22':'transparent',color:viewMode===m?'#fff':'#888',fontSize:isMobile?11:12,cursor:'pointer',flex:isMobile?1:'unset'}}>
              {m==='trees'?'🌳 Family Trees':m==='lineage'?'🔗 Cartel Lineage':'👥 All People'}
            </button>
          ))}
        </div>
      </div>

      {viewMode==='lineage' ? (
        /* CARTEL LINEAGE SPAWN TREE */
        <CartelLineageView selectedPerson={selectedPerson} onSelectPerson={setSelectedPerson} isMobile={isMobile} />
      ) : viewMode==='trees' ? (
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'230px 1fr 320px',height:isMobile?'auto':'calc(100vh - 49px)'}}>
          {/* Sidebar */}
          <div style={{background:'#0f0f1f',borderRight:isMobile?'none':'1px solid #222',borderBottom:isMobile?'1px solid #222':'none',overflowY:'auto',padding:10,maxHeight:isMobile?220:'none'}}>
            <div style={{fontSize:10,color:'#555',textTransform:'uppercase',marginBottom:10,padding:'0 4px'}}>Blood Family Trees</div>
            {FAMILY_GROUPS.map(g=>(
              <button key={g.id} onClick={()=>setActiveGroup(g.id)} style={{width:'100%',textAlign:'left',padding:'9px 11px',marginBottom:5,background:activeGroup===g.id?`${g.color}22`:'#161626',border:`1px solid ${activeGroup===g.id?g.color:'#2a2a3e'}`,borderRadius:7,cursor:'pointer'}}>
                <div style={{fontSize:11,fontWeight:700,color:activeGroup===g.id?g.color:'#ccc',marginBottom:2}}>{g.title}</div>
                <div style={{fontSize:10,color:'#777',lineHeight:1.3}}>{g.description.slice(0,55)}…</div>
              </button>
            ))}

            <div style={{marginTop:16,padding:'10px 11px',background:'#161626',borderRadius:7,border:'1px solid #222'}}>
              <div style={{fontSize:10,color:'#555',textTransform:'uppercase',marginBottom:8}}>Personnel Stats</div>
              {[
                {l:'Total Tracked',v:PEOPLE.length},
                {l:'Active/Fugitive',v:PEOPLE.filter(p=>['active','fugitive'].includes(p.status)).length,c:'#22c55e'},
                {l:'Arrested',v:PEOPLE.filter(p=>p.status==='arrested').length,c:'#ef4444'},
                {l:'Killed',v:PEOPLE.filter(p=>p.status==='killed').length,c:'#dc2626'},
                {l:'Deceased',v:PEOPLE.filter(p=>p.status==='deceased').length,c:'#6b7280'},
              ].map(s=>(
                <div key={s.l} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:11,color:'#777'}}>{s.l}</span>
                  <span style={{fontSize:11,fontWeight:700,color:s.c||'#fff'}}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tree view */}
          <div style={{overflowY:'auto',padding:isMobile?12:24}}>
            <div style={{borderLeft:`4px solid ${group.color}`,paddingLeft:16,marginBottom:24}}>
              <h2 style={{color:'#fff',margin:'0 0 4px',fontSize:20}}>{group.title}</h2>
              <p style={{color:'#999',margin:0,fontSize:13}}>{group.description}</p>
            </div>

            {group.generations.map((gen,gi)=>(
              <div key={gi} style={{marginBottom:24}}>
                <div style={{fontSize:10,color:'#666',textTransform:'uppercase',marginBottom:10,letterSpacing:1}}>{gen.label}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                  {gen.members.map(m=>{
                    const person=PEOPLE.find(p=>p.id===m.personId);
                    if(!person) return null;
                    return (
                      <div key={m.personId} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                        {m.relation&&<div style={{fontSize:10,color:group.color,background:`${group.color}22`,borderRadius:10,padding:'2px 8px'}}>{m.relation}</div>}
                        <PersonCard person={person} onSelect={setSelectedPerson} selected={selectedPerson?.id===person.id}/>
                        {m.note&&<div style={{fontSize:10,color:'#666',maxWidth:180,textAlign:'center',lineHeight:1.3}}>{m.note}</div>}
                      </div>
                    );
                  })}
                </div>
                {gi<group.generations.length-1&&(
                  <div style={{display:'flex',alignItems:'center',gap:8,margin:'16px 0 0'}}>
                    <div style={{height:1,flex:1,background:'#222'}}/>
                    <div style={{fontSize:16,color:'#444'}}>↓</div>
                    <div style={{height:1,flex:1,background:'#222'}}/>
                  </div>
                )}
              </div>
            ))}

            <div style={{background:'#111',borderRadius:8,padding:'14px 16px',border:'1px solid #222',marginTop:8}}>
              <div style={{fontSize:10,color:'#666',textTransform:'uppercase',marginBottom:8}}>Key Insight</div>
              <div style={{fontSize:13,color:'#ccc',lineHeight:1.6}}>{renderWithHotlinks(group.insight, setSelectedPerson)}</div>
            </div>
          </div>

          {/* Detail panel */}
          <div style={{borderLeft:isMobile?'none':'1px solid #222',overflowY:'auto',padding:14,background:'#0a0a16',display:isMobile?'none':'block'}}>
            {selectedPerson ? <PersonDetail person={selectedPerson} onSelect={setSelectedPerson}/> : (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:280,color:'#555',textAlign:'center',gap:10}}>
                <div style={{fontSize:36}}>👆</div>
                <div style={{fontSize:13}}>Click any person card</div>
                <div style={{fontSize:11}}>See full profile, blood relatives, and history</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ALL PEOPLE VIEW */
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 360px',height:isMobile?'auto':'calc(100vh - 49px)'}}>
          <div style={{overflowY:'auto',padding:isMobile?12:20}}>
            <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center'}}>
              <input placeholder="Search name or alias…" value={search} onChange={(e: any) =>setSearch(e.target.value)}
                style={{flex:1,background:'#1a1a2e',border:'1px solid #333',borderRadius:7,padding:'7px 12px',color:'#fff',fontSize:13}}/>
              <span style={{color:'#666',fontSize:12,whiteSpace:'nowrap'}}>{filteredPeople.length} people</span>
            </div>
            <div style={{display:'flex',gap:12,marginBottom:14,flexWrap:'wrap'}}>
              {Object.entries(STATUS_COLOR).map(([s,c])=>(
                <div key={s} style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:c}}/>
                  <span style={{color:'#888'}}>{STATUS_LABEL[s]}: {PEOPLE.filter(p=>p.status===s).length}</span>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:10}}>
              {filteredPeople.map(p=>{ const props = {person:p, onSelect:setSelectedPerson as (p:Person)=>void, selected:selectedPerson?.id===p.id}; return <PersonCard key={p.id} {...props}/>; })}
            </div>
          </div>
          <div style={{borderLeft:isMobile?'none':'1px solid #222',overflowY:'auto',padding:14,background:'#0a0a16',display:isMobile?'none':'block'}}>
            {selectedPerson ? <PersonDetail person={selectedPerson} onSelect={setSelectedPerson}/> : (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:280,color:'#555',textAlign:'center',gap:10}}>
                <div style={{fontSize:36}}>👆</div>
                <div style={{fontSize:13}}>Click any person for full profile</div>
              </div>
            )}
          </div>
        </div>
      )}



      {!selectedPerson && <CoffeeButton bottom={isMobile ? 12 : 14} size={isMobile ? 34 : 38} />}

      {isMobile && selectedPerson && (
        <div style={{position:'fixed',inset:0,zIndex:1400,background:'#0a0a16'}}>
          <div style={{position:'sticky',top:0,zIndex:5,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'#0f0f1f',borderBottom:'1px solid #222'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:1}}>Person Detail</div>
            <button onClick={()=>setSelectedPerson(null)} style={{background:'none',border:'1px solid #333',color:'#aaa',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>Close</button>
          </div>
          <div style={{padding:12,height:'calc(100vh - 46px)',overflowY:'auto'}}>
            <PersonDetail person={selectedPerson} onSelect={setSelectedPerson}/>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FamilyTreePage() {
  return (
    <Suspense fallback={<div style={{background:'#080810',minHeight:'100vh'}}/>}>
      <FamilyTreePageInner />
    </Suspense>
  );
}
