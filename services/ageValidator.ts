// Age Validation Utility
// Validates athlete age against event requirements

import { AgeRequirement } from '../types/events';

export interface AgeValidationResult {
  isValid: boolean;
  age: number;
  message: string;
  requirement?: string;
}

/**
 * Calculate age as of a specific date
 * @param birthDate - The person's date of birth
 * @param asOfDate - Calculate age as of this date (default: today)
 * @returns Age in years
 */
export const calculateAge = (birthDate: Date, asOfDate: Date = new Date()): number => {
  let age = asOfDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = asOfDate.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && asOfDate.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Format age requirement for display
 * @param ageRequirement - The age requirement object
 * @returns Human-readable string
 */
export const formatAgeRequirement = (ageRequirement: AgeRequirement): string => {
  const asOfDate = ageRequirement.asOfDate?.toDate 
    ? ageRequirement.asOfDate.toDate() 
    : new Date(ageRequirement.asOfDate as any);
  
  const dateStr = asOfDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  switch (ageRequirement.type) {
    case 'under':
      return `Under ${ageRequirement.maxAge} years old (as of ${dateStr})`;
    case 'over':
      return `${ageRequirement.minAge}+ years old (as of ${dateStr})`;
    case 'between':
      return `Ages ${ageRequirement.minAge}-${ageRequirement.maxAge} (as of ${dateStr})`;
    default:
      return '';
  }
};

/**
 * Validate an athlete's age against event requirements
 * @param birthDateString - Athlete's birth date (string format: YYYY-MM-DD or MM/DD/YYYY)
 * @param ageRequirement - The event's age requirement
 * @returns Validation result with status and message
 */
export const validateAthleteAge = (
  birthDateString: string | undefined,
  ageRequirement: AgeRequirement | undefined
): AgeValidationResult => {
  // No requirement means anyone can register
  if (!ageRequirement) {
    return {
      isValid: true,
      age: 0,
      message: 'No age requirement',
    };
  }

  // No birth date provided
  if (!birthDateString) {
    return {
      isValid: false,
      age: 0,
      message: 'Birth date required to verify age eligibility',
      requirement: formatAgeRequirement(ageRequirement),
    };
  }

  // Parse birth date
  let birthDate: Date;
  try {
    // Handle different date formats
    if (birthDateString.includes('/')) {
      // MM/DD/YYYY format
      const parts = birthDateString.split('/');
      birthDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    } else {
      // YYYY-MM-DD or ISO format
      birthDate = new Date(birthDateString);
    }
    
    if (isNaN(birthDate.getTime())) {
      throw new Error('Invalid date');
    }
  } catch {
    return {
      isValid: false,
      age: 0,
      message: 'Invalid birth date format',
      requirement: formatAgeRequirement(ageRequirement),
    };
  }

  // Get the "as of" date
  const asOfDate = ageRequirement.asOfDate?.toDate 
    ? ageRequirement.asOfDate.toDate() 
    : new Date(ageRequirement.asOfDate as any);

  // Calculate age as of the specified date
  const age = calculateAge(birthDate, asOfDate);
  const requirement = formatAgeRequirement(ageRequirement);

  // Validate based on requirement type
  switch (ageRequirement.type) {
    case 'under':
      if (age >= (ageRequirement.maxAge || 0)) {
        return {
          isValid: false,
          age,
          message: `Athlete is ${age} years old but must be under ${ageRequirement.maxAge}`,
          requirement,
        };
      }
      break;

    case 'over':
      if (age < (ageRequirement.minAge || 0)) {
        return {
          isValid: false,
          age,
          message: `Athlete is ${age} years old but must be ${ageRequirement.minAge} or older`,
          requirement,
        };
      }
      break;

    case 'between':
      if (age < (ageRequirement.minAge || 0) || age > (ageRequirement.maxAge || 999)) {
        return {
          isValid: false,
          age,
          message: `Athlete is ${age} years old but must be between ${ageRequirement.minAge} and ${ageRequirement.maxAge}`,
          requirement,
        };
      }
      break;
  }

  return {
    isValid: true,
    age,
    message: `Eligible (${age} years old)`,
    requirement,
  };
};

/**
 * Get a simple age label for display
 * @param birthDateString - Birth date string
 * @returns Age string like "Age 12" or "Age unknown"
 */
export const getAgeLabel = (birthDateString: string | undefined): string => {
  if (!birthDateString) return 'Age unknown';
  
  try {
    let birthDate: Date;
    if (birthDateString.includes('/')) {
      const parts = birthDateString.split('/');
      birthDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    } else {
      birthDate = new Date(birthDateString);
    }
    
    if (isNaN(birthDate.getTime())) return 'Age unknown';
    
    const age = calculateAge(birthDate);
    return `Age ${age}`;
  } catch {
    return 'Age unknown';
  }
};
