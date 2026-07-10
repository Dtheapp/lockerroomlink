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

/**
 * Calculate the youth sports age group (e.g., "5U", "8U", "14U") based on birthday.
 *
 * Uses the standard birth-year method: age group = seasonYear - birthYear
 * (the age the child turns during the season year). No month adjustment —
 * every child born in the same year is in the same age group.
 *
 * Examples for the 2026 season:
 * - Born anytime in 2015: 2026 - 2015 = 11 → 11U
 * - Born anytime in 2014: 2026 - 2014 = 12 → 12U
 * - Born anytime in 2016: 2026 - 2016 = 10 → 10U
 *
 * The Sept 10 cutoff is only used to decide which season we're registering for:
 * after Sept 10 we roll to next year's season; before, the current year.
 *
 * @param birthDateString - Birth date string (YYYY-MM-DD or MM/DD/YYYY format)
 * @param cutoffMonth - Season-rollover cutoff month (0-11, default 8 = September)
 * @param cutoffDay - Season-rollover cutoff day (default 10 = Sept 10th)
 * @param forYear - Optional specific season year (overrides auto-detection)
 * @returns Age group string like "5U", "8U", "14U" or null if invalid/adult
 */
export const calculateAgeGroup = (
  birthDateString: string | undefined | null,
  cutoffMonth: number = 8, // September (0-indexed)
  cutoffDay: number = 10,
  forYear?: number
): string | null => {
  if (!birthDateString) return null;
  
  try {
    let birthDate: Date;
    
    // Handle different date formats
    if (typeof birthDateString === 'string') {
      if (birthDateString.includes('/')) {
        // MM/DD/YYYY format
        const parts = birthDateString.split('/');
        birthDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      } else {
        // YYYY-MM-DD or ISO format
        birthDate = new Date(birthDateString);
      }
    } else {
      return null;
    }
    
    if (isNaN(birthDate.getTime())) return null;
    
    // Determine the season year
    // If a specific year is provided, use it
    // Otherwise: After Sept 10, we're registering for NEXT year's season
    //            Before Sept 10, we're registering for THIS year's season
    let seasonYear: number;
    if (forYear !== undefined) {
      seasonYear = forYear;
    } else {
      const today = new Date();
      const currentYear = today.getFullYear();
      const cutoffThisYear = new Date(currentYear, cutoffMonth, cutoffDay);
      
      // If we're past the cutoff date, registrations are for next year
      seasonYear = today >= cutoffThisYear ? currentYear + 1 : currentYear;
    }
    
    // Base age group = season year - birth year (birth-year method).
    // This is the standard youth-sports convention: a child's age group is the
    // age they turn during the season year. e.g. season 2026:
    //   born 2014 -> 12U, born 2015 -> 11U, born 2016 -> 10U.
    const birthYear = birthDate.getFullYear();
    let ageGroup = seasonYear - birthYear;
    
    // Return null for adults (18+) - they should select manually
    if (ageGroup >= 18) return null;
    
    // Return null for invalid ages (negative or 0)
    if (ageGroup <= 0) return null;
    
    return `${ageGroup}U`;
  } catch {
    return null;
  }
};

/**
 * Get the age group with a formatted display including the raw age
 * @param birthDateString - Birth date string
 * @returns Object with ageGroup and currentAge, or null values if invalid
 */
export const getAgeGroupInfo = (
  birthDateString: string | undefined | null
): { ageGroup: string | null; currentAge: number | null } => {
  if (!birthDateString) return { ageGroup: null, currentAge: null };
  
  try {
    let birthDate: Date;
    
    if (typeof birthDateString === 'string') {
      if (birthDateString.includes('/')) {
        const parts = birthDateString.split('/');
        birthDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      } else {
        birthDate = new Date(birthDateString);
      }
    } else {
      return { ageGroup: null, currentAge: null };
    }
    
    if (isNaN(birthDate.getTime())) return { ageGroup: null, currentAge: null };
    
    const currentAge = calculateAge(birthDate);
    const ageGroup = calculateAgeGroup(birthDateString);
    
    return { ageGroup, currentAge };
  } catch {
    return { ageGroup: null, currentAge: null };
  }
};
