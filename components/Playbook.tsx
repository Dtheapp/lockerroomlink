import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, doc, setDoc, onSnapshot, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Play, PlayElement, PlayRoute } from '../types';
import { Save, Trash2, Eraser, Plus, Route as RouteIcon, Undo2, BookOpen, PenTool, Maximize2, X, Eye, ChevronDown, Users, Move } from 'lucide-react';

const ROUTE_COLORS = [
  '#FACC15', '#06b6d4', '#ec4899', '#a3e635', '#f87171', '#ffffff', '#a855f7', '#ea580c', '#3b82f6', '#14b8a6', '#8b5cf6'
];

// Field aspect ratio (width:height) - standard football field proportions
const FIELD_ASPECT_RATIO = 16 / 9;

const Playbook: React.FC = () => {
  const { teamData, userData } = useAuth();
  
  // SECURITY: READ-ONLY MODE FOR PARENTS
  const isReadOnly = userData?.role === 'Parent';

  // UI STATE
  const [activeTab, setActiveTab] = useState<'editor' | 'library'>('editor');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAddPlayers, setShowAddPlayers] = useState(false);
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

  // UX: Default to Library for Read-Only users
  useEffect(() => {
    if (isReadOnly) {
        setActiveTab('library');
    }
  }, [isReadOnly]);

  useEffect(() => {
    if (!teamData?.id) return;
    const playsQuery = query(collection(db, 'teams', teamData.id, 'plays'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(playsQuery, (snapshot) => {
      const playsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Play));
      setSavedPlays(playsData);
    });
    return () => unsubscribe();
  }, [teamData?.id]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setShowAddPlayers(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  // Detect mobile/tablet
  useEffect(() => {
    const checkDevice = () => {
      setIsMobileOrTablet(window.innerWidth < 1024);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // --- ACTIONS ---

  const addElement = (type: 'X' | 'O', label: string) => {
      if (isReadOnly) return;

      // Position new players in formation area
      const startX = 50; 
      const startY = type === 'O' ? 65 : 35; 

      const baseLabel = label; 
      const existingCount = elements.filter(el => {
          const elBaseLabel = el.label.replace(/\d+$/, ''); 
          return elBaseLabel === baseLabel;
      }).length;

      const numberedLabel = `${baseLabel}${existingCount + 1}`;

      // Spread players out a bit when adding multiple
      const offset = (existingCount % 5) * 8 - 16;

      const newEl: PlayElement = {
          id: Date.now().toString(),
          type,
          label: numberedLabel,
          x: Math.max(5, Math.min(95, startX + offset)),
          y: startY + (Math.random() * 4 - 2), 
          color: type === 'O' ? 'bg-blue-600' : 'bg-red-600'
      };
      setElements([...elements, newEl]);
      setSelectedElementId(newEl.id);
      setSelectedRouteId(null);
      
      // Close add players panel after adding on mobile
      if (isMobileOrTablet) {
        setShowAddPlayers(false);
      }
  };

  const handleAddOrExtendRoute = () => {
      if (isReadOnly) return;
      if (!selectedElementId) return;
      const el = elements.find(e => e.id === selectedElementId);
      if (!el) return;

      const existingRouteIndex = routes.findIndex(r => r.startElementId === selectedElementId);

      if (existingRouteIndex >= 0) {
          const route = routes[existingRouteIndex];
          const lastPoint = route.points[route.points.length - 1];
          const newPoint = { x: Math.min(95, lastPoint.x + 5), y: Math.max(5, lastPoint.y - 8) };
          const updatedRoutes = [...routes];
          updatedRoutes[existingRouteIndex] = { ...route, points: [...route.points, newPoint] };
          setRoutes(updatedRoutes);
      } else {
          const colorIndex = routes.length % ROUTE_COLORS.length;
          const direction = el.type === 'O' ? -1 : 1; // O goes up, X goes down
          const newRoute: PlayRoute = {
              id: Date.now().toString(),
              startElementId: selectedElementId,
              points: [{ x: el.x, y: el.y + (direction * 10) }], 
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
      if ('touches' in e && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else if ('changedTouches' in e && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
      } else {
          clientX = (e as MouseEvent).clientX;
          clientY = (e as MouseEvent).clientY;
      }

      // Calculate percentage position
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;

      // Clamp to bounds
      return {
          x: Math.max(3, Math.min(97, x)),
          y: Math.max(3, Math.min(97, y))
      };
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent, type: 'element' | 'route_point', id: string, index?: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (isReadOnly) return;

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
      if (isReadOnly) return;
      
      e.preventDefault();
      
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

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Deselect when clicking empty area
    if (e.target === e.currentTarget) {
      setSelectedElementId(null);
      setSelectedRouteId(null);
    }
  };

  // --- SAVE / LOAD / DELETE ---

  const handleSavePlay = async () => {
    if (isReadOnly) return;
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
      
      // Load elements and routes as-is (should already be percentages 0-100)
      setElements(play.elements || []);
      setRoutes(play.routes || []);
      setSelectedPlayId(play.id);
      setSelectedElementId(null);
      setSelectedRouteId(null);
      setActiveTab('editor');
  };

  const clearBoard = () => {
      setElements([]);
      setRoutes([]);
      setPlayName('New Play');
      setSelectedPlayId(null);
      setSelectedElementId(null);
      setSelectedRouteId(null);
  };

  const deletePlay = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (isReadOnly) return;
      if (!window.confirm("Delete this play?")) return;
      await deleteDoc(doc(db, 'teams', teamData?.id!, 'plays', id));
      if (selectedPlayId === id) clearBoard();
  };

  const deleteSelection = () => {
      if (isReadOnly) return;
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
      if (isReadOnly) return;
      if (!selectedElementId) return;
      setRoutes(prev => prev.filter(r => r.startElementId !== selectedElementId));
  }

  const hasRoute = selectedElementId && routes.some(r => r.startElementId === selectedElementId);

  // --- FIELD COMPONENT (reused in both normal and fullscreen) ---
  const renderField = (isFullscreenMode: boolean = false) => (
    <div 
      ref={canvasRef}
      onMouseMove={handleMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onTouchMove={handleMove}
      onTouchEnd={stopDrag}
      onClick={handleCanvasClick}
      className="w-full h-full relative select-none overflow-hidden"
      style={{ 
        backgroundColor: '#2e7d32',
        touchAction: 'none'
      }}
    >
      {/* FIELD MARKINGS */}
      <div className="absolute inset-0 pointer-events-none" style={{ 
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 9%, rgba(255,255,255,0.3) 9%, rgba(255,255,255,0.3) 10%)`,
        backgroundSize: '100% 10%' 
      }}></div>
      
      {/* Hash marks */}
      <div className="absolute left-1/3 right-1/3 top-0 bottom-0 pointer-events-none" style={{ 
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 4%, rgba(255,255,255,0.2) 4%, rgba(255,255,255,0.2) 5%)`,
        backgroundSize: '100% 10%',
        borderLeft: '1px dashed rgba(255,255,255,0.15)', 
        borderRight: '1px dashed rgba(255,255,255,0.15)' 
      }}></div>
      
      {/* Yard numbers */}
      <div className="absolute top-0 bottom-0 left-1 w-6 flex flex-col justify-between py-2 text-white/25 text-[10px] font-bold font-mono pointer-events-none">
        <span>G</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>40</span><span>30</span><span>20</span><span>10</span><span>G</span>
      </div>

      {/* End zones */}
      <div className="absolute top-0 left-0 right-0 h-[8%] bg-orange-600/40 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-orange-600/40 pointer-events-none"></div>

      {/* SVG ROUTES LAYER */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {ROUTE_COLORS.map(color => (
            <marker key={color} id={`arrow-${color.replace('#','')}`} markerWidth="2" markerHeight="1.5" refX="1.8" refY="0.75" orient="auto">
              <polygon points="0 0, 2 0.75, 0 1.5" fill={color} />
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
              strokeWidth="0.5" 
              fill="none"
              strokeDasharray={route.style === 'dashed' ? '2,1' : 'none'}
              markerEnd={`url(#arrow-${route.color.replace('#','')})`}
            />
          );
        })}
      </svg>

      {/* ROUTE POINTS (draggable) */}
      {routes.map(route => (
        <React.Fragment key={route.id}>
          {route.points.map((pt, index) => (
            <div
              key={`${route.id}-${index}`}
              onMouseDown={(e) => startDrag(e, 'route_point', route.id, index)}
              onTouchStart={(e) => startDrag(e, 'route_point', route.id, index)}
              className={`absolute rounded-full shadow-lg transition-transform z-20 ${
                isReadOnly ? 'cursor-default' : 'cursor-move hover:scale-125 active:scale-150'
              } ${selectedRouteId === route.id ? 'ring-2 ring-white ring-offset-1 ring-offset-green-800' : ''}`}
              style={{ 
                backgroundColor: route.color, 
                left: `${pt.x}%`, 
                top: `${pt.y}%`, 
                transform: 'translate(-50%, -50%)',
                width: isFullscreenMode ? '16px' : '12px',
                height: isFullscreenMode ? '16px' : '12px',
              }}
            />
          ))}
        </React.Fragment>
      ))}

      {/* PLAYER ELEMENTS */}
      {elements.map(el => (
        <div
          key={el.id}
          onMouseDown={(e) => startDrag(e, 'element', el.id)}
          onTouchStart={(e) => startDrag(e, 'element', el.id)}
          className={`absolute rounded-full flex items-center justify-center font-bold text-white shadow-lg transition-all border-2 z-30 ${
            isReadOnly ? 'cursor-default' : 'cursor-move active:scale-110'
          } ${el.id === selectedElementId ? 'border-yellow-400 ring-4 ring-yellow-400/40 scale-110' : 'border-white/80'} ${el.color}`}
          style={{ 
            left: `${el.x}%`, 
            top: `${el.y}%`, 
            transform: 'translate(-50%, -50%)',
            width: isFullscreenMode ? '44px' : '36px',
            height: isFullscreenMode ? '44px' : '36px',
            fontSize: isFullscreenMode ? '12px' : '10px',
          }}
        >
          {el.label || el.type}
        </div>
      ))}

      {/* Empty state hint */}
      {elements.length === 0 && !isReadOnly && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm text-center">
            <Users className="w-5 h-5 mx-auto mb-1 opacity-60" />
            <span className="opacity-80">Add players to get started</span>
          </div>
        </div>
      )}
    </div>
  );

  // --- ADD PLAYERS PANEL (Mobile Bottom Sheet Style) ---
  const renderAddPlayersPanel = () => (
    <div className={`${isFullscreen ? 'fixed inset-x-0 bottom-0 z-40' : ''}`}>
      {/* Toggle Button */}
      {!isReadOnly && (
        <button
          onClick={() => setShowAddPlayers(!showAddPlayers)}
          className={`w-full py-3 flex items-center justify-center gap-2 font-semibold transition-colors ${
            showAddPlayers 
              ? 'bg-slate-700 text-white' 
              : 'bg-orange-600 hover:bg-orange-700 text-white'
          }`}
        >
          {showAddPlayers ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddPlayers ? 'Hide Players' : 'Add Players'}
        </button>
      )}
      
      {/* Expandable Panel */}
      {showAddPlayers && !isReadOnly && (
        <div className="bg-slate-900 border-t border-slate-700 p-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {/* Offense */}
          <div>
            <p className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Offense (O)
            </p>
            <div className="flex flex-wrap gap-2">
              {['QB', 'RB', 'WR', 'TE', 'C', 'G', 'T'].map(pos => (
                <button 
                  key={pos} 
                  onClick={() => addElement('O', pos)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors active:scale-95"
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
          
          {/* Defense */}
          <div>
            <p className="text-xs font-bold text-red-400 uppercase mb-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Defense (X)
            </p>
            <div className="flex flex-wrap gap-2">
              {['DL', 'DE', 'DT', 'LB', 'CB', 'S', 'N'].map(pos => (
                <button 
                  key={pos} 
                  onClick={() => addElement('X', pos)} 
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors active:scale-95"
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // --- SELECTION ACTIONS BAR ---
  const renderSelectionActions = () => {
    if (isReadOnly) return null;
    if (!selectedElementId && !selectedRouteId) return null;
    
    return (
      <div className={`${isFullscreen ? 'fixed top-20 left-1/2 -translate-x-1/2 z-40' : 'absolute top-2 left-1/2 -translate-x-1/2 z-40'}`}>
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700 p-2 flex items-center gap-2">
          {selectedElementId && (
            <>
              <button 
                onClick={handleAddOrExtendRoute} 
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RouteIcon className="w-3.5 h-3.5"/> {hasRoute ? 'Extend' : 'Route'}
              </button>
              {hasRoute && (
                <button 
                  onClick={clearPlayerRoute} 
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5"/> Clear
                </button>
              )}
              <button 
                onClick={deleteSelection} 
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Eraser className="w-3.5 h-3.5"/> Delete
              </button>
            </>
          )}
          {selectedRouteId && (
            <button 
              onClick={deleteSelection} 
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Eraser className="w-3.5 h-3.5"/> Delete Route
            </button>
          )}
          <button 
            onClick={() => { setSelectedElementId(null); setSelectedRouteId(null); }}
            className="text-slate-400 hover:text-white p-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
    {/* FLOATING FULLSCREEN BUTTON - Mobile only when not fullscreen */}
    {!isFullscreen && (
      <button
        onClick={() => setIsFullscreen(true)}
        className="fixed bottom-6 right-6 z-50 bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-full shadow-2xl transition-all active:scale-95 lg:hidden"
        title="Open Fullscreen Editor"
      >
        <Maximize2 className="w-6 h-6" />
      </button>
    )}

    {/* ==================== FULLSCREEN MODE ==================== */}
    {isFullscreen && (
      <div 
        className="fixed inset-0 z-50 bg-slate-950 flex flex-col"
        style={{ touchAction: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setIsFullscreen(false); setShowAddPlayers(false); }}
              className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <input 
              value={playName}
              onChange={(e) => setPlayName(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm font-semibold w-40"
              placeholder="Play Name"
              readOnly={isReadOnly}
            />
          </div>
          
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <>
                <button 
                  onClick={clearBoard}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  New
                </button>
                <button 
                  onClick={handleSavePlay}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* Field Container with aspect ratio */}
        <div className="flex-1 flex items-center justify-center p-2 overflow-hidden relative">
          <div 
            className="w-full h-full max-w-full rounded-lg overflow-hidden border-2 border-slate-700 shadow-2xl"
            style={{ 
              maxHeight: '100%',
              aspectRatio: `${FIELD_ASPECT_RATIO}`,
            }}
          >
            {renderField(true)}
          </div>
          {renderSelectionActions()}
        </div>

        {/* Bottom Add Players Panel */}
        {renderAddPlayersPanel()}
        
        {/* Drag hint */}
        {elements.length > 0 && !isDragging && !showAddPlayers && !isReadOnly && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-slate-800/80 text-slate-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-none">
            <Move className="w-3 h-3" /> Drag players to position
          </div>
        )}
      </div>
    )}

    {/* ==================== NORMAL VIEW ==================== */}
    {!isFullscreen && (
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-100px)]">
      
        {/* LEFT SIDEBAR */}
        <div className="w-full lg:w-80 flex flex-col bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-lg overflow-hidden shrink-0">
            
            {/* TABS */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
                <button 
                  onClick={() => setActiveTab('editor')}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'editor' ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                >
                    {isReadOnly ? <Eye className="w-4 h-4"/> : <PenTool className="w-4 h-4"/>} {isReadOnly ? 'View' : 'Edit'}
                </button>
                <button 
                  onClick={() => setActiveTab('library')}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'library' ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                >
                    <BookOpen className="w-4 h-4"/> Library
                </button>
            </div>

            {/* EDITOR TAB */}
            {activeTab === 'editor' && (
                <div className="flex-1 overflow-y-auto p-4">
                    {isReadOnly ? (
                        <div className="text-center py-8 px-4 text-zinc-500 space-y-2">
                            <Eye className="w-12 h-12 mx-auto text-zinc-400 opacity-50"/>
                            <h3 className="font-bold text-zinc-900 dark:text-white">View Mode</h3>
                            <p className="text-xs">Select a play from the <strong className="text-orange-500">Library</strong> to view it.</p>
                        </div>
                    ) : (
                      <div className="space-y-4">
                        <input 
                          value={playName} 
                          onChange={e => setPlayName(e.target.value)} 
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm" 
                          placeholder="Play Name" 
                        />
                        <select 
                          value={category} 
                          onChange={e => setCategory(e.target.value as any)} 
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm"
                        >
                            <option>Offense</option><option>Defense</option><option>Special Teams</option>
                        </select>

                        {/* Offense Players */}
                        <div>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Offense</p>
                            <div className="grid grid-cols-4 gap-1.5">
                                {['QB', 'RB', 'WR', 'TE', 'C', 'G', 'T'].map(pos => (
                                    <button key={pos} onClick={() => addElement('O', pos)} className="bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-800/50 rounded-lg text-xs py-2 font-bold transition-colors">{pos}</button>
                                ))}
                            </div>
                        </div>

                        {/* Defense Players */}
                        <div>
                            <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-2">Defense</p>
                            <div className="grid grid-cols-4 gap-1.5">
                                {['DL', 'DE', 'DT', 'LB', 'CB', 'S', 'N'].map(pos => (
                                    <button key={pos} onClick={() => addElement('X', pos)} className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-800/50 rounded-lg text-xs py-2 font-bold transition-colors">{pos}</button>
                                ))}
                            </div>
                        </div>

                        {/* Selection Actions */}
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                            {selectedElementId ? (
                                <>
                                  <button onClick={handleAddOrExtendRoute} className="w-full bg-yellow-100 dark:bg-yellow-600/20 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-600/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-yellow-200 dark:hover:bg-yellow-600/30 transition-colors">
                                      <RouteIcon className="w-4 h-4"/> {hasRoute ? 'Extend Route' : 'Add Route'}
                                  </button>
                                  {hasRoute && (
                                      <button onClick={clearPlayerRoute} className="w-full bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-900/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors">
                                          <Undo2 className="w-4 h-4"/> Clear Route
                                      </button>
                                  )}
                                  <button onClick={deleteSelection} className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">
                                      <Eraser className="w-4 h-4"/> Remove Player
                                  </button>
                                </>
                            ) : selectedRouteId ? (
                                <button onClick={deleteSelection} className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">
                                    <Eraser className="w-4 h-4"/> Remove Route
                                </button>
                            ) : (
                                <p className="text-center text-xs text-slate-500 py-3">Tap a player to select & edit</p>
                            )}
                        </div>

                        {/* Save/New Buttons */}
                        <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <button onClick={handleSavePlay} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"><Save className="w-4 h-4"/> Save</button>
                            <button onClick={clearBoard} className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white p-2.5 rounded-lg text-sm font-semibold transition-colors">New</button>
                        </div>
                      </div>
                    )}
                </div>
            )}

            {/* LIBRARY TAB */}
            {activeTab === 'library' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {savedPlays.length === 0 && <p className="text-center text-slate-500 text-sm mt-8">No saved plays yet.</p>}
                    {savedPlays.map(play => (
                        <div 
                          key={play.id} 
                          onClick={() => loadPlay(play)} 
                          className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center group transition-colors ${selectedPlayId === play.id ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-500/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-600'}`}
                        >
                            <div>
                                <p className="text-slate-900 dark:text-white text-sm font-bold">{play.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">{play.category}</span>
                                    <span className="text-[10px] text-slate-500">{play.elements?.length || 0} players</span>
                                </div>
                            </div>
                            {!isReadOnly && (
                              <button onClick={(e) => deletePlay(play.id, e)} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* RIGHT: THE FIELD */}
        <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-0">
          {/* Field with fixed aspect ratio */}
          <div className="flex-1 flex items-center justify-center bg-slate-200 dark:bg-slate-900 rounded-xl p-2 overflow-hidden relative">
            <div 
              className="w-full h-full rounded-lg overflow-hidden border-4 border-slate-300 dark:border-slate-700 shadow-xl relative"
              style={{ 
                maxHeight: '100%',
                aspectRatio: `${FIELD_ASPECT_RATIO}`,
              }}
            >
              {renderField(false)}
              
              {/* Desktop fullscreen button */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="absolute top-3 right-3 z-40 bg-slate-900/80 hover:bg-slate-800 text-white p-2.5 rounded-lg transition-all shadow-lg backdrop-blur-sm opacity-0 hover:opacity-100 focus:opacity-100 hidden lg:block"
                title="Fullscreen"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
            
            {/* Selection actions overlay */}
            {renderSelectionActions()}
          </div>
        </div>

      </div>
    )}
    </>
  );
};

export default Playbook;
