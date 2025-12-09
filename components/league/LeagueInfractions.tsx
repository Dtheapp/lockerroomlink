/**
 * League Infractions Page
 * Wrapper page for viewing and managing infractions in the league
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { InfractionsList } from './InfractionsList';

export const LeagueInfractions: React.FC = () => {
  const { leagueData } = useAuth();

  if (!leagueData?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No league found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/league"
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Infractions</h1>
            <p className="text-gray-400">{leagueData.name}</p>
          </div>
        </div>

        {/* Infractions List */}
        <InfractionsList leagueId={leagueData.id} />
      </div>
    </div>
  );
};

export default LeagueInfractions;
