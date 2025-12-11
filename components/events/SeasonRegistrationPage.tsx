/**
 * Season Registration Page
 * Public-facing registration page for a season
 * Parents select age group, fill out athlete info, and register
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getSeason, getProgram, registerForSeason } from '../../services/seasonService';
import { getPositionsForSport, getJerseyNumberRules, validateJerseyNumber } from '../../config/sportConfig';
import type { Season, Program, AgeGroup, SeasonRegistrationInput } from '../../types/season';
import { 
  Loader2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  Users,
  Calendar,
  Trophy,
  Shield,
  Heart,
  FileText
} from 'lucide-react';

export default function SeasonRegistrationPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Data state
  const [season, setSeason] = useState<Season | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [step, setStep] = useState(1);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    // Athlete info
    athleteFirstName: '',
    athleteLastName: '',
    athleteDOB: '',
    athleteGender: 'male' as 'male' | 'female' | 'other',
    athleteGrade: '',
    
    // Preferences
    preferredJerseyNumber: '',
    alternateJerseyNumbers: '',
    preferredPosition: '',
    
    // Parent info
    parentName: userData?.name || '',
    parentEmail: userData?.email || '',
    parentPhone: '',
    
    // Emergency contact
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyRelationship: '',
    
    // Medical
    medicalAllergies: '',
    medicalConditions: '',
    medicalMedications: '',
    medicalNotes: '',
    
    // Waiver
    waiverAccepted: false,
  });

  // Load season and program
  useEffect(() => {
    if (seasonId) {
      loadData();
    }
  }, [seasonId]);

  // Pre-fill parent info from user data
  useEffect(() => {
    if (userData) {
      setFormData(prev => ({
        ...prev,
        // Parent info from profile
        parentName: userData.name || prev.parentName,
        parentEmail: userData.email || prev.parentEmail,
        parentPhone: userData.phone || prev.parentPhone,
        // Emergency contact from profile (if they have one saved)
        emergencyContactName: userData.emergencyContact?.name || prev.emergencyContactName,
        emergencyContactPhone: userData.emergencyContact?.phone || prev.emergencyContactPhone,
        emergencyRelationship: userData.emergencyContact?.relationship || prev.emergencyRelationship,
      }));
    }
  }, [userData]);

  const loadData = async () => {
    if (!seasonId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const seasonData = await getSeason(seasonId);
      if (!seasonData) {
        setError('Season not found');
        return;
      }
      
      if (seasonData.status !== 'registration') {
        setError('Registration is not currently open for this season');
        return;
      }
      
      setSeason(seasonData);
      
      const programData = await getProgram(seasonData.programId);
      setProgram(programData);
    } catch (err) {
      console.error('Error loading season:', err);
      setError('Failed to load registration information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !season || !program || !selectedAgeGroup) {
      setError('Missing required information');
      return;
    }
    
    if (!formData.waiverAccepted) {
      setError('You must accept the waiver to continue');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // Parse jersey numbers
      let preferredJersey: number | undefined;
      let alternateJerseys: number[] = [];
      
      if (formData.preferredJerseyNumber) {
        const num = parseInt(formData.preferredJerseyNumber);
        if (!isNaN(num)) {
          // Validate jersey number for sport
          const validation = validateJerseyNumber(num, program.sport);
          if (!validation.valid) {
            setError(validation.error || 'Invalid jersey number');
            setSaving(false);
            return;
          }
          preferredJersey = num;
        }
      }
      
      if (formData.alternateJerseyNumbers) {
        alternateJerseys = formData.alternateJerseyNumbers
          .split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => !isNaN(n) && validateJerseyNumber(n, program.sport).valid);
      }
      
      const input: SeasonRegistrationInput = {
        seasonId: season.id,
        programId: program.id,
        programName: program.name,
        seasonName: season.name,
        ageGroupId: selectedAgeGroup.id,
        ageGroupName: selectedAgeGroup.name,
        sport: program.sport,
        
        parentUserId: user.uid,
        
        athleteFirstName: formData.athleteFirstName.trim(),
        athleteLastName: formData.athleteLastName.trim(),
        athleteDOB: new Date(formData.athleteDOB),
        athleteGender: formData.athleteGender,
        athleteGrade: formData.athleteGrade ? parseInt(formData.athleteGrade) : undefined,
        
        preferredJerseyNumber: preferredJersey,
        alternateJerseyNumbers: alternateJerseys,
        preferredPosition: formData.preferredPosition || undefined,
        
        parentName: formData.parentName.trim(),
        parentEmail: formData.parentEmail.trim(),
        parentPhone: formData.parentPhone.trim(),
        
        emergencyContactName: formData.emergencyContactName.trim(),
        emergencyContactPhone: formData.emergencyContactPhone.trim(),
        emergencyRelationship: formData.emergencyRelationship.trim(),
        
        medicalAllergies: formData.medicalAllergies.trim(),
        medicalConditions: formData.medicalConditions.trim(),
        medicalMedications: formData.medicalMedications.trim(),
        medicalNotes: formData.medicalNotes.trim(),
        
        waiverAccepted: formData.waiverAccepted,
        
        amountDue: season.registrationFee,
        amountPaid: 0, // TODO: Integrate payment
        paymentMethod: 'pending' as any,
      };
      
      await registerForSeason(input);
      setSuccess(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to complete registration');
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Check if current step is valid
  const isStepValid = () => {
    switch (step) {
      case 1:
        return !!selectedAgeGroup;
      case 2:
        return !!(
          formData.athleteFirstName &&
          formData.athleteLastName &&
          formData.athleteDOB &&
          formData.athleteGender
        );
      case 3:
        return !!(
          formData.parentName &&
          formData.parentEmail &&
          formData.parentPhone &&
          formData.emergencyContactName &&
          formData.emergencyContactPhone &&
          formData.emergencyRelationship
        );
      case 4:
        return formData.waiverAccepted;
      default:
        return false;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    );
  }

  // Error state
  if (error && !season) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full text-center ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-8 shadow-lg`}>
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Registration Unavailable
          </h2>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full text-center ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-8 shadow-lg`}>
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Registration Complete!
          </h2>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {formData.athleteFirstName} has been registered for {season?.name}. 
            You'll be notified when teams are assigned.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full text-center ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-8 shadow-lg`}>
          <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Sign In Required
          </h2>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Please sign in or create an account to register for {season?.name}.
          </p>
          <button
            onClick={() => navigate('/login', { state: { returnTo: `/register/${seasonId}` } })}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!season || !program) return null;

  const positions = getPositionsForSport(program.sport);
  const jerseyRules = getJerseyNumberRules(program.sport);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {program.name}
            </h1>
            <p className={`text-lg ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {season.name} Registration
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Registration Fee: ${(season.registrationFee / 100).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} py-4`}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Age Group', icon: Users },
              { num: 2, label: 'Athlete', icon: Trophy },
              { num: 3, label: 'Contact', icon: Shield },
              { num: 4, label: 'Confirm', icon: FileText },
            ].map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isComplete = step > s.num;
              
              return (
                <React.Fragment key={s.num}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isComplete ? 'bg-green-500 text-white' :
                      isActive ? 'bg-blue-600 text-white' :
                      isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs mt-1 ${
                      isActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : 
                      isDark ? 'text-gray-500' : 'text-gray-600'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      step > s.num ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-300'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-500">{error}</span>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6`}>
          
          {/* Step 1: Age Group Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Select Age Group
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Choose the age group for your athlete
              </p>
              
              <div className="grid gap-3">
                {season.activeAgeGroups.map(ag => {
                  const count = season.registrationCounts[ag.id] || 0;
                  const isFull = season.maxPlayersPerAgeGroup 
                    ? count >= season.maxPlayersPerAgeGroup 
                    : false;
                  
                  return (
                    <button
                      key={ag.id}
                      onClick={() => !isFull && setSelectedAgeGroup(ag)}
                      disabled={isFull}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        selectedAgeGroup?.id === ag.id
                          ? 'border-blue-500 bg-blue-500/20'
                          : isFull
                            ? isDark ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed' : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                            : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {ag.name}
                          </div>
                          {ag.minGrade !== undefined && ag.maxGrade !== undefined && (
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Grades {ag.minGrade}-{ag.maxGrade}
                            </div>
                          )}
                          {ag.minAge !== undefined && ag.maxAge !== undefined && (
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Ages {ag.minAge}-{ag.maxAge}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {isFull ? (
                            <span className="text-sm text-red-500">Full</span>
                          ) : season.maxPlayersPerAgeGroup ? (
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {count} / {season.maxPlayersPerAgeGroup}
                            </span>
                          ) : (
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {count} registered
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Athlete Information */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Athlete Information
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.athleteFirstName}
                    onChange={(e) => updateFormData('athleteFirstName', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.athleteLastName}
                    onChange={(e) => updateFormData('athleteLastName', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={formData.athleteDOB}
                    onChange={(e) => updateFormData('athleteDOB', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Gender *
                  </label>
                  <select
                    value={formData.athleteGender}
                    onChange={(e) => updateFormData('athleteGender', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Current Grade
                </label>
                <select
                  value={formData.athleteGrade}
                  onChange={(e) => updateFormData('athleteGrade', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select grade</option>
                  <option value="0">Kindergarten</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                    <option key={g} value={g}>{g}{g === 1 ? 'st' : g === 2 ? 'nd' : g === 3 ? 'rd' : 'th'} Grade</option>
                  ))}
                </select>
              </div>

              {/* Jersey & Position Preferences */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <h3 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Preferences (Optional)
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Preferred Jersey #
                    </label>
                    <input
                      type="number"
                      value={formData.preferredJerseyNumber}
                      onChange={(e) => updateFormData('preferredJerseyNumber', e.target.value)}
                      placeholder={jerseyRules ? `${jerseyRules.min}-${jerseyRules.max}` : 'e.g., 10'}
                      min={jerseyRules?.min}
                      max={jerseyRules?.max}
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Preferred Position
                    </label>
                    <select
                      value={formData.preferredPosition}
                      onChange={(e) => updateFormData('preferredPosition', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                      <option value="">Select position</option>
                      {positions.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="mt-3">
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Alternate Jersey Numbers (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formData.alternateJerseyNumbers}
                    onChange={(e) => updateFormData('alternateJerseyNumbers', e.target.value)}
                    placeholder="e.g., 7, 12, 23"
                    className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Contact & Medical Info */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Parent/Guardian Information
                </h2>
                {(userData?.name || userData?.email || userData?.phone) && (
                  <p className={`text-sm mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    ✓ Some fields pre-filled from your profile
                  </p>
                )}
                
                <div className="mt-4 space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Full Name *
                      {userData?.name && <span className={`ml-2 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>(from profile)</span>}
                    </label>
                    <input
                      type="text"
                      value={formData.parentName}
                      onChange={(e) => updateFormData('parentName', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Email *
                        {userData?.email && <span className={`ml-2 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>(from profile)</span>}
                      </label>
                      <input
                        type="email"
                        value={formData.parentEmail}
                        onChange={(e) => updateFormData('parentEmail', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Phone *
                        {userData?.phone && <span className={`ml-2 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>(from profile)</span>}
                      </label>
                      <input
                        type="tel"
                        value={formData.parentPhone}
                        onChange={(e) => updateFormData('parentPhone', e.target.value)}
                        placeholder="(555) 123-4567"
                        className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Emergency Contact
                  {userData?.emergencyContact?.name && <span className={`ml-2 text-xs font-normal ${isDark ? 'text-green-400' : 'text-green-600'}`}>(from profile)</span>}
                </h3>
                
                <div className="mt-3 space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      value={formData.emergencyContactName}
                      onChange={(e) => updateFormData('emergencyContactName', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => updateFormData('emergencyContactPhone', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Relationship *
                      </label>
                      <input
                        type="text"
                        value={formData.emergencyRelationship}
                        onChange={(e) => updateFormData('emergencyRelationship', e.target.value)}
                        placeholder="e.g., Grandparent"
                        className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Heart className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Medical Information (Optional)
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Allergies
                    </label>
                    <input
                      type="text"
                      value={formData.medicalAllergies}
                      onChange={(e) => updateFormData('medicalAllergies', e.target.value)}
                      placeholder="e.g., Peanuts, Bee stings"
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Medical Conditions
                    </label>
                    <input
                      type="text"
                      value={formData.medicalConditions}
                      onChange={(e) => updateFormData('medicalConditions', e.target.value)}
                      placeholder="e.g., Asthma, Diabetes"
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Medications
                    </label>
                    <input
                      type="text"
                      value={formData.medicalMedications}
                      onChange={(e) => updateFormData('medicalMedications', e.target.value)}
                      placeholder="e.g., Inhaler, EpiPen"
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Additional Notes
                    </label>
                    <textarea
                      value={formData.medicalNotes}
                      onChange={(e) => updateFormData('medicalNotes', e.target.value)}
                      placeholder="Any other medical information coaches should know"
                      rows={2}
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Waiver */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Review & Confirm
              </h2>
              
              {/* Summary */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Athlete:</span>
                    <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formData.athleteFirstName} {formData.athleteLastName}
                    </span>
                  </div>
                  <div>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Age Group:</span>
                    <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selectedAgeGroup?.name}
                    </span>
                  </div>
                  <div>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Program:</span>
                    <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {program.name}
                    </span>
                  </div>
                  <div>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Season:</span>
                    <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {season.name}
                    </span>
                  </div>
                </div>
                
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-600' : 'border-gray-200'} flex justify-between items-center`}>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Registration Fee:
                  </span>
                  <span className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    ${(season.registrationFee / 100).toFixed(2)}
                  </span>
                </div>
              </div>
              
              {/* Waiver */}
              <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-yellow-50 border-yellow-200'}`}>
                <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Waiver & Release
                </h3>
                <div className={`text-sm max-h-32 overflow-y-auto mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <p className="mb-2">
                    By checking the box below, I acknowledge that I am the parent/legal guardian of the above-named athlete 
                    and give permission for their participation in {program.name} {season.name}.
                  </p>
                  <p className="mb-2">
                    I understand that participation in youth sports involves inherent risks, including but not limited to 
                    physical injury. I agree to hold harmless the organization, coaches, volunteers, and facilities from 
                    any claims arising from participation.
                  </p>
                  <p>
                    I also consent to emergency medical treatment if required and cannot be reached.
                  </p>
                </div>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.waiverAccepted}
                    onChange={(e) => updateFormData('waiverAccepted', e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    I have read and agree to the waiver above. I confirm that all information provided is accurate.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className={`flex justify-between mt-6 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                step === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            
            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!isStepValid()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving || !formData.waiverAccepted}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Complete Registration
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
