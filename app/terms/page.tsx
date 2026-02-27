import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-slate-400 text-sm mb-8">Last updated: February 2026</p>

        <div className="prose prose-invert prose-slate max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-300 mb-4">
              By accessing and using OrderWarden (&quot;the Service&quot;), you accept and agree to be bound by the terms
              and provisions of this agreement. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">2. Description of Service</h2>
            <p className="text-slate-300 mb-4">
              OrderWarden provides order tracking and delivery risk monitoring services for Etsy sellers.
              The Service includes tracking number monitoring, risk assessment, and notification features.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">3. User Accounts</h2>
            <p className="text-slate-300 mb-4">
              You are responsible for maintaining the confidentiality of your account credentials and for all
              activities that occur under your account. You agree to notify us immediately of any unauthorized
              use of your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">4. Etsy Integration</h2>
            <p className="text-slate-300 mb-4">
              Our Service integrates with Etsy&apos;s platform through their official API. By connecting your Etsy
              shop, you authorize us to access your order and shop data as permitted by Etsy&apos;s API terms.
              We are not affiliated with or endorsed by Etsy, Inc.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">5. Subscription and Payment</h2>
            <p className="text-slate-300 mb-4">
              Certain features of the Service require a paid subscription. Subscription fees are billed in
              advance on a monthly basis. You may cancel your subscription at any time, and cancellation will
              take effect at the end of your current billing period.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">6. Limitation of Liability</h2>
            <p className="text-slate-300 mb-4">
              The Service is provided &quot;as is&quot; without warranties of any kind. We shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages resulting from your use of
              the Service, including but not limited to lost profits, lost sales, or business interruption.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">7. Modifications to Terms</h2>
            <p className="text-slate-300 mb-4">
              We reserve the right to modify these terms at any time. We will notify users of any material
              changes via email or through the Service. Your continued use of the Service after such modifications
              constitutes your acceptance of the updated terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">8. Contact Information</h2>
            <p className="text-slate-300 mb-4">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:support@orderwarden.com" className="text-blue-400 hover:text-blue-300">
                support@orderwarden.com
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
