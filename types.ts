import { Timestamp } from 'firebase/firestore';

export type UserRole = 'Coach' | 'Parent' | 'SuperAdmin';

// --- NEW: Helper Interfaces ---
export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface MedicalInfo {
  allergies: string;
  conditions: string;
  medications: string;
  bloodType: string;
  insuranceProvider?: string;
  insurancePolicy?: string;
}

// --- UPDATED: Main Interfaces ---

export interface UserProfile {
  uid: string;
  name: string;
  role: UserRole;
  teamId: string | null;
  email?: string;
  username?: string;
  
  // Contact Details
  phone?: string;          // Mobile (Mandatory)
  secondaryPhone?: string; // Home/Work (Optional)
  address?: string;        // Home Address
  
  // Emergency
  emergencyContact?: EmergencyContact;
  
  photoUrl?: string;
}

export interface Team {
  id: string;
  name: string;
  coachId: string | null;
}

export interface Player {
  id: string;
  name: string;
  number: number; // Jersey Number
  position: string;
  
  // Link to Parent
  parentId?: string; 
  
  // Personal & Medical
  dob?: string;
  medical?: MedicalInfo; // <--- The Critical Safety Data

  // Game Stats
  stats: {
    td: number;
    tkl: number;
  };
}

export interface Message {
  id: string;
  text: string;
  sender: {
    uid: string;
    name: string;
  };
  timestamp: Timestamp;
}

export interface BulletinPost {
  id: string;
  text: string;
  author: string;
  authorId?: string;
  timestamp: Timestamp;
}

export interface Marker {
  id: string;
  x: number;
  y: number;
  type: 'X' | 'O';
}

export interface Play {
  id: string;
  name: string;
  markers: Marker[];
}

export interface Video {
  id: string;
  title: string;
  url: string;
  youtubeId: string;
}
// ... (Keep existing interfaces)

// --- NEW: Private Messaging ---
export interface PrivateChat {
  id: string;
  participants: string[]; // Array of UIDs [uid1, uid2]
  participantData: {      // Snapshot of names for display
    [uid: string]: {
      username: string;
      role: string;
    }
  };
  lastMessage: string;
  lastMessageTime: Timestamp;
  updatedAt: any; // serverTimestamp
}

export interface PrivateMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: Timestamp;
}