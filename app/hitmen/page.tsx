'use client';

import Link from 'next/link';
import { PEOPLE, CARTEL_ATTACKS, CARTELS } from '@/lib/data';
import PersonPhoto from '@/components/PersonPhoto';

const KEYWORDS = ['sicario', 'enforcer', 'commander', 'hitman', 'military', 'armed wing', 'security'];

function isOperator(notes: string, role: string) {
  const x = `${notes} ${role}`.toLowerCase();
  return KEYWORDS.some((k) => x.includes(k));
}

export default function HitmenPage() {
  const operators = PEOPLE
    .filter((p) => (p.roles || []).some((r) => isOperator(p.notes || '', r.role)))
    .sort((a, b) => {
      const rank = { active: 0, fugitive: 1, arrested: 2, killed: 3, deceased: 4 } as Record<string, number>;
      return (rank[a.status] ?? 99) - (rank[b.status] ?? 99);
    });

  return (
    <div style={{ background: '#0a0a16', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui,sans-serif', padding: '20px 18px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Link href='/' style={{ color: '#666', textDecoration: 'none', fontSize: 12 }}>← Home</Link>
        <h1 style={{ margin: 0, fontSize: 20, color: '#C8282D' }}>Hitmen & Operators</h1>
      </div>

      <p style={{ color: '#888', fontSize: 13, marginTop: 0, maxWidth: 900, lineHeight: 1.6 }}>
        Cartel-adjacent operators tied to enforcement roles (sicarios, commanders, armed-wing/security figures). Each profile links to attacks where the person is explicitly tagged.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
        {operators.map((p) => {
          const related = CARTEL_ATTACKS.filter((a) => (a.personIds || []).includes(p.id));
          const latestRole = [...(p.roles || [])].sort((a, b) => (b.endYear || 2026) - (a.endYear || 2026) || b.startYear - a.startYear)[0];
          const cartel = latestRole ? CARTELS.find((c) => c.id === latestRole.cartelId) : null;
          const statusColor = { active: '#22c55e', fugitive: '#f59e0b', arrested: '#ef4444', killed: '#dc2626', deceased: '#6b7280' }[p.status] || '#666';

          return (
            <div key={p.id} style={{ background: '#0f0f1f', border: '1px solid #222', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <PersonPhoto personId={p.id} personName={p.name} size={42} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#777' }}>{p.alias?.[0] || '—'}</div>
                  <div style={{ fontSize: 10, color: statusColor, marginTop: 2, textTransform: 'uppercase' }}>{p.status}</div>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 11, color: '#aaa' }}>
                {latestRole ? `${latestRole.role} ${cartel ? `· ${cartel.shortName}` : ''}` : 'No role timeline available'}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>{related.length} tagged attacks</div>

              {related.slice(0, 3).map((a) => (
                <div key={a.id} style={{ marginTop: 6, background: '#111', border: '1px solid #1f1f30', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: 11, color: '#ddd' }}>{a.year} · {a.title}</div>
                </div>
              ))}

              <div style={{ marginTop: 10 }}>
                <Link href={`/family-tree?person=${p.id}`} style={{ color: '#C8282D', fontSize: 11, textDecoration: 'none' }}>Open full profile →</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
