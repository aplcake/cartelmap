import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cartel Atlas — Mexico Drug War 1930–2026',
  description: 'Interactive historical map of Mexican cartel territorial control, family bloodlines, and key events from 1930 to 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://unpkg.com/topojson-client@3/dist/topojson-client.min.js" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0a16' }}>
        {/* Mobile block */}
        <style>{`
          #mobile-block { display: none; }
          @media (max-width: 900px) {
            #mobile-block { display: flex; }
            #app-content { display: none; }
          }
        `}</style>
        <div id="mobile-block" style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'#0a0a16', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          textAlign:'center', padding:'40px 32px',
          fontFamily:'system-ui,sans-serif',
        }}>
          <div style={{fontSize:52, marginBottom:20}}>🖥️</div>
          <div style={{fontSize:22, fontWeight:900, color:'#fff', marginBottom:10, letterSpacing:-0.5}}>
            CARTEL <span style={{color:'#C8282D'}}>ATLAS</span>
          </div>
          <div style={{fontSize:14, color:'#888', lineHeight:1.7, maxWidth:320, marginBottom:28}}>
            This app is built for desktop. The interactive maps, family trees, and timeline require a larger screen.
          </div>
          <div style={{
            background:'#1a0a0a', border:'1px solid #C8282D',
            borderRadius:10, padding:'14px 24px',
            fontSize:13, color:'#C8282D', fontWeight:700,
          }}>
            Open on a PC or laptop to continue
          </div>
          <div style={{marginTop:24, fontSize:11, color:'#333'}}>
            Minimum width: 900px
          </div>
        </div>
        <div id="app-content">{children}</div>
      </body>
    </html>
  )
}
