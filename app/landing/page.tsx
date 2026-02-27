import Link from 'next/link';

export default function LandingPage() {
  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Bricolage Grotesque', sans-serif; background: #FAFAFA; color: #0A0A0A; }
        .landing-hero { min-height: 100vh; background: linear-gradient(135deg, #FF3B30 0%, #D32F2F 100%); padding: 2rem; display: flex; align-items: center; }
        .landing-hero-content { max-width: 1200px; margin: 0 auto; color: white; }
        .landing-hero h1 { font-family: 'Syne', sans-serif; font-size: clamp(2.5rem, 8vw, 5.5rem); font-weight: 800; line-height: 1.1; margin-bottom: 1.5rem; }
        .landing-subtitle { font-size: clamp(1.25rem, 3vw, 1.75rem); margin-bottom: 2.5rem; opacity: 0.95; }
        .landing-cta { display: inline-block; background: #FFD60A; color: #0A0A0A; padding: 1.25rem 3rem; font-size: 1.25rem; font-weight: 700; border-radius: 50px; text-decoration: none; }
        .landing-cta:hover { transform: scale(1.05); }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Bricolage+Grotesque:wght@400;500;600&display=swap" rel="stylesheet" />
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>Stop Losing Money<br/>on Etsy Refunds</h1>
          <p className="landing-subtitle">
            Track every order. Spot delivery issues before they become refunds.<br/>
            Save your shop from bad reviews and disputes.
          </p>
          <Link href="/sign-up" className="landing-cta">
            Start Free Trial &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
