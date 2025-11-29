
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Marker, Play } from '../types';
import { Save, Trash2, RotateCcw, Download } from 'lucide-react';

const Playbook: React.FC = () => {
  const { teamData } = useAuth();
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [markerType, setMarkerType] = useState<'X' | 'O'>('X');
  const [playName, setPlayName] = useState('New Play');
  const [savedPlays, setSavedPlays] = useState<Play[]>([]);
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teamData?.id) return;
    const playsCollection = collection(db, 'teams', teamData.id, 'plays');
    const unsubscribe = onSnapshot(playsCollection, (snapshot) => {
      const playsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Play));
      setSavedPlays(playsData);
    });
    return () => unsubscribe();
  }, [teamData?.id]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newMarker: Marker = { id: Date.now().toString(), x, y, type: markerType };
    setMarkers([...markers, newMarker]);
  };

  const handleSavePlay = async () => {
    if (!teamData?.id || !playName.trim()) return;
    const playData = { name: playName, markers };
    try {
      if (selectedPlayId) {
        await setDoc(doc(db, 'teams', teamData.id, 'plays', selectedPlayId), playData);
      } else {
        const newDoc = await addDoc(collection(db, 'teams', teamData.id, 'plays'), playData);
        setSelectedPlayId(newDoc.id);
      }
      alert('Play saved!');
    } catch (error) {
      console.error("Error saving play:", error);
    }
  };
  
  const handleLoadPlay = (play: Play) => {
    setPlayName(play.name);
    setMarkers(play.markers);
    setSelectedPlayId(play.id);
  };

  const clearBoard = () => {
    setMarkers([]);
    setPlayName('New Play');
    setSelectedPlayId(null);
  };
  
  const handleDeletePlay = async (playId: string) => {
    if (!teamData?.id || !window.confirm("Delete this play?")) return;
    try {
        await deleteDoc(doc(db, 'teams', teamData.id, 'plays', playId));
        if (selectedPlayId === playId) {
            clearBoard();
        }
    } catch (error) {
        console.error("Error deleting play:", error);
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-8rem)] md:h-auto">
      <div className="w-full md:w-1/4 bg-white dark:bg-slate-900 p-4 rounded-lg flex flex-col border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Controls</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Play Name</label>
            <input type="text" value={playName} onChange={(e) => setPlayName(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMarkerType('X')} className={`py-2 rounded transition-colors ${markerType === 'X' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-400 dark:hover:bg-slate-600'}`}>Place X</button>
            <button onClick={() => setMarkerType('O')} className={`py-2 rounded transition-colors ${markerType === 'O' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-400 dark:hover:bg-slate-600'}`}>Place O</button>
          </div>
          <button onClick={handleSavePlay} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded transition-colors">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={clearBoard} className="w-full flex items-center justify-center gap-2 bg-slate-400 dark:bg-slate-600 hover:bg-slate-500 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-2 rounded transition-colors">
            <RotateCcw className="w-4 h-4" /> Clear
          </button>
        </div>
        <hr className="border-slate-200 dark:border-slate-700 my-4" />
        <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Saved Plays</h2>
        <div className="flex-1 overflow-y-auto pr-2">
            {savedPlays.map(play => (
                <div key={play.id} className="flex justify-between items-center p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <button onClick={() => handleLoadPlay(play)} className="text-left flex-1 text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-slate-200">{play.name}</button>
                    <button onClick={() => handleDeletePlay(play.id)} className="p-1 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                </div>
            ))}
        </div>
      </div>
      <div className="flex-1 bg-green-800 border-4 border-white relative" ref={canvasRef} onClick={handleCanvasClick} style={{ 
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 2px, transparent 2px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 2px, transparent 2px)
          `,
          backgroundSize: '5% 10%'
       }}>
        {/* Field Markings can be added here as absolute divs */}
        {markers.map(marker => (
          <div key={marker.id}
            style={{ left: `${marker.x}%`, top: `${marker.y}%`, transform: 'translate(-50%, -50%)' }}
            className={`absolute w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold text-white shadow-lg cursor-pointer ${marker.type === 'X' ? 'bg-red-600' : 'bg-blue-600'}`}>
            {marker.type}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Playbook;
