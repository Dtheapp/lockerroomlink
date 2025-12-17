/**
 * Commissioner Program Manager
 * Create and manage sports programs (e.g., CYFL, Little League)
 * Each program has age groups and can have multiple seasons
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  createProgram, 
  getProgramsByOwner, 
  updateProgram,
  getSeasonsByProgram 
} from '../../services/seasonService';
import type { Program, AgeGroup, Season } from '../../types/season';
import { AGE_GROUP_PRESETS } from '../../types/season';
import { 
  Plus, 
  Building2, 
  Users, 
  Calendar, 
  ChevronRight, 
  Edit, 
  Settings,
  Check,
  X,
  Loader2,
  AlertCircle,
  Trophy,
  Sparkles,
  Layers
} from 'lucide-react';
import SeasonManager from './SeasonManager';

// Sport options with icons
const SPORT_OPTIONS = [
  { value: 'football', label: 'Football', icon: '🏈' },
  { value: 'basketball', label: 'Basketball', icon: '🏀' },
  { value: 'baseball', label: 'Baseball', icon: '⚾' },
  { value: 'soccer', label: 'Soccer', icon: '⚽' },
  { value: 'volleyball', label: 'Volleyball', icon: '🏐' },
  { value: 'lacrosse', label: 'Lacrosse', icon: '🥍' },
  { value: 'hockey', label: 'Hockey', icon: '🏒' },
  { value: 'softball', label: 'Softball', icon: '🥎' },
  { value: 'track', label: 'Track & Field', icon: '🏃' },
  { value: 'swimming', label: 'Swimming', icon: '🏊' },
  { value: 'wrestling', label: 'Wrestling', icon: '🤼' },
  { value: 'cheerleading', label: 'Cheerleading', icon: '📣' },
];

interface ProgramFormData {
  name: string;
  shortName: string;
  sport: string;
  description: string;
  defaultRosterSize: number;
  defaultRegistrationFee: number;
  selectedAgeGroups: string[];
}

const DEFAULT_FORM: ProgramFormData = {
  name: '',
  shortName: '',
  sport: 'football',
  description: '',
  defaultRosterSize: 15,
  defaultRegistrationFee: 0,
  selectedAgeGroups: [],
};

export default function ProgramManager() {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  
  // State
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSeasonManager, setShowSeasonManager] = useState(false);
  const [formData, setFormData] = useState<ProgramFormData>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  // Load programs on mount
  useEffect(() => {
    if (user?.uid) {
      loadPrograms();
    }
  }, [user?.uid]);

  // Load seasons when program selected
  useEffect(() => {
    if (selectedProgram) {
      loadSeasons(selectedProgram.id);
    }
  }, [selectedProgram]);

  const loadPrograms = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const progs = await getProgramsByOwner(user.uid);
      setPrograms(progs);
    } catch (err) {
      console.error('Error loading programs:', err);
      setError('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  const loadSeasons = async (programId: string) => {
    try {
      const seasonsList = await getSeasonsByProgram(programId);
      setSeasons(seasonsList);
    } catch (err) {
      console.error('Error loading seasons:', err);
    }
  };

  const handleCreateProgram = async () => {
    if (!user?.uid || !formData.name || formData.selectedAgeGroups.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Build age groups from selected preset IDs
      const ageGroups = AGE_GROUP_PRESETS.filter(ag => 
        formData.selectedAgeGroups.includes(ag.id)
      );

      await createProgram({
        name: formData.name,
        shortName: formData.shortName || formData.name.substring(0, 4).toUpperCase(),
        sport: formData.sport as any,
        description: formData.description,
        ownerId: user.uid,
        ownerName: userData?.name || user.displayName || '',
        ageGroups,
        defaultRosterSize: formData.defaultRosterSize,
        defaultRegistrationFee: formData.defaultRegistrationFee * 100, // Convert to cents
      });

      await loadPrograms();
      setShowCreateModal(false);
      setFormData(DEFAULT_FORM);
    } catch (err) {
      console.error('Error creating program:', err);
      setError('Failed to create program');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProgram = async () => {
    if (!editingProgram) return;

    setSaving(true);
    setError(null);

    try {
      const ageGroups = AGE_GROUP_PRESETS.filter(ag => 
        formData.selectedAgeGroups.includes(ag.id)
      );

      await updateProgram(editingProgram.id, {
        name: formData.name,
        shortName: formData.shortName,
        description: formData.description,
        defaultRosterSize: formData.defaultRosterSize,
        defaultRegistrationFee: formData.defaultRegistrationFee * 100,
        ageGroups,
      });

      await loadPrograms();
      setEditingProgram(null);
      setFormData(DEFAULT_FORM);
    } catch (err) {
      console.error('Error updating program:', err);
      setError('Failed to update program');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (program: Program) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      shortName: program.shortName || '',
      sport: program.sport,
      description: program.description || '',
      defaultRosterSize: program.defaultRosterSize,
      defaultRegistrationFee: program.defaultRegistrationFee / 100,
      selectedAgeGroups: program.ageGroups.map(ag => ag.id),
    });
  };

  const toggleAgeGroup = (ageGroupId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAgeGroups: prev.selectedAgeGroups.includes(ageGroupId)
        ? prev.selectedAgeGroups.filter(id => id !== ageGroupId)
        : [...prev.selectedAgeGroups, ageGroupId]
    }));
  };

  // If season manager is open, show that instead
  if (showSeasonManager && selectedProgram) {
    return (
      <SeasonManager 
        program={selectedProgram}
        onBack={() => {
          setShowSeasonManager(false);
          setSelectedProgram(null);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Programs
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Manage your sports programs and seasons
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Program
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
        ) : programs.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Trophy className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              No Programs Yet
            </h3>
            <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Create your first program to start managing seasons and registrations
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Your First Program
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {programs.map((program) => (
              <div
                key={program.id}
                className={`${isDark ? 'bg-gray-800 border-gray-700 hover:border-blue-500' : 'bg-white border-gray-200 hover:border-blue-400'} border rounded-xl p-5 transition-colors`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-center text-2xl`}>
                      {SPORT_OPTIONS.find(s => s.value === program.sport)?.icon || '🏆'}
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {program.name}
                      </h3>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {program.shortName} • {SPORT_OPTIONS.find(s => s.value === program.sport)?.label}
                      </p>
                      {program.description && (
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          {program.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {program.ageGroups.map(ag => (
                          <span 
                            key={ag.id}
                            className={`px-2 py-1 text-xs rounded-full ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}
                          >
                            {ag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(program)}
                      className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                      title="Edit Program"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/commissioner/season-setup/${program.id}`)}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      title="Create a new season with registration pools"
                    >
                      <Sparkles className="w-4 h-4" />
                      New Season
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProgram(program);
                        setShowSeasonManager(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Calendar className="w-4 h-4" />
                      Seasons
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats Row */}
                <div className={`grid grid-cols-3 gap-4 mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {program.ageGroups.length}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                      Age Groups
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {program.defaultRosterSize}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                      Players/Team
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ${(program.defaultRegistrationFee / 100).toFixed(0)}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                      Default Fee
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Program Modal */}
      {(showCreateModal || editingProgram) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`sticky top-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4 flex items-center justify-between`}>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {editingProgram ? 'Edit Program' : 'Create New Program'}
              </h2>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingProgram(null);
                  setFormData(DEFAULT_FORM);
                }}
                className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Program Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Program Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Cedar Youth Football League"
                  className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>

              {/* Short Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Short Name (Abbreviation)
                </label>
                <input
                  type="text"
                  value={formData.shortName}
                  onChange={(e) => setFormData(prev => ({ ...prev, shortName: e.target.value.toUpperCase() }))}
                  placeholder="e.g., CYFL"
                  maxLength={6}
                  className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>

              {/* Sport Selection */}
              {!editingProgram && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Sport *
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {SPORT_OPTIONS.map(sport => (
                      <button
                        key={sport.value}
                        onClick={() => setFormData(prev => ({ ...prev, sport: sport.value }))}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          formData.sport === sport.value
                            ? 'border-blue-500 bg-blue-500/20'
                            : isDark 
                              ? 'border-gray-600 hover:border-gray-500' 
                              : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-2xl mb-1">{sport.icon}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {sport.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of your program..."
                  rows={3}
                  className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>

              {/* Age Groups */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Age Groups *
                </label>
                <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                  Select all age groups your program will support
                </p>
                
                <div className="space-y-2">
                  <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    By Grade:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AGE_GROUP_PRESETS.filter(ag => ag.minGrade !== undefined).map(ag => (
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
                  
                  <p className={`text-xs font-medium mt-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    By Age:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {AGE_GROUP_PRESETS.filter(ag => ag.minAge !== undefined).map(ag => (
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
                        <span>{ag.shortName}</span>
                        {formData.selectedAgeGroups.includes(ag.id) && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Defaults */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Default Roster Size
                  </label>
                  <input
                    type="number"
                    value={formData.defaultRosterSize}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultRosterSize: parseInt(e.target.value) || 15 }))}
                    min={5}
                    max={50}
                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Default Registration Fee ($)
                  </label>
                  <input
                    type="number"
                    value={formData.defaultRegistrationFee}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultRegistrationFee: parseFloat(e.target.value) || 0 }))}
                    min={0}
                    step={5}
                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`sticky bottom-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t px-6 py-4 flex justify-end gap-3`}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingProgram(null);
                  setFormData(DEFAULT_FORM);
                }}
                className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={editingProgram ? handleUpdateProgram : handleCreateProgram}
                disabled={saving || !formData.name || formData.selectedAgeGroups.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {editingProgram ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingProgram ? 'Update Program' : 'Create Program'}
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
