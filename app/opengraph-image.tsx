import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'OrderWarden - Protect Your Etsy Shop'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Shield Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <svg
            width="120"
            height="140"
            viewBox="0 0 20 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <path
              d="M10 0L0 4V11C0 17.1 4.3 22.7 10 24C15.7 22.7 20 17.1 20 11V4L10 0Z"
              fill="url(#shieldGrad)"
            />
            <path
              d="M8 13L5 10L6.5 8.5L8 10L13.5 4.5L15 6L8 13Z"
              fill="white"
            />
          </svg>
        </div>

        {/* Logo Text */}
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: 20,
          }}
        >
          OrderWarden
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: '#94a3b8',
            marginBottom: 40,
          }}
        >
          Protect Your Etsy Shop
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 24,
            color: '#64748b',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Intelligent tracking monitoring to prevent refunds and disputes
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
