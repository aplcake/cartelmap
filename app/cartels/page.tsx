'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  CARTELS, PEOPLE, CARTEL_WARS, CARTEL_ATTACKS, DRUG_BUSTS,
  HISTORICAL_EVENTS, TERRITORY_PERIODS, TRAFFICKING_ROUTES,
  Person, Cartel
} from '@/lib/data';
import PersonPhoto from '@/components/PersonPhoto';
import CoffeeButton from '@/components/CoffeeButton';

const CARTEL_COLORS: Record<string, string> = {
  proto_sinaloa:'#5a1a1a', gulf_proto:'#1a2a5a', guadalajara:'#8B1A1A',
  sinaloa:'#C8282D', chapitos:'#FF6B35', tijuana:'#E8612A', juarez:'#D4A017',
  sonora_caro:'#8B4513', gulf:'#1A6B8A', zetas:'#2D5A27', beltran_leyva:'#7B3F8C',
  cjng:'#E63946', la_familia:'#2E8B57', knights_templar:'#8B6914', cdg_factions:'#1B4F72',
};

const STATUS_STYLE: Record<string, {label:string; color:string; bg:string}> = {
  active:     { label:'ACTIVE',     color:'#22c55e', bg:'#0a2a0a' },
  fragmented: { label:'FRAGMENTED', color:'#f59e0b', bg:'#2a1a00' },
  dissolved:  { label:'DISSOLVED',  color:'#666',    bg:'#111'    },
};

// Era labels for timeline
const ERA_COLORS: Record<string, string> = {
  'Pioneer Era': '#5a1a1a',
  'Guadalajara Federation': '#8B1A1A',
  'Plaza Division': '#C8282D',
  'Calderón War': '#E63946',
  'Fragmentation': '#7B3F8C',
  'Fentanyl Era': '#FF6B35',
};

function getEra(year: number) {
  if (year < 1980) return 'Pioneer Era';
  if (year < 1989) return 'Guadalajara Federation';
  if (year < 2006) return 'Plaza Division';
  if (year < 2012) return 'Calderón War';
  if (year < 2019) return 'Fragmentation';
  return 'Fentanyl Era';
}

function fmtB(n?: number) {
  if (!n) return null;
  if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}


function getCartelPeople(cartel: Cartel) {
  const founderIds = new Set(cartel.founders || []);
  const leaderIds = new Set(cartel.currentLeaders || []);

  return PEOPLE.filter((p) => {
    const explicit = (p.cartelIds || []).includes(cartel.id);
    const roleLinked = (p.roles || []).some((r) => r.cartelId === cartel.id);
    const founderLinked = founderIds.has(p.id);
    const leaderLinked = leaderIds.has(p.id);
    return explicit || roleLinked || founderLinked || leaderLinked;
  });
}

// Cartel logo placeholder — distinctive monogram based on ID
function CartelMonogram({ cartel, size = 64 }: { cartel: Cartel; size?: number }) {
  const color = CARTEL_COLORS[cartel.id] || '#555';
  const initials = cartel.shortName
    .split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.18,
      background: `${color}22`,
      border: `2px solid ${color}66`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize: size * 0.28, fontWeight: 900, color,
      letterSpacing: -1,
      fontFamily: 'Georgia, serif',
    }}>
      {initials}
    </div>
  );
}

// Cartel genealogy: parent → children chain
function GenealogyCrumb({ cartel, onSelect }: { cartel: Cartel; onSelect: (id: string) => void }) {
  const parent = cartel.parentCartels?.[0]
    ? CARTELS.find(c => c.id === cartel.parentCartels![0])
    : null;
  const spawned = CARTELS.filter(c => c.parentCartels?.includes(cartel.id));

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11 }}>
      {parent && (
        <>
          <button onClick={() => onSelect(parent.id)} style={{
            background: `${CARTEL_COLORS[parent.id]}22`,
            border: `1px solid ${CARTEL_COLORS[parent.id]}55`,
            color: CARTEL_COLORS[parent.id], borderRadius: 4,
            padding: '2px 8px', cursor: 'pointer', fontSize: 11,
          }}>↑ {parent.shortName}</button>
          <span style={{ color: '#333' }}>spawned</span>
        </>
      )}
      <span style={{
        background: `${CARTEL_COLORS[cartel.id]}33`,
        border: `1px solid ${CARTEL_COLORS[cartel.id]}77`,
        color: '#fff', borderRadius: 4, padding: '2px 8px', fontWeight: 700,
      }}>{cartel.shortName}</span>
      {spawned.length > 0 && (
        <>
          <span style={{ color: '#333' }}>→</span>
          {spawned.map(s => (
            <button key={s.id} onClick={() => onSelect(s.id)} style={{
              background: `${CARTEL_COLORS[s.id]}22`,
              border: `1px solid ${CARTEL_COLORS[s.id]}55`,
              color: CARTEL_COLORS[s.id], borderRadius: 4,
              padding: '2px 8px', cursor: 'pointer', fontSize: 11,
            }}>{s.shortName} ↓</button>
          ))}
        </>
      )}
    </div>
  );
}

// ── Cartel Detail Panel ───────────────────────────────────────────────────
function CartelDetail({ cartel, onClose, onSelectCartel }: {
  cartel: Cartel;
  onClose: () => void;
  onSelectCartel: (id: string) => void;
}) {
  const color = CARTEL_COLORS[cartel.id] || '#555';
  const status = STATUS_STYLE[cartel.status];
  const span = (cartel.dissolvedYear || 2026) - cartel.foundedYear;

  // Related data
  const members = getCartelPeople(cartel);
  const founders = (cartel.founders || []).map(id => PEOPLE.find(p => p.id === id)).filter(Boolean) as Person[];
  const leaders  = (cartel.currentLeaders || []).map(id => PEOPLE.find(p => p.id === id)).filter(Boolean) as Person[];
  const wars = CARTEL_WARS.filter(w => w.cartel1 === cartel.id || w.cartel2 === cartel.id);
  const attacks = CARTEL_ATTACKS.filter(a => a.attackerCartelId === cartel.id || a.targetCartelId === cartel.id);
  const busts = DRUG_BUSTS.filter(b => b.cartelId === cartel.id);
  const routes = TRAFFICKING_ROUTES.filter(r => r.cartelId === cartel.id);
  const keyEvents = HISTORICAL_EVENTS.filter(e =>
    e.cartelIds?.includes(cartel.id) && e.significance === 'critical'
  ).slice(0, 8);

  const totalWarDeaths = wars.reduce((sum, w) => sum + (w.estimatedDeaths || 0), 0);
  const totalAttackKilled = attacks.reduce((sum, a) => sum + (a.killed || 0), 0);
  const drugTypes = Array.from(new Set(cartel.primaryDrugs));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: 'min(640px, 95vw)', height: '100vh',
        background: '#0a0a16',
        borderLeft: `2px solid ${color}44`,
        overflowY: 'auto',
        boxShadow: `-12px 0 60px rgba(0,0,0,0.9), inset 0 0 40px ${color}08`,
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${color}22 0%, transparent 60%)`,
          borderBottom: `1px solid ${color}33`,
          padding: '24px 24px 20px',
          position: 'sticky', top: 0, zIndex: 2,
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <CartelMonogram cartel={cartel} size={72} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>
                  {cartel.name}
                </h2>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                  color: status.color, background: status.bg,
                  border: `1px solid ${status.color}44`,
                  borderRadius: 3, padding: '2px 6px',
                }}>{status.label}</span>
              </div>
              {cartel.aliases?.length > 0 && (
                <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic', marginBottom: 6 }}>
                  {cartel.aliases.slice(0, 3).join(' · ')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#888' }}>
                  {cartel.foundedYear}{cartel.dissolvedYear ? ` – ${cartel.dissolvedYear}` : ' – present'}
                  <span style={{ color: '#444', marginLeft: 4 }}>({span} yrs)</span>
                </span>
                <span style={{ fontSize: 12, color: '#666' }}>📍 {cartel.headquarters}</span>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: '#444',
              fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0,
            }}>✕</button>
          </div>

          {/* Genealogy */}
          <div style={{ marginTop: 14 }}>
            <GenealogyCrumb cartel={cartel} onSelect={onSelectCartel} />
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8, marginBottom: 20,
          }}>
            {[
              { label: 'People', value: members.length.toString(), icon: '👥' },
              { label: 'Wars', value: wars.length.toString(), icon: '🔥' },
              { label: 'Attacks', value: attacks.length.toString(), icon: '⚔️' },
              { label: 'Routes', value: routes.length.toString(), icon: '🚚' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#111', borderRadius: 8, padding: '10px',
                border: `1px solid ${color}22`, textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Financial */}
          {((cartel as any).annualRevenueUSD || (cartel as any).peakNetWorthUSD) && (
            <div style={{
              background: '#0d1108', border: `1px solid #f59e0b33`,
              borderRadius: 8, padding: '14px 16px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Financial Intelligence
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {(cartel as any).annualRevenueUSD && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>
                      {fmtB((cartel as any).annualRevenueUSD)}
                    </div>
                    <div style={{ fontSize: 10, color: '#666' }}>est. annual revenue at peak</div>
                  </div>
                )}
                {(cartel as any).peakNetWorthUSD && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>
                      {fmtB((cartel as any).peakNetWorthUSD)}
                    </div>
                    <div style={{ fontSize: 10, color: '#666' }}>est. peak total wealth</div>
                  </div>
                )}
              </div>
              {totalWarDeaths > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
                  ☠ ~{totalWarDeaths.toLocaleString()} deaths in associated wars
                  {totalAttackKilled > 0 && ` · ${totalAttackKilled.toLocaleString()} in documented attacks`}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div style={{
            background: '#0d0d1a', borderRadius: 8, padding: '14px 16px',
            borderLeft: `3px solid ${color}`, marginBottom: 20,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#ccc', lineHeight: 1.75 }}>
              {cartel.description}
            </p>
            {cartel.wikipediaUrl && (
              <a href={cartel.wikipediaUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                marginTop: 10, fontSize: 11, color: '#6b9fff',
                textDecoration: 'none', border: '1px solid #2a4a8a',
                borderRadius: 4, padding: '3px 8px',
              }}>📖 Wikipedia</a>
            )}
          </div>

          {/* Drugs */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Primary Drugs
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {drugTypes.map(d => (
                <span key={d} style={{
                  fontSize: 11, background: `${color}22`, border: `1px solid ${color}44`,
                  color, borderRadius: 5, padding: '3px 9px', fontWeight: 600,
                  textTransform: 'capitalize',
                }}>{d}</span>
              ))}
            </div>
          </div>

          {/* Active years / peak era */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Activity Span
            </div>
            <div style={{ position: 'relative', height: 28, background: '#111', borderRadius: 6, overflow: 'hidden' }}>
              {/* full timeline background 1930–2026 */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                {[1940,1960,1980,2000,2020].map(y => (
                  <div key={y} style={{
                    position: 'absolute',
                    left: `${((y - 1930) / 96) * 100}%`,
                    top: 0, bottom: 0, width: 1, background: '#1e1e2e',
                  }} />
                ))}
              </div>
              {/* Peak years */}
              <div style={{
                position: 'absolute',
                left: `${((cartel.peakYears[0] - 1930) / 96) * 100}%`,
                width: `${((cartel.peakYears[1] - cartel.peakYears[0]) / 96) * 100}%`,
                top: 4, bottom: 4,
                background: `${color}55`, borderRadius: 3,
              }} />
              {/* Full active span */}
              <div style={{
                position: 'absolute',
                left: `${((cartel.foundedYear - 1930) / 96) * 100}%`,
                width: `${(((cartel.dissolvedYear || 2026) - cartel.foundedYear) / 96) * 100}%`,
                top: 10, bottom: 10,
                background: color, borderRadius: 2,
              }} />
              {/* Year labels */}
              <div style={{
                position: 'absolute',
                left: `${((cartel.foundedYear - 1930) / 96) * 100}%`,
                top: '50%', transform: 'translate(4px, -50%)',
                fontSize: 9, color: '#fff', fontWeight: 700,
              }}>{cartel.foundedYear}</div>
              <div style={{
                position: 'absolute',
                left: `${(((cartel.dissolvedYear || 2025) - 1930) / 96) * 100}%`,
                top: '50%', transform: 'translate(-28px, -50%)',
                fontSize: 9, color: '#fff', fontWeight: 700,
              }}>{cartel.dissolvedYear || 'now'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ fontSize: 9, color: '#333' }}>1930</span>
              <span style={{ fontSize: 9, color: color }}>
                Peak: {cartel.peakYears[0]}–{cartel.peakYears[1]}
              </span>
              <span style={{ fontSize: 9, color: '#333' }}>2026</span>
            </div>
          </div>

          {/* Founders */}
          {founders.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Founders
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {founders.map(p => (
                  <Link key={p.id} href={`/family-tree?person=${p.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: '#111', borderRadius: 7, padding: '7px 10px',
                      border: `1px solid ${color}33`,
                      cursor: 'pointer', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e: any) => (e.currentTarget.style.borderColor = color)}
                    onMouseLeave={(e: any) => (e.currentTarget.style.borderColor = `${color}33`)}>
                      <PersonPhoto personId={p.id} personName={p.name} size={32} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>{p.alias[0]}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Current leaders (if different from founders) */}
          {leaders.length > 0 && leaders.some(l => !cartel.founders?.includes(l.id)) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                {cartel.status === 'active' ? 'Current Leadership' : 'Last Known Leadership'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {leaders.filter(l => !cartel.founders?.includes(l.id)).map(p => (
                  <Link key={p.id} href={`/family-tree?person=${p.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: '#111', borderRadius: 7, padding: '7px 10px',
                      border: `1px solid ${color}33`, cursor: 'pointer',
                    }}>
                      <PersonPhoto personId={p.id} personName={p.name} size={28} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{p.name}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* All Members */}
          {members.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                People linked to {cartel.shortName} ({members.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {members.map(p => {
                  const statusColor = { active:'#22c55e', arrested:'#ef4444', killed:'#dc2626', deceased:'#6b7280', fugitive:'#f59e0b' }[p.status] || '#666';
                  const latestRole = [...(p.roles || [])]
                    .filter(r => r.cartelId === cartel.id)
                    .sort((a,b) => (b.endYear || 2026) - (a.endYear || 2026) || b.startYear - a.startYear)[0]?.role;
                  return (
                    <Link key={p.id} href={`/family-tree?person=${p.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#111', borderRadius: 5, padding: '4px 8px',
                        border: '1px solid #1a1a2e', cursor: 'pointer', fontSize: 11,
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e: any) => (e.currentTarget.style.borderColor = '#2a2a4a')}
                      onMouseLeave={(e: any) => (e.currentTarget.style.borderColor = '#1a1a2e')}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                        <span style={{ color: '#ccc' }}>{p.alias[0] || p.name}</span>
                        {latestRole && <span style={{ color:'#666', fontSize:10 }}>• {latestRole}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wars */}
          {wars.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Wars & Major Conflicts
              </div>
              {wars.map(w => {
                const enemy = CARTELS.find(c => c.id === (w.cartel1 === cartel.id ? w.cartel2 : w.cartel1));
                const enemyColor = enemy ? CARTEL_COLORS[enemy.id] : '#555';
                return (
                  <div key={w.id} style={{
                    background: '#0d0d1a', borderRadius: 7, padding: '10px 12px',
                    marginBottom: 6, borderLeft: `3px solid #f97316`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>🔥 {w.title}</span>
                      <span style={{ fontSize: 10, color: '#555' }}>{w.startYear}{w.endYear ? `–${w.endYear}` : '–now'}</span>
                    </div>
                    {enemy && (
                      <div style={{ fontSize: 11, marginBottom: 4 }}>
                        vs <span style={{ color: enemyColor, fontWeight: 700 }}>{enemy.name}</span>
                      </div>
                    )}
                    {w.estimatedDeaths && (
                      <div style={{ fontSize: 11, color: '#ef4444' }}>
                        ☠ ~{w.estimatedDeaths.toLocaleString()} deaths
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4, lineHeight: 1.5 }}>
                      {w.description.slice(0, 140)}…
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Critical Events */}
          {keyEvents.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Critical Events
              </div>
              {keyEvents.map(ev => (
                <div key={ev.id} style={{
                  display: 'flex', gap: 10, marginBottom: 7,
                  background: '#0d0d1a', borderRadius: 6, padding: '8px 10px',
                  borderLeft: '2px solid #C8282D',
                }}>
                  <div style={{ fontSize: 11, color: '#C8282D', fontWeight: 700, flexShrink: 0, minWidth: 32 }}>
                    {ev.year}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{ev.title}</div>
                    <div style={{ fontSize: 10, color: '#777', lineHeight: 1.4 }}>{ev.description.slice(0, 120)}…</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trafficking Routes */}
          {routes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Trafficking Routes ({routes.length})
              </div>
              {routes.map(r => (
                <div key={r.id} style={{
                  background: '#0d0d1a', borderRadius: 6, padding: '8px 12px',
                  marginBottom: 5, borderLeft: `2px solid ${color}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ccc', marginBottom: 2 }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: '#666' }}>{r.type} · {r.drugType.join(', ')}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: r.volume === 'massive' ? '#C8282D33' : r.volume === 'high' ? '#f9741633' : '#33333344',
                      color: r.volume === 'massive' ? '#ef4444' : r.volume === 'high' ? '#fb923c' : '#888',
                      border: '1px solid currentColor', opacity: 0.9,
                    }}>{r.volume}</span>
                    <span style={{ fontSize: 9, color: '#444' }}>{r.startYear}–{r.endYear}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* External links */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #1a1a2e' }}>
            <Link href={`/map?cartel=${cartel.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: `${color}22`, border: `1px solid ${color}44`,
                color, borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}>🗺 View on Map</div>
            </Link>
            <Link href={`/family-tree`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#111', border: '1px solid #2a2a4a',
                color: '#888', borderRadius: 6, padding: '7px 12px', fontSize: 12,
                cursor: 'pointer',
              }}>🌳 Family Tree</div>
            </Link>
            <Link href={`/timeline`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#111', border: '1px solid #2a2a4a',
                color: '#888', borderRadius: 6, padding: '7px 12px', fontSize: 12,
                cursor: 'pointer',
              }}>⏱ Timeline</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cartel Card (grid item) ───────────────────────────────────────────────
function CartelCard({ cartel, onClick }: { cartel: Cartel; onClick: () => void; key?: React.Key }) {
  const color = CARTEL_COLORS[cartel.id] || '#555';
  const status = STATUS_STYLE[cartel.status];
  const memberCount = getCartelPeople(cartel).length;
  const warCount = CARTEL_WARS.filter(w => w.cartel1 === cartel.id || w.cartel2 === cartel.id).length;
  const era = getEra(cartel.foundedYear);

  return (
    <div onClick={onClick} style={{
      background: '#0d0d1a',
      border: `1px solid ${color}33`,
      borderRadius: 10,
      padding: '16px',
      cursor: 'pointer',
      transition: 'all 0.15s',
      position: 'relative',
      overflow: 'hidden',
    }}
    onMouseEnter={(e: any) => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = `${color}88`;
      el.style.background = `${color}11`;
      el.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e: any) => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = `${color}33`;
      el.style.background = '#0d0d1a';
      el.style.transform = 'translateY(0)';
    }}>
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${color}18, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Top row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
        <CartelMonogram cartel={cartel} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 3 }}>
            {cartel.name}
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: 1,
              color: status.color, background: status.bg,
              border: `1px solid ${status.color}44`,
              borderRadius: 2, padding: '1px 4px',
            }}>{status.label}</span>
            <span style={{ fontSize: 10, color: '#444' }}>
              {cartel.foundedYear}{cartel.dissolvedYear ? `–${cartel.dissolvedYear}` : '–now'}
            </span>
          </div>
        </div>
      </div>

      {/* Description excerpt */}
      <p style={{
        margin: '0 0 10px', fontSize: 11, color: '#777', lineHeight: 1.55,
        display: '-webkit-box', WebkitLineClamp: 3 as any,
        WebkitBoxOrient: 'vertical' as any, overflow: 'hidden',
      }}>
        {cartel.description}
      </p>

      {/* Drugs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
        {cartel.primaryDrugs.slice(0, 4).map(d => (
          <span key={d} style={{
            fontSize: 9, background: `${color}18`, border: `1px solid ${color}33`,
            color, borderRadius: 3, padding: '1px 5px', textTransform: 'capitalize',
          }}>{d}</span>
        ))}
      </div>

      {/* Footer stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 8, borderTop: `1px solid ${color}22`,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 10, color: '#555' }}>👥 {memberCount} people</span>
          {warCount > 0 && <span style={{ fontSize: 10, color: '#555' }}>🔥 {warCount} wars</span>}
          {(cartel as any).annualRevenueUSD && (
            <span style={{ fontSize: 10, color: '#f59e0b' }}>💰 {fmtB((cartel as any).annualRevenueUSD)}/yr</span>
          )}
        </div>
        <span style={{
          fontSize: 9, color: ERA_COLORS[era] || '#555',
          background: `${ERA_COLORS[era] || '#555'}22`,
          border: `1px solid ${ERA_COLORS[era] || '#555'}33`,
          borderRadius: 3, padding: '1px 5px',
        }}>{era}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function CartelsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [eraFilter, setEraFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectedCartel = selected ? CARTELS.find(c => c.id === selected) : null;

  const filtered = useMemo(() => {
    return CARTELS.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (eraFilter && getEra(c.foundedYear) !== eraFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) ||
          c.aliases?.some(a => a.toLowerCase().includes(q)) ||
          c.headquarters.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => a.foundedYear - b.foundedYear);
  }, [statusFilter, eraFilter, search]);

  // Cartel genealogy tree — compute generation levels
  const generations: Cartel[][] = useMemo(() => {
    const roots = CARTELS.filter(c => !c.parentCartels?.length || c.parentCartels.every(p => !CARTELS.find(cc => cc.id === p)));
    const placed = new Set<string>();
    const gens: Cartel[][] = [];
    let current = roots;
    while (current.length > 0) {
      gens.push(current);
      current.forEach(c => placed.add(c.id));
      current = CARTELS.filter(c =>
        !placed.has(c.id) &&
        c.parentCartels?.some(p => placed.has(p))
      );
    }
    return gens;
  }, []);

  const eras = Array.from(new Set(CARTELS.map(c => getEra(c.foundedYear))));
  const totalDeaths = CARTEL_WARS.reduce((s, w) => s + (w.estimatedDeaths || 0), 0);

  return (
    <div style={{ background: '#0a0a16', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, #1a0808 0%, #0a0a16 100%)',
        borderBottom: '1px solid #2a1515',
        padding: '32px 40px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: 12 }}>← Home</Link>
          <span style={{ color: '#222' }}>·</span>
          <Link href="/map" style={{ color: '#444', textDecoration: 'none', fontSize: 12 }}>Map</Link>
          <span style={{ color: '#222' }}>·</span>
          <Link href="/family-tree" style={{ color: '#444', textDecoration: 'none', fontSize: 12 }}>Family Tree</Link>
          <span style={{ color: '#222' }}>·</span>
          <Link href="/timeline" style={{ color: '#444', textDecoration: 'none', fontSize: 12 }}>Timeline</Link>
        </div>

        <h1 style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>
          THE <span style={{ color: '#C8282D' }}>CARTELS</span>
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#666', maxWidth: 600 }}>
          Every organization documented — from Prohibition-era bootleggers to the fentanyl empires of 2026.
          {' '}{CARTELS.length} cartels spanning 96 years of Mexican organized crime.
        </p>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { v: CARTELS.filter(c => c.status === 'active').length, l: 'Active', c: '#22c55e' },
            { v: CARTELS.filter(c => c.status === 'fragmented').length, l: 'Fragmented', c: '#f59e0b' },
            { v: CARTELS.filter(c => c.status === 'dissolved').length, l: 'Dissolved', c: '#555' },
            { v: CARTEL_WARS.length, l: 'Major Wars', c: '#f97316' },
            { v: `~${(totalDeaths/1000).toFixed(0)}K`, l: 'War Deaths', c: '#ef4444' },
          ].map(s => (
            <div key={s.l}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.c as string }}>{s.v}</span>
              <span style={{ fontSize: 11, color: '#444', marginLeft: 5 }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Genealogy tree */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
            Cartel Genealogy — Spawn Tree
          </div>
          <div style={{
            background: '#0d0d1a', borderRadius: 10, padding: '16px 20px',
            border: '1px solid #1a1a2e', overflowX: 'auto',
          }}>
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', minWidth: 'max-content' }}>
              {generations.map((gen, gi) => (
                <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 9, color: '#333', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, paddingLeft: 4 }}>
                    Gen {gi + 1}
                  </div>
                  {gen.map(c => {
                    const col = CARTEL_COLORS[c.id] || '#555';
                    const st = STATUS_STYLE[c.status];
                    return (
                      <button key={c.id} onClick={() => setSelected(c.id)} style={{
                        background: selected === c.id ? `${col}33` : '#111',
                        border: `1px solid ${selected === c.id ? col : col + '44'}`,
                        borderRadius: 6, padding: '5px 10px',
                        cursor: 'pointer', textAlign: 'left', minWidth: 130,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: selected === c.id ? '#fff' : '#ccc' }}>
                          {c.shortName}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                          <span style={{ fontSize: 9, color: '#444' }}>{c.foundedYear}</span>
                          <span style={{ fontSize: 8, color: st.color }}>{st.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            placeholder="Search cartels…"
            style={{
              background: '#111', border: '1px solid #2a2a3a', borderRadius: 6,
              color: '#fff', fontSize: 12, padding: '6px 12px',
              outline: 'none', width: 180,
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {(['active', 'fragmented', 'dissolved'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter((f: any) => f === s ? null : s)} style={{
                padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${statusFilter === s ? STATUS_STYLE[s].color : '#222'}`,
                background: statusFilter === s ? `${STATUS_STYLE[s].color}22` : 'transparent',
                color: statusFilter === s ? STATUS_STYLE[s].color : '#666',
              }}>{STATUS_STYLE[s].label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {eras.map(era => (
              <button key={era} onClick={() => setEraFilter((f: any) => f === era ? null : era)} style={{
                padding: '4px 10px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
                border: `1px solid ${eraFilter === era ? (ERA_COLORS[era] || '#555') : '#222'}`,
                background: eraFilter === era ? `${ERA_COLORS[era] || '#555'}22` : 'transparent',
                color: eraFilter === era ? (ERA_COLORS[era] || '#ccc') : '#555',
              }}>{era}</button>
            ))}
          </div>
          {(statusFilter || eraFilter || search) && (
            <button onClick={() => { setStatusFilter(null); setEraFilter(null); setSearch(''); }} style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
              border: '1px solid #333', background: 'transparent', color: '#666',
            }}>✕ Clear</button>
          )}
          <span style={{ fontSize: 11, color: '#333', marginLeft: 'auto' }}>
            {filtered.length} of {CARTELS.length}
          </span>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {(filtered as Cartel[]).map((c: Cartel) => (
            <CartelCard key={c.id} cartel={c} onClick={(): void => { setSelected(c.id); }} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#333' }}>
            No cartels match your filters
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedCartel && (
        <CartelDetail
          cartel={selectedCartel}
          onClose={() => setSelected(null)}
          onSelectCartel={(id) => setSelected(id)}
        />
      )}

      {!selectedCartel && <CoffeeButton bottom={isMobile ? 12 : 14} size={isMobile ? 34 : 38} />}
    </div>
  );
}
