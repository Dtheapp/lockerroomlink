/**
 * OSYS Referee Signup
 * Allows users to sign up as a referee
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signUpAsReferee } from '../../services/refereeService';
import { ArrowRight, Award, Calendar, MapPin, Clock, Check, X, Shield } from 'lucide-react';
import type { SportType } from '../../types';
import type { RefereeAvailability, RefereeCertification } from '../../types/referee';

interface Props {
  onComplete?: () => void;
  onCancel?: () => void;
}

const SUPPORTED_SPORTS: SportType[] = [
  'basketball', 'football', 'baseball', 'soccer', 'volleyball', 'cheer', 'other'
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export const RefereeSignup: React.FC<Props> = ({ onComplete, onCancel }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [selectedSports, setSelectedSports] = useState<SportType[]>([]);
  const [yearsExperience, setYearsExperience] = useState(0);
  const [bio, setBio] = useState('');
  const [availability, setAvailability] = useState<RefereeAvailability>({
    weekdays: true,
    weekends: true,
    evenings: true,
  });
  const [travelRadius, setTravelRadius] = useState(25);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [certifications, setCertifications] = useState<RefereeCertification[]>([]);
  const [newCert, setNewCert] = useState({ sport: '' as SportType, name: '', issuingBody: '' });
  
  const toggleSport = (sport: SportType) => {
    setSelectedSports(prev => 
      prev.includes(sport) 
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };
  
  const addCertification = () => {
    if (!newCert.sport || !newCert.name) return;
    setCertifications(prev => [...prev, {
      sport: newCert.sport,
      name: newCert.name,
      organization: newCert.issuingBody || '',
      issuingBody: newCert.issuingBody,
      verified: false,
      isVerified: false,
    }]);
    setNewCert({ sport: '' as SportType, name: '', issuingBody: '' });
  };
  
  const removeCertification = (index: number) => {
    setCertifications(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async () => {
    if (!user) return;
    
    if (selectedSports.length === 0) {
      setError('Please select at least one sport');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await signUpAsReferee(user.uid, {
        sports: selectedSports,
        yearsExperience,
        bio,
        availability,
        travelRadius,
        homeLocation: city && state ? { city, state } : undefined,
        certifications,
      });
      
      if (result.success) {
        // Profile updated - redirect to dashboard
        onComplete?.();
      } else {
        setError(result.error || 'Failed to sign up as referee');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Become a Referee</h2>
        <p className="text-slate-400">
          Join OSYS as an official and start officiating games
        </p>
      </div>
      
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Select Your Sports</h3>
        <p className="text-slate-400 text-sm mb-4">Choose all sports you're qualified to officiate</p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SUPPORTED_SPORTS.map(sport => (
            <button
              key={sport}
              onClick={() => toggleSport(sport)}
              className={`p-3 rounded-lg border-2 transition-all capitalize text-left ${
                selectedSports.includes(sport)
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                  : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{sport}</span>
                {selectedSports.includes(sport) && <Check className="w-4 h-4" />}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Experience</h3>
        <label className="block text-sm text-slate-400 mb-2">Years of officiating experience</label>
        <input
          type="number"
          min="0"
          max="50"
          value={yearsExperience}
          onChange={e => setYearsExperience(parseInt(e.target.value) || 0)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => setStep(2)}
          disabled={selectedSports.length === 0}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
  
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Availability & Location</h2>
        <p className="text-slate-400">Tell leagues when and where you can officiate</p>
      </div>
      
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Availability</h3>
        </div>
        
        <div className="space-y-3">
          {[
            { key: 'weekdays', label: 'Weekdays (Mon-Fri, daytime)' },
            { key: 'weekends', label: 'Weekends (Sat-Sun)' },
            { key: 'evenings', label: 'Evenings (after 5pm)' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={availability[key as keyof RefereeAvailability] as boolean}
                onChange={e => setAvailability(prev => ({ ...prev, [key]: e.target.checked }))}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Location</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">City</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Your city"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">State</label>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select State</option>
              {US_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            Travel radius: <span className="text-white font-medium">{travelRadius} miles</span>
          </label>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={travelRadius}
            onChange={e => setTravelRadius(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>5 mi</span>
            <span>100 mi</span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between">
        <button
          onClick={() => setStep(1)}
          className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setStep(3)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium transition-all flex items-center gap-2"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
  
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Profile & Certifications</h2>
        <p className="text-slate-400">Complete your referee profile</p>
      </div>
      
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">About You</h3>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Tell leagues about your experience, style, and qualifications..."
          rows={4}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
      
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Certifications (Optional)</h3>
        </div>
        
        {certifications.length > 0 && (
          <div className="space-y-2 mb-4">
            {certifications.map((cert, index) => (
              <div key={index} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-2">
                <div>
                  <span className="text-white capitalize">{cert.sport}</span>
                  <span className="text-slate-400 mx-2">—</span>
                  <span className="text-slate-300">{cert.name}</span>
                  {cert.issuingBody && (
                    <span className="text-slate-500 ml-2">({cert.issuingBody})</span>
                  )}
                </div>
                <button
                  onClick={() => removeCertification(index)}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={newCert.sport}
            onChange={e => setNewCert(prev => ({ ...prev, sport: e.target.value as SportType }))}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
          >
            <option value="">Sport</option>
            {selectedSports.map(sport => (
              <option key={sport} value={sport} className="capitalize">{sport}</option>
            ))}
          </select>
          <input
            type="text"
            value={newCert.name}
            onChange={e => setNewCert(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Certification name"
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
          />
          <input
            type="text"
            value={newCert.issuingBody}
            onChange={e => setNewCert(prev => ({ ...prev, issuingBody: e.target.value }))}
            placeholder="Issuing body (optional)"
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
          />
        </div>
        <button
          onClick={addCertification}
          disabled={!newCert.sport || !newCert.name}
          className="mt-3 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + Add Certification
        </button>
      </div>
      
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <p className="text-blue-400 text-sm">
          <strong>Note:</strong> You can apply for verification later from your dashboard to get a verified badge on your profile.
        </p>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      
      <div className="flex justify-between">
        <button
          onClick={() => setStep(2)}
          className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating Profile...
            </>
          ) : (
            <>
              Complete Signup <Check className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress indicator */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map(s => (
          <React.Fragment key={s}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
              s < step ? 'bg-green-600 text-white' :
              s === step ? 'bg-blue-600 text-white' :
              'bg-slate-700 text-slate-400'
            }`}>
              {s < step ? <Check className="w-5 h-5" /> : s}
            </div>
            {s < 3 && (
              <div className={`w-16 h-1 mx-2 rounded ${
                s < step ? 'bg-green-600' : 'bg-slate-700'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
      
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
};

export default RefereeSignup;
