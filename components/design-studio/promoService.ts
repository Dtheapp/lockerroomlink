// =============================================================================
// PROMO SERVICE - Save and load promo items to/from Firestore
// =============================================================================

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import type { PromoItem, SavePromoOptions } from './promoTypes';
import type { DesignElement, CanvasState, FlyerSize } from './types';

// Generate a thumbnail from the canvas
export async function generateThumbnail(
  canvas: CanvasState,
  elements: DesignElement[]
): Promise<Blob | null> {
  try {
    const thumbCanvas = document.createElement('canvas');
    const scale = 300 / Math.max(canvas.width, canvas.height);
    thumbCanvas.width = canvas.width * scale;
    thumbCanvas.height = canvas.height * scale;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return null;
    
    // Draw background
    ctx.fillStyle = canvas.backgroundColor;
    ctx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    
    // Draw simple rectangles for elements (thumbnail preview)
    ctx.globalAlpha = 0.6;
    for (const element of elements) {
      if (!element.visible) continue;
      
      ctx.fillStyle = element.backgroundColor || element.color || '#8b5cf6';
      ctx.fillRect(
        element.position.x * scale,
        element.position.y * scale,
        element.size.width * scale,
        element.size.height * scale
      );
    }
    
    return new Promise((resolve) => {
      thumbCanvas.toBlob((blob) => resolve(blob), 'image/png', 0.8);
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}

// Generate high quality export image
export async function generateHighResExport(
  canvas: CanvasState,
  elements: DesignElement[],
  size: FlyerSize
): Promise<Blob | null> {
  try {
    // Dynamic import to avoid circular dependency
    const { exportToImage } = await import('./ExportUtils');
    return await exportToImage(elements, size, 'png', 1, canvas.backgroundColor, 'high');
  } catch (error) {
    console.error('Error generating high-res export:', error);
    return null;
  }
}

// Save a promo item
export async function savePromoItem(
  name: string,
  canvas: CanvasState,
  elements: DesignElement[],
  size: FlyerSize,
  userId: string,
  userName: string,
  userRole: 'Coach' | 'Parent' | 'Fan' | 'Athlete' | 'SuperAdmin' | string,
  options: SavePromoOptions
): Promise<string> {
  const now = Timestamp.now();
  
  // Determine if this is a parent saving to team (for parent tag)
  const isParentSavingToTeam = userRole === 'Parent' && options.location === 'team';
  
  // Generate thumbnail
  const thumbnailBlob = await generateThumbnail(canvas, elements);
  let thumbnailUrl = '';
  let thumbnailPath = '';
  
  // Generate high-res export if requested
  let highResBlob: Blob | null = null;
  let highResUrl = '';
  let highResPath = '';
  
  if (options.exportQuality === 'high') {
    highResBlob = await generateHighResExport(canvas, elements, size);
  }
  
  // Determine collection path based on location
  let collectionPath: string;
  
  switch (options.location) {
    case 'team':
      if (!options.teamId) throw new Error('Team ID required for team promo');
      collectionPath = `teams/${options.teamId}/promoItems`;
      break;
    case 'player':
      if (!options.playerId) throw new Error('Player ID required for player promo');
      collectionPath = `users/${options.playerId}/promoItems`;
      break;
    case 'personal':
    default:
      collectionPath = `users/${userId}/promoItems`;
      break;
  }
  
  // Create the promo item document - only include defined fields
  const promoData: Omit<PromoItem, 'id'> = {
    name,
    canvas,
    elements,
    size,
    createdBy: userId,
    createdByName: userName,
    createdByRole: userRole as PromoItem['createdByRole'],
    createdByParent: isParentSavingToTeam,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
    location: options.location,
    isPublic: options.isPublic,
    isArchived: false,
    category: options.category,
    tags: options.tags,
    exportQuality: options.exportQuality || 'standard',
    // Only include optional fields if they have values
    ...(options.teamId && { teamId: options.teamId }),
    ...(options.playerId && { playerId: options.playerId }),
    ...(options.seasonId && { seasonId: options.seasonId }),
    ...(options.linkedEventId && { linkedEventId: options.linkedEventId }),
    ...(options.linkedEventType && { linkedEventType: options.linkedEventType }),
  };
  
  // Add to Firestore
  const docRef = await addDoc(collection(db, collectionPath), {
    ...promoData,
    createdAt: now,
    updatedAt: now,
  });
  
  // Upload thumbnail if generated
  if (thumbnailBlob) {
    thumbnailPath = `promo-thumbnails/${options.location}/${docRef.id}.png`;
    const storageRef = ref(storage, thumbnailPath);
    await uploadBytes(storageRef, thumbnailBlob);
    thumbnailUrl = await getDownloadURL(storageRef);
    
    // Update document with thumbnail URL
    await updateDoc(doc(db, collectionPath, docRef.id), {
      thumbnailUrl,
      thumbnailPath,
    });
  }
  
  // Upload high-res export if generated (for high quality saves)
  if (highResBlob) {
    highResPath = `promo-exports/${options.location}/${docRef.id}_4K.png`;
    const highResRef = ref(storage, highResPath);
    await uploadBytes(highResRef, highResBlob);
    highResUrl = await getDownloadURL(highResRef);
    
    // Update document with high-res URL
    await updateDoc(doc(db, collectionPath, docRef.id), {
      highResUrl,
      highResPath,
    });
  }
  
  return docRef.id;
}

// Load promo items for a user (personal)
export async function loadUserPromoItems(userId: string): Promise<PromoItem[]> {
  // Don't filter by isArchived in query since it may not exist on all docs
  // Filter in memory instead to handle missing fields
  const q = query(
    collection(db, `users/${userId}/promoItems`),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as PromoItem))
    .filter(item => !item.isArchived); // Filter archived in memory
}

// Load promo items for a team
export async function loadTeamPromoItems(teamId: string): Promise<PromoItem[]> {
  // Don't filter by isArchived in query since it may not exist on all docs
  const q = query(
    collection(db, `teams/${teamId}/promoItems`),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as PromoItem))
    .filter(item => !item.isArchived); // Filter archived in memory
}

// Load public promo items for a player
export async function loadPlayerPublicPromoItems(playerId: string): Promise<PromoItem[]> {
  const q = query(
    collection(db, `users/${playerId}/promoItems`),
    where('isPublic', '==', true),
    where('isArchived', '==', false),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  } as PromoItem));
}

// Update a promo item
export async function updatePromoItem(
  promoId: string,
  collectionPath: string,
  updates: Partial<PromoItem>
): Promise<void> {
  const docRef = doc(db, collectionPath, promoId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

// Delete a promo item
export async function deletePromoItem(
  promoId: string,
  collectionPath: string,
  thumbnailPath?: string
): Promise<void> {
  // Delete thumbnail from storage if exists
  if (thumbnailPath) {
    try {
      await deleteObject(ref(storage, thumbnailPath));
    } catch (error) {
      console.warn('Failed to delete thumbnail:', error);
    }
  }
  
  // Delete document
  await deleteDoc(doc(db, collectionPath, promoId));
}

// Archive all promo items for a season (called when season ends)
export async function archiveSeasonPromoItems(
  teamId: string,
  seasonId: string
): Promise<number> {
  const q = query(
    collection(db, `teams/${teamId}/promoItems`),
    where('seasonId', '==', seasonId),
    where('isArchived', '==', false)
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    batch.update(doc(db, `teams/${teamId}/promoItems`, docSnap.id), {
      isArchived: true,
      archivedAt: Timestamp.now(),
    });
  });
  
  await batch.commit();
  return snapshot.size;
}

// Get a single promo item
export async function getPromoItem(
  promoId: string,
  collectionPath: string
): Promise<PromoItem | null> {
  const docRef = doc(db, collectionPath, promoId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate(),
    updatedAt: docSnap.data().updatedAt?.toDate(),
  } as PromoItem;
}

// Duplicate a promo item
export async function duplicatePromoItem(
  promoId: string,
  sourceCollectionPath: string,
  userId: string,
  userName: string,
  options: SavePromoOptions
): Promise<string> {
  const original = await getPromoItem(promoId, sourceCollectionPath);
  if (!original) throw new Error('Promo item not found');
  
  return savePromoItem(
    `${original.name} (Copy)`,
    original.canvas,
    original.elements,
    original.size,
    userId,
    userName,
    options
  );
}

export default {
  savePromoItem,
  loadUserPromoItems,
  loadTeamPromoItems,
  loadPlayerPublicPromoItems,
  updatePromoItem,
  deletePromoItem,
  archiveSeasonPromoItems,
  getPromoItem,
  duplicatePromoItem,
};
