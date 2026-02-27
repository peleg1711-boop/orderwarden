import './globals.css'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import AuthGuard from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: 'OrderWarden - Etsy Order Protection',
  description: 'Protect your Etsy shop from refunds and disputes with intelligent tracking monitoring',
  metadataBase: new URL('https://orderwarden.com'),
  openGraph: {
    title: 'OrderWarden - Protect Your Etsy Shop',
    description: 'Protect your Etsy shop from refunds and disputes with intelligent tracking monitoring',
    url: 'https://orderwarden.com',
    siteName: 'OrderWarden',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OrderWarden - Protect Your Etsy Shop',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrderWarden - Protect Your Etsy Shop',
    description: 'Protect your Etsy shop from refunds and disputes with intelligent tracking monitoring',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <html lang="en">
        <body className="min-h-screen flex flex-col bg-slate-900">
          <AuthGuard>
            {children}
          </AuthGuard>
        </body>
      </html>
    </ClerkProvider>
  )
}
