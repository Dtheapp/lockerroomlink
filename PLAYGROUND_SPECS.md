# 🎮 THE PLAYGROUND - Technical Specification

**Created:** December 11, 2025  
**Status:** APPROVED - Ready for Development  
**Priority:** P0 - Game Changer Feature  
**Estimated Build Time:** 14 weeks (phased)

---

## 📋 Executive Summary

The Playground is a youth-safe social communication platform within OSYS that enables:
1. **Voice/Video Calls** - 1-on-1 calls between team members
2. **Playground Rooms** - Group video hangouts (Zoom-style)
3. **Virtual Film Room** - Coach-led video review sessions
4. **AI Tutor (Coach Brain)** - Educational AI companion
5. **Parent Safety Dashboard** - Full visibility and controls

**Key Differentiator:** Only platform where kids WANT to be and parents ALLOW them to be.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        OSYS PLAYGROUND                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   WebRTC    │  │   Firebase  │  │   OpenAI    │             │
│  │   (Calls)   │  │  (Signaling │  │  (AI Tutor) │             │
│  │             │  │   + Data)   │  │             │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────┐             │
│  │              React Components                  │             │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────┐ │             │
│  │  │ VideoCall│ │Playground│ │FilmRoom │ │Tutor│ │             │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────┘ │             │
│  └───────────────────────────────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────┐             │
│  │           Safety & Parental Controls           │             │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │             │
│  │  │CallLogs │ │TimeLimit│ │Moderation│         │             │
│  │  └─────────┘ └─────────┘ └─────────┘         │             │
│  └───────────────────────────────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Technology Stack

### Core Dependencies

```json
{
  "dependencies": {
    "simple-peer": "^9.11.1",          // WebRTC wrapper
    "socket.io-client": "^4.7.2",       // Real-time signaling (or use Firebase)
    "openai": "^4.20.0",                // AI Tutor
    "@daily-co/daily-js": "^0.45.0",    // For larger rooms (optional)
    "bad-words": "^3.0.4",              // Profanity filter for chat
    "date-fns": "^2.30.0"               // Time restrictions
  }
}
```

### Firebase Collections (New)

```typescript
// Firestore Schema

// Call history for safety logging
interface CallLog {
  id: string;
  type: 'voice' | 'video' | 'playground' | 'filmroom';
  participants: string[];           // User IDs
  participantNames: string[];       // Display names
  teamId: string;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  duration?: number;                // seconds
  initiatedBy: string;              // User ID who started
  status: 'active' | 'ended' | 'missed';
}

// Playground room state
interface PlaygroundRoom {
  id: string;
  teamId: string;
  name: string;
  type: 'hangout' | 'filmroom' | 'studyhall' | 'coaching';
  hostId: string;
  hostName: string;
  participants: {
    odLqEfGd]: string;                // odLqEfGd] -> odLqEfGd]Name
  };
  maxParticipants: number;
  isLive: boolean;
  startedAt: Timestamp;
  // Film room specific
  sharedVideoUrl?: string;
  sharedScreenUserId?: string;
  // Settings
  muteOnJoin: boolean;
  allowChat: boolean;
  createdAt: Timestamp;
}

// AI Tutor sessions
interface TutorSession {
  id: string;
  odLqEfGd]: string;
  odLqEfGd]Name: string;
  mode: 'school' | 'sports' | 'life' | 'goals';
  subject?: string;                 // e.g., "math", "english"
  topic?: string;                   // e.g., "quadratic equations"
  messages: TutorMessage[];
  startedAt: Timestamp;
  endedAt?: Timestamp;
  tokensUsed: number;
  parentVisible: boolean;           // Always true for safety
}

interface TutorMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp;
}

// Parental controls
interface ParentalControls {
  odLqEfGd]: string;                  // Parent's odLqEfGd]
  playerId: string;                 // Child's player ID
  settings: {
    callsEnabled: boolean;
    callHoursStart: string;         // "16:00" (4 PM)
    callHoursEnd: string;           // "21:00" (9 PM)
    playgroundEnabled: boolean;
    playgroundHoursStart: string;
    playgroundHoursEnd: string;
    aiTutorEnabled: boolean;
    blockedUsers: string[];         // User IDs blocked
    notifyOnAllCalls: boolean;
    notifyOnFlaggedContent: boolean;
  };
  updatedAt: Timestamp;
}
```

---

## 🔧 Phase 1: Voice/Video Calls (3 weeks)

### 1.1 Data Flow

```
┌─────────┐         ┌──────────┐         ┌─────────┐
│ Caller  │         │ Firebase │         │ Callee  │
│         │         │ Signaling│         │         │
└────┬────┘         └────┬─────┘         └────┬────┘
     │                   │                    │
     │ 1. Create offer   │                    │
     │ ─────────────────>│                    │
     │                   │ 2. Notify callee   │
     │                   │ ──────────────────>│
     │                   │                    │
     │                   │ 3. Accept/Reject   │
     │                   │ <──────────────────│
     │                   │                    │
     │ 4. Exchange ICE   │                    │
     │ <────────────────>│<──────────────────>│
     │                   │                    │
     │ 5. P2P Connection │                    │
     │ <═══════════════════════════════════>  │
     │    (Direct WebRTC - no server)         │
```

### 1.2 Components

```typescript
// src/components/playground/VideoCall.tsx

import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { db } from '../../services/firebase';
import { doc, setDoc, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore';

interface VideoCallProps {
  odLqEfGd]: string;
  odLqEfGd]Name: string;
  recipientId: string;
  recipientName: string;
  teamId: string;
  isVideo: boolean;               // true = video, false = voice only
  onEnd: () => void;
}

export const VideoCall: React.FC<VideoCallProps> = ({
  odLqEfGd],
  odLqEfGd]Name,
  recipientId,
  recipientName,
  teamId,
  isVideo,
  onEnd
}) => {
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(!isVideo);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const callDocId = [odLqEfGd], recipientId].sort().join('_');
  
  useEffect(() => {
    initializeCall();
    return () => cleanup();
  }, []);
  
  const initializeCall = async () => {
    // Get local media stream
    const stream = await navigator.mediaDevices.getUserMedia({
      video: isVideo,
      audio: true
    });
    
    streamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    
    // Create signaling document
    const callDoc = doc(db, 'calls', callDocId);
    
    // Initialize peer as caller
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream
    });
    
    peer.on('signal', async (data) => {
      await setDoc(callDoc, {
        offer: JSON.stringify(data),
        callerId: odLqEfGd],
        callerName: odLqEfGd]Name,
        recipientId,
        recipientName,
        teamId,
        isVideo,
        status: 'ringing',
        createdAt: serverTimestamp()
      });
    });
    
    peer.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      setCallStatus('connected');
      logCallStart();
    });
    
    peer.on('close', () => {
      setCallStatus('ended');
      onEnd();
    });
    
    peerRef.current = peer;
    
    // Listen for answer
    const unsubscribe = onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && peerRef.current) {
        peerRef.current.signal(JSON.parse(data.answer));
      }
    });
    
    return unsubscribe;
  };
  
  const logCallStart = async () => {
    // Log to callLogs collection for parent visibility
    await setDoc(doc(db, 'callLogs', `${callDocId}_${Date.now()}`), {
      type: isVideo ? 'video' : 'voice',
      participants: [odLqEfGd], recipientId],
      participantNames: [odLqEfGd]Name, recipientName],
      teamId,
      startedAt: serverTimestamp(),
      status: 'active',
      initiatedBy: odLqEfGd]
    });
  };
  
  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  const toggleCamera = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };
  
  const endCall = async () => {
    cleanup();
    await deleteDoc(doc(db, 'calls', callDocId));
    onEnd();
  };
  
  const cleanup = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Video displays */}
      <div className="flex-1 relative">
        {/* Remote video (large) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local video (small overlay) */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-4 right-4 w-32 h-24 object-cover rounded-xl border-2 border-white/20"
        />
        
        {/* Call status */}
        {callStatus === 'calling' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📞</span>
              </div>
              <h2 className="text-xl font-bold text-white">Calling {recipientName}...</h2>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="p-6 flex justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center ${
            isMuted ? 'bg-red-500' : 'bg-white/10'
          }`}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>
        
        {isVideo && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isCameraOff ? 'bg-red-500' : 'bg-white/10'
            }`}
          >
            {isCameraOff ? '📷' : '📹'}
          </button>
        )}
        
        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center"
        >
          📴
        </button>
      </div>
    </div>
  );
};
```

### 1.3 Incoming Call Handler

```typescript
// src/components/playground/IncomingCall.tsx

interface IncomingCallProps {
  callerId: string;
  callerName: string;
  isVideo: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCall: React.FC<IncomingCallProps> = ({
  callerId,
  callerName,
  isVideo,
  onAccept,
  onReject
}) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-32 h-32 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <span className="text-6xl">{isVideo ? '📹' : '📞'}</span>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
          {callerName}
        </h2>
        <p className="text-slate-400 mb-8">
          Incoming {isVideo ? 'video' : 'voice'} call...
        </p>
        
        <div className="flex justify-center gap-6">
          <button
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-2xl"
          >
            ❌
          </button>
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-2xl animate-bounce"
          >
            ✅
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 1.4 Call Service

```typescript
// src/services/playgroundService.ts

import { db } from './firebase';
import { 
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, Timestamp 
} from 'firebase/firestore';

// ============================================================================
// CALL FUNCTIONS
// ============================================================================

/**
 * Check if user can make calls (parental controls)
 */
export const canMakeCalls = async (
  parentId: string, 
  playerId: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const controlsDoc = await getDoc(doc(db, 'parentalControls', `${parentId}_${playerId}`));
  
  if (!controlsDoc.exists()) {
    return { allowed: true }; // No restrictions set
  }
  
  const controls = controlsDoc.data();
  
  if (!controls.settings.callsEnabled) {
    return { allowed: false, reason: 'Calls are disabled by parent' };
  }
  
  // Check time restrictions
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const { callHoursStart, callHoursEnd } = controls.settings;
  
  if (callHoursStart && callHoursEnd) {
    if (currentTime < callHoursStart || currentTime > callHoursEnd) {
      return { 
        allowed: false, 
        reason: `Calls are only allowed between ${callHoursStart} and ${callHoursEnd}` 
      };
    }
  }
  
  return { allowed: true };
};

/**
 * Check if recipient is blocked
 */
export const isUserBlocked = async (
  parentId: string,
  playerId: string,
  targetUserId: string
): Promise<boolean> => {
  const controlsDoc = await getDoc(doc(db, 'parentalControls', `${parentId}_${playerId}`));
  
  if (!controlsDoc.exists()) return false;
  
  const blockedUsers = controlsDoc.data().settings.blockedUsers || [];
  return blockedUsers.includes(targetUserId);
};

/**
 * Log call to history
 */
export const logCall = async (callData: {
  type: 'voice' | 'video' | 'playground' | 'filmroom';
  participants: string[];
  participantNames: string[];
  teamId: string;
  initiatedBy: string;
}): Promise<string> => {
  const id = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await setDoc(doc(db, 'callLogs', id), {
    ...callData,
    id,
    startedAt: serverTimestamp(),
    status: 'active'
  });
  
  return id;
};

/**
 * End call and update log
 */
export const endCallLog = async (callLogId: string): Promise<void> => {
  const callDoc = doc(db, 'callLogs', callLogId);
  const snapshot = await getDoc(callDoc);
  
  if (snapshot.exists()) {
    const startedAt = snapshot.data().startedAt?.toDate();
    const duration = startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0;
    
    await updateDoc(callDoc, {
      endedAt: serverTimestamp(),
      duration,
      status: 'ended'
    });
  }
};

/**
 * Get call history for parent dashboard
 */
export const getCallHistory = async (
  playerId: string,
  days: number = 7
): Promise<any[]> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const q = query(
    collection(db, 'callLogs'),
    where('participants', 'array-contains', playerId),
    where('startedAt', '>=', Timestamp.fromDate(cutoff)),
    orderBy('startedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```

---

## 🔧 Phase 2: Parent Safety Dashboard (1 week)

### 2.1 Parent Controls Component

```typescript
// src/components/playground/ParentControlsPanel.tsx

import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { GlassCard, Button } from '../ui/OSYSComponents';
import { OSYSInput } from '../ui/OSYSFormElements';
import { Shield, Phone, Clock, Users, Bell, Eye } from 'lucide-react';

interface ParentControlsPanelProps {
  playerId: string;
  playerName: string;
}

export const ParentControlsPanel: React.FC<ParentControlsPanelProps> = ({
  playerId,
  playerName
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    callsEnabled: true,
    callHoursStart: '16:00',
    callHoursEnd: '21:00',
    playgroundEnabled: true,
    playgroundHoursStart: '15:00',
    playgroundHoursEnd: '21:00',
    aiTutorEnabled: true,
    blockedUsers: [] as string[],
    notifyOnAllCalls: false,
    notifyOnFlaggedContent: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [playerId]);

  const loadSettings = async () => {
    if (!user) return;
    
    const docRef = doc(db, 'parentalControls', `${user.uid}_${playerId}`);
    const snapshot = await getDoc(docRef);
    
    if (snapshot.exists()) {
      setSettings(snapshot.data().settings);
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    await setDoc(doc(db, 'parentalControls', `${user.uid}_${playerId}`), {
      odLqEfGd]: user.uid,
      playerId,
      settings,
      updatedAt: serverTimestamp()
    });
    setSaving(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-bold text-white">
          Safety Controls for {playerName}
        </h2>
      </div>

      {/* Voice/Video Calls */}
      <div className="space-y-6">
        <div className="p-4 bg-white/5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-400" />
              <span className="font-medium text-white">Voice/Video Calls</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.callsEnabled}
                onChange={(e) => setSettings({ ...settings, callsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-checked:bg-purple-500 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
          
          {settings.callsEnabled && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm text-slate-400 mb-1 block">Start Time</label>
                <input
                  type="time"
                  value={settings.callHoursStart}
                  onChange={(e) => setSettings({ ...settings, callHoursStart: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-slate-400 mb-1 block">End Time</label>
                <input
                  type="time"
                  value={settings.callHoursEnd}
                  onChange={(e) => setSettings({ ...settings, callHoursEnd: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Playground */}
        <div className="p-4 bg-white/5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span className="font-medium text-white">Playground Rooms</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.playgroundEnabled}
                onChange={(e) => setSettings({ ...settings, playgroundEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-checked:bg-purple-500 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
        </div>

        {/* AI Tutor */}
        <div className="p-4 bg-white/5 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧠</span>
              <span className="font-medium text-white">AI Tutor (Coach Brain)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.aiTutorEnabled}
                onChange={(e) => setSettings({ ...settings, aiTutorEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-checked:bg-purple-500 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div className="p-4 bg-white/5 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-purple-400" />
            <span className="font-medium text-white">Notifications</span>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.notifyOnAllCalls}
                onChange={(e) => setSettings({ ...settings, notifyOnAllCalls: e.target.checked })}
                className="w-4 h-4 rounded bg-white/10 border-white/20"
              />
              <span className="text-slate-300">Notify me on all calls</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.notifyOnFlaggedContent}
                onChange={(e) => setSettings({ ...settings, notifyOnFlaggedContent: e.target.checked })}
                className="w-4 h-4 rounded bg-white/10 border-white/20"
              />
              <span className="text-slate-300">Notify me on flagged content</span>
            </label>
          </div>
        </div>

        <Button variant="primary" onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </GlassCard>
  );
};
```

---

## 🔧 Phase 3: AI Tutor (2 weeks)

### 3.1 Tutor Service

```typescript
// src/services/tutorService.ts

import OpenAI from 'openai';
import { db } from './firebase';
import { doc, setDoc, updateDoc, arrayUnion, serverTimestamp, increment } from 'firebase/firestore';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true  // For client-side (move to Cloud Function for production)
});

// System prompts for different modes
const SYSTEM_PROMPTS = {
  school: `You are Coach Brain, a friendly AI tutor for youth athletes. You help with school subjects while relating concepts to sports when possible. 
  
Rules:
- Be encouraging and supportive
- Break down complex topics into simple steps
- Use sports analogies when helpful
- Keep responses concise (under 200 words)
- If asked about inappropriate topics, redirect to learning
- Never share personal information or give medical/legal advice`,

  sports: `You are Coach Brain, an expert on youth sports. You help young athletes understand plays, rules, strategy, and how to improve their game.

Rules:
- Be positive and motivating
- Explain strategies simply
- Encourage practice and teamwork
- Focus on fundamentals
- Promote good sportsmanship`,

  life: `You are Coach Brain, a supportive mentor for young athletes. You help with confidence, teamwork, handling pressure, and life skills.

Rules:
- Be warm and understanding
- Listen before advising
- Encourage talking to parents/coaches about serious issues
- Promote positive self-talk
- Never diagnose or treat mental health issues
- If concerning content detected, recommend talking to a trusted adult`,

  goals: `You are Coach Brain, a goal-setting coach for young athletes. You help set goals, create action plans, and build good habits.

Rules:
- Help set SMART goals
- Break big goals into small steps
- Celebrate progress
- Encourage consistency
- Track habits and progress`
};

interface TutorResponse {
  message: string;
  tokensUsed: number;
}

/**
 * Get AI tutor response
 */
export const getTutorResponse = async (
  sessionId: string,
  odLqEfGd]: string,
  mode: 'school' | 'sports' | 'life' | 'goals',
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<TutorResponse> => {
  // Build messages array
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPTS[mode] },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: userMessage }
  ];

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages,
    max_tokens: 500,
    temperature: 0.7
  });

  const assistantMessage = completion.choices[0].message.content || 'I\'m having trouble thinking right now. Try again?';
  const tokensUsed = completion.usage?.total_tokens || 0;

  // Save to session
  const sessionRef = doc(db, 'tutorSessions', sessionId);
  await updateDoc(sessionRef, {
    messages: arrayUnion(
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
    ),
    tokensUsed: increment(tokensUsed),
    updatedAt: serverTimestamp()
  });

  return {
    message: assistantMessage,
    tokensUsed
  };
};

/**
 * Create new tutor session
 */
export const createTutorSession = async (
  odLqEfGd]: string,
  odLqEfGd]Name: string,
  mode: 'school' | 'sports' | 'life' | 'goals'
): Promise<string> => {
  const id = `tutor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await setDoc(doc(db, 'tutorSessions', id), {
    id,
    odLqEfGd],
    odLqEfGd]Name,
    mode,
    messages: [],
    startedAt: serverTimestamp(),
    tokensUsed: 0,
    parentVisible: true
  });
  
  return id;
};

/**
 * Check for concerning content
 */
export const checkForConcerningContent = (message: string): boolean => {
  const concerningKeywords = [
    'suicide', 'kill myself', 'self harm', 'hurt myself',
    'abuse', 'hitting me', 'scared of', 'help me'
  ];
  
  const lowerMessage = message.toLowerCase();
  return concerningKeywords.some(keyword => lowerMessage.includes(keyword));
};

/**
 * Alert parent/coach if concerning content detected
 */
export const alertTrustedAdult = async (
  playerId: string,
  playerName: string,
  concerningMessage: string,
  parentId: string
): Promise<void> => {
  // Log alert
  await setDoc(doc(db, 'tutorAlerts', `${playerId}_${Date.now()}`), {
    playerId,
    playerName,
    concerningMessage,
    parentId,
    createdAt: serverTimestamp(),
    reviewed: false
  });
  
  // TODO: Send push notification to parent
  // TODO: Send email to parent
};
```

### 3.2 Tutor UI Component

```typescript
// src/components/playground/AITutor.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GlassCard, Button, Badge } from '../ui/OSYSComponents';
import { 
  createTutorSession, 
  getTutorResponse, 
  checkForConcerningContent,
  alertTrustedAdult 
} from '../../services/tutorService';
import { Send, BookOpen, Trophy, Heart, Target, Loader2 } from 'lucide-react';

type TutorMode = 'school' | 'sports' | 'life' | 'goals';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AITutor: React.FC = () => {
  const { user, userData } = useAuth();
  const [mode, setMode] = useState<TutorMode>('school');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const modes = [
    { id: 'school' as TutorMode, icon: BookOpen, label: 'School', color: 'text-blue-400' },
    { id: 'sports' as TutorMode, icon: Trophy, label: 'Sports', color: 'text-amber-400' },
    { id: 'life' as TutorMode, icon: Heart, label: 'Life', color: 'text-pink-400' },
    { id: 'goals' as TutorMode, icon: Target, label: 'Goals', color: 'text-emerald-400' },
  ];

  useEffect(() => {
    startNewSession();
  }, [mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewSession = async () => {
    if (!user || !userData) return;
    const id = await createTutorSession(user.uid, userData.displayName || 'Athlete', mode);
    setSessionId(id);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId || !user || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // Check for concerning content
    if (checkForConcerningContent(userMessage)) {
      // Alert parent (in real app, get parentId from player record)
      await alertTrustedAdult(
        user.uid,
        userData?.displayName || 'Athlete',
        userMessage,
        userData?.parentId || ''
      );
      
      // Still respond, but include supportive message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I hear you, and I want you to know that's really important. Please talk to a parent, coach, or trusted adult about this. They care about you and want to help. You can also call or text 988 to talk to someone right now. I'm here for lighter questions, but real people are the best help for big stuff like this. 💙"
      }]);
      setLoading(false);
      return;
    }

    try {
      const response = await getTutorResponse(
        sessionId,
        user.uid,
        mode,
        userMessage,
        messages
      );
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
    } catch (error) {
      console.error('Tutor error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Oops! My brain glitched. Try asking again?" 
      }]);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center">
            <span className="text-2xl">🧠</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Coach Brain</h2>
            <p className="text-sm text-slate-400">Your AI Teammate</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2">
          {modes.map(({ id, icon: Icon, label, color }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                mode === id 
                  ? 'bg-purple-500/20 border border-purple-500/50' 
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={mode === id ? 'text-white' : 'text-slate-400'}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🧠</span>
            <h3 className="text-lg font-medium text-white mb-2">
              Hey! I'm Coach Brain
            </h3>
            <p className="text-slate-400 max-w-md mx-auto">
              {mode === 'school' && "Need help with homework? I'll explain it like a play!"}
              {mode === 'sports' && "Want to understand plays or improve your game? Let's go!"}
              {mode === 'life' && "Feeling stressed or need advice? I'm here to listen."}
              {mode === 'goals' && "Ready to set some goals and crush them? Let's plan!"}
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-purple-500 text-white rounded-br-md'
                  : 'bg-white/10 text-white rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 p-4 rounded-2xl rounded-bl-md">
              <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask Coach Brain anything..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          <Button variant="primary" onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
```

---

## 🔧 Phase 4: Playground Rooms (4 weeks)

### 4.1 Multi-Peer Architecture

For rooms with 2-6 people: **Mesh topology** (each peer connects to all others)
For rooms with 6+ people: **SFU via Daily.co or Agora**

```typescript
// src/services/playgroundRoomService.ts

// Room management functions
export const createPlaygroundRoom = async (
  teamId: string,
  hostId: string,
  hostName: string,
  type: 'hangout' | 'filmroom' | 'studyhall' | 'coaching',
  name?: string
): Promise<string> => {
  const id = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await setDoc(doc(db, 'playgroundRooms', id), {
    id,
    teamId,
    name: name || `${hostName}'s Room`,
    type,
    hostId,
    hostName,
    participants: { [hostId]: hostName },
    maxParticipants: type === 'coaching' ? 2 : 12,
    isLive: true,
    startedAt: serverTimestamp(),
    muteOnJoin: type === 'filmroom',
    allowChat: true,
    createdAt: serverTimestamp()
  });
  
  return id;
};

export const joinRoom = async (roomId: string, odLqEfGd]: string, odLqEfGd]Name: string) => {
  const roomRef = doc(db, 'playgroundRooms', roomId);
  await updateDoc(roomRef, {
    [`participants.${odLqEfGd]}`]: odLqEfGd]Name
  });
};

export const leaveRoom = async (roomId: string, odLqEfGd]: string) => {
  const roomRef = doc(db, 'playgroundRooms', roomId);
  await updateDoc(roomRef, {
    [`participants.${odLqEfGd]}`]: deleteField()
  });
};
```

---

## 📊 Firestore Security Rules (New)

```javascript
// Add to firestore.rules

// Call logs - only participants and their parents can read
match /callLogs/{callId} {
  allow read: if request.auth != null && (
    request.auth.uid in resource.data.participants ||
    isParentOf(request.auth.uid, resource.data.participants)
  );
  allow create: if request.auth != null;
  allow update: if request.auth != null && 
    request.auth.uid in resource.data.participants;
}

// Playground rooms - team members only
match /playgroundRooms/{roomId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null && 
    request.auth.uid == resource.data.hostId;
}

// Tutor sessions - user and their parents only
match /tutorSessions/{sessionId} {
  allow read: if request.auth != null && (
    request.auth.uid == resource.data.odLqEfGd] ||
    isParentOf(request.auth.uid, resource.data.odLqEfGd])
  );
  allow create: if request.auth != null;
  allow update: if request.auth != null && 
    request.auth.uid == resource.data.odLqEfGd];
}

// Parental controls - parent only
match /parentalControls/{controlId} {
  allow read, write: if request.auth != null && 
    request.auth.uid == resource.data.odLqEfGd];
}

// Tutor alerts - parent and admins
match /tutorAlerts/{alertId} {
  allow read: if request.auth != null && (
    request.auth.uid == resource.data.parentId ||
    isAdmin(request.auth.uid)
  );
  allow create: if request.auth != null;
  allow update: if request.auth != null && 
    request.auth.uid == resource.data.parentId;
}
```

---

## 📅 Implementation Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1-2 | Voice Calls | WebRTC setup, 1-on-1 calls working |
| 3 | Call Polish | Incoming call UI, call logs, error handling |
| 4 | Parent Dashboard | Safety controls, call history view |
| 5-6 | AI Tutor | OpenAI integration, 4 modes working |
| 7 | Tutor Polish | Concerning content detection, alerts |
| 8-10 | Playground Rooms | Multi-peer rooms, chat, reactions |
| 11-12 | Film Room | Screen sharing, telestrator basics |
| 13-14 | Polish & Test | Bug fixes, performance, UX refinement |

---

## 🚀 MVP Definition

**MVP (Week 6):**
- ✅ 1-on-1 voice/video calls
- ✅ Call logging for parents
- ✅ Basic parental controls (on/off, hours)
- ✅ AI Tutor with school mode

**Full Release (Week 14):**
- ✅ All call features
- ✅ Full parental dashboard
- ✅ Playground rooms
- ✅ Film room with screen share
- ✅ AI Tutor all modes
- ✅ Games and reactions

---

*Last Updated: December 11, 2025*
*Author: AI Assistant + FEGROX*
