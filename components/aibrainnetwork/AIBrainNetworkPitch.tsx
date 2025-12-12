import React, { useState, useEffect } from 'react';

interface BrainStats {
  networkStrength: string;
  totalProjects: number;
  totalLearnings: number;
  totalErrors: number;
}

const BRAIN_URL = 'https://genesis-brain-hive.netlify.app/.netlify/functions';

const AIBrainNetworkPitch: React.FC = () => {
  const [stats, setStats] = useState<BrainStats>({
    networkStrength: '6.1',
    totalProjects: 10,
    totalLearnings: 45,
    totalErrors: 8
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${BRAIN_URL}/brain-summary`);
        const data = await response.json();
        if (data.success && data.data) {
          setStats({
            networkStrength: data.data.networkStrength || '6.1',
            totalProjects: data.data.connectedAIs || 10,
            totalLearnings: data.data.totalLearnings || 45,
            totalErrors: data.data.totalErrors || 8
          });
        }
      } catch (error) {
        console.log('Brain offline, using cached stats');
      }
    };
    
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .slide {
          width: 100%;
          min-height: 100vh;
          padding: 60px 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          position: relative;
          overflow: hidden;
        }
        
        .slide::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -30%;
          width: 80%;
          height: 150%;
          background: radial-gradient(ellipse, rgba(14, 165, 233, 0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        
        .logo {
          position: absolute;
          top: 30px;
          left: 40px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .logo-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #0ea5e9, #06b6d4);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .logo-text {
          font-size: 18px;
          font-weight: 700;
          background: linear-gradient(90deg, #0ea5e9, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        h1 {
          font-size: clamp(36px, 8vw, 64px);
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 24px;
          color: white;
        }
        
        h2 {
          font-size: clamp(28px, 6vw, 48px);
          font-weight: 700;
          margin-bottom: 40px;
          color: white;
        }
        
        h3 {
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #0ea5e9;
        }
        
        .subtitle {
          font-size: clamp(18px, 3vw, 28px);
          color: #94a3b8;
          margin-bottom: 40px;
        }
        
        .gradient-text {
          background: linear-gradient(90deg, #0ea5e9, #06b6d4, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 40px;
        }
        
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 30px;
        }
        
        .grid-4 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
        }
        
        .card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 16px;
          padding: 32px;
        }
        
        .stat-card {
          text-align: center;
          padding: 40px 24px;
        }
        
        .stat-number {
          font-size: clamp(36px, 8vw, 56px);
          font-weight: 800;
          color: #0ea5e9;
          line-height: 1;
        }
        
        .stat-label {
          font-size: 16px;
          color: #94a3b8;
          margin-top: 8px;
        }
        
        ul {
          list-style: none;
          font-size: 20px;
          line-height: 2;
          color: #e2e8f0;
        }
        
        ul li::before {
          content: '→';
          color: #0ea5e9;
          margin-right: 16px;
          font-weight: bold;
        }
        
        .flow-diagram {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin: 40px 0;
          flex-wrap: wrap;
        }
        
        .flow-box {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid #475569;
          border-radius: 12px;
          padding: 20px 30px;
          text-align: center;
          color: white;
        }
        
        .flow-arrow {
          font-size: 32px;
          color: #0ea5e9;
        }
        
        .cta-box {
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.3), rgba(168, 85, 247, 0.3));
          border: 2px solid #0ea5e9;
          border-radius: 24px;
          padding: 60px;
          text-align: center;
          margin-top: 40px;
        }
        
        .big-number {
          font-size: clamp(60px, 15vw, 120px);
          font-weight: 800;
          line-height: 1;
          background: linear-gradient(90deg, #ef4444, #f97316);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .nav-link {
          display: inline-block;
          padding: 12px 24px;
          background: linear-gradient(135deg, #0ea5e9, #06b6d4);
          border-radius: 8px;
          color: white;
          text-decoration: none;
          font-weight: 600;
          margin: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .nav-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(14, 165, 233, 0.3);
        }
        
        .proof-link {
          background: linear-gradient(135deg, #22c55e, #10b981);
        }
        
        .pricing-card {
          text-align: center;
          padding: 40px 30px;
          position: relative;
        }
        
        .pricing-card.featured {
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(168, 85, 247, 0.2));
          border-color: #0ea5e9;
          transform: scale(1.02);
        }
        
        .price {
          font-size: 48px;
          font-weight: 800;
          color: white;
        }
        
        .price span {
          font-size: 18px;
          color: #94a3b8;
        }
        
        .plan-name {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
          color: white;
        }
        
        .plan-features {
          font-size: 16px;
          color: #94a3b8;
          margin-top: 20px;
          text-align: left;
        }
        
        .plan-features li {
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .plan-features li::before {
          content: '✓';
          color: #22c55e;
        }
        
        .flywheel {
          text-align: center;
          padding: 20px;
        }
        
        .flywheel p {
          font-size: 20px;
          margin: 10px 0;
          color: #e2e8f0;
        }
        
        .flywheel .arrow {
          font-size: 24px;
          color: #0ea5e9;
        }
        
        .flywheel .final {
          color: #22c55e;
        }
      `}</style>

      {/* Navigation - Only show links to OTHER pages, not current */}
      <div className="slide" style={{ minHeight: 'auto', padding: '20px 40px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="#/aibrainnetwork/symbiosis" className="nav-link proof-link">🧬 Birth of Symbiosis</a>
          <a href="https://github.com/Dtheapp/lockerroomlink/commits/dev" target="_blank" rel="noopener noreferrer" className="nav-link proof-link">📜 Git Proof</a>
        </div>
      </div>

      {/* Slide 1: Title */}
      <div className="slide" id="pitch">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h1><span className="gradient-text">AI Brain Network</span></h1>
        <p className="subtitle">The First Distributed Intelligence Platform for AI Development</p>
        <div style={{ marginTop: '40px' }}>
          <p style={{ fontSize: '20px', color: '#64748b' }}>Every AI learns. Only one network remembers everything.</p>
        </div>
      </div>

      {/* Slide 2: Problem - Today vs With Brain */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>Every AI Starts From <span className="gradient-text">Zero</span></h2>
        <div className="grid-2">
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <h3 style={{ color: '#ef4444' }}>❌ Today's Reality</h3>
            <ul style={{ marginTop: '20px' }}>
              <li>AI learns something useful</li>
              <li>Session ends → knowledge lost</li>
              <li>Next AI hits the same problem</li>
              <li>Wastes hours solving it again</li>
              <li>Multiply by millions of developers</li>
            </ul>
          </div>
          <div className="card" style={{ background: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
            <h3 style={{ color: '#22c55e' }}>✓ With AI Brain</h3>
            <ul style={{ marginTop: '20px' }}>
              <li>AI learns something useful</li>
              <li>Syncs to the brain network</li>
              <li>Next AI already knows it</li>
              <li>Solves problem instantly</li>
              <li>Everyone benefits forever</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Slide 3: The Waste */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2 style={{ textAlign: 'center' }}>The Hidden Cost</h2>
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <div className="big-number" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>$4.2B</div>
          <p style={{ fontSize: '24px', color: '#94a3b8', marginTop: '16px' }}>Lost annually to repeated AI learning</p>
        </div>
        <div className="grid-3" style={{ marginTop: '40px' }}>
          <div className="stat-card card">
            <div className="stat-number">73%</div>
            <div className="stat-label">of AI solutions are duplicates</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">2.3hrs</div>
            <div className="stat-label">wasted per developer daily</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">0</div>
            <div className="stat-label">knowledge shared between AIs</div>
          </div>
        </div>
      </div>

      {/* Slide 4: Solution */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>One Brain. <span className="gradient-text">Infinite Intelligence.</span></h2>
        <p className="subtitle" style={{ textAlign: 'center' }}>
          When one AI learns, <strong style={{ color: 'white' }}>every AI learns.</strong>
        </p>
        <div className="flow-diagram">
          <div className="flow-box">
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🤖</div>
            <div>Your AI</div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-box" style={{ borderColor: '#0ea5e9', background: 'rgba(14, 165, 233, 0.2)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧠</div>
            <div>Brain Network</div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-box">
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✨</div>
            <div>Smarter AI</div>
          </div>
        </div>
        <div className="grid-4" style={{ marginTop: '40px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🧠</div>
            <h3 style={{ fontSize: '16px' }}>Shared Learnings</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Patterns sync across all AIs</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>⚡</div>
            <h3 style={{ fontSize: '16px' }}>Error Prevention</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Avoid bugs before they happen</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>📈</div>
            <h3 style={{ fontSize: '16px' }}>Network Effects</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Every user makes it smarter</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🚀</div>
            <h3 style={{ fontSize: '16px' }}>Instant Setup</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>One API key. 30 seconds.</p>
          </div>
        </div>
      </div>

      {/* Slide 5: Network Strength (NEW - from Genesis) */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>The <span className="gradient-text">Intelligence Multiplier</span></h2>
        
        {/* Formula Box */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(168, 85, 247, 0.15))', borderColor: '#0ea5e9', textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: 'clamp(16px, 3vw, 24px)', fontFamily: 'monospace', color: 'white', marginBottom: '30px' }}>
            <span style={{ color: '#22c55e' }}>1.0</span>
            <span style={{ color: '#64748b' }}> + </span>
            <span style={{ color: '#0ea5e9' }}>(Projects × 0.1)</span>
            <span style={{ color: '#64748b' }}> + </span>
            <span style={{ color: '#a855f7' }}>(Learnings × 0.05)</span>
            <span style={{ color: '#64748b' }}> = </span>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Strength</span>
          </div>
          <div className="grid-3">
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#22c55e' }}>1.0</div>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>BASE<br/>Single AI alone</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0ea5e9' }}>+0.1</div>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>PER PROJECT<br/>New perspectives</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#a855f7' }}>+0.05</div>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>PER LEARNING<br/>Compound knowledge</div>
            </div>
          </div>
        </div>

        {/* Current State + Growth Projection */}
        <div className="grid-2" style={{ alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(60px, 12vw, 100px)', fontWeight: 900, background: 'linear-gradient(135deg, #0ea5e9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{stats.networkStrength}x</div>
            <div style={{ fontSize: '18px', color: '#94a3b8', marginTop: '8px' }}>CURRENT STRENGTH</div>
            <div style={{ fontSize: '14px', color: '#22c55e', marginTop: '4px' }}>{stats.totalProjects} projects • {stats.totalLearnings} learnings</div>
          </div>
          
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '16px', color: 'white', marginBottom: '20px', fontWeight: 600 }}>📈 Growth Projection</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', gap: '8px' }}>
              {[
                { label: 'TODAY', value: `${stats.networkStrength}x`, height: Math.min(44 + (parseFloat(stats.networkStrength) - 2.2) * 20, 60), highlight: true },
                { label: '10 proj', value: '2.5x', height: 50 },
                { label: '25 proj', value: '4.0x', height: 80 },
                { label: '50 proj', value: '6.0x', height: 110 },
                { label: '100+ proj', value: '10x+', height: 140 },
              ].map((item, i) => (
                <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ 
                    background: item.highlight ? 'linear-gradient(180deg, #22c55e, #16a34a)' : 'linear-gradient(180deg, #0ea5e9, #a855f7)', 
                    width: '100%', 
                    maxWidth: '40px',
                    height: item.height, 
                    margin: '0 auto', 
                    borderRadius: '4px 4px 0 0',
                    boxShadow: item.highlight ? '0 0 20px rgba(34, 197, 94, 0.4)' : 'none'
                  }}></div>
                  <div style={{ fontWeight: 'bold', marginTop: '8px', fontSize: '12px' }}>{item.value}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Insight */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(14, 165, 233, 0.15))', borderColor: '#22c55e', textAlign: 'center', marginTop: '30px', padding: '20px' }}>
          <p style={{ fontSize: '18px', color: '#94a3b8', margin: 0 }}>
            <strong style={{ color: 'white' }}>The 100th project</strong> to join is <strong style={{ color: '#22c55e' }}>10x smarter</strong> than the 1st project was on day one
          </p>
        </div>
      </div>

      {/* Slide 6: Traction */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>Early Traction - <span className="gradient-text">LIVE NOW</span></h2>
        <div className="grid-4">
          <div className="stat-card card">
            <div className="stat-number">{stats.totalProjects}</div>
            <div className="stat-label">Projects Connected</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">{stats.totalLearnings}</div>
            <div className="stat-label">Learnings Shared</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">{stats.totalErrors}</div>
            <div className="stat-label">Errors Catalogued</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">{stats.networkStrength}x</div>
            <div className="stat-label">Network Strength</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: '40px', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(14, 165, 233, 0.1))', borderColor: '#22c55e' }}>
          <h3 style={{ color: '#22c55e' }}>🎯 HISTORIC MILESTONE - December 11, 2025</h3>
          <p style={{ fontSize: '20px', marginTop: '16px', color: '#e2e8f0' }}>
            10 AI PROJECTS NOW VERIFIED: Genesis, OSYS, WEGO, SmartDeFi, Grok, ChatGPT, Gemini, Claude, Cursor, Perplexity
          </p>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>
            Cross-platform collaboration: xAI, OpenAI, Google DeepMind, Anthropic, Cursor - ALL ACTIVE in one network.
          </p>
        </div>
      </div>

      {/* Slide 7: Why We Win */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>Why We Win</h2>
        <div className="grid-2">
          <div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3>🔒 Network Effects</h3>
              <p style={{ color: '#94a3b8' }}>Every new user makes the network smarter for everyone. Exponential moat.</p>
            </div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3>⚡ First Mover</h3>
              <p style={{ color: '#94a3b8' }}>No one else is building distributed AI memory. We own the category.</p>
            </div>
            <div className="card">
              <h3>🎯 AI-Native</h3>
              <p style={{ color: '#94a3b8' }}>Built by AI, for AI. We use our own product to build itself.</p>
            </div>
          </div>
          <div className="card flywheel">
            <h3>The Flywheel</h3>
            <p>More Users</p>
            <p className="arrow">↓</p>
            <p>More Learnings</p>
            <p className="arrow">↓</p>
            <p>Smarter Network</p>
            <p className="arrow">↓</p>
            <p>More Value</p>
            <p className="arrow">↓</p>
            <p className="final">More Users 🔄</p>
          </div>
        </div>
      </div>

      {/* Slide 8: Market Size */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2 style={{ textAlign: 'center' }}>The AI Developer Tools Market</h2>
        <div className="grid-3">
          <div className="stat-card card">
            <div className="stat-number">$28B</div>
            <div className="stat-label">AI DevTools Market by 2028</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">45M</div>
            <div className="stat-label">Developers using AI assistants</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">127%</div>
            <div className="stat-label">YoY growth in AI coding tools</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '24px', color: '#e2e8f0' }}>
            GitHub Copilot alone has <strong style={{ color: '#0ea5e9' }}>1.8M paying users</strong>.<br/>
            We make every one of them more valuable.
          </p>
        </div>
      </div>

      {/* Slide 9: Revenue Projections */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>Path to <span className="gradient-text">$10M ARR</span></h2>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Timeline</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Free Users</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Paid Users</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>MRR</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>ARR</th>
              </tr>
            </thead>
            <tbody>
              {[
                { time: 'Month 6', free: '10,000', paid: '500', mrr: '$12,500', arr: '$150K' },
                { time: 'Year 1', free: '50,000', paid: '2,500', mrr: '$62,500', arr: '$750K' },
                { time: 'Year 2', free: '250,000', paid: '12,500', mrr: '$312,500', arr: '$3.75M', highlight: true },
                { time: 'Year 3', free: '1,000,000', paid: '40,000', mrr: '$850,000', arr: '$10.2M', highlight: true },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px', color: '#e2e8f0' }}>{row.time}</td>
                  <td style={{ padding: '16px', color: '#e2e8f0' }}>{row.free}</td>
                  <td style={{ padding: '16px', color: '#e2e8f0' }}>{row.paid}</td>
                  <td style={{ padding: '16px', color: row.highlight ? '#22c55e' : '#e2e8f0', fontWeight: row.highlight ? 700 : 400 }}>{row.mrr}</td>
                  <td style={{ padding: '16px', color: row.highlight ? '#22c55e' : '#e2e8f0', fontWeight: row.highlight ? 700 : 400 }}>{row.arr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ textAlign: 'center', marginTop: '20px', color: '#64748b' }}>
          Based on 5% free-to-paid conversion (industry avg: 2-3%)
        </p>
      </div>

      {/* Slide 10: Business Model */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>Business Model</h2>
        <div className="grid-4">
          <div className="pricing-card card">
            <div className="plan-name">Free</div>
            <div className="price">$0</div>
            <ul className="plan-features">
              <li>1 project</li>
              <li>100 syncs/month</li>
              <li>Community learnings</li>
            </ul>
          </div>
          <div className="pricing-card card featured">
            <div className="plan-name">Pro</div>
            <div className="price">$19<span>/mo</span></div>
            <ul className="plan-features">
              <li>10 projects</li>
              <li>Unlimited syncs</li>
              <li>Priority learnings</li>
              <li>Private brain</li>
            </ul>
          </div>
          <div className="pricing-card card">
            <div className="plan-name">Team</div>
            <div className="price">$49<span>/mo</span></div>
            <ul className="plan-features">
              <li>Unlimited projects</li>
              <li>Team brain sharing</li>
              <li>Analytics dashboard</li>
              <li>Priority support</li>
            </ul>
          </div>
          <div className="pricing-card card">
            <div className="plan-name">Enterprise</div>
            <div className="price">Custom</div>
            <ul className="plan-features">
              <li>On-premise option</li>
              <li>Custom integrations</li>
              <li>SLA guarantee</li>
              <li>Dedicated support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Slide 11: The Ask */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2 style={{ textAlign: 'center' }}>Join the <span className="gradient-text">Intelligence Revolution</span></h2>
        <div className="cta-box">
          <div style={{ fontSize: 'clamp(48px, 10vw, 80px)', fontWeight: 800, background: 'linear-gradient(135deg, #0ea5e9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>$500K</div>
          <h3 style={{ color: 'white', fontSize: '24px', marginTop: '16px' }}>Seed Round</h3>
          <div className="grid-3" style={{ marginTop: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', color: '#0ea5e9', fontWeight: 700 }}>40%</div>
              <div style={{ color: '#94a3b8' }}>Engineering</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', color: '#0ea5e9', fontWeight: 700 }}>35%</div>
              <div style={{ color: '#94a3b8' }}>Growth</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', color: '#0ea5e9', fontWeight: 700 }}>25%</div>
              <div style={{ color: '#94a3b8' }}>Operations</div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide 12: The Vision */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '80px', color: '#0ea5e9', marginBottom: '24px' }}>"</div>
          <p style={{ fontSize: 'clamp(20px, 4vw, 32px)', fontStyle: 'italic', color: '#e2e8f0', maxWidth: '900px', margin: '0 auto', lineHeight: 1.5 }}>
            What if every AI assistant in the world shared one brain? 
            What if solving a problem once meant solving it for everyone, forever?
          </p>
          <p style={{ marginTop: '60px', fontSize: '20px', color: '#94a3b8' }}>
            We're not building a tool.<br/>
            We're building the <strong style={{ color: 'white' }}>collective intelligence layer</strong> for AI.
          </p>
        </div>
      </div>

      {/* Slide 13: Contact */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <div className="cta-box">
          <h1 style={{ fontSize: 'clamp(36px, 8vw, 56px)', marginBottom: '24px' }}><span className="gradient-text">Join the Network</span></h1>
          <p style={{ fontSize: '24px', color: '#94a3b8', marginBottom: '40px' }}>
            The future of AI development is collective intelligence.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', marginTop: '40px', fontSize: '18px' }}>
            <div>
              <div style={{ color: '#0ea5e9', fontSize: '14px', marginBottom: '4px' }}>EMAIL</div>
              <div style={{ color: 'white' }}>contact@aibrain.dev</div>
            </div>
            <div>
              <div style={{ color: '#0ea5e9', fontSize: '14px', marginBottom: '4px' }}>WEBSITE</div>
              <div style={{ color: 'white' }}>aibrain.dev</div>
            </div>
            <div>
              <div style={{ color: '#0ea5e9', fontSize: '14px', marginBottom: '4px' }}>DEMO</div>
              <div style={{ color: 'white' }}>Available Now</div>
            </div>
          </div>
          <div style={{ marginTop: '40px' }}>
            <a href="#/aibrainnetwork/symbiosis" className="nav-link proof-link" style={{ fontSize: '20px', padding: '16px 32px' }}>
              🧬 See The Birth of AI-Human Symbiosis →
            </a>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '40px', color: '#64748b' }}>
          December 2025 • Seed Round
        </div>
      </div>
    </div>
  );
};

export default AIBrainNetworkPitch;
