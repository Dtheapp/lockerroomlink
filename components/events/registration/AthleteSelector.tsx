import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Player } from '../../../types';
import { Event, PricingTier } from '../../../types/events';
import { validateAthleteAge, getAgeLabel, formatAgeRequirement } from '../../../services/ageValidator';
import {
  User,
  Check,
  AlertCircle,
  Info,
  ChevronDown,
  Plus,
  Loader2,
  Baby
} from 'lucide-react';

export interface SelectedAthlete {
  athlete: Player;
  pricingTierId: string;
  pricingTierName: string;
  price: number;
  ageValidation: {
    isValid: boolean;
    age: number;
    message: string;
  };
}

interface AthleteSelectorProps {
  event: Event;
  pricingTiers: PricingTier[];
  parentId: string;
  existingRegistrations: string[]; // Athlete IDs already registered for this event
  selectedAthletes: SelectedAthlete[];
  onSelectionChange: (selected: SelectedAthlete[]) => void;
  onAddNewAthlete?: () => void;
}

const AthleteSelector: React.FC<AthleteSelectorProps> = ({
  event,
  pricingTiers,
  parentId,
  existingRegistrations,
  selectedAthletes,
  onSelectionChange,
  onAddNewAthlete
}) => {
  const [athletes, setAthletes] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get active pricing tiers
  const activeTiers = pricingTiers.filter(tier => {
    if (!tier.isActive) return false;
    
    const now = new Date();
    const availableFrom = tier.availableFrom?.toDate ? tier.availableFrom.toDate() : null;
    const availableUntil = tier.availableUntil?.toDate ? tier.availableUntil.toDate() : null;
    
    if (availableFrom && now < availableFrom) return false;
    if (availableUntil && now > availableUntil) return false;
    if (tier.maxQuantity && tier.currentQuantity >= tier.maxQuantity) return false;
    
    return true;
  });

  // Default tier (lowest price active tier)
  const defaultTier = activeTiers.reduce((min, tier) => 
    tier.price < min.price ? tier : min
  , activeTiers[0]);

  // Fetch parent's athletes
  useEffect(() => {
    const fetchAthletes = async () => {
      if (!parentId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Query players where parentId matches
        const playersQuery = query(
          collection(db, 'teams', event.teamId, 'players'),
          where('parentId', '==', parentId)
        );
        
        const snapshot = await getDocs(playersQuery);
        const athletesData: Player[] = [];
        
        snapshot.forEach(doc => {
          athletesData.push({ id: doc.id, ...doc.data() } as Player);
        });
        
        // Also check other teams if parent has athletes there
        // For now, we'll just use the current team's players
        
        setAthletes(athletesData);
      } catch (err: any) {
        console.error('Error fetching athletes:', err);
        setError('Failed to load athletes');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAthletes();
  }, [parentId, event.teamId]);

  // Check if athlete is selected
  const isSelected = (athleteId: string): boolean => {
    return selectedAthletes.some(sa => sa.athlete.id === athleteId);
  };

  // Get selected athlete data
  const getSelectedData = (athleteId: string): SelectedAthlete | undefined => {
    return selectedAthletes.find(sa => sa.athlete.id === athleteId);
  };

  // Toggle athlete selection
  const toggleAthlete = (athlete: Player) => {
    const ageValidation = validateAthleteAge(athlete.dob, event.ageRequirement);
    
    // Don't allow selection if age requirement not met
    if (!ageValidation.isValid) return;
    
    // Don't allow if already registered
    if (existingRegistrations.includes(athlete.id)) return;
    
    if (isSelected(athlete.id)) {
      // Remove from selection
      onSelectionChange(selectedAthletes.filter(sa => sa.athlete.id !== athlete.id));
    } else {
      // Add to selection with default tier
      if (defaultTier) {
        onSelectionChange([...selectedAthletes, {
          athlete,
          pricingTierId: defaultTier.id,
          pricingTierName: defaultTier.name,
          price: defaultTier.price,
          ageValidation: {
            isValid: ageValidation.isValid,
            age: ageValidation.age,
            message: ageValidation.message,
          },
        }]);
      }
    }
  };

  // Update pricing tier for selected athlete
  const updateAthleteTier = (athleteId: string, tierId: string) => {
    const tier = pricingTiers.find(t => t.id === tierId);
    if (!tier) return;
    
    onSelectionChange(selectedAthletes.map(sa => 
      sa.athlete.id === athleteId 
        ? { ...sa, pricingTierId: tierId, pricingTierName: tier.name, price: tier.price }
        : sa
    ));
  };

  // Format price
  const formatPrice = (cents: number): string => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading athletes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Age requirement notice */}
      {event.ageRequirement && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Baby className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-300">Age Requirement</p>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {formatAgeRequirement(event.ageRequirement)}
            </p>
          </div>
        </div>
      )}

      {/* Athletes list */}
      {athletes.length === 0 ? (
        <div className="text-center py-8">
          <User className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No Athletes Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have any athletes linked to your account yet.
          </p>
          {onAddNewAthlete && (
            <button
              onClick={onAddNewAthlete}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Athlete
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select the athlete(s) you want to register:
          </p>
          
          {athletes.map(athlete => {
            const ageValidation = validateAthleteAge(athlete.dob, event.ageRequirement);
            const alreadyRegistered = existingRegistrations.includes(athlete.id);
            const selected = isSelected(athlete.id);
            const selectedData = getSelectedData(athlete.id);
            const canSelect = ageValidation.isValid && !alreadyRegistered;
            
            return (
              <div
                key={athlete.id}
                className={`border-2 rounded-xl p-4 transition-all ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : canSelect
                      ? 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                }`}
                onClick={() => canSelect && toggleAthlete(athlete)}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox/Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {selected ? (
                      <Check className="w-6 h-6" />
                    ) : athlete.photoUrl ? (
                      <img 
                        src={athlete.photoUrl} 
                        alt={athlete.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {athlete.name}
                      </h4>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {getAgeLabel(athlete.dob)}
                      </span>
                    </div>
                    
                    {/* Status badges */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {alreadyRegistered && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                          <Check className="w-3 h-3" />
                          Already Registered
                        </span>
                      )}
                      
                      {!ageValidation.isValid && !alreadyRegistered && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full">
                          <AlertCircle className="w-3 h-3" />
                          {ageValidation.message}
                        </span>
                      )}
                      
                      {ageValidation.isValid && !alreadyRegistered && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                          <Check className="w-3 h-3" />
                          Eligible
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Pricing tier selector (when selected) */}
                {selected && selectedData && activeTiers.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800" onClick={e => e.stopPropagation()}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Pricing
                    </label>
                    <select
                      value={selectedData.pricingTierId}
                      onChange={(e) => updateAthleteTier(athlete.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      {activeTiers.map(tier => (
                        <option key={tier.id} value={tier.id}>
                          {tier.name} - {formatPrice(tier.price)}
                          {tier.maxQuantity && ` (${tier.maxQuantity - tier.currentQuantity} left)`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Price display when selected with single tier */}
                {selected && selectedData && activeTiers.length === 1 && (
                  <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedData.pricingTierName}
                      </span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatPrice(selectedData.price)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Add new athlete button */}
          {onAddNewAthlete && (
            <button
              onClick={onAddNewAthlete}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add New Athlete
            </button>
          )}
        </div>
      )}

      {/* Selection summary */}
      {selectedAthletes.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            Selected ({selectedAthletes.length})
          </h4>
          <ul className="space-y-1 text-sm">
            {selectedAthletes.map(sa => (
              <li key={sa.athlete.id} className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>{sa.athlete.name}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatPrice(sa.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AthleteSelector;
