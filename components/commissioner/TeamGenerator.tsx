/**
 * Team Generator Component
 * Generate teams for each age group after registration closes
 * Commissioner can set team count, naming pattern, and roster sizes
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  generateTeamsForAgeGroup,
  getSeasonTeams,
  getDraftPoolByAgeGroup,
  getSeasonDraftPool
} from '../../services/seasonService';
import type { Program, Season, AgeGroup, GeneratedTeam, DraftPoolPlayer } from '../../types/season';
import { 
  ArrowLeft, 
  Users2, 
  Plus, 
  Minus,
  Loader2,
  AlertCircle,
  X,
  Check,
  Trophy,
  Hash
} from 'lucide-react';

interface TeamGeneratorProps {
  season: Season;
  program: Program;
  onBack: () => void;
}

interface AgeGroupConfig {
  ageGroupId: string;
  ageGroupName: string;
  playerCount: number;
  numberOfTeams: number;
  rosterSize: number;
  namingPattern: 'letter' | 'number' | 'custom';
  customNames: string[];
  baseTeamName: string;
  generated: boolean;
}

export default function TeamGenerator({ season, program, onBack }: TeamGeneratorProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // State
  const [configs, setConfigs] = useState<AgeGroupConfig[]>([]);
  const [existingTeams, setExistingTeams] = useState<GeneratedTeam[]>([]);
  const [draftPool, setDraftPool] = useState<DraftPoolPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load existing teams and draft pool on mount
  useEffect(() => {
    loadData();
  }, [season.id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load existing teams
      const teams = await getSeasonTeams(season.id);
      setExistingTeams(teams);
      
      // Load draft pool for player counts
      const pool = await getSeasonDraftPool(season.id);
      setDraftPool(pool);
      
      // Initialize configs for each age group
      const initialConfigs: AgeGroupConfig[] = season.activeAgeGroups.map(ag => {
        const playerCount = pool.filter(p => p.ageGroupId === ag.id && p.status === 'available').length;
        const existingTeamCount = teams.filter(t => t.ageGroupId === ag.id).length;
        
        // Calculate recommended team count based on player count and roster size
        const recommendedTeams = playerCount > 0 
          ? Math.max(1, Math.ceil(playerCount / program.defaultRosterSize))
          : 1;
        
        return {
          ageGroupId: ag.id,
          ageGroupName: ag.name,
          playerCount,
          numberOfTeams: existingTeamCount || recommendedTeams,
          rosterSize: program.defaultRosterSize,
          namingPattern: 'letter' as const,
          customNames: [],
          baseTeamName: `${program.shortName || program.name} ${ag.shortName}`,
          generated: existingTeamCount > 0,
        };
      });
      
      setConfigs(initialConfigs);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (ageGroupId: string, updates: Partial<AgeGroupConfig>) => {
    setConfigs(prev => prev.map(c => 
      c.ageGroupId === ageGroupId ? { ...c, ...updates } : c
    ));
  };

  const handleGenerate = async (config: AgeGroupConfig) => {
    if (config.generated) {
      setError('Teams already generated for this age group');
      return;
    }
    
    setGenerating(config.ageGroupId);
    setError(null);
    
    try {
      await generateTeamsForAgeGroup({
        seasonId: season.id,
        ageGroupId: config.ageGroupId,
        numberOfTeams: config.numberOfTeams,
        rosterSize: config.rosterSize,
        namingPattern: config.namingPattern,
        teamNames: config.namingPattern === 'custom' ? config.customNames : undefined,
        baseTeamName: config.baseTeamName,
      });
      
      setSuccess(`Generated ${config.numberOfTeams} teams for ${config.ageGroupName}!`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Reload data
      await loadData();
    } catch (err) {
      console.error('Error generating teams:', err);
      setError('Failed to generate teams');
    } finally {
      setGenerating(null);
    }
  };

  const getTeamsForAgeGroup = (ageGroupId: string) => {
    return existingTeams.filter(t => t.ageGroupId === ageGroupId);
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Team Generator - {season.name}
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Generate teams for each age group based on registrations
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-500">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
      
      {success && (
        <div className="mx-6 mt-4 p-4 bg-green-500/20 border border-green-500 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-500">{success}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-6 space-y-6">
        {configs.map((config) => {
          const ageGroupTeams = getTeamsForAgeGroup(config.ageGroupId);
          
          return (
            <div
              key={config.ageGroupId}
              className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl overflow-hidden`}
            >
              {/* Age Group Header */}
              <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'} flex items-center justify-center`}>
                      <Users2 className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {config.ageGroupName}
                      </h3>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {config.playerCount} players registered
                      </p>
                    </div>
                  </div>
                  
                  {config.generated ? (
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">
                      <Check className="w-4 h-4" />
                      {ageGroupTeams.length} Teams Generated
                    </span>
                  ) : (
                    <button
                      onClick={() => handleGenerate(config)}
                      disabled={generating === config.ageGroupId || config.playerCount === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generating === config.ageGroupId ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Trophy className="w-4 h-4" />
                          Generate Teams
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Configuration or Generated Teams */}
              <div className="p-5">
                {config.generated ? (
                  // Show generated teams
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {ageGroupTeams.map(team => (
                      <div
                        key={team.id}
                        className={`p-3 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-50'}`}
                      >
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {team.name}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {team.currentRosterSize} / {team.maxRosterSize} players
                        </div>
                        {team.coachName && (
                          <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Coach: {team.coachName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Show configuration options
                  <div className="space-y-4">
                    {/* Team Count */}
                    <div className="flex items-center gap-4">
                      <label className={`text-sm font-medium w-32 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Number of Teams
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateConfig(config.ageGroupId, { 
                            numberOfTeams: Math.max(1, config.numberOfTeams - 1) 
                          })}
                          className={`p-1.5 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className={`w-12 text-center text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {config.numberOfTeams}
                        </span>
                        <button
                          onClick={() => updateConfig(config.ageGroupId, { 
                            numberOfTeams: config.numberOfTeams + 1 
                          })}
                          className={`p-1.5 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className={`text-sm ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          (~{Math.ceil(config.playerCount / config.numberOfTeams)} players each)
                        </span>
                      </div>
                    </div>

                    {/* Roster Size */}
                    <div className="flex items-center gap-4">
                      <label className={`text-sm font-medium w-32 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Max Roster Size
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateConfig(config.ageGroupId, { 
                            rosterSize: Math.max(5, config.rosterSize - 1) 
                          })}
                          className={`p-1.5 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className={`w-12 text-center text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {config.rosterSize}
                        </span>
                        <button
                          onClick={() => updateConfig(config.ageGroupId, { 
                            rosterSize: config.rosterSize + 1 
                          })}
                          className={`p-1.5 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Naming Pattern */}
                    <div className="flex items-center gap-4">
                      <label className={`text-sm font-medium w-32 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Team Naming
                      </label>
                      <div className="flex gap-2">
                        {[
                          { value: 'letter', label: 'Letters (A, B, C)' },
                          { value: 'number', label: 'Numbers (1, 2, 3)' },
                        ].map(option => (
                          <button
                            key={option.value}
                            onClick={() => updateConfig(config.ageGroupId, { 
                              namingPattern: option.value as any 
                            })}
                            className={`px-3 py-1.5 rounded text-sm ${
                              config.namingPattern === option.value
                                ? 'bg-blue-600 text-white'
                                : isDark 
                                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Base Team Name */}
                    <div className="flex items-center gap-4">
                      <label className={`text-sm font-medium w-32 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Base Name
                      </label>
                      <input
                        type="text"
                        value={config.baseTeamName}
                        onChange={(e) => updateConfig(config.ageGroupId, { baseTeamName: e.target.value })}
                        className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>

                    {/* Preview */}
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <div className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Preview:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: Math.min(config.numberOfTeams, 5) }).map((_, i) => {
                          const suffix = config.namingPattern === 'letter' 
                            ? String.fromCharCode(65 + i) 
                            : (i + 1).toString();
                          return (
                            <span
                              key={i}
                              className={`px-2 py-1 text-sm rounded ${isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'}`}
                            >
                              {config.baseTeamName} {suffix}
                            </span>
                          );
                        })}
                        {config.numberOfTeams > 5 && (
                          <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            +{config.numberOfTeams - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* No players warning */}
                    {config.playerCount === 0 && (
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-yellow-500/10 border border-yellow-500/50' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                          <span className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                            No players registered for this age group yet. Teams can still be generated but will be empty.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
