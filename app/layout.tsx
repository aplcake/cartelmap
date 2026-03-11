import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'

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
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
