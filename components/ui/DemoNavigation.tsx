import React, { useState } from 'react';

interface DemoNavProps {
  currentPage?: string;
}

const pages = [
  { id: 'welcome', label: '🏠 Home', path: '/welcome' },
  { id: 'player', label: '🏃 Athlete', path: '/player' },
  { id: 'team-demo', label: '🏈 Team', path: '/team-demo' },
  { id: 'fan-hub', label: '🏟️ Fan Hub', path: '/fan-hub' },
  { id: 'coach-demo', label: '📊 Coach', path: '/coach-demo' },
  { id: 'fundraising', label: '💰 Fundraise', path: '/fundraising' },
];

export function DemoNavigation({ currentPage }: DemoNavProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Floating Demo Nav */}
      <div
        style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        {/* Expanded Navigation */}
        <div
          style={{
            display: isExpanded ? 'flex' : 'none',
            gap: '0.5rem',
            padding: '0.5rem',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            animation: 'slideUp 0.3s ease-out'
          }}
        >
          {pages.map(page => (
            <a
              key={page.id}
              href={`#${page.path}`}
              style={{
                padding: '0.75rem 1rem',
                color: currentPage === page.id ? 'white' : 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: '50px',
                transition: 'all 0.2s',
                background: currentPage === page.id 
                  ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                  : 'transparent',
                whiteSpace: 'nowrap'
              }}
            >
              {page.label}
            </a>
          ))}
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            boxShadow: '0 10px 30px rgba(99, 102, 241, 0.4)',
            transition: 'all 0.3s',
            transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)'
          }}
        >
          {isExpanded ? '✕' : '🚀'}
        </button>

        {/* Demo Mode Label */}
        <div
          style={{
            position: 'absolute',
            bottom: '-1.5rem',
            fontSize: '0.625rem',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        >
          Demo Mode
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

export default DemoNavigation;
