import React, { useState } from 'react';
import { Event, CustomField, EmergencyContact, MedicalInfo } from '../../../types/events';
import { SelectedAthlete } from './AthleteSelector';
import {
  User,
  Phone,
  Mail,
  Heart,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';

export interface AthleteFormData {
  athleteId: string;
  athleteName: string;
  emergencyContact: EmergencyContact;
  medicalInfo?: MedicalInfo;
  customFieldResponses: Record<string, string | string[] | boolean>;
}

interface RegistrationFormProps {
  event: Event;
  selectedAthletes: SelectedAthlete[];
  formData: AthleteFormData[];
  onFormDataChange: (data: AthleteFormData[]) => void;
  parentInfo?: {
    name: string;
    phone: string;
    email: string;
  };
}

// Relationship options for emergency contact
const RELATIONSHIPS = [
  'Mother',
  'Father',
  'Guardian',
  'Grandparent',
  'Aunt',
  'Uncle',
  'Sibling',
  'Other'
];

const RegistrationForm: React.FC<RegistrationFormProps> = ({
  event,
  selectedAthletes,
  formData,
  onFormDataChange,
  parentInfo
}) => {
  const [currentAthleteIndex, setCurrentAthleteIndex] = useState(0);
  const [showMedical, setShowMedical] = useState<Record<string, boolean>>({});
  const [useSameContact, setUseSameContact] = useState<Record<string, boolean>>({});

  // Initialize form data for athletes if not present
  React.useEffect(() => {
    const existingIds = formData.map(fd => fd.athleteId);
    const newFormData = [...formData];
    let changed = false;
    
    selectedAthletes.forEach(sa => {
      if (!existingIds.includes(sa.athlete.id)) {
        newFormData.push({
          athleteId: sa.athlete.id,
          athleteName: sa.athlete.name,
          emergencyContact: {
            name: '',
            relationship: '',
            phone: '',
            email: '',
          },
          medicalInfo: undefined,
          customFieldResponses: {},
        });
        changed = true;
      }
    });
    
    if (changed) {
      onFormDataChange(newFormData);
    }
  }, [selectedAthletes]);

  // Get current athlete's form data
  const getCurrentFormData = (): AthleteFormData | undefined => {
    const athlete = selectedAthletes[currentAthleteIndex];
    if (!athlete) return undefined;
    return formData.find(fd => fd.athleteId === athlete.athlete.id);
  };

  // Update form data for an athlete
  const updateAthleteFormData = (athleteId: string, updates: Partial<AthleteFormData>) => {
    onFormDataChange(formData.map(fd => 
      fd.athleteId === athleteId ? { ...fd, ...updates } : fd
    ));
  };

  // Update emergency contact
  const updateEmergencyContact = (athleteId: string, updates: Partial<EmergencyContact>) => {
    const current = formData.find(fd => fd.athleteId === athleteId);
    if (!current) return;
    
    updateAthleteFormData(athleteId, {
      emergencyContact: { ...current.emergencyContact, ...updates }
    });
  };

  // Update medical info
  const updateMedicalInfo = (athleteId: string, updates: Partial<MedicalInfo>) => {
    const current = formData.find(fd => fd.athleteId === athleteId);
    if (!current) return;
    
    updateAthleteFormData(athleteId, {
      medicalInfo: { ...current.medicalInfo, ...updates }
    });
  };

  // Update custom field response
  const updateCustomField = (athleteId: string, fieldId: string, value: string | string[] | boolean) => {
    const current = formData.find(fd => fd.athleteId === athleteId);
    if (!current) return;
    
    updateAthleteFormData(athleteId, {
      customFieldResponses: {
        ...current.customFieldResponses,
        [fieldId]: value
      }
    });
  };

  // Apply parent info to emergency contact
  const applyParentInfo = (athleteId: string) => {
    if (!parentInfo) return;
    
    updateEmergencyContact(athleteId, {
      name: parentInfo.name,
      phone: parentInfo.phone,
      email: parentInfo.email,
    });
    
    setUseSameContact(prev => ({ ...prev, [athleteId]: true }));
  };

  const currentAthlete = selectedAthletes[currentAthleteIndex];
  const currentData = getCurrentFormData();

  if (!currentAthlete || !currentData) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No athletes selected
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Athlete tabs (if multiple) */}
      {selectedAthletes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {selectedAthletes.map((sa, index) => {
            const hasData = formData.find(fd => fd.athleteId === sa.athlete.id);
            const isComplete = hasData?.emergencyContact?.name && hasData?.emergencyContact?.phone;
            
            return (
              <button
                key={sa.athlete.id}
                onClick={() => setCurrentAthleteIndex(index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  index === currentAthleteIndex
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {isComplete && <Check className="w-4 h-4 text-green-400" />}
                <span>{sa.athlete.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Progress indicator */}
      {selectedAthletes.length > 1 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Athlete {currentAthleteIndex + 1} of {selectedAthletes.length}
        </p>
      )}

      {/* Current athlete form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Athlete header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {currentAthlete.athlete.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentAthlete.pricingTierName}
            </p>
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Phone className="w-5 h-5 text-red-500" />
              Emergency Contact
            </h4>
            
            {parentInfo && !useSameContact[currentData.athleteId] && (
              <button
                onClick={() => applyParentInfo(currentData.athleteId)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Use my contact info
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contact Name *
              </label>
              <input
                type="text"
                value={currentData.emergencyContact.name}
                onChange={(e) => updateEmergencyContact(currentData.athleteId, { name: e.target.value })}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Relationship *
              </label>
              <select
                value={currentData.emergencyContact.relationship}
                onChange={(e) => updateEmergencyContact(currentData.athleteId, { relationship: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select...</option>
                {RELATIONSHIPS.map(rel => (
                  <option key={rel} value={rel}>{rel}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={currentData.emergencyContact.phone}
                onChange={(e) => updateEmergencyContact(currentData.athleteId, { phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={currentData.emergencyContact.email || ''}
                onChange={(e) => updateEmergencyContact(currentData.athleteId, { email: e.target.value })}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Medical Information (Collapsible) */}
        <div className="space-y-4">
          <button
            onClick={() => setShowMedical(prev => ({ ...prev, [currentData.athleteId]: !prev[currentData.athleteId] }))}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              Medical Information (Optional)
            </h4>
            {showMedical[currentData.athleteId] ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          {showMedical[currentData.athleteId] && (
            <div className="grid sm:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Allergies
                </label>
                <input
                  type="text"
                  value={currentData.medicalInfo?.allergies || ''}
                  onChange={(e) => updateMedicalInfo(currentData.athleteId, { allergies: e.target.value })}
                  placeholder="List any allergies..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Medical Conditions
                </label>
                <input
                  type="text"
                  value={currentData.medicalInfo?.conditions || ''}
                  onChange={(e) => updateMedicalInfo(currentData.athleteId, { conditions: e.target.value })}
                  placeholder="Asthma, diabetes, etc."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Medications
                </label>
                <input
                  type="text"
                  value={currentData.medicalInfo?.medications || ''}
                  onChange={(e) => updateMedicalInfo(currentData.athleteId, { medications: e.target.value })}
                  placeholder="List any medications..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Insurance Provider
                </label>
                <input
                  type="text"
                  value={currentData.medicalInfo?.insuranceProvider || ''}
                  onChange={(e) => updateMedicalInfo(currentData.athleteId, { insuranceProvider: e.target.value })}
                  placeholder="Insurance company"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Policy Number
                </label>
                <input
                  type="text"
                  value={currentData.medicalInfo?.insurancePolicyNumber || ''}
                  onChange={(e) => updateMedicalInfo(currentData.athleteId, { insurancePolicyNumber: e.target.value })}
                  placeholder="Policy #"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Custom Fields */}
        {event.customFields && event.customFields.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Additional Information
            </h4>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {event.customFields.map(field => (
                <div key={field.id} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  
                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={(currentData.customFieldResponses[field.id] as string) || ''}
                      onChange={(e) => updateCustomField(currentData.athleteId, field.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                  
                  {field.type === 'textarea' && (
                    <textarea
                      value={(currentData.customFieldResponses[field.id] as string) || ''}
                      onChange={(e) => updateCustomField(currentData.athleteId, field.id, e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                  
                  {field.type === 'select' && field.options && (
                    <select
                      value={(currentData.customFieldResponses[field.id] as string) || ''}
                      onChange={(e) => updateCustomField(currentData.athleteId, field.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select...</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  
                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(currentData.customFieldResponses[field.id] as boolean) || false}
                        onChange={(e) => updateCustomField(currentData.athleteId, field.id, e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Yes</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation for multiple athletes */}
      {selectedAthletes.length > 1 && (
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentAthleteIndex(prev => Math.max(0, prev - 1))}
            disabled={currentAthleteIndex === 0}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous Athlete
          </button>
          
          <button
            onClick={() => setCurrentAthleteIndex(prev => Math.min(selectedAthletes.length - 1, prev + 1))}
            disabled={currentAthleteIndex === selectedAthletes.length - 1}
            className="px-4 py-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Athlete →
          </button>
        </div>
      )}
    </div>
  );
};

export default RegistrationForm;
