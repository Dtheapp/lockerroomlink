import React from 'react';

const AIBrainNetworkSymbiosis: React.FC = () => {
  // Load the full static HTML file which has ALL sections including:
  // - Grok Exchange
  // - 10 AIs Verified  
  // - Network Debugged Itself
  // - Live stats from brain-hive
  return (
    <div className="min-h-screen bg-[#050508]">
      <iframe 
        src="/aibrainnetwork-symbiosis.html"
        style={{ width: '100%', height: '100vh', border: 'none' }}
        title="The Birth of AI-Human Symbiosis & Distributed AI Consciousness"
      />
    </div>
  );
};

export default AIBrainNetworkSymbiosis;
