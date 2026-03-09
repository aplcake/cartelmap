'use client';
import { useState, useEffect } from 'react';
import { PERSON_WIKI_TITLES } from '@/lib/data';

interface Props {
  personId: string;
  personName: string;
  size?: number;
  carousel?: boolean;
}

export default function PersonPhoto({ personId, personName, size = 120, carousel = false }: Props) {
  const [images, setImages] = useState<{ url: string; caption: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const wikiTitle = PERSON_WIKI_TITLES[personId];

  useEffect(() => {
    if (!wikiTitle) { setLoading(false); return; }
    setLoading(true); setIdx(0);
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const collected: { url: string; caption: string }[] = [];
        if (data?.thumbnail?.source) {
          const hq = data.thumbnail.source.replace(/\/\d+px-/, '/400px-');
          collected.push({ url: hq, caption: data.description || personName });
        }
        if (data?.originalimage?.source && !collected.some(i => i.url === data.originalimage.source)) {
          collected.push({ url: data.originalimage.source, caption: `${personName} — original` });
        }
        setImages(collected);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wikiTitle, personName]);

  const initials = personName.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('');
  const current = images[idx];

  if (!current) return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: '#1a1a2e', border: '1px solid #333',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.max(10, Math.floor(size * 0.28)), fontWeight: 900,
      color: '#444', flexShrink: 0, userSelect: 'none' as const,
    }}>{loading ? '…' : initials}</div>
  );

  return (
    <div style={{ flexShrink: 0, position: 'relative' as const, width: size }}>
      <img
        key={current.url}
        src={current.url}
        alt={current.caption}
        style={{
          width: size, height: size,
          objectFit: 'cover' as const, objectPosition: 'top center',
          borderRadius: 8, border: '1px solid #333', display: 'block',
        }}
        onError={() => { setImages((p: any) => p.filter((_: any, i: any) => i !== idx)); setIdx(0); }}
      />
      {carousel && images.length > 1 && (
        <>
          <button onClick={(e: any) => { e.stopPropagation(); setIdx((i: any) => (i - 1 + images.length) % images.length); }}
            style={{ position: 'absolute' as const, left: 2, top: '50%', transform: 'translateY(-50%)', background: '#000b', border: 'none', borderRadius: 4, color: '#fff', width: 20, height: 20, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>‹</button>
          <button onClick={(e: any) => { e.stopPropagation(); setIdx((i: any) => (i + 1) % images.length); }}
            style={{ position: 'absolute' as const, right: 2, top: '50%', transform: 'translateY(-50%)', background: '#000b', border: 'none', borderRadius: 4, color: '#fff', width: 20, height: 20, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>›</button>
          <div style={{ position: 'absolute' as const, bottom: 5, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 3, pointerEvents: 'none' as const }}>
            {images.map((_: any, i: any) => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === idx ? '#fff' : '#555' }} />)}
          </div>
        </>
      )}
      {carousel && (
        <div style={{ fontSize: 9, color: '#777', marginTop: 3, textAlign: 'center' as const, maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {current.caption}
        </div>
      )}
    </div>
  );
}
