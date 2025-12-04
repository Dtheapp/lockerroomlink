import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { EventAttachment } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Helper to determine file type
const getFileType = (contentType: string): 'image' | 'pdf' | 'document' => {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  return 'document';
};

// Upload event attachment
export const uploadEventAttachment = async (
  teamId: string,
  eventId: string,
  file: File,
  uploadedBy: string
): Promise<EventAttachment> => {
  const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fileExtension = file.name.split('.').pop();
  const storagePath = `teams/${teamId}/events/${eventId}/${fileId}.${fileExtension}`;
  
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return {
    id: fileId,
    name: file.name,
    url,
    type: getFileType(file.type),
    contentType: file.type,
    size: file.size,
    uploadedAt: new Date(),
    uploadedBy
  };
};

// Delete event attachment
export const deleteEventAttachment = async (
  teamId: string,
  eventId: string,
  attachment: EventAttachment
): Promise<void> => {
  const fileExtension = attachment.name.split('.').pop();
  const storagePath = `teams/${teamId}/events/${eventId}/${attachment.id}.${fileExtension}`;
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
};

export { auth, db, storage };