'use client';
import { useState } from 'react';
import { CARTEL_LOGOS } from '@/lib/data';

interface Props {
  cartelId: string;
  cartelName: string;
  color: string;
  size?: number;
}

export default function CartelLogo({ cartelId, cartelName, color, size = 80 }: Props) {
  const [failed, setFailed] = useState(false);
  const logoUrl = CARTEL_LOGOS[cartelId];

  if (!logoUrl || failed) return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: `${color}22`, border: `2px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.floor(size * 0.22), fontWeight: 900, color,
      flexShrink: 0, textAlign: 'center', padding: 4, lineHeight: 1.2,
    }}>
      {cartelName.split(' ').slice(0, 2).join('\n')}
    </div>
  );

  return (
    <img
      src={logoUrl}
      alt={`${cartelName} logo`}
      style={{
        width: size, height: size,
        objectFit: 'contain',
        borderRadius: 8,
        background: `${color}11`,
        border: `1px solid ${color}33`,
        padding: 4, flexShrink: 0, display: 'block',
      }}
      onError={() => setFailed(true)}
    />
  );
}
