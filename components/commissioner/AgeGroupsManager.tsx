import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ArrowLeft, Save, Loader2, X, Plus } from 'lucide-react';
import { toastSuccess, toastError } from '../../services/toast';
import type { SportType } from '../../types';

// Age groups by program type
const AGE_GROUPS_BY_TYPE = {
  youth: ['5U', '6U', '7U', '8U', '9U', '10U', '11U', '12U'],
  middleschool: ['JV', 'Varsity'],
  highschool: ['JV', 'Varsity'],
  college: ['JV', 'Varsity'],
  adult: ['18+'],
};

// Sport-specific age group structure
interface SportAgeGroups {
  sport: SportType;
  ageGroups: string[];
}

const AgeGroupsManager: React.FC = () => {
  const navigate = useNavigate();
  const { programData, userData } = useAuth();
  const { theme } = useTheme();
  
  // Get selected sport from localStorage
  const selectedSport = (localStorage.getItem('commissioner_selected_sport') || 'Football').toLowerCase() as SportType;
  const selectedSportDisplay = selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1);
  
  // Get program type from programData
  const programType = ((programData as any)?.programType || 'youth') as keyof typeof AGE_GROUPS_BY_TYPE;
  const availableAgeGroups = AGE_GROUPS_BY_TYPE[programType] || AGE_GROUPS_BY_TYPE.youth;
  
  // Created age groups FOR THIS SPORT (the ones we'll save)
  const [createdGroups, setCreatedGroups] = useState<string[]>([]);
  
  // Currently selected ages for creating a new group
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Load existing age groups for THIS SPORT from programData.sportConfigs
  useEffect(() => {
    const sportConfigs: SportAgeGroups[] = (programData as any)?.sportConfigs || [];
    const currentSportConfig = sportConfigs.find(sc => sc.sport?.toLowerCase() === selectedSport.toLowerCase());
    
    if (currentSportConfig?.ageGroups?.length > 0) {
      setCreatedGroups(currentSportConfig.ageGroups);
    } else {
      // No sport-specific config exists - start fresh (don't use legacy)
      setCreatedGroups([]);
    }
    
    // Auto-select 18+ for adult programs
    if (programType === 'adult') {
      setCreatedGroups(['18+']);
    }
  }, [(programData as any)?.sportConfigs, selectedSport, programType]);
  
  // Toggle age in pending selection
  const togglePendingAge = (ag: string) => {
    if (pendingSelection.includes(ag)) {
      setPendingSelection(pendingSelection.filter(a => a !== ag));
    } else {
      setPendingSelection([...pendingSelection, ag]);
    }
  };
  
  // Create group from pending selection
  const handleCreateGroup = () => {
    if (pendingSelection.length === 0) return;
    
    // Sort and create label
    const sorted = [...pendingSelection].sort((a, b) => {
      const numA = parseInt(a.replace('U', '')) || 0;
      const numB = parseInt(b.replace('U', '')) || 0;
      return numA - numB;
    });
    
    // Create group name (e.g., "5U" or "5U-6U" or "5U-6U-7U")
    let groupName: string;
    if (sorted.length === 1) {
      groupName = sorted[0];
    } else if (sorted.length === 2) {
      groupName = `${sorted[0]}-${sorted[1]}`;
    } else {
      groupName = `${sorted[0]}-${sorted[sorted.length - 1]}`;
    }
    
    // Check if already exists
    if (createdGroups.includes(groupName)) {
      toastError('This group already exists');
      return;
    }
    
    setCreatedGroups([...createdGroups, groupName]);
    setPendingSelection([]);
    setHasChanges(true);
    toastSuccess(`Created ${groupName} group`);
  };
  
  // Remove a created group
  const handleRemoveGroup = (group: string) => {
    setCreatedGroups(createdGroups.filter(g => g !== group));
    setHasChanges(true);
  };
  
  // Save all groups to Firebase - PER SPORT
  const handleSave = async () => {
    const programId = programData?.id;
    if (!programId) {
      toastError('No program found');
      return;
    }
    
    // Allow saving with 0 age groups (to clear a sport's config)
    
    setSaving(true);
    try {
      // Sort age groups before saving
      const sorted = [...createdGroups].sort((a, b) => {
        const getFirstNum = (s: string) => parseInt(s.replace('U', '').split('-')[0]) || 0;
        return getFirstNum(a) - getFirstNum(b);
      });
      
      // Get existing sportConfigs or create new array
      const existingConfigs: SportAgeGroups[] = (programData as any)?.sportConfigs || [];
      
      // Update or add config for current sport (case-insensitive comparison)
      const otherConfigs = existingConfigs.filter(sc => sc.sport?.toLowerCase() !== selectedSport.toLowerCase());
      const newConfigs: SportAgeGroups[] = [
        ...otherConfigs,
        { sport: selectedSport.toLowerCase() as SportType, ageGroups: sorted }
      ];
      
      // Also update legacy ageGroups for backward compatibility (merge all sports)
      const allAgeGroups = [...new Set(newConfigs.flatMap(c => c.ageGroups))].sort((a, b) => {
        const getFirstNum = (s: string) => parseInt(s.replace('U', '').split('-')[0]) || 0;
        return getFirstNum(a) - getFirstNum(b);
      });
      
      await updateDoc(doc(db, 'programs', programId), {
        sportConfigs: newConfigs,
        ageGroups: allAgeGroups, // Keep legacy field for backward compat
        updatedAt: serverTimestamp(),
      });
      toastSuccess(`Age groups for ${selectedSportDisplay} saved!`);
      setHasChanges(false);
      navigate('/commissioner');
    } catch (error) {
      console.error('Error saving age groups:', error);
      toastError('Failed to save age groups');
    } finally {
      setSaving(false);
    }
  };
  
  // Check if an age is already used in a created group
  const isAgeUsed = (ag: string) => {
    return createdGroups.some(group => {
      if (group === ag) return true;
      if (group.includes('-')) {
        const [start, end] = group.split('-');
        const startNum = parseInt(start.replace('U', '')) || 0;
        const endNum = parseInt(end.replace('U', '')) || 0;
        const agNum = parseInt(ag.replace('U', '')) || 0;
        return agNum >= startNum && agNum <= endNum;
      }
      return false;
    });
  };
  
  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-slate-100'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/commissioner')}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">{selectedSportDisplay} Age Groups</h1>
                <p className="text-white/80 text-sm">
                  Configure age divisions for {selectedSportDisplay}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Created Groups Section */}
        <div className={`rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
          <h2 className={`font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Your Age Groups ({createdGroups.length})
          </h2>
          
          {createdGroups.length === 0 ? (
            <p className={`text-center py-4 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>
              No age groups yet. Select ages below to create groups.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {createdGroups.map((group) => (
                <div
                  key={group}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-purple-500/20 border border-purple-500/30'
                      : 'bg-purple-50 border border-purple-200'
                  }`}
                >
                  <span className={`font-semibold ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                    {group}
                  </span>
                  <button
                    onClick={() => handleRemoveGroup(group)}
                    className={`p-1 rounded-full transition-colors ${
                      theme === 'dark' 
                        ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' 
                        : 'hover:bg-red-100 text-slate-400 hover:text-red-500'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Age Selection Section */}
        {programType !== 'adult' && (
          <div className={`rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
            <h2 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Select Ages
            </h2>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
              Click one age for single group (e.g., 6U), or multiple ages to combine (e.g., 5U-6U)
            </p>
            
            <div className={`grid gap-3 ${
              programType === 'middleschool' || programType === 'highschool' || programType === 'college' 
                ? 'grid-cols-2 max-w-sm mx-auto' 
                : 'grid-cols-4 sm:grid-cols-4 md:grid-cols-8'
            }`}>
              {availableAgeGroups.map((ag) => {
                const isSelected = pendingSelection.includes(ag);
                const isUsed = isAgeUsed(ag);
                
                return (
                  <button
                    key={ag}
                    onClick={() => !isUsed && togglePendingAge(ag)}
                    disabled={isUsed}
                    className={`relative p-4 rounded-xl text-center font-bold text-lg transition-all ${
                      isUsed
                        ? theme === 'dark'
                          ? 'bg-gray-700/50 text-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                        : isSelected
                          ? 'bg-purple-600 text-white shadow-lg scale-105'
                          : theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {ag}
                    {isSelected && (
                      <X className="absolute top-1 right-1 w-4 h-4 text-white" />
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Create Group Bar */}
            {pendingSelection.length > 0 && (
              <div className={`mt-4 p-4 rounded-lg flex items-center justify-between ${
                theme === 'dark' ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'
              }`}>
                <div>
                  <span className={`text-sm ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                    Creating: <strong>{pendingSelection.length === 1 
                      ? pendingSelection[0] 
                      : `${[...pendingSelection].sort((a, b) => {
                          const numA = parseInt(a.replace('U', '')) || 0;
                          const numB = parseInt(b.replace('U', '')) || 0;
                          return numA - numB;
                        })[0]}-${[...pendingSelection].sort((a, b) => {
                          const numA = parseInt(a.replace('U', '')) || 0;
                          const numB = parseInt(b.replace('U', '')) || 0;
                          return numA - numB;
                        })[pendingSelection.length - 1]}`
                    }</strong>
                  </span>
                </div>
                <button
                  onClick={handleCreateGroup}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Group
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Adult program message */}
        {programType === 'adult' && (
          <div className={`rounded-xl p-6 text-center ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'
          }`}>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}>
              Adult programs automatically use the 18+ age group.
            </p>
          </div>
        )}
        
        {/* Save Button - Always show, even with 0 age groups */}
        <div className={`sticky bottom-4 p-4 rounded-xl shadow-lg ${
          theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {createdGroups.length === 0 
                  ? 'No age groups configured' 
                  : `${createdGroups.length} age group${createdGroups.length !== 1 ? 's' : ''} ready`
                }
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                {createdGroups.length === 0 
                  ? `Select ages above to create groups for ${selectedSportDisplay}`
                  : createdGroups.join(', ')
                }
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                hasChanges
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : theme === 'dark'
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Age Groups
            </button>
          </div>
        </div>
        
        {/* Tip */}
        <p className={`text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>
          💡 Create single age groups (6U) or combined (5U-6U) for smaller programs
        </p>
      </div>
    </div>
  );
};

export default AgeGroupsManager;
