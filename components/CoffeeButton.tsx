import React from 'react';

export default function CoffeeButton({
  bottom = 14,
  right = 12,
  size = 38,
  zIndex = 1240,
  position = 'fixed',
  style,
}: {
  bottom?: number;
  right?: number;
  size?: number;
  zIndex?: number;
  position?: 'fixed' | 'absolute';
  style?: React.CSSProperties;
}) {
  return (
    <a
      href='https://ko-fi.com/aplcake'
      target='_blank'
      rel='noopener noreferrer'
      title='Buy me a coffee'
      aria-label='Support on Ko-fi'
      style={{
        position,
        right,
        bottom,
        zIndex,
        width: size,
        height: size,
        borderRadius: '999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        fontSize: size < 36 ? 16 : 18,
        background: '#1a1a2e',
        border: '1px solid #3a3a55',
        boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      ☕
    </a>
  );
}
