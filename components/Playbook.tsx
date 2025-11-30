import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, doc, setDoc, onSnapshot, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Play, PlayElement, PlayRoute } from '../types';
import { Save, Trash2, MousePointer2, Eraser, LayoutGrid, Plus, Route as RouteIcon, Undo2, BookOpen, PenTool, Maximize2, Minimize2, Menu, X } from 'lucide-react';

const ROUTE_COLORS = [
  '#FACC15', '#06b6d4', '#ec4899', '#a3e635', '#f87171', '#ffffff', '#a855f7', '#ea580c', '#3b82f6', '#14b8a6', '#8b5cf6'
];

const Playbook: React.FC = () => {
  const { teamData } = useAuth();
  
  // UI STATE
  const [activeTab, setActiveTab] = useState<'editor' | 'library'>('editor');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);

  // PLAY DATA
  const [playName, setPlayName] = useState('New Play');
  const [category, setCategory] = useState<'Offense' | 'Defense' | 'Special Teams'>('Offense');
  const [elements, setElements] = useState<PlayElement[]>([]);
  const [routes, setRoutes] = useState<PlayRoute[]>([]); 
  
  // SELECTION
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // LIBRARY
  const [savedPlays, setSavedPlays] = useState<Play[]>([]);
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);
  
  // DRAGGING
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ type: 'element' | 'route_point', id: string, index?: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teamData?.id) return;
    const q = query(collection(db, 'teams', teamData.id, 'plays'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Play));
      setSavedPlays(playsData);
    });
    return () => unsubscribe();
  }, [teamData?.id]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setShowToolbar(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  // Auto-fullscreen on landscape orientation (mobile/tablet only)
  useEffect(() => {
    const handleOrientationChange = () => {
      // Only apply to mobile/tablet devices (not desktop)
      const isMobile = window.innerWidth < 1024; // Less than lg breakpoint
      setIsMobileOrTablet(isMobile);
      
      if (!isMobile) return; // Desktop stays normal
      
      // Check if landscape (width > height)
      const isLandscape = window.innerWidth > window.innerHeight;
      
      if (isLandscape) {
        // Landscape → Enter fullscreen
        setIsFullscreen(true);
      } else {
        // Portrait → Exit fullscreen
        setIsFullscreen(false);
        setShowToolbar(false);
      }
    };
    
    // Check on mount
    handleOrientationChange();
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  // --- ACTIONS ---

  const addElement = (type: 'X' | 'O', label: string) => {
      const startX = type === 'O' ? 50 : 50; 
      const startY = type === 'O' ? 60 : 40; 

      const newEl: PlayElement = {
          id: Date.now().toString(),
          type,
          label,
          x: startX + (Math.random() * 5 - 2.5), 
          y: startY + (Math.random() * 5 - 2.5), 
          color: type === 'O' ? 'bg-blue-600' : 'bg-red-600'
      };
      setElements([...elements, newEl]);
      setSelectedElementId(newEl.id);
      setSelectedRouteId(null);
  };

  const handleAddOrExtendRoute = () => {
      if (!selectedElementId) return;
      const el = elements.find(e => e.id === selectedElementId);
      if (!el) return;

      const existingRouteIndex = routes.findIndex(r => r.startElementId === selectedElementId);

      if (existingRouteIndex >= 0) {
          const route = routes[existingRouteIndex];
          const lastPoint = route.points[route.points.length - 1];
          const newPoint = { x: lastPoint.x + 5, y: lastPoint.y - 5 };
          const updatedRoutes = [...routes];
          updatedRoutes[existingRouteIndex] = { ...route, points: [...route.points, newPoint] };
          setRoutes(updatedRoutes);
      } else {
          const colorIndex = routes.length % ROUTE_COLORS.length;
          const newRoute: PlayRoute = {
              id: Date.now().toString(),
              startElementId: selectedElementId,
              points: [{ x: el.x, y: el.y - (el.type === 'O' ? 15 : -15) }], 
              color: ROUTE_COLORS[colorIndex],
              style: 'solid',
              arrow: true
          };
          setRoutes([...routes, newRoute]);
      }
  };

  // --- UNIVERSAL POINTER HANDLERS (MOUSE + TOUCH) ---

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      
      let clientX, clientY;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      return {
          x: ((clientX - rect.left) / rect.width) * 100,
          y: ((clientY - rect.top) / rect.height) * 100
      };
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent, type: 'element' | 'route_point', id: string, index?: number) => {
      e.stopPropagation();
      if (type === 'element') {
          setSelectedElementId(id);
          setSelectedRouteId(null);
      } else {
          setSelectedRouteId(id);
          setSelectedElementId(null);
      }
      
      setDragTarget({ type, id, index });
      setIsDragging(true);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging || !canvasRef.current || !dragTarget) return;
      
      const { x, y } = getPointerPos(e);

      if (dragTarget.type === 'element') {
          setElements(prev => prev.map(el => el.id === dragTarget.id ? { ...el, x, y } : el));
      } else if (dragTarget.type === 'route_point' && typeof dragTarget.index === 'number') {
          setRoutes(prev => prev.map(r => {
              if (r.id === dragTarget.id) {
                  const newPoints = [...r.points];
                  newPoints[dragTarget.index!] = { x, y };
                  return { ...r, points: newPoints };
              }
              return r;
          }));
      }
  };

  const stopDrag = () => {
      setIsDragging(false);
      setDragTarget(null);
  };

  // --- SAVE / LOAD / DELETE ---

  const handleSavePlay = async () => {
    if (!teamData?.id || !playName.trim()) return;
    const playData: Partial<Play> = { name: playName, category, elements, routes, createdAt: serverTimestamp() };
    try {
      if (selectedPlayId) {
        await setDoc(doc(db, 'teams', teamData.id, 'plays', selectedPlayId), playData, { merge: true });
      } else {
        const newDoc = await addDoc(collection(db, 'teams', teamData.id, 'plays'), playData);
        setSelectedPlayId(newDoc.id);
      }
      alert('Play saved!');
    } catch (error) { console.error("Error saving play:", error); }
  };

  const loadPlay = (play: Play) => {
      setPlayName(play.name);
      setCategory(play.category);
      setElements(play.elements || []);
      setRoutes(play.routes || []); 
      setSelectedPlayId(play.id);
      setActiveTab('editor');
  };

  const clearBoard = () => {
      setElements([]);
      setRoutes([]);
      setPlayName('New Play');
      setSelectedPlayId(null);
  };

  const deletePlay = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("Delete this play?")) return;
      await deleteDoc(doc(db, 'teams', teamData?.id!, 'plays', id));
      if (selectedPlayId === id) clearBoard();
  };

  const deleteSelection = () => {
      if (selectedElementId) {
          setRoutes(prev => prev.filter(r => r.startElementId !== selectedElementId));
          setElements(prev => prev.filter(el => el.id !== selectedElementId));
          setSelectedElementId(null);
      } else if (selectedRouteId) {
          setRoutes(prev => prev.filter(r => r.id !== selectedRouteId));
          setSelectedRouteId(null);
      }
  };

  const clearPlayerRoute = () => {
      if (!selectedElementId) return;
      setRoutes(prev => prev.filter(r => r.startElementId !== selectedElementId));
  }

  const hasRoute = selectedElementId && routes.some(r => r.startElementId === selectedElementId);

  return (
    <>
    {/* FLOATING FULLSCREEN BUTTON - Mobile/Tablet only, when NOT in fullscreen */}
    {!isFullscreen && isMobileOrTablet && (
      <button
        onClick={() => setIsFullscreen(true)}
        className="fixed bottom-6 right-6 z-50 bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-full shadow-2xl transition-all active:scale-95"
        title="Open Fullscreen Field"
      >
        <Maximize2 className="w-6 h-6" />
      </button>
    )}

    {/* FULLSCREEN MODE */}
    {isFullscreen ? (
      <div className="fixed inset-0 z-50 bg-slate-950">
        {/* Minimal Header */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-none">
          <h2 className="text-white font-bold text-lg bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg pointer-events-auto">{playName}</h2>
          <button 
            onClick={() => {
              setIsFullscreen(false);
              setShowToolbar(false);
            }}
            className="bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 text-white p-2 rounded-lg transition-colors pointer-events-auto"
            title="Exit Fullscreen (or press ESC)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* FLOATING TOOLBAR (Bottom Right) */}
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className="fixed bottom-6 right-6 z-30 bg-orange-600 hover:bg-orange-500 text-white p-4 rounded-full shadow-2xl transition-all active:scale-95"
          title={showToolbar ? "Hide Tools" : "Show Tools"}
        >
          {showToolbar ? <X className="w-6 h-6" /> : <PenTool className="w-6 h-6" />}
        </button>

        {/* TOOLS DRAWER (Slides from bottom on mobile, sidebar on desktop) */}
        {showToolbar && (
          <div className="fixed lg:absolute inset-x-0 bottom-0 lg:inset-y-0 lg:left-0 lg:right-auto lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-800 z-20 max-h-[70vh] lg:max-h-full overflow-y-auto shadow-2xl animate-in slide-in-from-bottom lg:slide-in-from-left">
            <div className="p-4 space-y-4">
              <input 
                value={playName} 
                onChange={e => setPlayName(e.target.value)} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" 
                placeholder="Play Name" 
              />
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value as any)} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
              >
                <option>Offense</option><option>Defense</option><option>Special Teams</option>
              </select>

              <div>
                <p className="text-xs font-bold text-blue-400 uppercase mb-2">Offense (O)</p>
                <div className="grid grid-cols-5 gap-1">
                  {['QB', 'RB', 'WR', 'TE', 'OL'].map(pos => (
                    <button key={pos} onClick={() => addElement('O', pos)} className="bg-blue-900/30 hover:bg-blue-800/50 text-blue-200 border border-blue-800/50 rounded text-xs py-1.5 font-mono transition-colors">{pos}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-red-400 uppercase mb-2">Defense (X)</p>
                <div className="grid grid-cols-4 gap-1">
                  {['DL', 'LB', 'CB', 'S'].map(pos => (
                    <button key={pos} onClick={() => addElement('X', pos)} className="bg-red-900/30 hover:bg-red-800/50 text-red-200 border border-red-800/50 rounded text-xs py-1.5 font-mono transition-colors">{pos}</button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                {selectedElementId ? (
                  <>
                    <button onClick={handleAddOrExtendRoute} className="w-full bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-yellow-600/30 transition-colors">
                      <RouteIcon className="w-3 h-3"/> {hasRoute ? 'Extend Route' : 'Add Route'}
                    </button>
                    {hasRoute && (
                      <button onClick={clearPlayerRoute} className="w-full bg-orange-900/20 text-orange-400 border border-orange-900/50 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-orange-900/30 transition-colors">
                        <Undo2 className="w-3 h-3"/> Clear Route Only
                      </button>
                    )}
                    <button onClick={deleteSelection} className="w-full bg-red-900/20 text-red-400 border border-red-900/50 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-red-900/30 transition-colors">
                      <Eraser className="w-3 h-3"/> Remove Player
                    </button>
                  </>
                ) : selectedRouteId ? (
                  <button onClick={deleteSelection} className="w-full bg-red-900/20 text-red-400 border border-red-900/50 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-red-900/30 transition-colors">
                    <Eraser className="w-3 h-3"/> Remove Route Chain
                  </button>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-2">Select a player or route to edit</p>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-800">
                <button onClick={handleSavePlay} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded text-sm flex items-center justify-center gap-2 transition-colors"><Save className="w-4 h-4"/> Save</button>
                <button onClick={clearBoard} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white p-2 rounded text-sm transition-colors">New</button>
              </div>
            </div>
          </div>
        )}

        {/* FULLSCREEN FIELD - Full screen canvas */}
        <div className="absolute inset-0"
          onClick={(e) => {
            // Close toolbar if clicking outside of it
            if (showToolbar && e.target === e.currentTarget) {
              setShowToolbar(false);
            }
          }}
        >
            <div 
              ref={canvasRef}
              onMouseMove={handleMove}
              onMouseUp={stopDrag}
              onMouseLeave={stopDrag}
              onTouchMove={handleMove}
              onTouchEnd={stopDrag}
              className="w-full h-full relative cursor-crosshair select-none overflow-hidden"
              style={{ backgroundColor: '#2e7d32' }}
            >
              {/* FIELD TEXTURES */}
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 9.5%, rgba(255,255,255,0.4) 10%)`, backgroundSize: '100% 10%' }}></div>
              <div className="absolute left-1/3 right-1/3 top-0 bottom-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 1.8%, rgba(255,255,255,0.3) 2%)`, backgroundSize: '100% 10%', borderLeft: '2px dashed rgba(255,255,255,0.1)', borderRight: '2px dashed rgba(255,255,255,0.1)' }}></div>
              <div className="absolute top-0 bottom-0 left-2 w-8 flex flex-col justify-between py-4 text-white/30 text-xs font-bold font-mono pointer-events-none"><span>G</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>40</span><span>30</span><span>20</span><span>10</span><span>G</span></div>

              {/* SVG LAYER */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }} viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  {ROUTE_COLORS.map(color => (
                    <marker key={color} id={`arrow-${color.replace('#','')}`} markerWidth="1.5" markerHeight="1" refX="1.4" refY="0.5" orient="auto">
                      <polygon points="0 0, 1.5 0.5, 0 1" fill={color} />
                    </marker>
                  ))}
                </defs>
                
                {routes.map(route => {
                  const startEl = elements.find(e => e.id === route.startElementId);
                  if (!startEl) return null;
                  let pathD = `M ${startEl.x} ${startEl.y}`;
                  route.points.forEach(pt => { pathD += ` L ${pt.x} ${pt.y}`; });
                  return (
                    <path 
                      key={route.id}
                      d={pathD}
                      stroke={route.color}
                      strokeWidth="0.4" 
                      fill="none"
                      strokeDasharray={route.style === 'dashed' ? '1,1' : 'none'}
                      markerEnd={`url(#arrow-${route.color.replace('#','')})`}
                    />
                  );
                })}
              </svg>

              {/* INTERACTIVE LAYER */}
              {routes.map(route => (
                <div key={route.id} style={{ zIndex: 20 }}>
                  {route.points.map((pt, index) => (
                    <div
                      key={`${route.id}-${index}`}
                      onMouseDown={(e) => startDrag(e, 'route_point', route.id, index)}
                      onTouchStart={(e) => startDrag(e, 'route_point', route.id, index)}
                      className={`absolute w-3 h-3 rounded-full shadow-md cursor-move hover:scale-150 transition-transform ${selectedRouteId === route.id ? 'ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: route.color, left: `${pt.x}%`, top: `${pt.y}%`, transform: 'translate(-50%, -50%)' }}
                    />
                  ))}
                </div>
              ))}

              {elements.map(el => (
                <div
                  key={el.id}
                  onMouseDown={(e) => startDrag(e, 'element', el.id)}
                  onTouchStart={(e) => startDrag(e, 'element', el.id)}
                  className={`absolute w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md cursor-move transition-transform active:scale-110 border-2 z-30 ${el.id === selectedElementId ? 'border-yellow-400 ring-2 ring-yellow-400/50' : 'border-white'} ${el.color}`}
                  style={{ left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  {el.label || el.type}
                </div>
              ))}
            </div>
          </div>
      </div>
    ) : (
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
      
      {/* LEFT SIDEBAR - TABBED & THEMED */}
      <div className="w-full lg:w-1/4 flex flex-col bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-lg overflow-hidden shrink-0">
          
          {/* TABS HEADER */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setActiveTab('editor')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'editor' ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
              >
                  <PenTool className="w-4 h-4"/> Editor
              </button>
              <button 
                onClick={() => setActiveTab('library')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'library' ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
              >
                  <BookOpen className="w-4 h-4"/> Library
              </button>
          </div>

          {/* TAB 1: EDITOR TOOLS */}
          {activeTab === 'editor' && (
              <div className="p-4 flex flex-col gap-4 overflow-y-auto">
                  <div className="space-y-4">
                      <input 
                        value={playName} 
                        onChange={e => setPlayName(e.target.value)} 
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white text-sm placeholder-slate-400" 
                        placeholder="Play Name" 
                      />
                      <select 
                        value={category} 
                        onChange={e => setCategory(e.target.value as any)} 
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white text-sm"
                      >
                          <option>Offense</option><option>Defense</option><option>Special Teams</option>
                      </select>

                      <div>
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Offense (O)</p>
                          <div className="grid grid-cols-5 gap-1">
                              {['QB', 'RB', 'WR', 'TE', 'OL'].map(pos => (
                                  <button key={pos} onClick={() => addElement('O', pos)} className="bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-800/50 rounded text-xs py-1.5 font-mono transition-colors">{pos}</button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-2">Defense (X)</p>
                          <div className="grid grid-cols-4 gap-1">
                              {['DL', 'LB', 'CB', 'S'].map(pos => (
                                  <button key={pos} onClick={() => addElement('X', pos)} className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-800/50 rounded text-xs py-1.5 font-mono transition-colors">{pos}</button>
                              ))}
                          </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                          {selectedElementId ? (
                              <>
                                <button onClick={handleAddOrExtendRoute} className="w-full bg-yellow-100 dark:bg-yellow-600/20 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-600/50 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-yellow-200 dark:hover:bg-yellow-600/30 transition-colors">
                                    <RouteIcon className="w-3 h-3"/> {hasRoute ? 'Extend Route' : 'Add Route'}
                                </button>
                                {hasRoute && (
                                    <button onClick={clearPlayerRoute} className="w-full bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-900/50 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors">
                                        <Undo2 className="w-3 h-3"/> Clear Route Only
                                    </button>
                                )}
                                <button onClick={deleteSelection} className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">
                                    <Eraser className="w-3 h-3"/> Remove Player
                                </button>
                              </>
                          ) : selectedRouteId ? (
                              <button onClick={deleteSelection} className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">
                                  <Eraser className="w-3 h-3"/> Remove Route Chain
                              </button>
                          ) : (
                              <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-2">Select a player or route to edit</p>
                          )}
                      </div>

                      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                          <button onClick={handleSavePlay} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded text-sm flex items-center justify-center gap-2 transition-colors"><Save className="w-4 h-4"/> Save</button>
                          <button onClick={clearBoard} className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white p-2 rounded text-sm transition-colors">New</button>
                      </div>
                  </div>
              </div>
          )}

          {/* TAB 2: LIBRARY (FULL HEIGHT) */}
          {activeTab === 'library' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {savedPlays.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-4">No saved plays yet.</p>}
                  {savedPlays.map(play => (
                      <div key={play.id} onClick={() => loadPlay(play)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center group transition-colors ${selectedPlayId === play.id ? 'bg-sky-100 dark:bg-sky-900/20 border-sky-300 dark:border-sky-500/50' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                          <div>
                              <p className="text-slate-900 dark:text-white text-sm font-bold">{play.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 rounded border border-slate-200 dark:border-slate-700">{play.category}</span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{play.elements?.length || 0} players</span>
                              </div>
                          </div>
                          <button onClick={(e) => deletePlay(play.id, e)} className="text-slate-400 dark:text-slate-600 hover:text-red-500 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* RIGHT: THE FIELD - TOUCH & MOUSE ENABLED, THEMED BORDER */}
      <div className="flex-1 bg-green-800 rounded-xl border-4 border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-2xl touch-none group">
          {/* FULLSCREEN BUTTON - Desktop only (hover to show) */}
          <button
            onClick={() => setIsFullscreen(true)}
            className="hidden lg:block absolute top-4 right-4 z-40 bg-slate-900/80 hover:bg-slate-800 text-white p-3 rounded-lg transition-all shadow-lg backdrop-blur-sm opacity-0 group-hover:opacity-100"
            title="Open Fullscreen View"
          >
            <Maximize2 className="w-5 h-5" />
          </button>

          {/* TAP TO EXPAND HINT (Mobile Only) */}
          {elements.length === 0 && routes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 lg:hidden">
              <div className="bg-slate-900/60 backdrop-blur-sm text-white px-6 py-3 rounded-lg text-sm">
                Tap field to expand fullscreen
              </div>
            </div>
          )}
          
          <div 
            ref={canvasRef}
            onClick={(e) => {
              // Tap to expand on mobile (only if not dragging)
              if (window.innerWidth < 1024 && !isDragging && e.target === e.currentTarget) {
                setIsFullscreen(true);
              }
            }}
            onMouseMove={handleMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onTouchMove={handleMove}
            onTouchEnd={stopDrag}
            className="w-full h-full relative cursor-crosshair select-none overflow-hidden"
            style={{ backgroundColor: '#2e7d32' }}
          >
              {/* FIELD TEXTURES */}
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 9.5%, rgba(255,255,255,0.4) 10%)`, backgroundSize: '100% 10%' }}></div>
              <div className="absolute left-1/3 right-1/3 top-0 bottom-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 1.8%, rgba(255,255,255,0.3) 2%)`, backgroundSize: '100% 10%', borderLeft: '2px dashed rgba(255,255,255,0.1)', borderRight: '2px dashed rgba(255,255,255,0.1)' }}></div>
              <div className="absolute top-0 bottom-0 left-2 w-8 flex flex-col justify-between py-4 text-white/30 text-xs font-bold font-mono pointer-events-none"><span>G</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>40</span><span>30</span><span>20</span><span>10</span><span>G</span></div>

              {/* SVG LAYER */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                      {ROUTE_COLORS.map(color => (
                          <marker key={color} id={`arrow-${color.replace('#','')}`} markerWidth="1.5" markerHeight="1" refX="1.4" refY="0.5" orient="auto">
                              <polygon points="0 0, 1.5 0.5, 0 1" fill={color} />
                          </marker>
                      ))}
                  </defs>
                  
                  {routes.map(route => {
                      const startEl = elements.find(e => e.id === route.startElementId);
                      if (!startEl) return null;
                      let pathD = `M ${startEl.x} ${startEl.y}`;
                      route.points.forEach(pt => { pathD += ` L ${pt.x} ${pt.y}`; });
                      return (
                          <path 
                            key={route.id}
                            d={pathD}
                            stroke={route.color}
                            strokeWidth="0.4" 
                            fill="none"
                            strokeDasharray={route.style === 'dashed' ? '1,1' : 'none'}
                            markerEnd={`url(#arrow-${route.color.replace('#','')})`}
                          />
                      );
                  })}
              </svg>

              {/* INTERACTIVE LAYER */}
              {routes.map(route => (
                  <div key={route.id} style={{ zIndex: 20 }}>
                      {route.points.map((pt, index) => (
                          <div
                            key={`${route.id}-${index}`}
                            onMouseDown={(e) => startDrag(e, 'route_point', route.id, index)}
                            onTouchStart={(e) => startDrag(e, 'route_point', route.id, index)}
                            className={`absolute w-3 h-3 rounded-full shadow-md cursor-move hover:scale-150 transition-transform ${selectedRouteId === route.id ? 'ring-2 ring-white' : ''}`}
                            style={{ backgroundColor: route.color, left: `${pt.x}%`, top: `${pt.y}%`, transform: 'translate(-50%, -50%)' }}
                          />
                      ))}
                  </div>
              ))}

              {elements.map(el => (
                  <div
                    key={el.id}
                    onMouseDown={(e) => startDrag(e, 'element', el.id)}
                    onTouchStart={(e) => startDrag(e, 'element', el.id)}
                    className={`absolute w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md cursor-move transition-transform active:scale-110 border-2 z-30 ${el.id === selectedElementId ? 'border-yellow-400 ring-2 ring-yellow-400/50' : 'border-white'} ${el.color}`}
                    style={{ left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)' }}
                  >
                      {el.label || el.type}
                  </div>
              ))}
          </div>
      </div>

    </div>
    )}
    </>
  );
};

export default Playbook;