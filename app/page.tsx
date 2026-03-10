import Link from 'next/link';
import { CARTELS, PEOPLE, HISTORICAL_EVENTS } from '@/lib/data';

export default function HomePage() {
  const totalDeaths = 120000; // estimated from all wars
  const criticalEvents = HISTORICAL_EVENTS.filter(e=>e.significance==='critical').length;
  const activeCartels = CARTELS.filter(c=>c.status==='active').length;
  const activePeople = PEOPLE.filter(p=>['active','fugitive'].includes(p.status)).length;

  return (
    <div style={{background:'#0a0a16',minHeight:'100vh',color:'#fff',fontFamily:'system-ui,sans-serif'}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(180deg, #1a0808 0%, #0a0a16 100%)',borderBottom:'1px solid #2a1515',padding:'60px 40px 50px',textAlign:'center'}}>
        <div style={{fontSize:13,color:'#C8282D',letterSpacing:4,textTransform:'uppercase',marginBottom:16}}>1930 — 2026</div>
        <h1 style={{margin:'0 0 12px',fontSize:52,fontWeight:900,color:'#fff',letterSpacing:-1}}>
          CARTEL<span style={{color:'#C8282D'}}> ATLAS</span>
        </h1>
        <p style={{color:'#888',fontSize:17,margin:'0 0 8px',maxWidth:600,marginLeft:'auto',marginRight:'auto',lineHeight:1.6}}>
          The complete documented history of Mexican organized crime — blood family trees, territorial control, trafficking routes, and the full timeline from Prohibition bootleggers to El Mencho's February 2026 death.
        </p>
        <div style={{marginTop:8,fontSize:13,color:'#C8282D',fontWeight:700}}>
          ⚠ BREAKING: El Mencho (CJNG founder) killed February 22, 2026 — succession war underway
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:1,background:'#1a0a0a',borderBottom:'1px solid #2a1515'}}>
        {[
          {label:'Years of History',value:'96',sub:'1930–2026'},
          {label:'Cartels Documented',value:CARTELS.length.toString(),sub:`${activeCartels} still active`},
          {label:'Key Figures',value:PEOPLE.length.toString(),sub:`${activePeople} active/fugitive`},
          {label:'Critical Events',value:criticalEvents.toString(),sub:'turning points'},
          {label:'Est. Drug War Deaths',value:'120K+',sub:'2006–2026'},
        ].map(s=>(
          <div key={s.label} style={{background:'#0f0f1f',padding:'20px 24px',textAlign:'center'}}>
            <div style={{fontSize:32,fontWeight:900,color:'#C8282D'}}>{s.value}</div>
            <div style={{fontSize:12,color:'#fff',fontWeight:600,marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:11,color:'#666'}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:16,padding:32,maxWidth:1100,margin:'0 auto'}}>
        {[
          {href:'/map',emoji:'🗺',title:'Territory Map',desc:'Interactive 1930–2026 map. State-by-state cartel control, municipal breakdown, trafficking routes, inter-cartel attacks, mass violence sites, and drug bust markers. 4 data layers.',color:'#C8282D'},
          {href:'/family-tree',emoji:'🌳',title:'Blood Family Trees & Personnel',desc:`${PEOPLE.length} documented figures with photos, role timelines, mentor chains, blood relatives, and hotlinked notable connections (politicians, musicians, athletes). Cartel lineage spawn tree.`,color:'#E8612A'},
          {href:'/timeline',emoji:'⏱',title:'Timeline of Events',desc:`${HISTORICAL_EVENTS.length} documented events 1930–2026. Busts, arrests, massacres, assassinations, founding moments. Filter by cartel, type, significance. Seized drug volumes shown.`,color:'#7B3F8C'},
          {href:'/cartels',emoji:'💀',title:'Cartel Profiles',desc:`All ${CARTELS.length} documented organizations — from 1930s bootleggers to 2026 fentanyl empires. Stats, genealogy tree, members, wars, routes, and financial intelligence per cartel.`,color:'#1A6B8A'},
          {href:'/hitmen',emoji:'🎯',title:'Hitmen & Operators',desc:'Cartel-adjacent enforcers, commanders, sicarios, and security chiefs linked to attacks and role timelines. Useful for understanding who executes violence vs who commands it.',color:'#9b59b6'},
        ].map(nav=>(
          <Link key={nav.href} href={nav.href} style={{textDecoration:'none'}}>
            <div style={{background:'#0f0f1f',border:`1px solid ${nav.color}44`,borderRadius:12,padding:'24px 20px',cursor:'pointer',transition:'all 0.2s'}}>
              <div style={{fontSize:36,marginBottom:12}}>{nav.emoji}</div>
              <div style={{fontSize:18,fontWeight:700,color:'#fff',marginBottom:8}}>{nav.title}</div>
              <div style={{fontSize:13,color:'#888',lineHeight:1.5}}>{nav.desc}</div>
              <div style={{marginTop:14,color:nav.color,fontSize:12,fontWeight:700}}>Open →</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Breaking news: El Mencho */}
      <div style={{maxWidth:900,margin:'0 auto 32px',padding:'0 32px'}}>
        <div style={{background:'#1a0a0a',border:'1px solid #C8282D',borderRadius:12,padding:'20px 24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#C8282D',animation:'pulse 1s infinite'}}/>
            <span style={{fontSize:12,color:'#C8282D',fontWeight:700,textTransform:'uppercase',letterSpacing:2}}>Latest Event — February 22, 2026</span>
          </div>
          <h3 style={{margin:'0 0 8px',color:'#fff',fontSize:18}}>El Mencho Killed — CJNG Succession War Begins</h3>
          <p style={{color:'#999',fontSize:13,lineHeight:1.6,margin:0}}>
            Nemesio Oseguera Cervantes ("El Mencho"), founder of CJNG and Mexico's most-wanted man for a decade, was wounded in a joint Mexican Army / US intelligence operation in Tapalpa, Jalisco and died en route to Mexico City. His death triggered 252 road blockades across 20 states, 25 National Guard deaths, airport closures across western Mexico, and a US State Department shelter-in-place advisory. No clear CJNG successor has emerged.
          </p>
        </div>
      </div>

      {/* Cartel family overview */}
      <div style={{maxWidth:900,margin:'0 auto 40px',padding:'0 32px'}}>
        <h2 style={{color:'#888',fontSize:13,textTransform:'uppercase',letterSpacing:2,marginBottom:16}}>All Documented Organizations</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
          {CARTELS.map(c=>(
            <div key={c.id} style={{background:'#0f0f1f',border:`1px solid ${c.color}33`,borderRadius:8,padding:'10px 12px'}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:c.color,flexShrink:0}}/>
                <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{c.shortName}</div>
              </div>
              <div style={{fontSize:10,color:'#777'}}>{c.foundedYear}–{c.dissolvedYear||'present'} · {c.status}</div>
              <div style={{fontSize:11,color:'#999',marginTop:3,lineHeight:1.3}}>{c.description.slice(0,70)}…</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
