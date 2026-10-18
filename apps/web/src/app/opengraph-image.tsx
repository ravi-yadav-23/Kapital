import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Kapitl — IPO Intelligence Platform'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#0c0a09',
          backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1612 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1a1612 2%, transparent 0%)',
          backgroundSize: '100px 100px',
          padding: '60px 80px',
          color: '#fafaf9',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Glow corner */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            filter: 'blur(90px)',
          }}
        />

        {/* Top Header Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0c0a09',
              fontWeight: '900',
              fontSize: '28px',
            }}
          >
            K
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
              Kapitl
            </span>
            <span style={{ fontSize: '13px', color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '2px' }}>
              IPO Intelligence Platform
            </span>
          </div>
        </div>

        {/* Center Punchy Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '950px', gap: '18px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 16px',
              borderRadius: '9999px',
              backgroundColor: '#1a1612',
              border: '1px solid #2d2520',
              color: '#f59e0b',
              fontSize: '15px',
              fontWeight: '600',
              width: 'fit-content',
            }}
          >
            Autonomous Multi-Agent Due Diligence & SEBI Allocation
          </div>
          <h1
            style={{
              fontSize: '60px',
              fontWeight: '900',
              lineHeight: '1.1',
              letterSpacing: '-1.5px',
              margin: '0',
            }}
          >
            Stop guessing which <span style={{ color: '#f59e0b' }}>IPO to apply</span> to.
          </h1>
          <p style={{ fontSize: '22px', color: '#a8a29e', margin: '0', lineHeight: '1.4' }}>
            Scores every IPO 0-100 with AI, allocates your family&apos;s corpus mathematically across SEBI categories, and executes listing-day exits.
          </p>
        </div>

        {/* Bottom Feature Badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderTop: '1px solid #2d2520',
            paddingTop: '24px',
            fontSize: '15px',
            color: '#a8a29e',
          }}
        >
          <div style={{ display: 'flex', gap: '32px' }}>
            <span>✓ 6-Dimension Composite Scoring</span>
            <span>✓ Multi-Account Constraint Solver</span>
            <span>✓ Angel One SmartAPI</span>
          </div>
          <div style={{ color: '#fafaf9', fontWeight: '700' }}>
            Built by Ravi Yadav
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
