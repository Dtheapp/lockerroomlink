import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadedFile {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  path: string; // storage path used for the object
}

// Allowed mime types (images and PDFs). Can be extended later.
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default

export async function uploadFile(file: File, path: string, onProgress?: (percent: number) => void): Promise<UploadedFile> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Unsupported file type');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes) {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(percent);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, name: file.name, mimeType: file.type, size: file.size, path });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function deleteFile(path: string): Promise<void> {
  if (!path) return;
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (err) {
    // Bubble up error - caller can decide how to handle (file may already be gone)
    throw err;
  }
}
