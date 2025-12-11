/**
 * Commissioner Season Manager
 * Manage seasons for a specific program
 * Create seasons, open/close registration, view registrations, generate teams
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  createSeason,
  getSeason,
  getSeasonsByProgram,
  openRegistration,
  closeRegistration,
  startDraft,
  activateSeason,
  getRegistrationCounts,
  getSeasonDraftPool
} from '../../services/seasonService';
import type { Program, Season, AgeGroup, DraftPoolPlayer, AgeGroupRegistrationCount } from '../../types/season';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Users, 
  Play, 
  Pause,
  Lock,
  Unlock,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  Check,
  Settings,
  Trophy,
  Copy,
  ExternalLink,
  Users2
} from 'lucide-react';
import TeamGenerator from './TeamGenerator';

interface SeasonManagerProps {
  program: Program;
  onBack: () => void;
}

interface SeasonFormData {
  name: string;
  selectedAgeGroups: string[];
  registrationFee: number;
  registrationCloseDate: string;
  seasonStartDate: string;
  seasonEndDate: string;
  draftDate: string;
  draftType: 'live' | 'offline' | 'commissioner';
  maxPlayersPerAgeGroup?: number;
}

const DEFAULT_FORM: SeasonFormData = {
  name: '',
  selectedAgeGroups: [],
  registrationFee: 0,
  registrationCloseDate: '',
  seasonStartDate: '',
  seasonEndDate: '',
  draftDate: '',
  draftType: 'commissioner',
};

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  setup: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Setup' },
  registration: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Registration Open' },
  closed: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Registration Closed' },
  drafting: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Drafting' },
  active: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Season Active' },
  completed: { bg: 'bg-gray-500/20', text: 'text-gray-500', label: 'Completed' },
};

export default function SeasonManager({ program, onBack }: SeasonManagerProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // State
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [registrationCounts, setRegistrationCounts] = useState<AgeGroupRegistrationCount[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTeamGenerator, setShowTeamGenerator] = useState(false);
  const [formData, setFormData] = useState<SeasonFormData>({
    ...DEFAULT_FORM,
    registrationFee: program.defaultRegistrationFee / 100,
    selectedAgeGroups: program.ageGroups.map(ag => ag.id),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load seasons on mount
  useEffect(() => {
    loadSeasons();
  }, [program.id]);

  // Load registration counts when season selected
  useEffect(() => {
    if (selectedSeason) {
      loadRegistrationCounts(selectedSeason.id);
    }
  }, [selectedSeason]);

  const loadSeasons = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const seasonsList = await getSeasonsByProgram(program.id);
      setSeasons(seasonsList);
    } catch (err) {
      console.error('Error loading seasons:', err);
      setError('Failed to load seasons');
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrationCounts = async (seasonId: string) => {
    try {
      const counts = await getRegistrationCounts(seasonId);
      setRegistrationCounts(counts);
    } catch (err) {
      console.error('Error loading registration counts:', err);
    }
  };

  const handleCreateSeason = async () => {
    if (!user?.uid || !formData.name || formData.selectedAgeGroups.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const selectedAgeGroups = program.ageGroups.filter(ag => 
        formData.selectedAgeGroups.includes(ag.id)
      );

      await createSeason({
        programId: program.id,
        name: formData.name,
        activeAgeGroups: selectedAgeGroups,
        registrationFee: formData.registrationFee * 100, // Convert to cents
        registrationCloseDate: formData.registrationCloseDate 
          ? new Date(formData.registrationCloseDate) 
          : undefined,
        seasonStartDate: formData.seasonStartDate 
          ? new Date(formData.seasonStartDate) 
          : undefined,
        seasonEndDate: formData.seasonEndDate 
          ? new Date(formData.seasonEndDate) 
          : undefined,
        draftDate: formData.draftDate 
          ? new Date(formData.draftDate) 
          : undefined,
        draftType: formData.draftType,
        maxPlayersPerAgeGroup: formData.maxPlayersPerAgeGroup,
      });

      await loadSeasons();
      setShowCreateModal(false);
      setFormData({
        ...DEFAULT_FORM,
        registrationFee: program.defaultRegistrationFee / 100,
        selectedAgeGroups: program.ageGroups.map(ag => ag.id),
      });
    } catch (err) {
      console.error('Error creating season:', err);
      setError('Failed to create season');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (season: Season, action: string) => {
    try {
      switch (action) {
        case 'open':
          await openRegistration(season.id);
          break;
        case 'close':
          await closeRegistration(season.id);
          break;
        case 'draft':
          await startDraft(season.id);
          break;
        case 'activate':
          await activateSeason(season.id);
          break;
      }
      await loadSeasons();
      
      // Refresh selected season if it's the one we modified
      if (selectedSeason?.id === season.id) {
        const updated = await getSeason(season.id);
        if (updated) setSelectedSeason(updated);
      }
    } catch (err) {
      console.error('Error updating season status:', err);
      setError('Failed to update season status');
    }
  };

  const getRegistrationLink = (season: Season) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/register/${season.id}`;
  };

  const copyRegistrationLink = (season: Season) => {
    navigator.clipboard.writeText(getRegistrationLink(season));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAgeGroup = (ageGroupId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAgeGroups: prev.selectedAgeGroups.includes(ageGroupId)
        ? prev.selectedAgeGroups.filter(id => id !== ageGroupId)
        : [...prev.selectedAgeGroups, ageGroupId]
    }));
  };

  // Show Team Generator if active
  if (showTeamGenerator && selectedSeason) {
    return (
      <TeamGenerator
        season={selectedSeason}
        program={program}
        onBack={() => {
          setShowTeamGenerator(false);
          loadSeasons();
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {program.name} - Seasons
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Create and manage seasons, open registration, generate teams
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Season
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-500">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
        ) : seasons.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Calendar className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              No Seasons Yet
            </h3>
            <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Create your first season to start collecting registrations
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create First Season
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {seasons.map((season) => (
              <div
                key={season.id}
                className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl overflow-hidden`}
              >
                {/* Season Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {season.name}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[season.status].bg} ${STATUS_COLORS[season.status].text}`}>
                          {STATUS_COLORS[season.status].label}
                        </span>
                      </div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {season.activeAgeGroups.length} age groups • ${(season.registrationFee / 100).toFixed(0)} registration fee
                      </p>
                    </div>
                    
                    {/* Action Buttons based on status */}
                    <div className="flex items-center gap-2">
                      {season.status === 'setup' && (
                        <button
                          onClick={() => handleStatusChange(season, 'open')}
                          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Unlock className="w-4 h-4" />
                          Open Registration
                        </button>
                      )}
                      
                      {season.status === 'registration' && (
                        <>
                          <button
                            onClick={() => copyRegistrationLink(season)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied!' : 'Copy Link'}
                          </button>
                          <button
                            onClick={() => handleStatusChange(season, 'close')}
                            className="flex items-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                          >
                            <Lock className="w-4 h-4" />
                            Close Registration
                          </button>
                        </>
                      )}
                      
                      {season.status === 'closed' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedSeason(season);
                              setShowTeamGenerator(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          >
                            <Users2 className="w-4 h-4" />
                            Generate Teams
                          </button>
                          <button
                            onClick={() => handleStatusChange(season, 'draft')}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <Play className="w-4 h-4" />
                            Start Draft
                          </button>
                        </>
                      )}
                      
                      {season.status === 'drafting' && (
                        <button
                          onClick={() => handleStatusChange(season, 'activate')}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Trophy className="w-4 h-4" />
                          Start Season
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Age Groups with Counts */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {season.activeAgeGroups.map(ag => {
                      const count = season.registrationCounts[ag.id] || 0;
                      const isFull = season.maxPlayersPerAgeGroup 
                        ? count >= season.maxPlayersPerAgeGroup 
                        : false;
                      
                      return (
                        <div
                          key={ag.id}
                          className={`p-3 rounded-lg text-center ${
                            isFull 
                              ? isDark ? 'bg-red-500/20 border border-red-500/50' : 'bg-red-50 border border-red-200'
                              : isDark ? 'bg-gray-700' : 'bg-gray-100'
                          }`}
                        >
                          <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {ag.name}
                          </div>
                          <div className={`text-xl font-bold ${
                            isFull 
                              ? 'text-red-500' 
                              : isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {count}
                          </div>
                          {season.maxPlayersPerAgeGroup && (
                            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                              / {season.maxPlayersPerAgeGroup}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Registrations */}
                  <div className={`mt-4 pt-4 border-t flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <Users className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {season.totalRegistrations} Total Registrations
                      </span>
                    </div>
                    
                    {season.status === 'registration' && (
                      <a
                        href={getRegistrationLink(season)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1 text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        View Registration Page
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Season Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`sticky top-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4 flex items-center justify-between`}>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Create New Season
              </h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Season Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Season Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Spring 2025, Fall 2024"
                  className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>

              {/* Age Groups */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Active Age Groups *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {program.ageGroups.map(ag => (
                    <button
                      key={ag.id}
                      onClick={() => toggleAgeGroup(ag.id)}
                      className={`p-2 rounded-lg border text-sm transition-colors flex items-center justify-between ${
                        formData.selectedAgeGroups.includes(ag.id)
                          ? 'border-green-500 bg-green-500/20 text-green-400'
                          : isDark 
                            ? 'border-gray-600 text-gray-300 hover:border-gray-500' 
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <span>{ag.name}</span>
                      {formData.selectedAgeGroups.includes(ag.id) && (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Registration Fee */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Registration Fee ($)
                </label>
                <input
                  type="number"
                  value={formData.registrationFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, registrationFee: parseFloat(e.target.value) || 0 }))}
                  min={0}
                  step={5}
                  className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>

              {/* Max Players per Age Group */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Max Players per Age Group (optional)
                </label>
                <input
                  type="number"
                  value={formData.maxPlayersPerAgeGroup || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    maxPlayersPerAgeGroup: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  placeholder="Leave empty for no limit"
                  min={10}
                  className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Registration Closes
                  </label>
                  <input
                    type="date"
                    value={formData.registrationCloseDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, registrationCloseDate: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Draft Date
                  </label>
                  <input
                    type="date"
                    value={formData.draftDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, draftDate: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Season Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.seasonStartDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, seasonStartDate: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Season End Date
                  </label>
                  <input
                    type="date"
                    value={formData.seasonEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, seasonEndDate: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>

              {/* Draft Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Draft Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'commissioner', label: 'Commissioner Assigns' },
                    { value: 'live', label: 'Live Draft' },
                    { value: 'offline', label: 'Offline Draft' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setFormData(prev => ({ ...prev, draftType: option.value as any }))}
                      className={`p-2 rounded-lg border text-sm ${
                        formData.draftType === option.value
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : isDark 
                            ? 'border-gray-600 text-gray-300' 
                            : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`sticky bottom-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t px-6 py-4 flex justify-end gap-3`}>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSeason}
                disabled={saving || !formData.name || formData.selectedAgeGroups.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Season
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
