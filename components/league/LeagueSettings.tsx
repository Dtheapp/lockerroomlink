import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { League, SportType } from '../../types';
import { ChevronLeft, Save, Settings, MapPin, Trophy, AlertCircle, CheckCircle, Globe, Copy, ExternalLink, Loader2, Users, Plus, X, Camera, AtSign } from 'lucide-react';
import { Link } from 'react-router-dom';

// Available age groups for youth leagues
const AVAILABLE_AGE_GROUPS = ['5U', '6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U', 'JV', 'Varsity', '18+'];

export default function LeagueSettings() {
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    sport: '' as SportType,
    city: '',
    state: '',
    description: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    publicProfile: true
  });

  const [copied, setCopied] = useState(false);
  const [zipcode, setZipcode] = useState('');
  const [zipcodeLookupLoading, setZipcodeLookupLoading] = useState(false);
  const [zipcodeError, setZipcodeError] = useState('');
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);
  
  // Logo upload state
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Username/handle state
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Track initial values for change detection
  const initialDataRef = useRef<{
    formData: typeof formData;
    zipcode: string;
    ageGroups: string[];
    username: string;
  } | null>(null);


  useEffect(() => {
    if (leagueData) {
      setFormData({
        name: leagueData.name || '',
        sport: leagueData.sport || 'football',
        city: leagueData.city || '',
        state: leagueData.state || '',
        description: (leagueData as any).description || '',
        contactName: (leagueData as any).contactName || '',
        contactEmail: (leagueData as any).contactEmail || '',
        contactPhone: (leagueData as any).contactPhone || '',
        website: (leagueData as any).website || '',
        publicProfile: true // Always public
      });
      setZipcode((leagueData as any).zipcode || '');
      setAgeGroups((leagueData as any).ageGroups || []);
      setLogoUrl((leagueData as any).logoUrl || '');
      setUsername((leagueData as any).username || '');
      if ((leagueData as any).username) {
        setUsernameAvailable(true); // Already saved username is valid
      }
      
      // Store initial values for change detection
      initialDataRef.current = {
        formData: {
          name: leagueData.name || '',
          sport: leagueData.sport || 'football',
          city: leagueData.city || '',
          state: leagueData.state || '',
          description: (leagueData as any).description || '',
          contactName: (leagueData as any).contactName || '',
          contactEmail: (leagueData as any).contactEmail || '',
          contactPhone: (leagueData as any).contactPhone || '',
          website: (leagueData as any).website || '',
          publicProfile: true
        },
        zipcode: (leagueData as any).zipcode || '',
        ageGroups: (leagueData as any).ageGroups || [],
        username: (leagueData as any).username || ''
      };
      setHasChanges(false);
    }
  }, [leagueData]);

  // Detect changes
  useEffect(() => {
    if (!initialDataRef.current) return;
    
    const initial = initialDataRef.current;
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initial.formData);
    const zipcodeChanged = zipcode !== initial.zipcode;
    const ageGroupsChanged = JSON.stringify(ageGroups) !== JSON.stringify(initial.ageGroups);
    const usernameChanged = username !== initial.username;
    
    setHasChanges(formChanged || zipcodeChanged || ageGroupsChanged || usernameChanged);
  }, [formData, zipcode, ageGroups, username]);

  // Check username availability
  const checkUsername = async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      setUsernameAvailable(null);
      return;
    }
    
    // Validate format: lowercase, alphanumeric, hyphens only
    if (!/^[a-z0-9-]+$/.test(value)) {
      setUsernameError('Only lowercase letters, numbers, and hyphens allowed');
      setUsernameAvailable(null);
      return;
    }
    
    setUsernameChecking(true);
    setUsernameError('');
    
    try {
      // Check if username is taken by another league
      const q = query(collection(db, 'leagues'), where('username', '==', value));
      const snapshot = await getDocs(q);
      
      // If no results, or the only result is our own league, it's available
      const isAvailable = snapshot.empty || 
        (snapshot.docs.length === 1 && snapshot.docs[0].id === leagueData?.id);
      
      setUsernameAvailable(isAvailable);
      if (!isAvailable) {
        setUsernameError('This username is already taken');
      }
    } catch (err) {
      console.error('Error checking username:', err);
      setUsernameError('Error checking availability');
    } finally {
      setUsernameChecking(false);
    }
  };

  // Handle username change with debounce
  const handleUsernameChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    setUsername(cleaned);
    setUsernameAvailable(null);
    setUsernameError('');
  };

  // Handle logo upload
  const handleLogoUpload = async (file: File) => {
    if (!leagueData || !file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }
    
    setLogoUploading(true);
    try {
      const storageRef = ref(storage, `leagues/${leagueData.id}/logo`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setLogoUrl(url);
      
      // Save immediately
      await updateDoc(doc(db, 'leagues', leagueData.id), { logoUrl: url });
    } catch (err) {
      console.error('Error uploading logo:', err);
      setError('Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  // Zipcode lookup function
  const lookupZipcode = async (zip: string) => {
    if (zip.length !== 5 || !/^\d{5}$/.test(zip)) return;
    
    setZipcodeLookupLoading(true);
    setZipcodeError('');
    
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (response.ok) {
        const data = await response.json();
        if (data.places && data.places.length > 0) {
          const place = data.places[0];
          setFormData(prev => ({
            ...prev,
            city: place['place name'] || '',
            state: place['state abbreviation'] || ''
          }));
        }
      } else if (response.status === 404) {
        setZipcodeError('Invalid ZIP code');
      }
    } catch (err) {
      console.error('Zipcode lookup failed:', err);
    } finally {
      setZipcodeLookupLoading(false);
    }
  };

  // Handle zipcode change
  const handleZipcodeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 5);
    setZipcode(cleaned);
    setZipcodeError('');
    
    if (cleaned.length === 5) {
      lookupZipcode(cleaned);
    }
  };

  // Use username for pretty URL if set, otherwise use league ID
  const publicUrl = leagueData 
    ? `${window.location.origin}/league/${username || leagueData.id}` 
    : '';

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueData || !user) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    // Validate username if set
    if (username && usernameAvailable === false) {
      setError('Please choose an available username');
      setLoading(false);
      return;
    }

    try {
      const leagueRef = doc(db, 'leagues', leagueData.id);
      await updateDoc(leagueRef, {
        ...formData,
        zipcode,
        ageGroups,
        logoUrl,
        username: username || null, // Save username if set
        publicProfile: true, // Always public
        updatedAt: new Date()
      });
      
      // Update initial data ref so hasChanges resets
      initialDataRef.current = {
        formData: { ...formData },
        zipcode,
        ageGroups: [...ageGroups],
        username
      };
      
      setSuccess(true);
      setHasChanges(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating league:', err);
      setError('Failed to update league settings');
    } finally {
      setLoading(false);
    }
  };

  if (!leagueData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className="text-center">
          <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-red-500' : 'text-red-600'
          }`} />
          <h2 className={`text-xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>No League Found</h2>
          <p className={`mt-2 ${
            theme === 'dark' ? 'text-gray-400' : 'text-slate-600'
          }`}>You are not associated with any league.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white' 
        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        theme === 'dark' 
          ? 'bg-black/40 backdrop-blur-xl border-white/10' 
          : 'bg-white/80 backdrop-blur-xl border-slate-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/league" className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}>
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className={`text-xl font-bold flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Settings className={theme === 'dark' ? 'w-5 h-5 text-purple-400' : 'w-5 h-5 text-purple-600'} />
                League Settings
              </h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>{leagueData.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className={`mb-6 rounded-xl p-4 flex items-center gap-3 ${
            theme === 'dark' 
              ? 'bg-red-500/10 border border-red-500/50' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
              theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`} />
            <p className={theme === 'dark' ? 'text-red-300' : 'text-red-700'}>{error}</p>
          </div>
        )}

        {success && (
          <div className={`mb-6 rounded-xl p-4 flex items-center gap-3 ${
            theme === 'dark' 
              ? 'bg-emerald-500/10 border border-emerald-500/50' 
              : 'bg-emerald-50 border border-emerald-200'
          }`}>
            <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            }`} />
            <p className={theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}>Settings saved successfully!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo Upload */}
          <div className={`rounded-2xl p-6 ${
            theme === 'dark' 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <Camera className={theme === 'dark' ? 'w-5 h-5 text-purple-400' : 'w-5 h-5 text-purple-600'} />
              League Logo
            </h2>
            
            <div className="flex items-center gap-6">
              <div className="relative">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="League logo" 
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-purple-500/30"
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-2xl flex items-center justify-center ${
                    theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'
                  }`}>
                    <Trophy className={`w-10 h-10 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                  </div>
                )}
                {logoUploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Upload a logo for your league. This will appear on your public page and in the app.
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  {logoUrl ? 'Change Logo' : 'Upload Logo'}
                </button>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className={`rounded-2xl p-6 ${
            theme === 'dark' 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <Trophy className={theme === 'dark' ? 'w-5 h-5 text-amber-400' : 'w-5 h-5 text-amber-600'} />
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  League Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                  placeholder="Describe your league..."
                />
              </div>

              {/* Username/Handle */}
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <AtSign className="w-4 h-4 inline mr-1" />
                  League Username
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {window.location.origin}/league/
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    onBlur={() => username && checkUsername(username)}
                    placeholder="your-league-name"
                    className={`w-full rounded-xl pl-[calc(100%-180px)] sm:pl-64 pr-12 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                      theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                    } ${usernameError ? 'border-red-500' : usernameAvailable === true ? 'border-emerald-500' : ''}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameChecking && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                    {!usernameChecking && usernameAvailable === true && (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    )}
                    {!usernameChecking && usernameAvailable === false && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
                {usernameError && (
                  <p className="text-red-500 text-xs mt-1">{usernameError}</p>
                )}
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  Create a custom URL for your public league page. Leave blank to use the default ID.
                </p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className={`rounded-2xl p-6 ${
            theme === 'dark' 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <MapPin className={theme === 'dark' ? 'w-5 h-5 text-emerald-400' : 'w-5 h-5 text-emerald-600'} />
              Location
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  ZIP Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={zipcode}
                    onChange={(e) => handleZipcodeChange(e.target.value)}
                    placeholder="Enter ZIP"
                    maxLength={5}
                    className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                      theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                    } ${zipcodeError ? 'border-red-500' : ''}`}
                  />
                  {zipcodeLookupLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    </div>
                  )}
                </div>
                {zipcodeError && (
                  <p className="text-red-500 text-xs mt-1">{zipcodeError}</p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  readOnly
                  className={`w-full rounded-xl px-4 py-2.5 cursor-not-allowed ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-slate-400'
                      : 'bg-slate-100 border border-slate-200 text-slate-500'
                  }`}
                  placeholder="Auto-filled"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  readOnly
                  className={`w-full rounded-xl px-4 py-2.5 cursor-not-allowed ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-slate-400'
                      : 'bg-slate-100 border border-slate-200 text-slate-500'
                  }`}
                  placeholder="Auto-filled"
                />
              </div>
            </div>
          </div>

          {/* Age Groups */}
          <div className={`rounded-2xl p-6 ${
            theme === 'dark' 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Users className={theme === 'dark' ? 'w-5 h-5 text-blue-400' : 'w-5 h-5 text-blue-600'} />
                Age Groups
              </h2>
            </div>

            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Configure which age groups your league supports. Teams will register under these divisions.
            </p>

            {/* Age Group Selector - Always visible */}
            <div className={`mb-4 p-4 rounded-xl ${
              theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'
            }`}>
              <p className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Select age groups to add:
              </p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_AGE_GROUPS.map(ag => {
                  const isSelected = pendingSelection.includes(ag);
                  // Check if this age is already used in a created group
                  const isUsed = ageGroups.some(group => {
                    if (group === ag) return true;
                    if (group.includes('-')) {
                      const [start, end] = group.split('-');
                      const startNum = parseInt(start.replace('U', '').replace('+', '')) || 0;
                      const endNum = parseInt(end.replace('U', '').replace('+', '')) || 0;
                      const agNum = parseInt(ag.replace('U', '').replace('+', '')) || 0;
                      return agNum >= startNum && agNum <= endNum;
                    }
                    return false;
                  });

                  return (
                    <button
                      key={ag}
                      type="button"
                      disabled={isUsed}
                      onClick={() => {
                        if (isUsed) return;
                        if (isSelected) {
                          setPendingSelection(pendingSelection.filter(a => a !== ag));
                        } else {
                          setPendingSelection([...pendingSelection, ag]);
                        }
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                        isUsed
                          ? theme === 'dark'
                            ? 'bg-slate-700/50 text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                          : isSelected
                            ? 'bg-purple-600 text-white shadow-lg scale-105'
                            : theme === 'dark'
                              ? 'bg-white/10 text-slate-300 hover:bg-white/20'
                              : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {ag}
                    </button>
                  );
                })}
              </div>

              {/* Create Group Bar - Shows when ages selected */}
              {pendingSelection.length > 0 && (
                <div className={`mt-4 p-4 rounded-lg flex items-center justify-between ${
                  theme === 'dark' ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'
                }`}>
                  <div>
                    <span className={`text-sm ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                      Creating: <strong>{
                        pendingSelection.length === 1 
                          ? pendingSelection[0] 
                          : (() => {
                              const sorted = [...pendingSelection].sort((a, b) => {
                                const numA = parseInt(a.replace('U', '').replace('+', '')) || 99;
                                const numB = parseInt(b.replace('U', '').replace('+', '')) || 99;
                                return numA - numB;
                              });
                              return `${sorted[0]}-${sorted[sorted.length - 1]}`;
                            })()
                      }</strong>
                    </span>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Click one for single (6U) or multiple to combine (5U-6U)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingSelection.length === 0) return;
                      // Sort and create label
                      const sorted = [...pendingSelection].sort((a, b) => {
                        const numA = parseInt(a.replace('U', '').replace('+', '')) || 99;
                        const numB = parseInt(b.replace('U', '').replace('+', '')) || 99;
                        return numA - numB;
                      });
                      // Create group name
                      let groupName = sorted.length === 1 ? sorted[0] : `${sorted[0]}-${sorted[sorted.length - 1]}`;
                      // Check if already exists
                      if (!ageGroups.includes(groupName)) {
                        const newGroups = [...ageGroups, groupName].sort((a, b) => {
                          const getFirstNum = (s: string) => parseInt(s.replace('U', '').replace('+', '').split('-')[0]) || 99;
                          return getFirstNum(a) - getFirstNum(b);
                        });
                        setAgeGroups(newGroups);
                      }
                      setPendingSelection([]);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Group
                  </button>
                </div>
              )}
            </div>

            {/* Current Age Groups */}
            {ageGroups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ageGroups.map(ag => (
                  <div
                    key={ag}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                      theme === 'dark'
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                        : 'bg-purple-100 text-purple-700 border border-purple-200'
                    }`}
                  >
                    <span className="font-semibold">{ag}</span>
                    <button
                      type="button"
                      onClick={() => setAgeGroups(ageGroups.filter(a => a !== ag))}
                      className={`p-1 rounded-full transition-colors ${
                        theme === 'dark' 
                          ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' 
                          : 'hover:bg-red-100 text-slate-400 hover:text-red-500'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-center py-8 rounded-xl border-2 border-dashed ${
                theme === 'dark' ? 'border-white/10' : 'border-slate-200'
              }`}>
                <Users className={`w-10 h-10 mx-auto mb-2 ${
                  theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                }`} />
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  No age groups configured yet
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                  ⚠️ You must add age groups before creating seasons
                </p>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className={`rounded-2xl p-6 ${
            theme === 'dark' 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Contact Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="e.g., John Smith"
                  className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                  placeholder="https://"
                />
              </div>
            </div>
          </div>

          {/* Shareable Link */}
          <div className={`rounded-2xl p-6 ${
            theme === 'dark' 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <Globe className={theme === 'dark' ? 'w-5 h-5 text-cyan-400' : 'w-5 h-5 text-cyan-600'} />
              Public League Page
            </h2>
            
            {leagueData && (
              <div>
                <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Share this link to let anyone view your standings, schedules, and teams:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm ${
                      theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-slate-300'
                        : 'bg-slate-50 border border-slate-200 text-slate-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={copyPublicUrl}
                    className={`flex items-center gap-1 px-4 py-2.5 rounded-xl transition-colors ${
                      theme === 'dark'
                        ? 'bg-white/10 hover:bg-white/20 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                    title="Copy URL"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end pb-20">
            <button
              type="submit"
              disabled={loading || !hasChanges || success}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                success
                  ? 'bg-emerald-600 text-white'
                  : hasChanges
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/25'
                    : theme === 'dark'
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {success ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {loading ? 'Saving...' : 'Save Settings'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
