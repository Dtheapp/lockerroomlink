/**
 * ManagersPage
 * =============
 * Dedicated page for commissioners to manage their account managers
 * Managers have full access to ALL commissioner teams
 */

import React, { useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import TeamManagersPanel from './TeamManagersPanel';
import { AnimatedBackground, GlassCard } from '../ui/OSYSComponents';
import { Users, Shield, Info } from 'lucide-react';

const ManagersPage: React.FC = () => {
  const { theme } = useTheme();
  const { userData } = useAuth();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Check if user is a commissioner
  const isCommissioner = ['Commissioner', 'TeamCommissioner', 'ProgramCommissioner', 'LeagueOwner', 'LeagueCommissioner'].includes(userData?.role || '');

  if (!isCommissioner) {
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <GlassCard className="max-w-md text-center p-8">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-zinc-400">
              Only commissioners can access this page.
            </p>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <div className="relative z-10 p-4 md:p-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
            }`}>
              <Users className={`w-6 h-6 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                Account Managers
              </h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Add helpers to manage ALL your teams
              </p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <GlassCard className="mb-6 p-4">
          <div className="flex items-start gap-3">
            <Info className={`w-5 h-5 mt-0.5 flex-shrink-0 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
            <div>
              <h3 className={`font-medium mb-1 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                What are Account Managers?
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Account managers are sub-accounts that can log in with their own email and password. 
                They have <strong>full access</strong> to all your teams - they can manage rosters, 
                schedules, send messages, and do everything you can do. Perfect for assistant coaches, 
                board members, or anyone helping run your organization.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Managers Panel */}
        <GlassCard className="p-0">
          <TeamManagersPanel />
        </GlassCard>
      </div>
    </div>
  );
};

export default ManagersPage;
