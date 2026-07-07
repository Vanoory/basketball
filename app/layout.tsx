import type { Metadata, Viewport } from 'next'
import { Press_Start_2P } from 'next/font/google'
import './globals.css'

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
})

export const metadata: Metadata = {
  title: 'Pixel Hoops 3x3',
  description:
    'A 3D pixel-art 3v3 basketball game in your browser. Jump shots, dunks, passing, shot meter and AI defense.',
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  userScalable: false,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`bg-background ${pixelFont.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
