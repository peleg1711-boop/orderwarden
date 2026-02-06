import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
        }}
      >
        <svg
          width="20"
          height="24"
          viewBox="0 0 20 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10 0L0 4V11C0 17.1 4.3 22.7 10 24C15.7 22.7 20 17.1 20 11V4L10 0Z"
            fill="white"
            fillOpacity="0.9"
          />
          <path
            d="M8 13L5 10L6.5 8.5L8 10L13.5 4.5L15 6L8 13Z"
            fill="#10b981"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
