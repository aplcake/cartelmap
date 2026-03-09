'use client';
import { Person } from '@/lib/data';

interface Props {
  person: Person;
  color: string;
  onClick: (p: Person) => void;
}

export default function PersonChip({ person, color, onClick }: Props) {
  return (
    <span
      onClick={() => onClick(person)}
      title={`${person.name} — click to view profile`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '1px 6px', margin: '0 2px',
        background: `${color}22`, border: `1px solid ${color}55`,
        borderRadius: 10, cursor: 'pointer',
        fontSize: 'inherit', color, fontWeight: 600,
        whiteSpace: 'nowrap', verticalAlign: 'middle',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = `${color}44`)}
      onMouseLeave={e => (e.currentTarget.style.background = `${color}22`)}
    >
      👤 {person.alias[0] || person.name}
    </span>
  );
}
