import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '36px',
          border: '5px solid #f59e0b',
        }}
      >
        <svg
          width="88"
          height="88"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <line x1="20" y1="4" x2="8.12" y2="15.88" />
          <line x1="14.47" y1="14.48" x2="20" y2="20" />
          <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </svg>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '4px',
          }}
        >
          <span
            style={{
              fontSize: '16px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '2px',
              fontFamily: 'sans-serif',
              textTransform: 'uppercase',
            }}
          >
            BARBER<span style={{ color: '#f59e0b' }}>SITE</span>
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
