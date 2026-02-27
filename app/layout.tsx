import './globals.css'
import type { Metadata } from 'next'
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import Link from 'next/link'

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
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <html lang="en">
        <body className="min-h-screen flex flex-col bg-slate-900">
          <SignedIn>
            <main className="flex-1">
              {children}
            </main>
            <footer className="bg-slate-900 border-t border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <p className="text-slate-400 text-sm">© 2026 OrderWarden. All rights reserved.</p>
                  <div className="flex items-center gap-6">
                    <Link href="/terms" className="text-slate-400 hover:text-white text-sm transition-colors">Terms of Service</Link>
                    <Link href="/privacy" className="text-slate-400 hover:text-white text-sm transition-colors">Privacy Policy</Link>
                    <a href="mailto:support@orderwarden.com" className="text-slate-400 hover:text-white text-sm transition-colors">Support</a>
                  </div>
                </div>
              </div>
            </footer>
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </body>
      </html>
    </ClerkProvider>
  )
}
