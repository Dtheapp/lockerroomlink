import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, doc, setDoc, onSnapshot, deleteDoc, serverTimestamp, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { CoachPlay, PlayElement, PlayRoute, OffensePlayType, DefensePlayType, Formation, SystemPlaybook, SystemPlay, SystemFormation, ImportedPlaybook, DrawingLine, PlayShape, LineType, ShapeType } from '../types';
import { Save, Trash2, Eraser, Plus, Undo2, BookOpen, PenTool, Maximize2, X, ChevronDown, Users, FolderOpen, Layers, ChevronRight, AlertTriangle, Search, CheckCircle, AlertCircle, Download, Package, Lock, RefreshCw, Eye, Edit2, Circle, Square, Triangle, Minus, MousePointer, Move, Sparkles } from 'lucide-react';
import ClonePlayModal from './ClonePlayModal';

// Line colors for drawing
const LINE_COLORS = [
  '#000000', '#ff0000', '#FACC15', '#06b6d4', '#ec4899', '#a3e635', '#f87171', '#ffffff', '#a855f7', '#ea580c', '#3b82f6'
];

// Shape colors
const SHAPE_COLORS = [
  '#000000', '#ff0000', '#FACC15', '#06b6d4', '#3b82f6', '#a855f7', '#ffffff'
];

const ROUTE_COLORS = [
  '#FACC15', '#06b6d4', '#ec4899', '#a3e635', '#f87171', '#ffffff', '#a855f7', '#ea580c', '#3b82f6', '#14b8a6', '#8b5cf6'
];

// Field aspect ratio (width:height) - standard football field proportions
const FIELD_ASPECT_RATIO = 16 / 9;

interface CoachPlaybookProps {
  onClose?: () => void;
}

const CoachPlaybook: React.FC<CoachPlaybookProps> = ({ onClose }) => {
  const { userData, user } = useAuth();

  // UI STATE
  const [activeTab, setActiveTab] = useState<'formations' | 'editor' | 'library' | 'import'>('formations');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'All' | 'Offense' | 'Defense' | 'Special Teams'>('All');
  const [filterOffenseType, setFilterOffenseType] = useState<'All' | 'Run' | 'Pass'>('All');
  const [filterDefenseType, setFilterDefenseType] = useState<'All' | 'Normal' | 'Blitz'>('All');
  const [filterFormationId, setFilterFormationId] = useState<string | null>(null);
  const [formationSearch, setFormationSearch] = useState('');

  // FORMATION STATE
  const [formations, setFormations] = useState<Formation[]>([]);
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const [editingFormation, setEditingFormation] = useState<Formation | null>(null);
  const [formationName, setFormationName] = useState('');
  const [formationCategory, setFormationCategory] = useState<'Offense' | 'Defense' | 'Special Teams'>('Offense');
  const [formationElements, setFormationElements] = useState<PlayElement[]>([]);
  const [deleteFormationConfirm, setDeleteFormationConfirm] = useState<{ id: string; name: string; playCount: number } | null>(null);
  const [deletingFormation, setDeletingFormation] = useState(false);
  const [isFormationDesignMode, setIsFormationDesignMode] = useState(false);

  // PLAY DATA
  const [playName, setPlayName] = useState('New Play');
  const [playNotes, setPlayNotes] = useState('');
  const [category, setCategory] = useState<'Offense' | 'Defense' | 'Special Teams'>('Offense');
  const [offenseType, setOffenseType] = useState<OffensePlayType>('Run');
  const [defenseType, setDefenseType] = useState<DefensePlayType>('Normal');
  const [playFormationId, setPlayFormationId] = useState<string | null>(null); // Formation this play is based on
  const [playFormationName, setPlayFormationName] = useState<string>('');
  const [elements, setElements] = useState<PlayElement[]>([]);
  const [routes, setRoutes] = useState<PlayRoute[]>([]); 
  const [lines, setLines] = useState<DrawingLine[]>([]); // Standalone drawing lines
  const [shapes, setShapes] = useState<PlayShape[]>([]); // Zone/coverage shapes
  
  // DRAWING MODE STATE
  const [drawingMode, setDrawingMode] = useState<'select' | 'line' | 'shape'>('select');
  const [selectedLineType, setSelectedLineType] = useState<LineType>('route');
  const [selectedLineColor, setSelectedLineColor] = useState<string>('#000000');
  const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>('circle');
  const [selectedShapeColor, setSelectedShapeColor] = useState<string>('#000000');
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [currentDrawingLine, setCurrentDrawingLine] = useState<DrawingLine | null>(null);
  const [isPlacingShape, setIsPlacingShape] = useState(false);
  const [currentShape, setCurrentShape] = useState<PlayShape | null>(null);
  const [shapeStartPos, setShapeStartPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  
  // SELECTION
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // LIBRARY
  const [savedPlays, setSavedPlays] = useState<CoachPlay[]>([]);
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);
  
  // Delete confirmation state
  const [deletePlayConfirm, setDeletePlayConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deletingPlay, setDeletingPlay] = useState(false);

  // SYSTEM PLAYBOOKS (for importing)
  const [systemPlaybooks, setSystemPlaybooks] = useState<SystemPlaybook[]>([]);
  const [systemPlays, setSystemPlays] = useState<SystemPlay[]>([]);
  const [systemFormations, setSystemFormations] = useState<SystemFormation[]>([]);
  const [importedPlaybooks, setImportedPlaybooks] = useState<ImportedPlaybook[]>([]);
  const [selectedSystemPlaybook, setSelectedSystemPlaybook] = useState<SystemPlaybook | null>(null);
  const [previewingPlay, setPreviewingPlay] = useState<SystemPlay | null>(null);
  const [importingPlaybook, setImportingPlaybook] = useState(false);
  
  // Play preview modal (for viewing plays without editing)
  const [previewPlay, setPreviewPlay] = useState<CoachPlay | null>(null);
  
  // Unimport playbook state
  const [unimportConfirm, setUnimportConfirm] = useState<ImportedPlaybook | null>(null);
  const [unimportingPlaybook, setUnimportingPlaybook] = useState(false);
  
  // Add plays from imported playbook modal
  const [addPlaysFromPlaybook, setAddPlaysFromPlaybook] = useState<SystemPlaybook | null>(null);
  const [selectedPlaysToAdd, setSelectedPlaysToAdd] = useState<string[]>([]);
  const [addingPlays, setAddingPlays] = useState(false);
  
  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Clone Play Modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const cloneCredits = userData?.cloneCredits ?? 10; // Default to 10 credits for new users
  
  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // Auto-dismiss after 3 seconds
  };
  
  // DRAGGING
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ type: 'element' | 'route_point' | 'line_point' | 'shape', id: string, index?: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const formationCanvasRef = useRef<HTMLDivElement>(null);

  // Check for dark mode
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Load coach's formations
  useEffect(() => {
    if (!user?.uid) return;
    const formationsQuery = query(collection(db, 'users', user.uid, 'formations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(formationsQuery, (snapshot) => {
      const formationsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Formation));
      setFormations(formationsData);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Load coach's personal plays
  useEffect(() => {
    if (!user?.uid) return;
    const playsQuery = query(collection(db, 'users', user.uid, 'plays'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(playsQuery, (snapshot) => {
      const playsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as CoachPlay));
      setSavedPlays(playsData);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Load published system playbooks
  useEffect(() => {
    const playbooksQuery = query(collection(db, 'systemPlaybooks'), where('isPublished', '==', true));
    const unsubscribe = onSnapshot(playbooksQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemPlaybook));
      setSystemPlaybooks(data);
    });
    return () => unsubscribe();
  }, []);

  // Load system plays and formations
  useEffect(() => {
    const playsUnsub = onSnapshot(collection(db, 'systemPlays'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemPlay));
      setSystemPlays(data);
    });
    const formsUnsub = onSnapshot(collection(db, 'systemFormations'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemFormation));
      setSystemFormations(data);
    });
    return () => { playsUnsub(); formsUnsub(); };
  }, []);

  // Load coach's imported playbooks
  useEffect(() => {
    if (!user?.uid) return;
    const importedQuery = query(collection(db, 'users', user.uid, 'importedPlaybooks'));
    const unsubscribe = onSnapshot(importedQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ImportedPlaybook));
      setImportedPlaybooks(data);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Auto-sync system plays when source is updated
  useEffect(() => {
    if (!user?.uid || systemPlays.length === 0 || savedPlays.length === 0) return;
    
    const syncSystemPlays = async () => {
      for (const coachPlay of savedPlays) {
        if (!coachPlay.systemPlayId || !coachPlay.isSystemPlay) continue;
        
        const sourcePlay = systemPlays.find(sp => sp.id === coachPlay.systemPlayId);
        if (!sourcePlay) continue;
        
        // Check if source has been updated (compare elements, routes, and notes)
        const sourceElementsStr = JSON.stringify(sourcePlay.elements);
        const coachElementsStr = JSON.stringify(coachPlay.elements);
        const sourceRoutesStr = JSON.stringify(sourcePlay.routes);
        const coachRoutesStr = JSON.stringify(coachPlay.routes);
        const sourceNotes = sourcePlay.notes || '';
        const coachNotes = coachPlay.notes || '';
        
        if (sourceElementsStr !== coachElementsStr || sourceRoutesStr !== coachRoutesStr || sourceNotes !== coachNotes) {
          // Update coach's copy with source data
          await setDoc(doc(db, 'users', user.uid, 'plays', coachPlay.id), {
            elements: sourcePlay.elements,
            routes: sourcePlay.routes,
            name: sourcePlay.name,
            notes: sourcePlay.notes || '',
            offenseType: sourcePlay.offenseType,
            defenseType: sourcePlay.defenseType,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }
    };
    
    syncSystemPlays();
  }, [systemPlays, user?.uid]); // Only sync when systemPlays change

  // Keep previewPlay in sync with savedPlays when data changes
  useEffect(() => {
    if (previewPlay && savedPlays.length > 0) {
      const updatedPlay = savedPlays.find(p => p.id === previewPlay.id);
      if (updatedPlay && JSON.stringify(updatedPlay) !== JSON.stringify(previewPlay)) {
        setPreviewPlay(updatedPlay);
      }
    }
  }, [savedPlays]);

  // Keep previewingPlay (system play preview) in sync with systemPlays when data changes
  useEffect(() => {
    if (previewingPlay && systemPlays.length > 0) {
      const updatedPlay = systemPlays.find(p => p.id === previewingPlay.id);
      if (updatedPlay && JSON.stringify(updatedPlay) !== JSON.stringify(previewingPlay)) {
        setPreviewingPlay(updatedPlay);
      }
    }
  }, [systemPlays]);

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

  // --- UNIVERSAL POINTER HANDLERS (MOUSE + TOUCH) ---

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      // Use the correct canvas ref based on mode
      const activeCanvas = isFormationDesignMode ? formationCanvasRef.current : canvasRef.current;
      if (!activeCanvas) return { x: 0, y: 0 };
      const rect = activeCanvas.getBoundingClientRect();
      
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

  const startDrag = (e: React.MouseEvent | React.TouchEvent, type: 'element' | 'route_point' | 'line_point' | 'shape', id: string, index?: number) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Don't allow dragging for read-only plays (system plays)
      const currentPlayForDrag = savedPlays.find(p => p.id === selectedPlayId);
      if (currentPlayForDrag?.isSystemPlay) return;

      if (type === 'element') {
          setSelectedElementId(id);
          setSelectedRouteId(null);
          setSelectedLineId(null);
          setSelectedShapeId(null);
      } else if (type === 'route_point') {
          setSelectedRouteId(id);
          setSelectedElementId(null);
          setSelectedLineId(null);
          setSelectedShapeId(null);
      } else if (type === 'line_point') {
          setSelectedLineId(id);
          setSelectedElementId(null);
          setSelectedRouteId(null);
          setSelectedShapeId(null);
      } else if (type === 'shape') {
          setSelectedShapeId(id);
          setSelectedElementId(null);
          setSelectedRouteId(null);
          setSelectedLineId(null);
      }
      
      setDragTarget({ type, id, index });
      setIsDragging(true);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
      const { x, y } = getPointerPos(e);
      
      // Handle shape resizing during placement
      if (isPlacingShape && shapeStartPos && currentShape) {
          e.preventDefault();
          const width = Math.abs(x - shapeStartPos.x);
          const height = Math.abs(y - shapeStartPos.y);
          const minX = Math.min(x, shapeStartPos.x);
          const minY = Math.min(y, shapeStartPos.y);
          setCurrentShape({
              ...currentShape,
              x: minX + width / 2,
              y: minY + height / 2,
              width: Math.max(width, 2),
              height: Math.max(height, 2)
          });
          return;
      }
      
      // Handle freehand line drawing - add points as mouse moves
      if (isDrawingLine && currentDrawingLine) {
          e.preventDefault();
          // Add new point to create freehand path (with distance threshold to avoid too many points)
          const lastPoint = currentDrawingLine.points[currentDrawingLine.points.length - 1];
          const dx = x - lastPoint.x;
          const dy = y - lastPoint.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Only add point if moved at least 3 pixels (reduces point count while keeping smooth curves)
          if (dist >= 3) {
              setCurrentDrawingLine({
                  ...currentDrawingLine,
                  points: [...currentDrawingLine.points, { x, y }]
              });
          }
          return;
      }
      
      if (!isDragging || !dragTarget) return;
      
      e.preventDefault();

      if (dragTarget.type === 'element') {
          // Check if we're in formation design mode
          if (isFormationDesignMode) {
            setFormationElements(prev => prev.map(el => el.id === dragTarget.id ? { ...el, x, y } : el));
          } else {
            setElements(prev => prev.map(el => el.id === dragTarget.id ? { ...el, x, y } : el));
          }
      } else if (dragTarget.type === 'route_point' && typeof dragTarget.index === 'number') {
          setRoutes(prev => prev.map(r => {
              if (r.id === dragTarget.id) {
                  const newPoints = [...r.points];
                  newPoints[dragTarget.index!] = { x, y };
                  return { ...r, points: newPoints };
              }
              return r;
          }));
      } else if (dragTarget.type === 'line_point' && typeof dragTarget.index === 'number') {
          setLines(prev => prev.map(l => {
              if (l.id === dragTarget.id) {
                  const newPoints = [...l.points];
                  newPoints[dragTarget.index!] = { x, y };
                  return { ...l, points: newPoints };
              }
              return l;
          }));
      } else if (dragTarget.type === 'shape') {
          setShapes(prev => prev.map(s => s.id === dragTarget.id ? { ...s, x, y } : s));
      }
  };

  const stopDrag = (e?: React.MouseEvent | React.TouchEvent) => {
      // Finish line drawing on mouseup
      if (isDrawingLine && currentDrawingLine) {
          // Only save if line has meaningful length
          const points = currentDrawingLine.points;
          if (points.length >= 2) {
              const dx = points[points.length - 1].x - points[0].x;
              const dy = points[points.length - 1].y - points[0].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 3) {
                  setLines(prev => [...prev, currentDrawingLine]);
              }
          }
          setCurrentDrawingLine(null);
          setIsDrawingLine(false);
          return;
      }
      
      // Finish shape placement on mouseup
      if (isPlacingShape && currentShape) {
          if (currentShape.width > 2 && currentShape.height > 2) {
              setShapes(prev => [...prev, currentShape]);
          }
          setCurrentShape(null);
          setShapeStartPos(null);
          setIsPlacingShape(false);
          // Don't immediately start new shape - user must click again
          return;
      }
      
      setIsDragging(false);
      setDragTarget(null);
  };

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getPointerPos(e);
    
    // Don't allow drawing for read-only plays (system plays)
    const currentPlayForDrag = savedPlays.find(p => p.id === selectedPlayId);
    if (currentPlayForDrag?.isSystemPlay) {
      // Just deselect
      if (e.target === e.currentTarget) {
        setSelectedElementId(null);
        setSelectedRouteId(null);
        setSelectedLineId(null);
        setSelectedShapeId(null);
      }
      return;
    }
    
    // Handle line drawing mode - start line on mousedown, finish on mouseup
    if (drawingMode === 'line') {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isDrawingLine) {
        // Start new freehand line on mousedown - just starting point
        const newLine: DrawingLine = {
          id: Date.now().toString(),
          points: [{ x, y }], // Start with single point, more added as mouse moves
          color: selectedLineColor,
          lineType: selectedLineType
        };
        setCurrentDrawingLine(newLine);
        setIsDrawingLine(true);
      }
      // Line is finished in stopDrag (mouseup)
      return;
    }
    
    // Handle shape placement mode - start shape on mousedown, finish on mouseup
    if (drawingMode === 'shape') {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isPlacingShape) {
        // Start shape placement on mousedown
        const newShape: PlayShape = {
          id: Date.now().toString(),
          shapeType: selectedShapeType,
          x: x,
          y: y,
          width: 0,
          height: 0,
          color: selectedShapeColor,
          filled: false
        };
        setCurrentShape(newShape);
        setShapeStartPos({ x, y });
        setIsPlacingShape(true);
      }
      // Shape is finished in stopDrag (mouseup)
      return;
    }
    
    // Default select mode - deselect when clicking empty area
    if (e.target === e.currentTarget) {
      setSelectedElementId(null);
      setSelectedRouteId(null);
      setSelectedLineId(null);
      setSelectedShapeId(null);
    }
  };
  
  // Finish line drawing (legacy - lines are now completed on mouseup in stopDrag)
  const finishDrawingLine = () => {
    if (isDrawingLine && currentDrawingLine && currentDrawingLine.points.length > 2) {
      setLines(prev => [...prev, { ...currentDrawingLine, points: currentDrawingLine.points.slice(0, -1) }]);
    }
    setCurrentDrawingLine(null);
    setIsDrawingLine(false);
  };
  
  // Cancel current drawing
  const cancelDrawing = () => {
    setCurrentDrawingLine(null);
    setIsDrawingLine(false);
    setCurrentShape(null);
    setShapeStartPos(null);
    setIsPlacingShape(false);
  };
  
  // Delete selected line or shape
  const deleteSelectedDrawing = () => {
    if (selectedLineId) {
      setLines(prev => prev.filter(l => l.id !== selectedLineId));
      setSelectedLineId(null);
    }
    if (selectedShapeId) {
      setShapes(prev => prev.filter(s => s.id !== selectedShapeId));
      setSelectedShapeId(null);
    }
  };

  // --- FORMATION MANAGEMENT ---

  const handleSaveFormation = async () => {
    if (!user?.uid || !formationName.trim()) {
      showToast('Please enter a formation name', 'error');
      return;
    }
    if (formationElements.length === 0) {
      showToast('Please add at least one player to the formation', 'error');
      return;
    }
    
    const formationData: Partial<Formation> = {
      name: formationName,
      category: formationCategory,
      elements: formationElements,
      coachId: user.uid,
      coachName: userData?.name || 'Unknown Coach',
      updatedAt: serverTimestamp()
    };
    
    try {
      if (editingFormation) {
        await setDoc(doc(db, 'users', user.uid, 'formations', editingFormation.id), formationData, { merge: true });
        showToast('Formation updated!');
      } else {
        formationData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'users', user.uid, 'formations'), formationData);
        showToast('Formation saved!');
      }
      clearFormationDesigner();
    } catch (error) {
      console.error('Error saving formation:', error);
      showToast('Failed to save formation', 'error');
    }
  };

  const loadFormationForEdit = (formation: Formation) => {
    setEditingFormation(formation);
    setFormationName(formation.name);
    setFormationCategory(formation.category);
    setFormationElements(formation.elements || []);
    setIsFormationDesignMode(true);
  };

  const clearFormationDesigner = () => {
    setEditingFormation(null);
    setFormationName('');
    setFormationCategory('Offense');
    setFormationElements([]);
    setIsFormationDesignMode(false);
    setSelectedElementId(null);
  };

  const deleteFormation = async () => {
    if (!deleteFormationConfirm || !user?.uid) return;
    setDeletingFormation(true);
    try {
      // First delete all plays that use this formation
      const playsQuery = query(
        collection(db, 'users', user.uid, 'plays'),
        where('formationId', '==', deleteFormationConfirm.id)
      );
      const playsSnapshot = await getDocs(playsQuery);
      const deletePromises = playsSnapshot.docs.map(playDoc => 
        deleteDoc(doc(db, 'users', user.uid, 'plays', playDoc.id))
      );
      await Promise.all(deletePromises);
      
      // Then delete the formation
      await deleteDoc(doc(db, 'users', user.uid, 'formations', deleteFormationConfirm.id));
      setDeleteFormationConfirm(null);
    } catch (error) {
      console.error('Error deleting formation:', error);
      showToast('Failed to delete formation', 'error');
    } finally {
      setDeletingFormation(false);
    }
  };

  const addFormationElement = (type: 'X' | 'O', label: string) => {
    const startX = 50;
    const startY = type === 'O' ? 65 : 35;
    
    const baseLabel = label;
    const existingCount = formationElements.filter(el => {
      const elBaseLabel = el.label.replace(/\d+$/, '');
      return elBaseLabel === baseLabel;
    }).length;
    
    const numberedLabel = `${baseLabel}${existingCount + 1}`;
    const offset = (existingCount % 5) * 8 - 16;
    
    const newEl: PlayElement = {
      id: Date.now().toString(),
      type,
      label: numberedLabel,
      x: Math.max(5, Math.min(95, startX + offset)),
      y: startY + (Math.random() * 4 - 2),
      color: type === 'O' ? 'bg-blue-600' : 'bg-red-600'
    };
    setFormationElements([...formationElements, newEl]);
    setSelectedElementId(newEl.id);
  };

  const deleteFormationElement = () => {
    if (selectedElementId) {
      setFormationElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementId(null);
    }
  };

  // Get plays count for a formation
  const getFormationPlayCount = (formationId: string) => {
    return savedPlays.filter(p => p.formationId === formationId).length;
  };

  // Get actual play count for a system playbook (only count plays that exist)
  const getActualPlaybookPlayCount = (playbook: SystemPlaybook) => {
    if (!playbook.playIds) return 0;
    return playbook.playIds.filter(playId => systemPlays.some(sp => sp.id === playId)).length;
  };

  // Start creating a play from a formation
  const startPlayFromFormation = (formation: Formation) => {
    setPlayFormationId(formation.id);
    setPlayFormationName(formation.name);
    setCategory(formation.category);
    setElements(formation.elements.map(el => ({ ...el, id: Date.now().toString() + Math.random() })));
    setRoutes([]);
    setLines([]);
    setShapes([]);
    setPlayName('New Play');
    setPlayNotes('');
    setOffenseType('Run');
    setSelectedPlayId(null);
    setDrawingMode('select');
    setActiveTab('editor');
  };

  // Filter formations by search and category
  const filteredFormations = formations.filter(f => {
    if (filterCategory !== 'All' && f.category !== filterCategory) return false;
    if (formationSearch && !f.name.toLowerCase().includes(formationSearch.toLowerCase())) return false;
    return true;
  });

  // --- SAVE / LOAD / DELETE ---

  const handleSavePlay = async () => {
    if (!user?.uid || !playName.trim()) return;
    if (!playFormationId) {
      showToast('Please select a formation first from the Formations tab', 'error');
      return;
    }
    const playData: Partial<CoachPlay> = { 
      name: playName, 
      notes: playNotes || '',
      category, 
      formationId: playFormationId,
      formationName: playFormationName,
      elements, 
      routes,
      lines: lines || [],
      shapes: shapes || [],
      coachId: user.uid,
      coachName: userData?.name || 'Unknown Coach',
      updatedAt: serverTimestamp()
    };
    
    // Add offense type only for offensive plays
    if (category === 'Offense') {
      playData.offenseType = offenseType;
    }
    
    // Add defense type only for defensive plays
    if (category === 'Defense') {
      playData.defenseType = defenseType;
    }
    
    try {
      if (selectedPlayId) {
        await setDoc(doc(db, 'users', user.uid, 'plays', selectedPlayId), playData, { merge: true });
      } else {
        playData.createdAt = serverTimestamp();
        const newDoc = await addDoc(collection(db, 'users', user.uid, 'plays'), playData);
        setSelectedPlayId(newDoc.id);
      }
      showToast('Play saved to your collection!');
      // Clear the board and navigate to library tab after saving
      clearBoard();
      setActiveTab('library');
    } catch (error) { 
      console.error("Error saving play:", error);
      showToast('Failed to save play. Please try again.', 'error');
    }
  };

  const loadPlay = (play: CoachPlay) => {
      setPlayName(play.name);
      setPlayNotes(play.notes || '');
      setCategory(play.category);
      setOffenseType(play.offenseType || 'Run');
      setDefenseType(play.defenseType || 'Normal');
      setPlayFormationId(play.formationId || null);
      setPlayFormationName(play.formationName || '');
      
      // Normalize coordinates if they seem compressed
      const els = play.elements || [];
      const rts = play.routes || [];
      
      if (els.length > 0) {
        const xValues = els.map(e => e.x);
        const yValues = els.map(e => e.y);
        const xRange = Math.max(...xValues) - Math.min(...xValues);
        const yRange = Math.max(...yValues) - Math.min(...yValues);
        
        const needsXSpread = xRange < 40 && els.length > 3;
        const needsYSpread = yRange < 25 && els.length > 3;
        
        if (needsXSpread || needsYSpread) {
          const xMin = Math.min(...xValues);
          const xMax = Math.max(...xValues);
          const yMin = Math.min(...yValues);
          const yMax = Math.max(...yValues);
          
          const normalizedElements = els.map(el => {
            let newX = el.x;
            let newY = el.y;
            
            if (needsXSpread && xMax !== xMin) {
              newX = 10 + ((el.x - xMin) / (xMax - xMin)) * 80;
            }
            
            if (needsYSpread && yMax !== yMin) {
              newY = 20 + ((el.y - yMin) / (yMax - yMin)) * 60;
            }
            
            return { ...el, x: newX, y: newY };
          });
          
          const normalizedRoutes = rts.map(route => ({
            ...route,
            points: route.points.map(pt => {
              let newX = pt.x;
              let newY = pt.y;
              
              if (needsXSpread && xMax !== xMin) {
                newX = 10 + ((pt.x - xMin) / (xMax - xMin)) * 80;
              }
              if (needsYSpread && yMax !== yMin) {
                newY = 20 + ((pt.y - yMin) / (yMax - yMin)) * 60;
              }
              
              return { x: Math.max(5, Math.min(95, newX)), y: Math.max(5, Math.min(95, newY)) };
            })
          }));
          
          setElements(normalizedElements);
          setRoutes(normalizedRoutes);
        } else {
          setElements(els);
          setRoutes(rts);
        }
      } else {
        setElements(els);
        setRoutes(rts);
      }
      
      setSelectedPlayId(play.id);
      setSelectedElementId(null);
      setSelectedRouteId(null);
      setSelectedLineId(null);
      setSelectedShapeId(null);
      setLines(play.lines || []);
      setShapes(play.shapes || []);
      setActiveTab('editor');
  };

  const clearBoard = () => {
      setElements([]);
      setRoutes([]);
      setLines([]);
      setShapes([]);
      setPlayName('New Play');
      setPlayNotes('');
      setCategory('Offense');
      setOffenseType('Run');
      setPlayFormationId(null);
      setPlayFormationName('');
      setSelectedPlayId(null);
      setSelectedElementId(null);
      setSelectedRouteId(null);
      setSelectedLineId(null);
      setSelectedShapeId(null);
      setDrawingMode('select');
      cancelDrawing();
  };

  // Handle cloned play from AI
  // Handle cloned play from AI
  const handlePlayCloned = (
    clonedElements: PlayElement[], 
    clonedLines: DrawingLine[], 
    clonedShapes: PlayShape[], 
    suggestedCategory: 'Offense' | 'Defense' | 'Special Teams'
  ) => {
    // Clear the board first
    clearBoard();
    
    // Set the new elements from the cloned play
    setElements(clonedElements);
    setLines(clonedLines); // Routes come as standalone lines since they're not attached to players
    setShapes(clonedShapes);
    setCategory(suggestedCategory);
    setPlayName('Cloned Play');
    setPlayNotes('Play cloned from image. Adjust positions and add routes as needed.');
    
    // Switch to editor tab
    setActiveTab('editor');
    
    // Show success message
    showToast('Play cloned! Select a formation and adjust as needed.');
  };

  const deletePlay = async () => {
      if (!deletePlayConfirm || !user?.uid) return;
      setDeletingPlay(true);
      try {
        const playToDelete = savedPlays.find(p => p.id === deletePlayConfirm.id);
        
        // Delete the play itself
        await deleteDoc(doc(db, 'users', user.uid, 'plays', deletePlayConfirm.id));
        
        // Also remove from team playbook if it was assigned
        if (playToDelete) {
          await removePlayFromTeamPlaybooks(deletePlayConfirm.id);
        }
        
        if (selectedPlayId === deletePlayConfirm.id) clearBoard();
        setDeletePlayConfirm(null);
        showToast('Play deleted successfully');
      } catch (error) {
        console.error(error);
        showToast('Failed to delete play', 'error');
      } finally {
        setDeletingPlay(false);
      }
  };

  // Quick delete by system play ID (for removing from Add Plays modal)
  const removePlayBySystemPlayId = async (systemPlayId: string) => {
    if (!user?.uid) return;
    
    const playToDelete = savedPlays.find(p => p.systemPlayId === systemPlayId);
    if (!playToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'plays', playToDelete.id));
      await removePlayFromTeamPlaybooks(playToDelete.id);
      if (selectedPlayId === playToDelete.id) clearBoard();
      showToast('Play removed from folder');
    } catch (error) {
      console.error(error);
      showToast('Failed to remove play', 'error');
    }
  };

  // Remove a play from all team playbooks
  const removePlayFromTeamPlaybooks = async (playId: string) => {
    if (!user?.uid || !userData?.teamId) return;
    
    try {
      // Get all teams the coach is associated with
      const teamIds = userData.teamIds || [userData.teamId];
      
      for (const teamId of teamIds) {
        // Query team playbook entries that have this play
        const teamPlaybookQuery = query(
          collection(db, 'teams', teamId, 'teamPlaybook'),
          where('playId', '==', playId)
        );
        const snapshot = await getDocs(teamPlaybookQuery);
        
        // Delete each matching entry
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, 'teams', teamId, 'teamPlaybook', docSnap.id));
        }
      }
    } catch (error) {
      console.error('Error removing play from team playbooks:', error);
    }
  };

  // --- UNIMPORT SYSTEM PLAYBOOK ---
  const unimportPlaybook = async () => {
    if (!unimportConfirm || !user?.uid) return;
    setUnimportingPlaybook(true);
    
    try {
      // Find all plays from this system playbook
      const playsToDelete = savedPlays.filter(p => {
        if (!p.systemPlayId || !p.isSystemPlay) return false;
        // Check if the system play is part of this playbook
        const systemPlaybook = systemPlaybooks.find(sp => sp.id === unimportConfirm.playbookId);
        return systemPlaybook?.playIds.includes(p.systemPlayId);
      });
      
      // Delete each imported play and remove from team playbooks
      for (const play of playsToDelete) {
        await deleteDoc(doc(db, 'users', user.uid, 'plays', play.id));
        await removePlayFromTeamPlaybooks(play.id);
      }
      
      // Remove the import record
      await deleteDoc(doc(db, 'users', user.uid, 'importedPlaybooks', unimportConfirm.playbookId));
      
      showToast(`Unimported "${unimportConfirm.playbookName}" and removed ${playsToDelete.length} plays`);
      setUnimportConfirm(null);
    } catch (error) {
      console.error('Error unimporting playbook:', error);
      showToast('Failed to unimport playbook', 'error');
    } finally {
      setUnimportingPlaybook(false);
    }
  };

  // --- IMPORT SYSTEM PLAYBOOK (just records access, doesn't add plays) ---
  const importPlaybook = async (playbook: SystemPlaybook) => {
    if (!user?.uid || importingPlaybook) return;
    
    // Check if already imported
    if (importedPlaybooks.some(ip => ip.playbookId === playbook.id)) {
      showToast('Playbook already imported', 'error');
      return;
    }
    
    setImportingPlaybook(true);
    try {
      // Just record the import - don't add plays automatically
      // Coach will use "Add Plays" to select which plays they want
      const importRecord = {
        playbookId: playbook.id,
        playbookName: playbook.name,
        category: playbook.category,
        importedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', user.uid, 'importedPlaybooks', playbook.id), importRecord);
      
      showToast(`"${playbook.name}" imported! Click "Add Plays" to add plays to your folder.`);
      setSelectedSystemPlaybook(null);
    } catch (error) {
      console.error('Error importing playbook:', error);
      showToast('Failed to import playbook', 'error');
    } finally {
      setImportingPlaybook(false);
    }
  };

  // --- ADD SELECTED PLAYS FROM IMPORTED PLAYBOOK ---
  const addSelectedPlaysToFolder = async () => {
    if (!user?.uid || !addPlaysFromPlaybook || selectedPlaysToAdd.length === 0) return;
    
    setAddingPlays(true);
    try {
      // Get existing system play IDs to avoid duplicates
      const existingPlaySystemIds = savedPlays.filter(p => p.systemPlayId).map(p => p.systemPlayId);
      
      let addedCount = 0;
      for (const systemPlayId of selectedPlaysToAdd) {
        // Skip if already in folder
        if (existingPlaySystemIds.includes(systemPlayId)) continue;
        
        const sysPlay = systemPlays.find(p => p.id === systemPlayId);
        if (!sysPlay) continue;
        
        const playData = {
          name: sysPlay.name,
          notes: sysPlay.notes || '',
          category: sysPlay.category,
          offenseType: sysPlay.offenseType || null,
          defenseType: sysPlay.defenseType || null,
          formationId: '',
          formationName: sysPlay.formationName || '',
          elements: sysPlay.elements || [],
          routes: sysPlay.routes || [],
          systemPlayId: sysPlay.id,
          isSystemPlay: true,
          coachId: user.uid,
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'users', user.uid, 'plays'), playData);
        addedCount++;
      }
      
      showToast(`Added ${addedCount} play${addedCount !== 1 ? 's' : ''} to your folder!`);
      setAddPlaysFromPlaybook(null);
      setSelectedPlaysToAdd([]);
    } catch (error) {
      console.error('Error adding plays:', error);
      showToast('Failed to add plays', 'error');
    } finally {
      setAddingPlays(false);
    }
  };

  // Toggle play selection for adding
  const togglePlaySelection = (playId: string) => {
    setSelectedPlaysToAdd(prev => 
      prev.includes(playId) 
        ? prev.filter(id => id !== playId)
        : [...prev, playId]
    );
  };

  // Select/deselect all plays from a playbook
  const toggleSelectAllPlays = (playbook: SystemPlaybook) => {
    const playbookPlayIds = playbook.playIds;
    const allSelected = playbookPlayIds.every(id => selectedPlaysToAdd.includes(id));
    
    if (allSelected) {
      setSelectedPlaysToAdd(prev => prev.filter(id => !playbookPlayIds.includes(id)));
    } else {
      setSelectedPlaysToAdd(prev => [...new Set([...prev, ...playbookPlayIds])]);
    }
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

  // Filter plays by category, offense type, defense type, and formation
  const filteredPlays = savedPlays.filter(p => {
    // Filter by formation
    if (filterFormationId && p.formationId !== filterFormationId) return false;
    // Filter by category
    if (filterCategory !== 'All' && p.category !== filterCategory) return false;
    // Filter by offense type (only when viewing offense plays)
    if ((filterCategory === 'Offense' || filterCategory === 'All') && p.category === 'Offense') {
      if (filterOffenseType !== 'All' && p.offenseType !== filterOffenseType) return false;
    }
    // Filter by defense type (only when viewing defense plays)
    if ((filterCategory === 'Defense' || filterCategory === 'All') && p.category === 'Defense') {
      if (filterDefenseType !== 'All' && p.defenseType !== filterDefenseType) return false;
    }
    return true;
  });

  // Check if current play is a system play (read-only)
  const currentPlay = savedPlays.find(p => p.id === selectedPlayId);
  const isCurrentPlayReadOnly = currentPlay?.isSystemPlay === true;

  // Group plays by formation for organized display
  const playsByFormation = savedPlays.reduce((acc, play) => {
    const formationId = play.formationId || 'unknown';
    if (!acc[formationId]) acc[formationId] = [];
    acc[formationId].push(play);
    return acc;
  }, {} as Record<string, CoachPlay[]>);

  // --- FIELD COMPONENT (reused in both normal and fullscreen) ---
  const renderField = (isFullscreenMode: boolean = false) => {
    // Generate SVG path for different line types
    const generateLinePath = (line: DrawingLine): string => {
      if (line.points.length < 2) return '';
      
      const points = line.points;
      let pathD = `M ${points[0].x} ${points[0].y}`;
      
      if (line.lineType === 'curved') {
        // Smooth curved line using quadratic bezier
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          pathD += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
        }
        // Final line to last point
        if (points.length > 1) {
          pathD += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
        }
      } else if (line.lineType === 'zigzag') {
        // Zigzag pattern
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const numZigs = Math.max(2, Math.floor(dist / 3));
          const perpX = -dy / dist * 1.5;
          const perpY = dx / dist * 1.5;
          
          for (let j = 1; j <= numZigs; j++) {
            const t = j / numZigs;
            const baseX = prev.x + dx * t;
            const baseY = prev.y + dy * t;
            const offset = (j % 2 === 0 ? 1 : -1);
            if (j < numZigs) {
              pathD += ` L ${baseX + perpX * offset} ${baseY + perpY * offset}`;
            } else {
              pathD += ` L ${curr.x} ${curr.y}`;
            }
          }
        }
      } else {
        // Straight lines for all other types
        for (let i = 1; i < points.length; i++) {
          pathD += ` L ${points[i].x} ${points[i].y}`;
        }
      }
      
      return pathD;
    };
    
    // Get stroke dash array for line type
    const getStrokeDash = (lineType: LineType): string => {
      if (lineType === 'dashed') return '2,1';
      return 'none';
    };
    
    // Get marker end for line type - arrows for routes, block marker for blocks
    const getMarkerEnd = (line: DrawingLine): string => {
      if (line.lineType === 'block') {
        return `url(#block-${line.color.replace('#','')})`;
      }
      // Route, curved, solid, and dashed get arrows to show direction
      if (line.lineType === 'route' || line.lineType === 'curved' || line.lineType === 'solid' || line.lineType === 'dashed') {
        return `url(#arrow-${line.color.replace('#','')})`;
      }
      // Zigzag doesn't get an end marker
      return '';
    };
    
    // Render shape SVG
    const renderShapeSvg = (shape: PlayShape) => {
      const { shapeType, x, y, width, height, color } = shape;
      const halfW = width / 2;
      const halfH = height / 2;
      
      switch (shapeType) {
        case 'circle':
          return <ellipse cx={x} cy={y} rx={halfW} ry={halfH} fill="none" stroke={color} strokeWidth="0.5" />;
        case 'oval':
          return <ellipse cx={x} cy={y} rx={halfW} ry={halfH * 0.6} fill="none" stroke={color} strokeWidth="0.5" />;
        case 'square':
          return <rect x={x - halfW} y={y - halfH} width={width} height={height} fill="none" stroke={color} strokeWidth="0.5" />;
        case 'rectangle':
          return <rect x={x - halfW} y={y - halfH * 0.6} width={width} height={height * 0.6} fill="none" stroke={color} strokeWidth="0.5" />;
        case 'triangle':
          return <polygon points={`${x},${y - halfH} ${x - halfW},${y + halfH} ${x + halfW},${y + halfH}`} fill="none" stroke={color} strokeWidth="0.5" />;
        case 'diamond':
          return <polygon points={`${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}`} fill="none" stroke={color} strokeWidth="0.5" />;
        case 'x':
          return (
            <g>
              <line x1={x - halfW} y1={y - halfH} x2={x + halfW} y2={y + halfH} stroke={color} strokeWidth="0.5" />
              <line x1={x + halfW} y1={y - halfH} x2={x - halfW} y2={y + halfH} stroke={color} strokeWidth="0.5" />
            </g>
          );
        case 'smallCircle':
          return <circle cx={x} cy={y} r={Math.min(halfW, halfH) * 0.5} fill="none" stroke={color} strokeWidth="0.5" />;
        default:
          return null;
      }
    };
    
    return (
    <div 
      ref={canvasRef}
      onMouseMove={handleMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onTouchMove={handleMove}
      onTouchEnd={stopDrag}
      onMouseDown={handleCanvasClick}
      onTouchStart={handleCanvasClick}
      className={`w-full h-full relative select-none overflow-hidden ${drawingMode !== 'select' ? 'cursor-crosshair' : ''}`}
      style={{ 
        backgroundColor: isDarkMode ? '#1f1f1f' : '#e5e5e5',
        touchAction: 'none'
      }}
    >
      {/* FIELD MARKINGS - subtle grid lines */}
      <div className="absolute inset-0 pointer-events-none" style={{ 
        backgroundImage: isDarkMode 
          ? `repeating-linear-gradient(to bottom, transparent 0%, transparent 9%, rgba(255,255,255,0.1) 9%, rgba(255,255,255,0.1) 10%)`
          : `repeating-linear-gradient(to bottom, transparent 0%, transparent 9%, rgba(0,0,0,0.1) 9%, rgba(0,0,0,0.1) 10%)`,
        backgroundSize: '100% 10%' 
      }}></div>
      
      {/* Hash marks */}
      <div className="absolute left-1/3 right-1/3 top-0 bottom-0 pointer-events-none" style={{ 
        backgroundImage: isDarkMode
          ? `repeating-linear-gradient(to bottom, transparent 0%, transparent 4%, rgba(255,255,255,0.08) 4%, rgba(255,255,255,0.08) 5%)`
          : `repeating-linear-gradient(to bottom, transparent 0%, transparent 4%, rgba(0,0,0,0.08) 4%, rgba(0,0,0,0.08) 5%)`,
        backgroundSize: '100% 10%',
        borderLeft: isDarkMode ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed rgba(0,0,0,0.1)', 
        borderRight: isDarkMode ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed rgba(0,0,0,0.1)' 
      }}></div>

      {/* End zones - subtle */}
      <div className={`absolute top-0 left-0 right-0 h-[8%] pointer-events-none ${isDarkMode ? 'bg-orange-600/20' : 'bg-orange-500/15'}`}></div>
      <div className={`absolute bottom-0 left-0 right-0 h-[8%] pointer-events-none ${isDarkMode ? 'bg-orange-600/20' : 'bg-orange-500/15'}`}></div>

      {/* SVG LAYER - Routes, Lines, and Shapes */}
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 10, pointerEvents: drawingMode === 'select' ? 'auto' : 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {/* Arrow markers for routes */}
          {LINE_COLORS.map(color => (
            <React.Fragment key={color}>
              <marker id={`arrow-${color.replace('#','')}`} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
                <polygon points="0 0, 4 1.5, 0 3" fill={color} />
              </marker>
              <marker id={`block-${color.replace('#','')}`} markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
                <line x1="0" y1="0" x2="0" y2="5" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
              </marker>
            </React.Fragment>
          ))}
          {/* Legacy route colors */}
          {ROUTE_COLORS.map(color => (
            <marker key={`legacy-${color}`} id={`arrow-coach-${color.replace('#','')}`} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
              <polygon points="0 0, 4 1.5, 0 3" fill={color} />
            </marker>
          ))}
        </defs>
        
        {/* Legacy routes (player-attached) */}
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
              markerEnd={`url(#arrow-coach-${route.color.replace('#','')})`}
            />
          );
        })}
        
        {/* Drawing lines - with clickable hitbox */}
        {lines.map(line => (
          <g key={line.id}>
            {/* Invisible wider stroke for click detection */}
            {drawingMode === 'select' && (
              <path
                d={generateLinePath(line)}
                stroke="transparent"
                strokeWidth="3"
                fill="none"
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLineId(line.id);
                  setSelectedElementId(null);
                  setSelectedRouteId(null);
                  setSelectedShapeId(null);
                }}
              />
            )}
            {/* Visible line */}
            <path
              d={generateLinePath(line)}
              stroke={line.color}
              strokeWidth="0.5"
              fill="none"
              strokeDasharray={getStrokeDash(line.lineType)}
              markerEnd={getMarkerEnd(line)}
              className={selectedLineId === line.id ? 'opacity-100' : 'opacity-90'}
              style={selectedLineId === line.id ? { filter: 'drop-shadow(0 0 2px white)' } : {}}
            />
          </g>
        ))}
        
        {/* Current drawing line */}
        {currentDrawingLine && (
          <path
            d={generateLinePath(currentDrawingLine)}
            stroke={currentDrawingLine.color}
            strokeWidth="0.5"
            fill="none"
            strokeDasharray={getStrokeDash(currentDrawingLine.lineType)}
            markerEnd={getMarkerEnd(currentDrawingLine)}
            opacity="0.7"
          />
        )}
        
        {/* Shapes - with clickable hitbox */}
        {shapes.map(shape => (
          <g key={shape.id}>
            {/* Invisible clickable area for selection */}
            {drawingMode === 'select' && (
              <rect
                x={shape.x - shape.width / 2 - 1}
                y={shape.y - shape.height / 2 - 1}
                width={shape.width + 2}
                height={shape.height + 2}
                fill="transparent"
                style={{ cursor: 'pointer', pointerEvents: 'fill' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedShapeId(shape.id);
                  setSelectedElementId(null);
                  setSelectedRouteId(null);
                  setSelectedLineId(null);
                }}
              />
            )}
            {/* Visible shape */}
            <g className={selectedShapeId === shape.id ? 'opacity-100' : 'opacity-90'}
               style={selectedShapeId === shape.id ? { filter: 'drop-shadow(0 0 2px white)' } : {}}>
              {renderShapeSvg(shape)}
            </g>
          </g>
        ))}
        
        {/* Current shape being placed */}
        {currentShape && currentShape.width > 0 && (
          <g opacity="0.7">
            {renderShapeSvg(currentShape)}
          </g>
        )}
      </svg>

      {/* LINE POINTS - hidden for clean lines, only show when selected for editing */}
      {/* Points are not rendered - lines are freehand drawn and shown as clean paths */}
      
      {/* SHAPE HANDLES (draggable) */}
      {shapes.map(shape => (
        <div
          key={shape.id}
          onMouseDown={(e) => startDrag(e, 'shape', shape.id)}
          onTouchStart={(e) => startDrag(e, 'shape', shape.id)}
          className={`absolute cursor-move z-15 ${
            selectedShapeId === shape.id ? 'ring-2 ring-yellow-400 ring-offset-1' : ''
          }`}
          style={{
            left: `${shape.x - shape.width / 2}%`,
            top: `${shape.y - shape.height / 2}%`,
            width: `${shape.width}%`,
            height: `${shape.height}%`,
            pointerEvents: drawingMode === 'select' ? 'auto' : 'none'
          }}
        />
      ))}

      {/* ROUTE POINTS (draggable) - legacy */}
      {routes.map(route => (
        <React.Fragment key={route.id}>
          {route.points.map((pt, index) => (
            <div
              key={`${route.id}-${index}`}
              onMouseDown={(e) => startDrag(e, 'route_point', route.id, index)}
              onTouchStart={(e) => startDrag(e, 'route_point', route.id, index)}
              className={`absolute rounded-full shadow-lg z-20 cursor-move hover:scale-125 active:scale-150 ${
                selectedRouteId === route.id ? 'ring-2 ring-white ring-offset-1 ring-offset-green-800' : ''
              }`}
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
          className={`absolute flex items-center font-bold text-white shadow-lg border-2 z-30 cursor-move ${
            el.id === selectedElementId ? 'border-yellow-400 ring-4 ring-yellow-400/40 scale-110' : 'border-white/80'
          } ${el.color} ${el.type === 'O' ? 'rounded-full justify-center' : 'justify-center'}`}
          style={{ 
            left: `${el.x}%`, 
            top: `${el.y}%`, 
            transform: 'translate(-50%, -50%)',
            width: isFullscreenMode ? '44px' : '36px',
            height: isFullscreenMode ? '44px' : '36px',
            fontSize: isFullscreenMode ? '12px' : '10px',
            ...(el.type === 'X' ? { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0', paddingTop: isFullscreenMode ? '14px' : '12px' } : {})
          }}
        >
          {el.label || el.type}
        </div>
      ))}

      {/* Drawing mode indicator */}
      {(isDrawingLine || isPlacingShape) && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/80 text-white px-3 py-1 rounded-full text-xs z-40">
          {isDrawingLine ? 'Drag to draw line' : 'Drag to size shape'}
        </div>
      )}

      {/* Empty state hint */}
      {elements.length === 0 && lines.length === 0 && shapes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm text-center">
            <Users className="w-5 h-5 mx-auto mb-1 opacity-60" />
            <span className="opacity-80">Add players to get started</span>
          </div>
        </div>
      )}
    </div>
  );
  };

  // --- FORMATION FIELD (for designing formations) ---
  const renderFormationField = () => (
    <div 
      ref={formationCanvasRef}
      onMouseMove={handleMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onTouchMove={handleMove}
      onTouchEnd={stopDrag}
      onMouseDown={handleCanvasClick}
      onTouchStart={handleCanvasClick}
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
      
      {/* End zones */}
      <div className="absolute top-0 left-0 right-0 h-[8%] bg-orange-600/40 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-orange-600/40 pointer-events-none"></div>

      {/* FORMATION PLAYER ELEMENTS */}
      {formationElements.map(el => (
        <div
          key={el.id}
          onMouseDown={(e) => startDrag(e, 'element', el.id)}
          onTouchStart={(e) => startDrag(e, 'element', el.id)}
          className={`absolute flex items-center font-bold text-white shadow-lg border-2 z-30 cursor-move ${
            el.id === selectedElementId ? 'border-yellow-400 ring-4 ring-yellow-400/40 scale-110' : 'border-white/80'
          } ${el.color} ${el.type === 'O' ? 'rounded-full justify-center' : 'justify-center'}`}
          style={{ 
            left: `${el.x}%`, 
            top: `${el.y}%`, 
            transform: 'translate(-50%, -50%)',
            width: '36px',
            height: '36px',
            fontSize: '10px',
            ...(el.type === 'X' ? { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0', paddingTop: '12px' } : {})
          }}
        >
          {el.label || el.type}
        </div>
      ))}

      {/* Empty state hint for formation */}
      {formationElements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm text-center">
            <Layers className="w-5 h-5 mx-auto mb-1 opacity-60" />
            <span className="opacity-80">Add players to create formation</span>
          </div>
        </div>
      )}
      
      {/* Formation label */}
      <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs font-bold z-40">
        FORMATION: {formationName || 'Untitled'}
      </div>
    </div>
  );

  // --- ADD PLAYERS PANEL (Mobile Bottom Sheet Style) ---
  const renderAddPlayersPanel = () => (
    <div className={`${isFullscreen ? 'fixed inset-x-0 bottom-0 z-40' : ''}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setShowAddPlayers(!showAddPlayers)}
        className={`w-full py-3 flex items-center justify-center gap-2 font-semibold transition-colors ${
          showAddPlayers 
            ? 'bg-slate-700 text-white' 
            : 'bg-orange-600 hover:bg-orange-700 text-white'
        }`}
      >
        {showAddPlayers ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {showAddPlayers ? 'Hide Tools' : 'Drawing Tools'}
      </button>
      
      {/* Expandable Panel */}
      {showAddPlayers && (
        <div className="bg-slate-900 border-t border-slate-700 p-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Mode Selection */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { setDrawingMode('select'); cancelDrawing(); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                drawingMode === 'select' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <MousePointer className="w-3 h-3" /> Select
            </button>
            <button
              onClick={() => { setDrawingMode('line'); cancelDrawing(); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                drawingMode === 'line' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Minus className="w-3 h-3" /> Lines
            </button>
            <button
              onClick={() => { setDrawingMode('shape'); cancelDrawing(); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                drawingMode === 'shape' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Square className="w-3 h-3" /> Shapes
            </button>
          </div>
          
          {/* Line Types - shown when line mode selected */}
          {drawingMode === 'line' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-yellow-400 uppercase">Line Type</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedLineType('route')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedLineType === 'route' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="24" height="16" viewBox="0 0 24 16">
                    <line x1="2" y1="14" x2="20" y2="4" stroke="currentColor" strokeWidth="2" />
                    <polygon points="22,2 18,2 18,6" fill="currentColor" />
                  </svg>
                  <span className="text-[10px]">Route</span>
                </button>
                <button
                  onClick={() => setSelectedLineType('curved')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedLineType === 'curved' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="24" height="16" viewBox="0 0 24 16">
                    <path d="M2,14 Q12,0 22,4" stroke="currentColor" strokeWidth="2" fill="none" />
                    <polygon points="22,2 18,2 20,6" fill="currentColor" />
                  </svg>
                  <span className="text-[10px]">Curved</span>
                </button>
                <button
                  onClick={() => setSelectedLineType('zigzag')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedLineType === 'zigzag' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="24" height="16" viewBox="0 0 24 16">
                    <path d="M2,14 L6,6 L10,14 L14,6 L18,14 L22,4" stroke="currentColor" strokeWidth="2" fill="none" />
                    <polygon points="22,2 18,2 20,6" fill="currentColor" />
                  </svg>
                  <span className="text-[10px]">Motion</span>
                </button>
                <button
                  onClick={() => setSelectedLineType('block')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedLineType === 'block' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="24" height="16" viewBox="0 0 24 16">
                    <line x1="2" y1="14" x2="20" y2="4" stroke="currentColor" strokeWidth="2" />
                    <line x1="18" y1="2" x2="22" y2="6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="text-[10px]">Block</span>
                </button>
                <button
                  onClick={() => setSelectedLineType('solid')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedLineType === 'solid' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="24" height="16" viewBox="0 0 24 16">
                    <line x1="2" y1="14" x2="22" y2="4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="text-[10px]">Solid</span>
                </button>
                <button
                  onClick={() => setSelectedLineType('dashed')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedLineType === 'dashed' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="24" height="16" viewBox="0 0 24 16">
                    <line x1="2" y1="14" x2="22" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4,2" />
                  </svg>
                  <span className="text-[10px]">Dashed</span>
                </button>
              </div>
              
              {/* Line Color */}
              <p className="text-xs font-bold text-yellow-400 uppercase mt-3">Line Color</p>
              <div className="flex flex-wrap gap-2">
                {LINE_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedLineColor(color)}
                    className={`w-7 h-7 rounded-full border-2 ${
                      selectedLineColor === color ? 'border-yellow-400 ring-2 ring-yellow-400/50' : 'border-slate-500'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Shape Types - shown when shape mode selected */}
          {drawingMode === 'shape' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-cyan-400 uppercase">Shape Type</p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setSelectedShapeType('circle')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedShapeType === 'circle' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Circle className="w-5 h-5" />
                  <span className="text-[9px]">Circle</span>
                </button>
                <button
                  onClick={() => setSelectedShapeType('oval')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedShapeType === 'oval' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="20" height="14" viewBox="0 0 20 14">
                    <ellipse cx="10" cy="7" rx="9" ry="5" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                  <span className="text-[9px]">Oval</span>
                </button>
                <button
                  onClick={() => setSelectedShapeType('square')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedShapeType === 'square' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Square className="w-5 h-5" />
                  <span className="text-[9px]">Square</span>
                </button>
                <button
                  onClick={() => setSelectedShapeType('rectangle')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedShapeType === 'rectangle' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="20" height="14" viewBox="0 0 20 14">
                    <rect x="1" y="3" width="18" height="8" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                  <span className="text-[9px]">Rect</span>
                </button>
                <button
                  onClick={() => setSelectedShapeType('triangle')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedShapeType === 'triangle' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Triangle className="w-5 h-5" />
                  <span className="text-[9px]">Triangle</span>
                </button>
                <button
                  onClick={() => setSelectedShapeType('diamond')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedShapeType === 'diamond' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <polygon points="8,1 15,8 8,15 1,8" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                  <span className="text-[9px]">Diamond</span>
                </button>
                <button
                  onClick={() => setSelectedShapeType('x')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedShapeType === 'x' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                  <span className="text-[9px]">X Mark</span>
                </button>
                <button
                  onClick={() => setSelectedShapeType('smallCircle')}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 ${
                    selectedShapeType === 'smallCircle' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                  <span className="text-[9px]">Dot</span>
                </button>
              </div>
              
              {/* Shape Color */}
              <p className="text-xs font-bold text-cyan-400 uppercase mt-3">Shape Color</p>
              <div className="flex flex-wrap gap-2">
                {SHAPE_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedShapeColor(color)}
                    className={`w-7 h-7 rounded-full border-2 ${
                      selectedShapeColor === color ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-slate-500'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Players - shown in select mode */}
          {drawingMode === 'select' && (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );

  // --- SELECTION ACTIONS BAR ---
  const renderSelectionActions = () => {
    const hasSelection = selectedElementId || selectedRouteId || selectedLineId || selectedShapeId;
    if (!hasSelection) return null;
    
    return (
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30">
        <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700 p-1.5 flex items-center gap-1.5">
          {selectedElementId && (
            <button 
              onClick={deleteSelection} 
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Eraser className="w-3 h-3"/> Delete Player
            </button>
          )}
          {selectedRouteId && (
            <button 
              onClick={deleteSelection} 
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Eraser className="w-3 h-3"/> Delete Route
            </button>
          )}
          {selectedLineId && (
            <button 
              onClick={deleteSelectedDrawing} 
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Eraser className="w-3 h-3"/> Delete Line
            </button>
          )}
          {selectedShapeId && (
            <button 
              onClick={deleteSelectedDrawing} 
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Eraser className="w-3 h-3"/> Delete Shape
            </button>
          )}
          <button 
            onClick={() => { setSelectedElementId(null); setSelectedRouteId(null); setSelectedLineId(null); setSelectedShapeId(null); }}
            className="text-slate-400 hover:text-white p-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Count plays by category
  const offenseCount = savedPlays.filter(p => p.category === 'Offense').length;
  const defenseCount = savedPlays.filter(p => p.category === 'Defense').length;
  const specialTeamsCount = savedPlays.filter(p => p.category === 'Special Teams').length;

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
        className="fixed inset-0 z-50 bg-black flex flex-col"
        style={{ touchAction: 'none' }}
      >
        {/* Floating Header - overlays field */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 py-2 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setIsFullscreen(false); setShowAddPlayers(false); }}
              className="bg-slate-900/90 hover:bg-slate-800 text-white p-2 rounded-lg transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </button>
            <input 
              value={playName}
              onChange={(e) => setPlayName(e.target.value)}
              className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm font-semibold w-32"
              placeholder="Play Name"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={clearBoard}
              className="bg-slate-900/90 backdrop-blur-sm hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-xs transition-colors"
            >
              New
            </button>
            <button 
              onClick={handleSavePlay}
              className="bg-emerald-600/90 backdrop-blur-sm hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Save className="w-3 h-3" /> Save
            </button>
          </div>
        </div>

        {/* Field - TRUE FULLSCREEN, fills entire space */}
        <div className="flex-1 relative overflow-hidden">
          {renderField(true)}
          {renderSelectionActions()}
        </div>

        {/* Bottom Add Players Panel */}
        {renderAddPlayersPanel()}
        
        {/* Drag hint */}
        {elements.length > 0 && !isDragging && !showAddPlayers && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/60 text-white/70 text-xs px-3 py-1 rounded-full flex items-center gap-2 pointer-events-none">
            <Move className="w-3 h-3" /> Drag to move
          </div>
        )}
      </div>
    )}

    {/* ==================== NORMAL VIEW ==================== */}
    {!isFullscreen && (
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">My Playbook</h2>
              <p className="text-orange-100 text-sm">Design and manage your plays</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 rounded-lg px-3 py-1 text-white text-sm">
              <span className="font-bold">{savedPlays.length}</span> plays
            </div>
            {onClose && (
              <button onClick={onClose} className="text-white/80 hover:text-white p-2">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 p-3 flex justify-center gap-6">
          <div className="text-center">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{offenseCount}</p>
            <p className="text-xs text-slate-500">Offense</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{defenseCount}</p>
            <p className="text-xs text-slate-500">Defense</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{specialTeamsCount}</p>
            <p className="text-xs text-slate-500">Special Teams</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* LEFT SIDEBAR */}
          <div className="w-full lg:w-80 flex flex-col border-r border-slate-200 dark:border-zinc-800 shrink-0">
              
              {/* TABS */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <button 
                    onClick={() => setActiveTab('formations')}
                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 transition-colors ${activeTab === 'formations' ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                  >
                      <Layers className="w-4 h-4"/> Forms
                  </button>
                  <button 
                    onClick={() => setActiveTab('editor')}
                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 transition-colors ${activeTab === 'editor' ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                  >
                      <PenTool className="w-4 h-4"/> Design
                  </button>
                  <button 
                    onClick={() => setActiveTab('library')}
                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 transition-colors ${activeTab === 'library' ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                  >
                      <FolderOpen className="w-4 h-4"/> Plays
                  </button>
                  <button 
                    onClick={() => setActiveTab('import')}
                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 transition-colors ${activeTab === 'import' ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                  >
                      <Download className="w-4 h-4"/> Import
                  </button>
              </div>

              {/* FORMATIONS TAB */}
              {activeTab === 'formations' && (
                <div className="flex-1 overflow-y-auto max-h-[500px]">
                  {/* Formation Design Mode */}
                  {isFormationDesignMode ? (
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          {editingFormation ? 'Edit Formation' : 'New Formation'}
                        </h3>
                        <button 
                          onClick={clearFormationDesigner}
                          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <input
                        value={formationName}
                        onChange={e => setFormationName(e.target.value)}
                        placeholder="Formation Name (e.g., I-Formation, Shotgun)"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm"
                      />
                      
                      <select
                        value={formationCategory}
                        onChange={e => setFormationCategory(e.target.value as any)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm"
                      >
                        <option>Offense</option>
                        <option>Defense</option>
                        <option>Special Teams</option>
                      </select>
                      
                      {/* Add Players to Formation */}
                      <div>
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Offense Players</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {['QB', 'RB', 'WR', 'TE', 'C', 'G', 'T'].map(pos => (
                            <button 
                              key={pos} 
                              onClick={() => addFormationElement('O', pos)} 
                              className="bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-800/50 rounded-lg text-xs py-2 font-bold transition-colors"
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-2">Defense Players</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {['DL', 'DE', 'DT', 'LB', 'CB', 'S', 'N'].map(pos => (
                            <button 
                              key={pos} 
                              onClick={() => addFormationElement('X', pos)} 
                              className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-800/50 rounded-lg text-xs py-2 font-bold transition-colors"
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Selection Actions */}
                      {selectedElementId && formationElements.some(el => el.id === selectedElementId) && (
                        <button 
                          onClick={deleteFormationElement}
                          className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                        >
                          <Eraser className="w-4 h-4" /> Remove Player
                        </button>
                      )}
                      
                      <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <button 
                          onClick={handleSaveFormation}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" /> Save Formation
                        </button>
                        <button 
                          onClick={clearFormationDesigner}
                          className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white p-2.5 rounded-lg text-sm font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Formation List */
                    <div className="p-3 space-y-3">
                      {/* Search & Filter */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          value={formationSearch}
                          onChange={e => setFormationSearch(e.target.value)}
                          placeholder="Search formations..."
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                        />
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {['All', 'Offense', 'Defense', 'Special Teams'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => setFilterCategory(cat as any)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              filterCategory === cat
                                ? cat === 'Offense' ? 'bg-blue-500 text-white'
                                : cat === 'Defense' ? 'bg-red-500 text-white'
                                : cat === 'Special Teams' ? 'bg-purple-500 text-white'
                                : 'bg-orange-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {cat === 'Special Teams' ? 'ST' : cat}
                          </button>
                        ))}
                      </div>
                      
                      {/* New Formation Button */}
                      <button
                        onClick={() => setIsFormationDesignMode(true)}
                        className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 hover:border-orange-400 hover:text-orange-500 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Create Formation
                      </button>
                      
                      {/* Formations List */}
                      {filteredFormations.length === 0 ? (
                        <div className="text-center py-8">
                          <Layers className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                          <p className="text-slate-500 text-sm">No formations yet</p>
                          <p className="text-slate-400 text-xs mt-1">Create a formation to start building plays</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredFormations.map(formation => {
                            const playCount = getFormationPlayCount(formation.id);
                            return (
                              <div 
                                key={formation.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 group hover:border-orange-300 dark:hover:border-orange-600 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                        formation.category === 'Offense' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                        : formation.category === 'Defense' ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                                        : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                                      }`}>{formation.category}</span>
                                      <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{formation.name}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                      {formation.elements?.length || 0} players • {playCount} plays
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => startPlayFromFormation(formation)}
                                      className="p-1.5 text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded"
                                      title="Create play from formation"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => loadFormationForEdit(formation)}
                                      className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                                      title="Edit formation"
                                    >
                                      <PenTool className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteFormationConfirm({ id: formation.id, name: formation.name, playCount })}
                                      className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                      title="Delete formation"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Quick action to create play */}
                                <button
                                  onClick={() => startPlayFromFormation(formation)}
                                  className="w-full mt-2 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-slate-600 dark:text-slate-400 hover:text-orange-600 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                >
                                  <ChevronRight className="w-3 h-3" /> Create Play
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* EDITOR TAB */}
              {activeTab === 'editor' && (
                  <div className="flex-1 overflow-y-auto p-4 max-h-[500px]">
                    <div className="space-y-4">
                      {/* System Play Read-Only Notice */}
                      {isCurrentPlayReadOnly && (
                        <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm font-medium">System Play (Read-Only)</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            This play is from a system playbook and auto-syncs with admin updates.
                          </p>
                        </div>
                      )}
                      
                      {/* Formation Info */}
                      {playFormationId ? (
                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                          <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Formation</p>
                          <p className="font-bold text-orange-800 dark:text-orange-300">{playFormationName}</p>
                        </div>
                      ) : formations.length > 0 ? (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">Select a Formation</p>
                          <select
                            className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm"
                            value=""
                            onChange={(e) => {
                              const selectedFormation = formations.find(f => f.id === e.target.value);
                              if (selectedFormation) {
                                startPlayFromFormation(selectedFormation);
                              }
                            }}
                          >
                            <option value="">-- Choose a formation --</option>
                            {formations.map(f => (
                              <option key={f.id} value={f.id}>{f.name} ({f.category})</option>
                            ))}
                          </select>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            Or <button onClick={() => setActiveTab('formations')} className="underline font-medium">create a new formation</button>
                            {' '} | {' '}
                            <button 
                              onClick={() => setShowCloneModal(true)} 
                              className="underline font-medium text-purple-600 dark:text-purple-400 inline-flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" /> clone from image
                            </button>
                          </p>
                        </div>
                      ) : (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> No Formations Available
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            Create a formation first before designing plays.
                          </p>
                          <button
                            onClick={() => setActiveTab('formations')}
                            className="mt-2 text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded font-medium"
                          >
                            Create Formation
                          </button>
                        </div>
                      )}
                      
                      <input 
                        value={playName} 
                        onChange={e => setPlayName(e.target.value)} 
                        disabled={isCurrentPlayReadOnly}
                        className={`w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm ${isCurrentPlayReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Play Name" 
                      />

                      {/* Play Notes */}
                      <div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Play Notes</p>
                        <textarea 
                          value={playNotes} 
                          onChange={e => setPlayNotes(e.target.value)} 
                          disabled={isCurrentPlayReadOnly}
                          rows={3}
                          className={`w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm resize-none ${isCurrentPlayReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                          placeholder="Add notes about this play (e.g., player assignments, key reads, execution tips)..." 
                        />
                      </div>

                      {/* Offense Play Type - Run or Pass (only shown for Offense) */}
                      {category === 'Offense' && (
                        <div>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Play Type</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => !isCurrentPlayReadOnly && setOffenseType('Run')}
                              disabled={isCurrentPlayReadOnly}
                              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                                offenseType === 'Run'
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              } ${isCurrentPlayReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              🏃 Run
                            </button>
                            <button
                              onClick={() => !isCurrentPlayReadOnly && setOffenseType('Pass')}
                              disabled={isCurrentPlayReadOnly}
                              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                                offenseType === 'Pass'
                                  ? 'bg-sky-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              } ${isCurrentPlayReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              🏈 Pass
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Defense Play Type - Normal or Blitz (only shown for Defense) */}
                      {category === 'Defense' && (
                        <div>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Defense Type</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDefenseType('Normal')}
                              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                                defenseType === 'Normal'
                                  ? 'bg-slate-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              🛡️ Normal
                            </button>
                            <button
                              onClick={() => setDefenseType('Blitz')}
                              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                                defenseType === 'Blitz'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              ⚡ Blitz
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Offense Players - Hidden for read-only plays */}
                      {!isCurrentPlayReadOnly && (
                        <div>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Add/Adjust Offense</p>
                            <div className="grid grid-cols-4 gap-1.5">
                                {['QB', 'RB', 'WR', 'TE', 'C', 'G', 'T'].map(pos => (
                                    <button key={pos} onClick={() => addElement('O', pos)} className="bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-800/50 rounded-lg text-xs py-2 font-bold transition-colors">{pos}</button>
                                ))}
                            </div>
                        </div>
                      )}

                      {/* Defense Players - Hidden for read-only plays */}
                      {!isCurrentPlayReadOnly && (
                        <div>
                            <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-2">Add/Adjust Defense</p>
                            <div className="grid grid-cols-4 gap-1.5">
                                {['DL', 'DE', 'DT', 'LB', 'CB', 'S', 'N'].map(pos => (
                                    <button key={pos} onClick={() => addElement('X', pos)} className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-800/50 rounded-lg text-xs py-2 font-bold transition-colors">{pos}</button>
                                ))}
                            </div>
                        </div>
                      )}

                      {/* Selection Actions - Hidden for read-only plays */}
                      {!isCurrentPlayReadOnly && (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                            {selectedElementId ? (
                                <button onClick={deleteSelection} className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">
                                    <Eraser className="w-4 h-4"/> Remove Player
                                </button>
                            ) : selectedRouteId ? (
                                <button onClick={deleteSelection} className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">
                                    <Eraser className="w-4 h-4"/> Remove Route
                                </button>
                            ) : selectedLineId ? (
                                <button onClick={deleteSelectedDrawing} className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">
                                    <Eraser className="w-4 h-4"/> Remove Line
                                </button>
                            ) : selectedShapeId ? (
                                <button onClick={deleteSelectedDrawing} className="w-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/50 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">
                                    <Eraser className="w-4 h-4"/> Remove Shape
                                </button>
                            ) : null}
                        </div>
                      )}

                      {/* Drawing Tools - Always Visible */}
                      {!isCurrentPlayReadOnly && playFormationId && (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Drawing Tools</p>
                          
                          {/* Mode Selection */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setDrawingMode('select'); }}
                              className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                                drawingMode === 'select' ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <MousePointer className="w-3 h-3" /> Select
                            </button>
                            <button
                              onClick={() => { setDrawingMode('line'); }}
                              className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                                drawingMode === 'line' ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Minus className="w-3 h-3" /> Lines
                            </button>
                            <button
                              onClick={() => { setDrawingMode('shape'); }}
                              className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                                drawingMode === 'shape' ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Square className="w-3 h-3" /> Shapes
                            </button>
                          </div>
                          
                          {/* Line Type Selection */}
                          {drawingMode === 'line' && (
                            <div className="space-y-2">
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">Click and drag to draw line</p>
                              <div className="grid grid-cols-3 gap-1">
                                {(['route', 'curved', 'zigzag', 'block', 'solid', 'dashed'] as LineType[]).map(type => (
                                  <button
                                    key={type}
                                    onClick={() => setSelectedLineType(type)}
                                    className={`p-1.5 rounded text-[10px] font-medium capitalize ${selectedLineType === type ? 'bg-yellow-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {LINE_COLORS.slice(0, 8).map(color => (
                                  <button
                                    key={color}
                                    onClick={() => setSelectedLineColor(color)}
                                    className={`w-5 h-5 rounded border-2 ${selectedLineColor === color ? 'border-orange-500 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Shape Type Selection */}
                          {drawingMode === 'shape' && (
                            <div className="space-y-2">
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">Click and drag to draw shape</p>
                              <div className="grid grid-cols-4 gap-1">
                                {(['circle', 'square', 'triangle', 'diamond', 'x', 'dot'] as ShapeType[]).map(type => (
                                  <button
                                    key={type}
                                    onClick={() => setSelectedShapeType(type)}
                                    className={`p-1.5 rounded text-[10px] font-medium capitalize ${selectedShapeType === type ? 'bg-purple-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {LINE_COLORS.slice(0, 8).map(color => (
                                  <button
                                    key={color}
                                    onClick={() => setSelectedShapeColor(color)}
                                    className={`w-5 h-5 rounded border-2 ${selectedShapeColor === color ? 'border-orange-500 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Save/Cancel Buttons */}
                      <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                          {isCurrentPlayReadOnly ? (
                            <button onClick={() => setActiveTab('library')} className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Plays
                            </button>
                          ) : (
                            <>
                              <button onClick={handleSavePlay} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"><Save className="w-4 h-4"/> Save</button>
                              <button onClick={clearBoard} className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"><X className="w-4 h-4"/> Cancel</button>
                            </>
                          )}
                      </div>
                    </div>
                  </div>
              )}

              {/* LIBRARY TAB */}
              {activeTab === 'library' && (
                  <div className="flex-1 overflow-y-auto max-h-[500px]">
                    {/* Category Filter */}
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                      {/* Formation Filter */}
                      <div>
                        <p className="text-xs text-slate-500 mb-1.5">Filter by Formation:</p>
                        <select
                          value={filterFormationId || ''}
                          onChange={e => setFilterFormationId(e.target.value || null)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm"
                        >
                          <option value="">All Formations</option>
                          {formations.map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.category})</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {['All', 'Offense', 'Defense', 'Special Teams'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => {
                              setFilterCategory(cat as any);
                              if (cat !== 'Offense' && cat !== 'All') setFilterOffenseType('All');
                              if (cat !== 'Defense' && cat !== 'All') setFilterDefenseType('All');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              filterCategory === cat
                                ? cat === 'Offense' ? 'bg-blue-500 text-white'
                                : cat === 'Defense' ? 'bg-red-500 text-white'
                                : cat === 'Special Teams' ? 'bg-purple-500 text-white'
                                : 'bg-orange-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                            }`}
                          >
                            {cat === 'Special Teams' ? 'ST' : cat}
                          </button>
                        ))}
                      </div>
                      
                      {/* Offense Type Filter - Only show when viewing Offense or All */}
                      {(filterCategory === 'Offense' || filterCategory === 'All') && (
                        <div className="flex gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 self-center">Type:</span>
                          {['All', 'Run', 'Pass'].map(type => (
                            <button
                              key={type}
                              onClick={() => setFilterOffenseType(type as any)}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                filterOffenseType === type
                                  ? type === 'Run' ? 'bg-emerald-500 text-white'
                                  : type === 'Pass' ? 'bg-sky-500 text-white'
                                  : 'bg-slate-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {type === 'Run' ? '🏃 Run' : type === 'Pass' ? '🏈 Pass' : 'All'}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Defense Type Filter - Only show when viewing Defense or All */}
                      {(filterCategory === 'Defense' || filterCategory === 'All') && (
                        <div className="flex gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 self-center">Defense:</span>
                          {['All', 'Normal', 'Blitz'].map(type => (
                            <button
                              key={type}
                              onClick={() => setFilterDefenseType(type as any)}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                filterDefenseType === type
                                  ? type === 'Blitz' ? 'bg-amber-500 text-white'
                                  : type === 'Normal' ? 'bg-slate-500 text-white'
                                  : 'bg-slate-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {type === 'Blitz' ? '⚡ Blitz' : type === 'Normal' ? '🛡️ Normal' : 'All'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 space-y-2">
                      {filteredPlays.length === 0 && (
                        <div className="text-center py-8">
                          <FolderOpen className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                          <p className="text-slate-500 text-sm">
                            {formations.length === 0
                              ? 'Create a formation first to start building plays!'
                              : filterFormationId
                                ? 'No plays with this formation yet.'
                                : filterCategory === 'All' && filterOffenseType === 'All' 
                                  ? 'No plays saved yet. Select a formation and create plays!' 
                                  : filterOffenseType !== 'All' 
                                    ? `No ${filterOffenseType.toLowerCase()} plays yet.`
                                    : `No ${filterCategory} plays yet.`}
                          </p>
                          {formations.length === 0 && (
                            <button
                              onClick={() => setActiveTab('formations')}
                              className="mt-2 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded font-medium"
                            >
                              Go to Formations
                            </button>
                          )}
                        </div>
                      )}
                      {filteredPlays.map(play => (
                          <div 
                            key={play.id} 
                            onClick={() => setPreviewPlay(play)} 
                            className={`p-3 rounded-lg border cursor-pointer group transition-colors ${selectedPlayId === play.id ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-500/50' : play.isSystemPlay ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-600'}`}
                          >
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{play.name}</p>
                                      {/* System Play Lock Icon */}
                                      {play.isSystemPlay && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center gap-0.5" title="System play (auto-synced)">
                                          <Lock className="w-3 h-3" /> System
                                        </span>
                                      )}
                                      {/* Run/Pass Tag for Offense plays */}
                                      {play.category === 'Offense' && play.offenseType && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                          play.offenseType === 'Run' 
                                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400'
                                        }`}>
                                          {play.offenseType === 'Run' ? '🏃 RUN' : '🏈 PASS'}
                                        </span>
                                      )}
                                      {/* Blitz Tag for Defense plays */}
                                      {play.category === 'Defense' && play.defenseType === 'Blitz' && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                                          ⚡ BLITZ
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                          play.category === 'Offense' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                          : play.category === 'Defense' ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                                          : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                                        }`}>{play.category}</span>
                                        {play.formationName && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-medium">
                                            {play.formationName}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-slate-500">{play.elements?.length || 0} players</span>
                                    </div>
                                </div>
                                {/* Action buttons */}
                                <div className="flex items-center gap-1 ml-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setPreviewPlay(play); }} 
                                    className="text-slate-400 hover:text-blue-500 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="View Play"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {/* Edit button - only for non-system plays */}
                                  {!play.isSystemPlay && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); loadPlay(play); }} 
                                      className="text-slate-400 hover:text-orange-500 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                      title="Edit Play"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {/* Delete button - for all plays including system plays */}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setDeletePlayConfirm({ id: play.id, name: play.name }); }} 
                                    className="text-slate-400 hover:text-red-500 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Play"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                          </div>
                      ))}
                    </div>
                  </div>
              )}

              {/* IMPORT TAB */}
              {activeTab === 'import' && (
                <div className="flex-1 overflow-y-auto max-h-[500px] p-3">
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">System Playbooks</h3>
                    <p className="text-xs text-slate-500">Import pre-made playbooks from your organization</p>
                  </div>

                  {systemPlaybooks.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                      <p className="text-slate-500 text-sm">No system playbooks available yet.</p>
                      <p className="text-slate-400 text-xs mt-1">Check back later for playbooks from your admin.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {systemPlaybooks.map(pb => {
                        const isImported = importedPlaybooks.some(ip => ip.playbookId === pb.id);
                        return (
                          <div 
                            key={pb.id} 
                            className={`p-3 rounded-lg border transition-colors ${isImported ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300'}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-900 dark:text-white text-sm">{pb.name}</p>
                                  {isImported && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 font-medium flex items-center gap-0.5">
                                      <CheckCircle className="w-3 h-3" /> Imported
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    pb.category === 'Offense' ? 'bg-blue-100 text-blue-600' 
                                    : pb.category === 'Defense' ? 'bg-red-100 text-red-600'
                                    : 'bg-purple-100 text-purple-600'
                                  }`}>{pb.category}</span>
                                  <span className="text-[10px] text-slate-500">{getActualPlaybookPlayCount(pb)} plays</span>
                                </div>
                                {pb.description && (
                                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{pb.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              {!isImported ? (
                                <>
                                  <button
                                    onClick={() => setSelectedSystemPlaybook(pb)}
                                    className="flex-1 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                  >
                                    Preview
                                  </button>
                                  <button
                                    onClick={() => importPlaybook(pb)}
                                    disabled={importingPlaybook}
                                    className="flex-1 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded flex items-center justify-center gap-1 disabled:opacity-50"
                                  >
                                    {importingPlaybook ? (
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <><Download className="w-3 h-3" /> Import</>
                                    )}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => {
                                      setAddPlaysFromPlaybook(pb);
                                      setSelectedPlaysToAdd([]);
                                    }}
                                    className="flex-1 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" /> Add Plays
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const importRecord = importedPlaybooks.find(ip => ip.playbookId === pb.id);
                                      if (importRecord) setUnimportConfirm(importRecord);
                                    }}
                                    className="flex-1 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded flex items-center justify-center gap-1 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                                  >
                                    <Trash2 className="w-3 h-3" /> Unimport
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* RIGHT: THE FIELD */}
          <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-[400px] p-4">
            {/* Field with fixed aspect ratio */}
            <div className="flex-1 flex items-center justify-center bg-slate-200 dark:bg-slate-900 rounded-xl p-2 overflow-hidden relative">
              <div 
                className="w-full h-full rounded-lg overflow-hidden border-4 border-slate-300 dark:border-slate-700 shadow-xl relative"
                style={{ 
                  maxHeight: '100%',
                  aspectRatio: `${FIELD_ASPECT_RATIO}`,
                }}
              >
                {/* Show formation field when in formation design mode, otherwise show play field */}
                {isFormationDesignMode ? renderFormationField() : renderField(false)}
                
                {/* Desktop fullscreen button - only for play design */}
                {!isFormationDesignMode && (
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="absolute top-3 right-3 z-40 bg-slate-900/80 hover:bg-slate-800 text-white p-2.5 rounded-lg transition-all shadow-lg backdrop-blur-sm opacity-0 hover:opacity-100 focus:opacity-100 hidden lg:block"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* Selection actions overlay - only for play design */}
              {!isFormationDesignMode && renderSelectionActions()}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* DELETE PLAY CONFIRMATION MODAL */}
    {deletePlayConfirm && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Play</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
              </div>
            </div>
            <button 
              onClick={() => setDeletePlayConfirm(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-orange-500" />
              <p className="font-bold text-slate-900 dark:text-white">{deletePlayConfirm.name}</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
            Are you sure you want to delete this play? If this play is assigned to any teams, it will also be removed from those teams.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={() => setDeletePlayConfirm(null)}
              disabled={deletingPlay}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={deletePlay}
              disabled={deletingPlay}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {deletingPlay ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Play
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* DELETE FORMATION CONFIRMATION MODAL */}
    {deleteFormationConfirm && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Formation</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400">This will also delete all plays</p>
              </div>
            </div>
            <button 
              onClick={() => setDeleteFormationConfirm(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-orange-500" />
              <p className="font-bold text-slate-900 dark:text-white">{deleteFormationConfirm.name}</p>
            </div>
          </div>
          
          {deleteFormationConfirm.playCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Warning: {deleteFormationConfirm.playCount} play{deleteFormationConfirm.playCount > 1 ? 's' : ''} will be deleted
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                All plays using this formation will be permanently removed.
              </p>
            </div>
          )}
          
          <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
            Are you sure you want to delete this formation? This action cannot be undone.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteFormationConfirm(null)}
              disabled={deletingFormation}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={deleteFormation}
              disabled={deletingFormation}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {deletingFormation ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Formation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Playbook Preview Modal */}
    {selectedSystemPlaybook && !previewingPlay && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedSystemPlaybook.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  selectedSystemPlaybook.category === 'Offense' ? 'bg-blue-100 text-blue-600' 
                  : selectedSystemPlaybook.category === 'Defense' ? 'bg-red-100 text-red-600'
                  : 'bg-purple-100 text-purple-600'
                }`}>{selectedSystemPlaybook.category}</span>
                <span className="text-xs text-slate-500">{getActualPlaybookPlayCount(selectedSystemPlaybook)} plays</span>
              </div>
            </div>
            <button onClick={() => setSelectedSystemPlaybook(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {selectedSystemPlaybook.description && (
            <div className="px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">{selectedSystemPlaybook.description}</p>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Plays Included (tap to preview):</p>
            <div className="space-y-2">
              {systemPlays
                .filter(p => selectedSystemPlaybook.playIds.includes(p.id))
                .map(play => (
                  <div 
                    key={play.id} 
                    onClick={() => setPreviewingPlay(play)}
                    className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors border border-transparent hover:border-orange-300 dark:hover:border-orange-600"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{play.name}</span>
                        {play.category === 'Offense' && play.offenseType && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                            play.offenseType === 'Run' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'
                          }`}>
                            {play.offenseType === 'Run' ? '🏃' : '🏈'}
                          </span>
                        )}
                        {play.category === 'Defense' && play.defenseType === 'Blitz' && (
                          <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-amber-100 text-amber-600">⚡</span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                    {play.formationName && (
                      <span className="text-[10px] text-slate-500">Formation: {play.formationName}</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
          
          <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
            <button 
              onClick={() => setSelectedSystemPlaybook(null)}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium"
            >
              Close
            </button>
            {!importedPlaybooks.some(ip => ip.playbookId === selectedSystemPlaybook.id) ? (
              <button 
                onClick={() => importPlaybook(selectedSystemPlaybook)}
                disabled={importingPlaybook}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {importingPlaybook ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Download className="w-4 h-4" /> Import Playbook</>
                )}
              </button>
            ) : (
              <button disabled className="flex-1 py-2.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg font-medium flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Already Imported
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Single Play Preview Modal */}
    {previewingPlay && (
      <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{previewingPlay.name}</h3>
                {previewingPlay.category === 'Offense' && previewingPlay.offenseType && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    previewingPlay.offenseType === 'Run' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'
                  }`}>
                    {previewingPlay.offenseType === 'Run' ? '🏃 RUN' : '🏈 PASS'}
                  </span>
                )}
                {previewingPlay.category === 'Defense' && previewingPlay.defenseType === 'Blitz' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-600">⚡ BLITZ</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  previewingPlay.category === 'Offense' ? 'bg-blue-100 text-blue-600' 
                  : previewingPlay.category === 'Defense' ? 'bg-red-100 text-red-600'
                  : 'bg-purple-100 text-purple-600'
                }`}>{previewingPlay.category}</span>
                {previewingPlay.formationName && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">{previewingPlay.formationName}</span>
                )}
                <span className="text-[10px] text-slate-500">{previewingPlay.elements?.length || 0} players</span>
              </div>
            </div>
            <button onClick={() => setPreviewingPlay(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Play Field Preview */}
          <div className="flex-1 p-4 bg-slate-100 dark:bg-zinc-950 overflow-hidden">
            <div 
              className="w-full rounded-lg overflow-hidden border-4 border-slate-300 dark:border-zinc-700 shadow-xl relative"
              style={{ aspectRatio: '16/9', maxHeight: '400px' }}
            >
              <div className="w-full h-full relative select-none" style={{ backgroundColor: '#2e7d32' }}>
                {/* Field markings */}
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 9%, rgba(255,255,255,0.3) 9%, rgba(255,255,255,0.3) 10%)`, backgroundSize: '100% 10%' }}></div>
                <div className="absolute top-0 left-0 right-0 h-[8%] bg-orange-600/40 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-orange-600/40 pointer-events-none"></div>

                {/* Routes SVG */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    {ROUTE_COLORS.map(color => (
                      <marker key={`preview-${color}`} id={`arrow-preview-${color.replace('#','')}`} markerWidth="2" markerHeight="1.5" refX="1.8" refY="0.75" orient="auto">
                        <polygon points="0 0, 2 0.75, 0 1.5" fill={color} />
                      </marker>
                    ))}
                  </defs>
                  {(previewingPlay.routes || []).map(route => {
                    const startEl = previewingPlay.elements?.find(e => e.id === route.startElementId);
                    if (!startEl) return null;
                    let pathD = `M ${startEl.x} ${startEl.y}`;
                    route.points.forEach(pt => { pathD += ` L ${pt.x} ${pt.y}`; });
                    return (
                      <path key={route.id} d={pathD} stroke={route.color} strokeWidth="0.5" fill="none"
                        strokeDasharray={route.style === 'dashed' ? '2,1' : 'none'}
                        markerEnd={`url(#arrow-preview-${route.color.replace('#','')})`}
                      />
                    );
                  })}
                </svg>

                {/* Route points */}
                {(previewingPlay.routes || []).map(route => (
                  <React.Fragment key={route.id}>
                    {route.points.map((pt, index) => (
                      <div
                        key={`${route.id}-${index}`}
                        className="absolute rounded-full shadow-lg z-20"
                        style={{ backgroundColor: route.color, left: `${pt.x}%`, top: `${pt.y}%`, transform: 'translate(-50%, -50%)', width: '10px', height: '10px' }}
                      />
                    ))}
                  </React.Fragment>
                ))}

                {/* Player elements */}
                {(previewingPlay.elements || []).map(el => (
                  <div
                    key={el.id}
                    className={`absolute flex items-center font-bold text-white shadow-lg border-2 z-30 border-white/80 ${el.color} ${el.type === 'O' ? 'rounded-full justify-center' : 'justify-center'}`}
                    style={{ 
                      left: `${el.x}%`, 
                      top: `${el.y}%`, 
                      transform: 'translate(-50%, -50%)', 
                      width: '28px', 
                      height: '28px', 
                      fontSize: '8px',
                      ...(el.type === 'X' ? { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0', paddingTop: '9px' } : {})
                    }}
                  >
                    {el.label || el.type}
                  </div>
                ))}

                {/* Play name overlay */}
                <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs font-bold z-40">
                  {previewingPlay.name}
                </div>
              </div>
            </div>
          </div>
          
          {/* Notes Section */}
          {previewingPlay.notes && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Notes</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{previewingPlay.notes}</p>
            </div>
          )}
          
          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-zinc-800">
            <button 
              onClick={() => setPreviewingPlay(null)}
              className="w-full py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Toast Notification */}
    {toast && (
      <div 
        className="fixed inset-0 z-[100]" 
        onClick={() => setToast(null)}
      >
        <div 
          className={`fixed top-4 right-4 z-[101] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in cursor-pointer ${
            toast.type === 'success' 
              ? 'bg-green-600 text-white' 
              : 'bg-red-600 text-white'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setToast(null);
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{toast.message}</span>
          <button className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )}

    {/* PLAY PREVIEW MODAL */}
    {previewPlay && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Eye className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{previewPlay.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    previewPlay.category === 'Offense' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    : previewPlay.category === 'Defense' ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                    : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                  }`}>{previewPlay.category}</span>
                  {previewPlay.isSystemPlay && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
                      <Lock className="w-3 h-3" /> System
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setPreviewPlay(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Field Preview */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="bg-slate-200 dark:bg-slate-900 rounded-xl p-2">
              <div 
                className="w-full rounded-lg overflow-hidden border-4 border-slate-300 dark:border-slate-700 shadow-xl relative"
                style={{ aspectRatio: `${FIELD_ASPECT_RATIO}`, backgroundColor: '#2e7d32' }}
              >
                {/* Field markings */}
                <div className="absolute inset-0 pointer-events-none" style={{ 
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 9%, rgba(255,255,255,0.3) 9%, rgba(255,255,255,0.3) 10%)`,
                  backgroundSize: '100% 10%' 
                }}></div>
                
                {/* SVG Layer for routes, lines, and shapes */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    {ROUTE_COLORS.map(color => (
                      <React.Fragment key={color}>
                        <marker id={`arrow-preview-${color.replace('#','')}`} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
                          <polygon points="0 0, 4 1.5, 0 3" fill={color} />
                        </marker>
                        <marker id={`block-preview-${color.replace('#','')}`} markerWidth="4" markerHeight="5" refX="2" refY="2.5" orient="auto">
                          <line x1="2" y1="0" x2="2" y2="5" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
                        </marker>
                      </React.Fragment>
                    ))}
                  </defs>
                  
                  {/* Legacy routes */}
                  {(previewPlay.routes || []).map(route => {
                    const startEl = (previewPlay.elements || []).find(e => e.id === route.startElementId);
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
                        markerEnd={`url(#arrow-preview-${route.color.replace('#','')})`}
                      />
                    );
                  })}

                  {/* Drawing lines */}
                  {(previewPlay.lines || []).map(line => {
                    if (line.points.length < 2) return null;
                    const points = line.points;
                    let pathD = `M ${points[0].x} ${points[0].y}`;
                    
                    if (line.lineType === 'curved') {
                      for (let i = 1; i < points.length; i++) {
                        const prev = points[i - 1];
                        const curr = points[i];
                        const midX = (prev.x + curr.x) / 2;
                        const midY = (prev.y + curr.y) / 2;
                        pathD += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
                      }
                      if (points.length > 1) {
                        pathD += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
                      }
                    } else if (line.lineType === 'zigzag') {
                      for (let i = 1; i < points.length; i++) {
                        const prev = points[i - 1];
                        const curr = points[i];
                        const dx = curr.x - prev.x;
                        const dy = curr.y - prev.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const numZigs = Math.max(2, Math.floor(dist / 3));
                        const perpX = -dy / dist * 1.5;
                        const perpY = dx / dist * 1.5;
                        
                        for (let j = 1; j <= numZigs; j++) {
                          const t = j / numZigs;
                          const baseX = prev.x + dx * t;
                          const baseY = prev.y + dy * t;
                          const offset = (j % 2 === 0 ? 1 : -1);
                          if (j < numZigs) {
                            pathD += ` L ${baseX + perpX * offset} ${baseY + perpY * offset}`;
                          } else {
                            pathD += ` L ${curr.x} ${curr.y}`;
                          }
                        }
                      }
                    } else {
                      for (let i = 1; i < points.length; i++) {
                        pathD += ` L ${points[i].x} ${points[i].y}`;
                      }
                    }

                    const markerEnd = line.lineType === 'block' 
                      ? `url(#block-preview-${line.color.replace('#','')})` 
                      : (line.lineType === 'route' || line.lineType === 'curved' || line.lineType === 'solid' || line.lineType === 'dashed')
                        ? `url(#arrow-preview-${line.color.replace('#','')})`
                        : '';

                    return (
                      <path
                        key={line.id}
                        d={pathD}
                        stroke={line.color}
                        strokeWidth="0.5"
                        fill="none"
                        strokeDasharray={line.lineType === 'dashed' ? '2,1' : 'none'}
                        markerEnd={markerEnd}
                      />
                    );
                  })}

                  {/* Shapes */}
                  {(previewPlay.shapes || []).map(shape => {
                    const { shapeType, x, y, width, height, color } = shape;
                    const halfW = width / 2;
                    const halfH = height / 2;
                    
                    switch (shapeType) {
                      case 'circle':
                        return <ellipse key={shape.id} cx={x} cy={y} rx={halfW} ry={halfH} fill="none" stroke={color} strokeWidth="0.5" />;
                      case 'oval':
                        return <ellipse key={shape.id} cx={x} cy={y} rx={halfW} ry={halfH * 0.6} fill="none" stroke={color} strokeWidth="0.5" />;
                      case 'square':
                        return <rect key={shape.id} x={x - halfW} y={y - halfH} width={width} height={height} fill="none" stroke={color} strokeWidth="0.5" />;
                      case 'rectangle':
                        return <rect key={shape.id} x={x - halfW} y={y - halfH * 0.6} width={width} height={height * 0.6} fill="none" stroke={color} strokeWidth="0.5" />;
                      case 'triangle':
                        return <polygon key={shape.id} points={`${x},${y - halfH} ${x - halfW},${y + halfH} ${x + halfW},${y + halfH}`} fill="none" stroke={color} strokeWidth="0.5" />;
                      case 'diamond':
                        return <polygon key={shape.id} points={`${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}`} fill="none" stroke={color} strokeWidth="0.5" />;
                      case 'x':
                        return (
                          <g key={shape.id}>
                            <line x1={x - halfW} y1={y - halfH} x2={x + halfW} y2={y + halfH} stroke={color} strokeWidth="0.5" />
                            <line x1={x + halfW} y1={y - halfH} x2={x - halfW} y2={y + halfH} stroke={color} strokeWidth="0.5" />
                          </g>
                        );
                      case 'smallCircle':
                        return <circle key={shape.id} cx={x} cy={y} r={Math.min(halfW, halfH) * 0.5} fill="none" stroke={color} strokeWidth="0.5" />;
                      default:
                        return null;
                    }
                  })}
                </svg>

                {/* Player elements */}
                {(previewPlay.elements || []).map(el => (
                  <div
                    key={el.id}
                    className={`absolute flex items-center font-bold text-white shadow-lg border-2 z-30 border-white/80 ${el.color} ${el.type === 'O' ? 'rounded-full justify-center' : 'justify-center'}`}
                    style={{ 
                      left: `${el.x}%`, 
                      top: `${el.y}%`, 
                      transform: 'translate(-50%, -50%)', 
                      width: '32px', 
                      height: '32px', 
                      fontSize: '10px',
                      ...(el.type === 'X' ? { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0', paddingTop: '10px' } : {})
                    }}
                  >
                    {el.label || el.type}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Notes Section */}
          {previewPlay.notes && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Notes</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{previewPlay.notes}</p>
            </div>
          )}
          
          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
            <button 
              onClick={() => setPreviewPlay(null)}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
            {!previewPlay.isSystemPlay && (
              <button 
                onClick={() => { loadPlay(previewPlay); setPreviewPlay(null); }}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Edit2 className="w-4 h-4" /> Edit Play
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* UNIMPORT PLAYBOOK CONFIRMATION MODAL */}
    {unimportConfirm && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unimport Playbook</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400">Remove all plays from this import</p>
              </div>
            </div>
            <button 
              onClick={() => setUnimportConfirm(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-orange-500" />
              <p className="font-bold text-slate-900 dark:text-white">{unimportConfirm.playbookName}</p>
            </div>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              All plays from this system playbook will be removed
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              This will also remove them from any team playbooks they were added to.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setUnimportConfirm(null)}
              disabled={unimportingPlaybook}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={unimportPlaybook}
              disabled={unimportingPlaybook}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {unimportingPlaybook ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Unimport
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ADD PLAYS FROM IMPORTED PLAYBOOK MODAL */}
    {addPlaysFromPlaybook && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Plays to Folder</h3>
                <p className="text-sm text-slate-500">{addPlaysFromPlaybook.name}</p>
              </div>
            </div>
            <button 
              onClick={() => { setAddPlaysFromPlaybook(null); setSelectedPlaysToAdd([]); }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Select All / Count */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleSelectAllPlays(addPlaysFromPlaybook)}
                className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
              >
                {addPlaysFromPlaybook.playIds.every(id => selectedPlaysToAdd.includes(id)) 
                  ? 'Deselect All' 
                  : 'Select All'}
              </button>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {selectedPlaysToAdd.filter(id => addPlaysFromPlaybook.playIds.includes(id)).length} of {getActualPlaybookPlayCount(addPlaysFromPlaybook)} selected
            </span>
          </div>
          
          {/* Play List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {systemPlays
              .filter(p => addPlaysFromPlaybook.playIds.includes(p.id))
              .map(play => {
                const isSelected = selectedPlaysToAdd.includes(play.id);
                const alreadyAdded = savedPlays.some(sp => sp.systemPlayId === play.id);
                
                return (
                  <div 
                    key={play.id}
                    onClick={() => !alreadyAdded && togglePlaySelection(play.id)}
                    className={`p-3 rounded-lg border transition-all ${
                      alreadyAdded 
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 cursor-default'
                        : isSelected 
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 cursor-pointer' 
                          : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox / Status */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        alreadyAdded
                          ? 'bg-emerald-500 border-emerald-500'
                          : isSelected 
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {(isSelected || alreadyAdded) && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      
                      {/* Play Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{play.name}</p>
                          {alreadyAdded && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-medium">
                              ✓ In folder
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            play.category === 'Offense' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                            : play.category === 'Defense' ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                            : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                          }`}>{play.category}</span>
                          {play.category === 'Offense' && play.offenseType && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              play.offenseType === 'Run' 
                                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                                : 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400'
                            }`}>
                              {play.offenseType === 'Run' ? '🏃 RUN' : '🏈 PASS'}
                            </span>
                          )}
                          {play.formationName && (
                            <span className="text-[10px] text-slate-500">{play.formationName}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Preview Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewingPlay(play); }}
                          className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Preview play"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* Remove Button (only for plays already in folder) */}
                        {alreadyAdded && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removePlayBySystemPlayId(play.id); }}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Remove from folder"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
            <button 
              onClick={() => { setAddPlaysFromPlaybook(null); setSelectedPlaysToAdd([]); }}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={addSelectedPlaysToFolder}
              disabled={selectedPlaysToAdd.filter(id => addPlaysFromPlaybook.playIds.includes(id)).length === 0 || addingPlays}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingPlays ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add {selectedPlaysToAdd.filter(id => addPlaysFromPlaybook.playIds.includes(id)).length} Play{selectedPlaysToAdd.filter(id => addPlaysFromPlaybook.playIds.includes(id)).length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Clone Play Modal */}
    <ClonePlayModal
      isOpen={showCloneModal}
      onClose={() => setShowCloneModal(false)}
      onPlayCloned={handlePlayCloned}
      currentCredits={cloneCredits}
    />
    </>
  );
};

export default CoachPlaybook;
