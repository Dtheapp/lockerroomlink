// =============================================================================
// PROMO ITEM TYPES - Saved designs for teams, users, and players
// =============================================================================

import type { DesignElement, CanvasState, FlyerSize } from './types';
import type { ExportQuality } from './ExportUtils';

export type PromoItemLocation = 'personal' | 'team' | 'player';

export interface PromoItem {
  id: string;
  name: string;
  description?: string;
  
  // Design data
  canvas: CanvasState;
  elements: DesignElement[];
  size: FlyerSize;
  
  // Thumbnails for display
  thumbnailUrl?: string; // Generated PNG preview
  thumbnailPath?: string; // Storage path
  
  // High quality export (for print)
  highResUrl?: string; // Full resolution image URL
  highResPath?: string; // Storage path for high-res
  exportQuality?: ExportQuality; // Quality level saved
  
  // Ownership
  createdBy: string; // User ID who created it
  createdByName: string; // User's display name
  createdAt: Date;
  updatedAt: Date;
  
  // Location - where it's saved
  location: PromoItemLocation;
  teamId?: string; // If saved to team
  playerId?: string; // If saved to player's public promo
  seasonId?: string; // Link to season (for team items, auto-delete with season)
  
  // Linking to events/registrations
  linkedEventId?: string;
  linkedEventType?: 'registration' | 'game' | 'event' | 'fundraiser';
  
  // Status
  isPublic: boolean; // Visible on public pages
  isArchived: boolean;
  
  // Metadata
  tags?: string[];
  category?: 'flyer' | 'poster' | 'social' | 'banner' | 'story';
}

// For the save dialog options
export interface SavePromoOptions {
  location: PromoItemLocation;
  teamId?: string;
  playerId?: string;
  playerName?: string;
  seasonId?: string;
  linkedEventId?: string;
  linkedEventType?: 'registration' | 'game' | 'event' | 'fundraiser';
  isPublic: boolean;
  category?: 'flyer' | 'poster' | 'social' | 'banner' | 'story';
  tags?: string[];
  // Export quality option
  exportQuality?: ExportQuality; // 'standard' (free) or 'high' (costs credits)
}

// Player option for parent saving to player profile
export interface PlayerOption {
  id: string;
  name: string;
  photoUrl?: string;
  teamId: string;
  teamName: string;
}

// Team option for coaches
export interface TeamOption {
  id: string;
  name: string;
  logoUrl?: string;
  sport?: string;
}

export default PromoItem;
