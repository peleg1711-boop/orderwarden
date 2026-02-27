import Link from 'next/link';

export default function PrivacyPage() {
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
            <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-slate-400 text-sm mb-8">Last updated: February 2026</p>

        <div className="prose prose-invert prose-slate max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">1. Information We Collect</h2>
            <p className="text-slate-300 mb-4">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
              <li>Account information (email address, name)</li>
              <li>Etsy shop data (shop name, order information, tracking numbers)</li>
              <li>Payment information (processed securely by our payment provider)</li>
              <li>Communications with our support team</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            <p className="text-slate-300 mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Monitor tracking status and assess delivery risks</li>
              <li>Send you notifications about your orders</li>
              <li>Process payments and manage your subscription</li>
              <li>Respond to your comments, questions, and support requests</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">3. Information Sharing</h2>
            <p className="text-slate-300 mb-4">
              We do not sell, trade, or rent your personal information to third parties.
              We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
              <li>With service providers who assist in operating our platform</li>
              <li>To comply with legal obligations or protect our rights</li>
              <li>With your consent or at your direction</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">4. Data Security</h2>
            <p className="text-slate-300 mb-4">
              We implement appropriate technical and organizational measures to protect your personal
              information against unauthorized access, alteration, disclosure, or destruction.
              However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">5. Data Retention</h2>
            <p className="text-slate-300 mb-4">
              We retain your information for as long as your account is active or as needed to provide
              you services. You may request deletion of your data at any time by contacting us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">6. Third-Party Services</h2>
            <p className="text-slate-300 mb-4">
              Our Service integrates with third-party services including Etsy and shipping carriers.
              Your use of these services is governed by their respective privacy policies.
              We encourage you to review their privacy practices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">7. Your Rights</h2>
            <p className="text-slate-300 mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
              <li>Access and receive a copy of your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of marketing communications</li>
              <li>Disconnect your Etsy account at any time</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">8. Changes to This Policy</h2>
            <p className="text-slate-300 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">9. Contact Us</h2>
            <p className="text-slate-300 mb-4">
              If you have any questions about this Privacy Policy, please contact us at{' '}
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
