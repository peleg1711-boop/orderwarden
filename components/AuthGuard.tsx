'use client'

import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

const publicPaths = ['/sign-in', '/sign-up', '/landing', '/privacy', '/terms']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

  if (isPublicPath) {
    return <>{children}</>
  }

  return (
    <>
      <SignedIn>
        <main className="flex-1">
          {children}
        </main>
        <footer className="bg-slate-900 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-slate-400 text-sm">&copy; 2026 OrderWarden. All rights reserved.</p>
              <div className="flex items-center gap-6">
                <a href="/terms" className="text-slate-400 hover:text-white text-sm transition-colors">Terms of Service</a>
                <a href="/privacy" className="text-slate-400 hover:text-white text-sm transition-colors">Privacy Policy</a>
                <a href="mailto:support@orderwarden.com" className="text-slate-400 hover:text-white text-sm transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
