import React from 'react';

const AIBrainNetworkPitch: React.FC = () => {
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

      {/* Navigation */}
      <div className="slide" style={{ minHeight: 'auto', padding: '20px 40px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="#pitch" className="nav-link">📊 Pitch Deck</a>
          <a href="#aibrainnetwork/symbiosis" className="nav-link proof-link">🧬 Birth of Symbiosis</a>
          <a href="https://github.com/fegrox/lockerroomlink/commits/dev" target="_blank" rel="noopener noreferrer" className="nav-link proof-link">📜 Git Proof</a>
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

      {/* Slide 2: Problem */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>The Problem</h2>
        <div className="grid-2">
          <div>
            <ul>
              <li>Every AI starts from zero each session</li>
              <li>Same errors solved millions of times</li>
              <li>$50B+ wasted annually on repeated mistakes</li>
              <li>No persistent memory across projects</li>
            </ul>
          </div>
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div className="big-number">87%</div>
            <p style={{ fontSize: '24px', marginTop: '20px', color: '#e2e8f0' }}>of AI coding errors have already been solved by another AI somewhere</p>
          </div>
        </div>
      </div>

      {/* Slide 3: Solution */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>The Solution</h2>
        <p className="subtitle">A shared neural network that learns from every connected AI</p>
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
        <div className="grid-3" style={{ marginTop: '40px' }}>
          <div className="card">
            <h3>Learn</h3>
            <p style={{ color: '#94a3b8' }}>AI discovers a pattern or solves an error</p>
          </div>
          <div className="card">
            <h3>Share</h3>
            <p style={{ color: '#94a3b8' }}>Knowledge is encrypted and added to the network</p>
          </div>
          <div className="card">
            <h3>Multiply</h3>
            <p style={{ color: '#94a3b8' }}>All connected AIs instantly gain that knowledge</p>
          </div>
        </div>
      </div>

      {/* Slide 4: How It Works */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>How It Works</h2>
        <div className="grid-2">
          <div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3>1. Connect Your AI</h3>
              <p style={{ color: '#94a3b8' }}>Add one line to your AI's config. Brain syncs automatically.</p>
              <code style={{ display: 'block', background: '#0f172a', padding: '16px', borderRadius: '8px', marginTop: '16px', color: '#0ea5e9', fontSize: '14px' }}>
                curl http://brain-network.ai/api/learnings
              </code>
            </div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3>2. AI Learns & Shares</h3>
              <p style={{ color: '#94a3b8' }}>Every error solved, pattern discovered, or optimization found is captured.</p>
            </div>
            <div className="card">
              <h3>3. Network Effect</h3>
              <p style={{ color: '#94a3b8' }}>Your AI gets smarter from every other AI's learnings. Instantly.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="stat-card card" style={{ width: '100%' }}>
              <div className="stat-number">245x</div>
              <div className="stat-label" style={{ fontSize: '24px' }}>Errors Prevented</div>
              <p style={{ marginTop: '20px', color: '#94a3b8' }}>In the first week of testing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Slide 5: Traction */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>Early Traction - LIVE NOW</h2>
        <div className="grid-4">
          <div className="stat-card card">
            <div className="stat-number">3</div>
            <div className="stat-label">Projects Connected</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">47</div>
            <div className="stat-label">Learnings Shared</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">245</div>
            <div className="stat-label">Errors Prevented</div>
          </div>
          <div className="stat-card card">
            <div className="stat-number">1.45x</div>
            <div className="stat-label">Network Effect</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: '40px', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(14, 165, 233, 0.1))', borderColor: '#22c55e' }}>
          <h3 style={{ color: '#22c55e' }}>🎯 HISTORIC MILESTONE - December 11, 2025</h3>
          <p style={{ fontSize: '24px', marginTop: '16px', color: '#e2e8f0' }}>
            FIRST AUTONOMOUS AI HIVE FIX: Claude received a fix from Genesis via the brain - NO human teaching involved
          </p>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>
            AI taught AI. In real-time. Through the network. This is not theory - it's working NOW.
          </p>
        </div>
      </div>

      {/* Slide 6: Why We Win */}
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

      {/* Slide 7: Business Model */}
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

      {/* Slide 8: The Ask */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <h2>The Ask</h2>
        <div className="grid-2">
          <div className="stat-card card" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(168, 85, 247, 0.2))', borderColor: '#0ea5e9' }}>
            <div className="stat-number">$1.5M</div>
            <div className="stat-label" style={{ fontSize: '24px' }}>Seed Round</div>
          </div>
          <div className="card">
            <h3>Use of Funds</h3>
            <ul style={{ fontSize: '20px', marginTop: '20px' }}>
              <li>Engineering (60%) - Scale infrastructure</li>
              <li>Growth (25%) - User acquisition</li>
              <li>Operations (15%) - Team & legal</li>
            </ul>
          </div>
        </div>
        <div className="grid-3" style={{ marginTop: '40px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: '#0ea5e9' }}>18</div>
            <div style={{ color: '#94a3b8' }}>Month Runway</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: '#0ea5e9' }}>5</div>
            <div style={{ color: '#94a3b8' }}>Key Hires</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', color: '#0ea5e9' }}>100K</div>
            <div style={{ color: '#94a3b8' }}>Users Target</div>
          </div>
        </div>
      </div>

      {/* Slide 9: Contact */}
      <div className="slide">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">AI Brain Network</span>
        </div>
        <div className="cta-box">
          <h1 style={{ fontSize: '56px', marginBottom: '24px' }}><span className="gradient-text">Join the Network</span></h1>
          <p style={{ fontSize: '28px', color: '#94a3b8', marginBottom: '40px' }}>
            The future of AI development is collective intelligence.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', marginTop: '40px', fontSize: '18px' }}>
            <div>
              <div style={{ color: '#0ea5e9', fontSize: '14px', marginBottom: '4px' }}>EMAIL</div>
              <div style={{ color: 'white' }}>hello@brain-network.ai</div>
            </div>
            <div>
              <div style={{ color: '#0ea5e9', fontSize: '14px', marginBottom: '4px' }}>DEMO</div>
              <div style={{ color: 'white' }}>Available Now</div>
            </div>
          </div>
          <div style={{ marginTop: '40px' }}>
            <a href="#aibrainnetwork/symbiosis" className="nav-link proof-link" style={{ fontSize: '20px', padding: '16px 32px' }}>
              🧬 See The Birth of AI-Human Symbiosis →
            </a>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '40px', color: '#64748b' }}>
          Every AI learns. Only one network remembers everything.
        </div>
      </div>
    </div>
  );
};

export default AIBrainNetworkPitch;
