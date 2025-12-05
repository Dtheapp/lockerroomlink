import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, addDoc, doc, setDoc, onSnapshot, deleteDoc, serverTimestamp, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { SystemPlay, SystemFormation, SystemPlaybook, PlayElement, PlayRoute, OffensePlayType, DefensePlayType, DrawingLine, PlayShape, LineType, ShapeType } from '../../types';
import { Save, Trash2, Eraser, Plus, Route as RouteIcon, Undo2, BookOpen, PenTool, X, ChevronDown, Users, Move, FolderOpen, Layers, ChevronRight, AlertTriangle, Search, CheckCircle, AlertCircle, Package, Eye, EyeOff, Copy, FileStack, MousePointer, Minus, Square } from 'lucide-react';

const ROUTE_COLORS = [
  '#FACC15', '#06b6d4', '#ec4899', '#a3e635', '#f87171', '#ffffff', '#a855f7', '#ea580c', '#3b82f6', '#14b8a6', '#8b5cf6'
];

const LINE_COLORS = ['#000000', '#FACC15', '#06b6d4', '#ec4899', '#f87171', '#ffffff', '#a855f7', '#3b82f6'];

const FIELD_ASPECT_RATIO = 16 / 9;

const AdminPlaybook: React.FC = () => {
  const { userData, user } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // UI STATE
  const [activeTab, setActiveTab] = useState<'formations' | 'editor' | 'library' | 'playbooks'>('formations');
  const [filterCategory, setFilterCategory] = useState<'All' | 'Offense' | 'Defense' | 'Special Teams'>('All');
  const [filterOffenseType, setFilterOffenseType] = useState<'All' | 'Run' | 'Pass'>('All');
  const [filterDefenseType, setFilterDefenseType] = useState<'All' | 'Normal' | 'Blitz'>('All');
  const [filterFormationId, setFilterFormationId] = useState<string | null>(null);

  // FORMATION STATE
  const [formations, setFormations] = useState<SystemFormation[]>([]);
  const [editingFormation, setEditingFormation] = useState<SystemFormation | null>(null);
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
  const [playFormationId, setPlayFormationId] = useState<string | null>(null);
  const [playFormationName, setPlayFormationName] = useState<string>('');
  const [elements, setElements] = useState<PlayElement[]>([]);
  const [routes, setRoutes] = useState<PlayRoute[]>([]);
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [shapes, setShapes] = useState<PlayShape[]>([]);

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
  const [savedPlays, setSavedPlays] = useState<SystemPlay[]>([]);
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);

  // Delete confirmation
  const [deletePlayConfirm, setDeletePlayConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deletingPlay, setDeletingPlay] = useState(false);

  // PLAYBOOK MANAGEMENT
  const [playbooks, setPlaybooks] = useState<SystemPlaybook[]>([]);
  const [editingPlaybook, setEditingPlaybook] = useState<SystemPlaybook | null>(null);
  const [playbookName, setPlaybookName] = useState('');
  const [playbookDescription, setPlaybookDescription] = useState('');
  const [playbookCategory, setPlaybookCategory] = useState<'Offense' | 'Defense' | 'Special Teams'>('Offense');
  const [selectedPlaybookPlays, setSelectedPlaybookPlays] = useState<string[]>([]);
  const [isPlaybookEditMode, setIsPlaybookEditMode] = useState(false);
  const [deletePlaybookConfirm, setDeletePlaybookConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deletingPlaybook, setDeletingPlaybook] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // DRAGGING
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ type: 'element' | 'route_point', id: string, index?: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const formationCanvasRef = useRef<HTMLDivElement>(null);

  // Load system formations
  useEffect(() => {
    const formationsQuery = query(collection(db, 'systemFormations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(formationsQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemFormation));
      setFormations(data);
    });
    return () => unsubscribe();
  }, []);

  // Load system plays
  useEffect(() => {
    const playsQuery = query(collection(db, 'systemPlays'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(playsQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemPlay));
      setSavedPlays(data);
    });
    return () => unsubscribe();
  }, []);

  // Load system playbooks
  useEffect(() => {
    const playbooksQuery = query(collection(db, 'systemPlaybooks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(playbooksQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemPlaybook));
      setPlaybooks(data);
    });
    return () => unsubscribe();
  }, []);

  // --- POINTER HANDLERS ---
  const getPointerPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
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
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) };
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent, type: 'element' | 'route_point', id: string, index?: number) => {
    e.stopPropagation();
    e.preventDefault();
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
    if (!isDragging || !dragTarget) return;
    e.preventDefault();
    const { x, y } = getPointerPos(e);
    if (dragTarget.type === 'element') {
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
    }
  };

  const stopDrag = () => {
    setIsDragging(false);
    setDragTarget(null);
  };

  // --- DRAWING HANDLERS ---
  const generateLinePath = (line: DrawingLine): string => {
    if (line.points.length < 2) return '';
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
    return pathD;
  };

  const getStrokeDash = (lineType: LineType): string => {
    if (lineType === 'dashed') return '2,1';
    return 'none';
  };

  const getMarkerEnd = (line: DrawingLine): string => {
    if (line.lineType === 'block') return `url(#block-${line.color.replace('#','')})`;
    if (line.lineType === 'route' || line.lineType === 'curved' || line.lineType === 'solid' || line.lineType === 'dashed') {
      return `url(#arrow-${line.color.replace('#','')})`;
    }
    return '';
  };

  const renderShapeSvg = (shape: PlayShape) => {
    const { shapeType, x, y, width, height, color } = shape;
    const halfW = width / 2;
    const halfH = height / 2;
    switch (shapeType) {
      case 'circle': return <ellipse cx={x} cy={y} rx={halfW} ry={halfH} fill="none" stroke={color} strokeWidth="0.5" />;
      case 'oval': return <ellipse cx={x} cy={y} rx={halfW} ry={halfH * 0.6} fill="none" stroke={color} strokeWidth="0.5" />;
      case 'square': return <rect x={x - halfW} y={y - halfH} width={width} height={height} fill="none" stroke={color} strokeWidth="0.5" />;
      case 'rectangle': return <rect x={x - halfW} y={y - halfH * 0.6} width={width} height={height * 0.6} fill="none" stroke={color} strokeWidth="0.5" />;
      case 'triangle': return <polygon points={`${x},${y - halfH} ${x - halfW},${y + halfH} ${x + halfW},${y + halfH}`} fill="none" stroke={color} strokeWidth="0.5" />;
      case 'diamond': return <polygon points={`${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}`} fill="none" stroke={color} strokeWidth="0.5" />;
      case 'x': return (<g><line x1={x - halfW} y1={y - halfH} x2={x + halfW} y2={y + halfH} stroke={color} strokeWidth="0.5" /><line x1={x + halfW} y1={y - halfH} x2={x - halfW} y2={y + halfH} stroke={color} strokeWidth="0.5" /></g>);
      default: return null;
    }
  };

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isFormationDesignMode) return;
    const { x, y } = getPointerPos(e);
    
    if (drawingMode === 'line') {
      if (!isDrawingLine) {
        const newLine: DrawingLine = {
          id: Date.now().toString(),
          points: [{ x, y }],
          color: selectedLineColor,
          lineType: selectedLineType
        };
        setCurrentDrawingLine(newLine);
        setIsDrawingLine(true);
      }
    } else if (drawingMode === 'shape') {
      if (!isPlacingShape) {
        setShapeStartPos({ x, y });
        setCurrentShape({
          id: Date.now().toString(),
          shapeType: selectedShapeType,
          x, y, width: 0, height: 0,
          color: selectedShapeColor,
          filled: false
        });
        setIsPlacingShape(true);
      }
    } else if (drawingMode === 'select') {
      setSelectedElementId(null);
      setSelectedRouteId(null);
      setSelectedLineId(null);
      setSelectedShapeId(null);
    }
  };

  const handleCanvasMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDragging && dragTarget) {
      handleMove(e);
      return;
    }
    
    const { x, y } = getPointerPos(e);
    
    if (isDrawingLine && currentDrawingLine) {
      const lastPoint = currentDrawingLine.points[currentDrawingLine.points.length - 1];
      const dist = Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2));
      if (dist > 1) {
        setCurrentDrawingLine({
          ...currentDrawingLine,
          points: [...currentDrawingLine.points, { x, y }]
        });
      }
    } else if (isPlacingShape && currentShape && shapeStartPos) {
      const width = Math.abs(x - shapeStartPos.x);
      const height = Math.abs(y - shapeStartPos.y);
      const centerX = (x + shapeStartPos.x) / 2;
      const centerY = (y + shapeStartPos.y) / 2;
      setCurrentShape({ ...currentShape, x: centerX, y: centerY, width, height });
    }
  };

  const handleCanvasUp = () => {
    if (isDrawingLine && currentDrawingLine) {
      if (currentDrawingLine.points.length >= 2) {
        setLines(prev => [...prev, currentDrawingLine]);
      }
      setCurrentDrawingLine(null);
      setIsDrawingLine(false);
    } else if (isPlacingShape && currentShape) {
      if (currentShape.width > 1 && currentShape.height > 1) {
        setShapes(prev => [...prev, currentShape]);
      }
      setCurrentShape(null);
      setIsPlacingShape(false);
      setShapeStartPos(null);
    }
    stopDrag();
  };

  const deleteSelectedDrawing = () => {
    if (selectedLineId) {
      setLines(prev => prev.filter(l => l.id !== selectedLineId));
      setSelectedLineId(null);
    } else if (selectedShapeId) {
      setShapes(prev => prev.filter(s => s.id !== selectedShapeId));
      setSelectedShapeId(null);
    } else if (selectedElementId) {
      setRoutes(prev => prev.filter(r => r.startElementId !== selectedElementId));
      setElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementId(null);
    } else if (selectedRouteId) {
      setRoutes(prev => prev.filter(r => r.id !== selectedRouteId));
      setSelectedRouteId(null);
    }
  };

  // --- ELEMENT ACTIONS ---
  const addElement = (type: 'X' | 'O', label: string) => {
    const startX = 50;
    const startY = type === 'O' ? 65 : 35;
    const targetElements = isFormationDesignMode ? formationElements : elements;
    const existingCount = targetElements.filter(el => el.label.replace(/\d+$/, '') === label).length;
    const numberedLabel = `${label}${existingCount + 1}`;
    const offset = (existingCount % 5) * 8 - 16;
    const newEl: PlayElement = {
      id: Date.now().toString(),
      type,
      label: numberedLabel,
      x: Math.max(5, Math.min(95, startX + offset)),
      y: startY + (Math.random() * 4 - 2),
      color: type === 'O' ? 'bg-blue-600' : 'bg-red-600'
    };
    if (isFormationDesignMode) {
      setFormationElements(prev => [...prev, newEl]);
    } else {
      setElements(prev => [...prev, newEl]);
    }
  };

  const deleteSelectedElement = () => {
    if (isFormationDesignMode && selectedElementId) {
      setFormationElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementId(null);
    } else if (selectedElementId) {
      setRoutes(prev => prev.filter(r => r.startElementId !== selectedElementId));
      setElements(prev => prev.filter(el => el.id !== selectedElementId));
      setSelectedElementId(null);
    } else if (selectedRouteId) {
      setRoutes(prev => prev.filter(r => r.id !== selectedRouteId));
      setSelectedRouteId(null);
    }
  };

  // --- ROUTE ACTIONS ---
  const handleAddOrExtendRoute = () => {
    if (!selectedElementId) return;
    const existingRoute = routes.find(r => r.startElementId === selectedElementId);
    const el = elements.find(e => e.id === selectedElementId);
    if (!el) return;
    if (existingRoute) {
      const lastPt = existingRoute.points[existingRoute.points.length - 1];
      const newPt = { x: lastPt.x + 5, y: lastPt.y - 8 };
      setRoutes(prev => prev.map(r => r.id === existingRoute.id ? { ...r, points: [...r.points, newPt] } : r));
    } else {
      const newRoute: PlayRoute = {
        id: Date.now().toString(),
        startElementId: selectedElementId,
        points: [{ x: el.x, y: el.y - 10 }],
        color: ROUTE_COLORS[routes.length % ROUTE_COLORS.length],
        style: 'solid',
        arrow: true
      };
      setRoutes(prev => [...prev, newRoute]);
    }
  };

  // --- FORMATION MANAGEMENT ---
  const handleSaveFormation = async () => {
    if (!user?.uid || !formationName.trim()) {
      showToast('Please enter a formation name', 'error');
      return;
    }
    if (formationElements.length === 0) {
      showToast('Please add at least one player', 'error');
      return;
    }
    const formationData: Partial<SystemFormation> = {
      name: formationName,
      category: formationCategory,
      elements: formationElements,
      createdBy: user.uid,
      createdByName: userData?.name || 'Admin',
      updatedAt: serverTimestamp()
    };
    try {
      if (editingFormation) {
        await setDoc(doc(db, 'systemFormations', editingFormation.id), formationData, { merge: true });
        showToast('Formation updated!');
      } else {
        formationData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'systemFormations'), formationData);
        showToast('Formation saved!');
      }
      clearFormationDesigner();
    } catch (error) {
      console.error('Error saving formation:', error);
      showToast('Failed to save formation', 'error');
    }
  };

  const clearFormationDesigner = () => {
    setFormationName('');
    setFormationCategory('Offense');
    setFormationElements([]);
    setEditingFormation(null);
    setIsFormationDesignMode(false);
    setSelectedElementId(null);
  };

  const loadFormationForEdit = (formation: SystemFormation) => {
    setEditingFormation(formation);
    setFormationName(formation.name);
    setFormationCategory(formation.category);
    setFormationElements(formation.elements || []);
    setIsFormationDesignMode(true);
    setActiveTab('formations');
  };

  const startPlayFromFormation = (formation: SystemFormation) => {
    setPlayFormationId(formation.id);
    setPlayFormationName(formation.name);
    setCategory(formation.category);
    setElements(formation.elements?.map(el => ({ ...el, id: `${el.id}-${Date.now()}` })) || []);
    setRoutes([]);
    setLines([]);
    setShapes([]);
    setPlayName('New Play');
    setPlayNotes('');
    setSelectedPlayId(null);
    setIsFormationDesignMode(false);
    setDrawingMode('select');
    setActiveTab('editor');
  };

  const deleteFormation = async () => {
    if (!deleteFormationConfirm || !user?.uid) return;
    setDeletingFormation(true);
    try {
      const playsQuery = query(collection(db, 'systemPlays'), where('formationId', '==', deleteFormationConfirm.id));
      const playsSnapshot = await getDocs(playsQuery);
      const deletePromises = playsSnapshot.docs.map(playDoc => deleteDoc(doc(db, 'systemPlays', playDoc.id)));
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, 'systemFormations', deleteFormationConfirm.id));
      setDeleteFormationConfirm(null);
      showToast('Formation deleted');
    } catch (error) {
      console.error('Error deleting formation:', error);
      showToast('Failed to delete formation', 'error');
    } finally {
      setDeletingFormation(false);
    }
  };

  // --- PLAY MANAGEMENT ---
  const handleSavePlay = async () => {
    if (!user?.uid || !playName.trim()) return;
    if (!playFormationId) {
      showToast('Please select a formation first', 'error');
      return;
    }
    const playData: Partial<SystemPlay> = {
      name: playName,
      notes: playNotes || '',
      category,
      formationId: playFormationId,
      formationName: playFormationName,
      elements,
      routes,
      lines: lines || [],
      shapes: shapes || [],
      createdBy: user.uid,
      createdByName: userData?.name || 'Admin',
      updatedAt: serverTimestamp()
    };
    if (category === 'Offense') playData.offenseType = offenseType;
    if (category === 'Defense') playData.defenseType = defenseType;
    try {
      if (selectedPlayId) {
        await setDoc(doc(db, 'systemPlays', selectedPlayId), playData, { merge: true });
      } else {
        playData.createdAt = serverTimestamp();
        const newDoc = await addDoc(collection(db, 'systemPlays'), playData);
        setSelectedPlayId(newDoc.id);
      }
      showToast('Play saved!');
      // Navigate to library tab after saving
      setActiveTab('library');
    } catch (error) {
      console.error('Error saving play:', error);
      showToast('Failed to save play', 'error');
    }
  };

  const loadPlay = (play: SystemPlay) => {
    setPlayName(play.name);
    setPlayNotes(play.notes || '');
    setCategory(play.category);
    setOffenseType(play.offenseType || 'Run');
    setDefenseType(play.defenseType || 'Normal');
    setPlayFormationId(play.formationId || null);
    setPlayFormationName(play.formationName || '');
    setElements(play.elements || []);
    setRoutes(play.routes || []);
    setLines(play.lines || []);
    setShapes(play.shapes || []);
    setSelectedPlayId(play.id);
    setIsFormationDesignMode(false);
    setDrawingMode('select');
    setActiveTab('editor');
  };

  const deletePlay = async () => {
    if (!deletePlayConfirm) return;
    setDeletingPlay(true);
    try {
      await deleteDoc(doc(db, 'systemPlays', deletePlayConfirm.id));
      if (selectedPlayId === deletePlayConfirm.id) {
        setSelectedPlayId(null);
        setPlayName('New Play');
        setPlayNotes('');
        setElements([]);
        setRoutes([]);
        setLines([]);
        setShapes([]);
      }
      setDeletePlayConfirm(null);
      showToast('Play deleted');
    } catch (error) {
      console.error('Error deleting play:', error);
      showToast('Failed to delete play', 'error');
    } finally {
      setDeletingPlay(false);
    }
  };

  // --- PLAYBOOK MANAGEMENT ---
  const handleSavePlaybook = async () => {
    if (!user?.uid || !playbookName.trim()) {
      showToast('Please enter a playbook name', 'error');
      return;
    }
    if (selectedPlaybookPlays.length === 0) {
      showToast('Please select at least one play', 'error');
      return;
    }
    // Get unique formation IDs from selected plays
    const formationIds = [...new Set(
      savedPlays
        .filter(p => selectedPlaybookPlays.includes(p.id) && p.formationId)
        .map(p => p.formationId!)
    )];

    const playbookData: Partial<SystemPlaybook> = {
      name: playbookName,
      description: playbookDescription,
      category: playbookCategory,
      playIds: selectedPlaybookPlays,
      formationIds,
      playCount: selectedPlaybookPlays.length,
      createdBy: user.uid,
      createdByName: userData?.name || 'Admin',
      isPublished: false,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingPlaybook) {
        await setDoc(doc(db, 'systemPlaybooks', editingPlaybook.id), playbookData, { merge: true });
        showToast('Playbook updated!');
      } else {
        playbookData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'systemPlaybooks'), playbookData);
        showToast('Playbook created!');
      }
      clearPlaybookEditor();
    } catch (error) {
      console.error('Error saving playbook:', error);
      showToast('Failed to save playbook', 'error');
    }
  };

  const clearPlaybookEditor = () => {
    setPlaybookName('');
    setPlaybookDescription('');
    setPlaybookCategory('Offense');
    setSelectedPlaybookPlays([]);
    setEditingPlaybook(null);
    setIsPlaybookEditMode(false);
  };

  const loadPlaybookForEdit = (playbook: SystemPlaybook) => {
    setEditingPlaybook(playbook);
    setPlaybookName(playbook.name);
    setPlaybookDescription(playbook.description || '');
    setPlaybookCategory(playbook.category);
    setSelectedPlaybookPlays(playbook.playIds || []);
    setIsPlaybookEditMode(true);
    setActiveTab('playbooks');
  };

  const togglePlaybookPublished = async (playbook: SystemPlaybook) => {
    try {
      await setDoc(doc(db, 'systemPlaybooks', playbook.id), {
        isPublished: !playbook.isPublished,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showToast(playbook.isPublished ? 'Playbook unpublished' : 'Playbook published!');
    } catch (error) {
      console.error('Error toggling publish:', error);
      showToast('Failed to update playbook', 'error');
    }
  };

  const deletePlaybook = async () => {
    if (!deletePlaybookConfirm) return;
    setDeletingPlaybook(true);
    try {
      await deleteDoc(doc(db, 'systemPlaybooks', deletePlaybookConfirm.id));
      setDeletePlaybookConfirm(null);
      showToast('Playbook deleted');
    } catch (error) {
      console.error('Error deleting playbook:', error);
      showToast('Failed to delete playbook', 'error');
    } finally {
      setDeletingPlaybook(false);
    }
  };

  const togglePlayInPlaybook = (playId: string) => {
    setSelectedPlaybookPlays(prev =>
      prev.includes(playId) ? prev.filter(id => id !== playId) : [...prev, playId]
    );
  };

  // Get plays filtered by playbook category
  const playsForPlaybook = savedPlays.filter(p => p.category === playbookCategory);

  // Get actual play count for a playbook (only count plays that exist)
  const getActualPlaybookPlayCount = (playbook: SystemPlaybook) => {
    if (!playbook.playIds) return 0;
    return playbook.playIds.filter(playId => savedPlays.some(sp => sp.id === playId)).length;
  };

  // Filter plays
  const filteredFormations = formations.filter(f => {
    if (filterCategory !== 'All' && f.category !== filterCategory) return false;
    return true;
  });

  const filteredPlays = savedPlays.filter(p => {
    if (filterFormationId && p.formationId !== filterFormationId) return false;
    if (filterCategory !== 'All' && p.category !== filterCategory) return false;
    if ((filterCategory === 'Offense' || filterCategory === 'All') && p.category === 'Offense') {
      if (filterOffenseType !== 'All' && p.offenseType !== filterOffenseType) return false;
    }
    if ((filterCategory === 'Defense' || filterCategory === 'All') && p.category === 'Defense') {
      if (filterDefenseType !== 'All' && p.defenseType !== filterDefenseType) return false;
    }
    return true;
  });

  // Check if user is superadmin
  if (userData?.role !== 'SuperAdmin') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-slate-500">Only Super Admins can access the System Playbook editor.</p>
      </div>
    );
  }

  // Clear board / cancel editing
  const clearBoard = () => {
    setElements([]);
    setRoutes([]);
    setLines([]);
    setShapes([]);
    setPlayName('New Play');
    setPlayNotes('');
    setCategory('Offense');
    setOffenseType('Run');
    setDefenseType('Normal');
    setPlayFormationId(null);
    setPlayFormationName('');
    setSelectedPlayId(null);
    setSelectedElementId(null);
    setSelectedRouteId(null);
    setSelectedLineId(null);
    setSelectedShapeId(null);
    setDrawingMode('select');
    setIsDrawingLine(false);
    setCurrentDrawingLine(null);
    setIsPlacingShape(false);
    setCurrentShape(null);
    setShapeStartPos(null);
  };

  // --- SELECTION ACTIONS POPUP (floating delete buttons) ---
  const renderSelectionActions = () => {
    const hasSelection = selectedElementId || selectedLineId || selectedShapeId;
    if (!hasSelection) return null;
    
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700 p-1.5 flex items-center gap-1.5">
          {selectedElementId && (
            <button 
              onClick={deleteSelectedElement} 
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Eraser className="w-3 h-3"/> Delete Player
            </button>
          )}
          {selectedLineId && (
            <button 
              onClick={() => {
                setLines(lines.filter(l => l.id !== selectedLineId));
                setSelectedLineId(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Eraser className="w-3 h-3"/> Delete Line
            </button>
          )}
          {selectedShapeId && (
            <button 
              onClick={() => {
                setShapes(shapes.filter(s => s.id !== selectedShapeId));
                setSelectedShapeId(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Eraser className="w-3 h-3"/> Delete Shape
            </button>
          )}
          <button 
            onClick={() => { setSelectedElementId(null); setSelectedLineId(null); setSelectedShapeId(null); }}
            className="text-slate-400 hover:text-white p-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Render field for plays
  const renderField = () => (
    <div
      ref={canvasRef}
      onMouseMove={handleCanvasMove}
      onMouseUp={handleCanvasUp}
      onMouseLeave={handleCanvasUp}
      onTouchMove={handleCanvasMove}
      onTouchEnd={handleCanvasUp}
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

      {/* Routes and Lines SVG */}
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 10, pointerEvents: drawingMode === 'select' ? 'auto' : 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {/* Arrow and block markers for drawing lines */}
          {LINE_COLORS.map(color => (
            <React.Fragment key={color}>
              <marker id={`arrow-${color.replace('#','')}`} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
                <polygon points="0 0, 4 1.5, 0 3" fill={color} />
              </marker>
              <marker id={`block-${color.replace('#','')}`} markerWidth="4" markerHeight="5" refX="2" refY="2.5" orient="auto">
                <line x1="2" y1="0" x2="2" y2="5" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
              </marker>
            </React.Fragment>
          ))}
          {/* Legacy route colors */}
          {ROUTE_COLORS.map(color => (
            <marker key={`legacy-${color}`} id={`arrow-admin-${color.replace('#','')}`} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
              <polygon points="0 0, 4 1.5, 0 3" fill={color} />
            </marker>
          ))}
        </defs>
        
        {/* Legacy routes */}
        {routes.map(route => {
          const startEl = elements.find(e => e.id === route.startElementId);
          if (!startEl) return null;
          let pathD = `M ${startEl.x} ${startEl.y}`;
          route.points.forEach(pt => { pathD += ` L ${pt.x} ${pt.y}`; });
          return (
            <path key={route.id} d={pathD} stroke={route.color} strokeWidth="0.5" fill="none"
              strokeDasharray={route.style === 'dashed' ? '2,1' : 'none'}
              markerEnd={`url(#arrow-admin-${route.color.replace('#','')})`}
            />
          );
        })}

        {/* Drawing lines */}
        {lines.map(line => (
          <g key={line.id}>
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

        {/* Shapes */}
        {shapes.map(shape => (
          <g key={shape.id}>
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

      {/* Route points */}
      {routes.map(route => (
        <React.Fragment key={route.id}>
          {route.points.map((pt, index) => (
            <div
              key={`${route.id}-${index}`}
              onMouseDown={(e) => startDrag(e, 'route_point', route.id, index)}
              onTouchStart={(e) => startDrag(e, 'route_point', route.id, index)}
              className={`absolute rounded-full shadow-lg z-20 cursor-move ${selectedRouteId === route.id ? 'ring-2 ring-white' : ''}`}
              style={{ backgroundColor: route.color, left: `${pt.x}%`, top: `${pt.y}%`, transform: 'translate(-50%, -50%)', width: '14px', height: '14px' }}
            />
          ))}
        </React.Fragment>
      ))}

      {/* Player elements */}
      {elements.map(el => (
        <div
          key={el.id}
          onMouseDown={(e) => startDrag(e, 'element', el.id)}
          onTouchStart={(e) => startDrag(e, 'element', el.id)}
          className={`absolute flex items-center font-bold text-white shadow-lg border-2 z-30 cursor-move ${el.id === selectedElementId ? 'border-yellow-400 ring-4 ring-yellow-400/40 scale-110' : 'border-white/80'} ${el.color} ${el.type === 'O' ? 'rounded-full justify-center' : 'justify-center'}`}
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
    </div>
  );

  // Render field for formations
  const renderFormationField = () => (
    <div
      ref={formationCanvasRef}
      onMouseMove={handleMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onTouchMove={handleMove}
      onTouchEnd={stopDrag}
      className="w-full h-full relative select-none overflow-hidden"
      style={{ backgroundColor: '#2e7d32', touchAction: 'none' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0%, transparent 9%, rgba(255,255,255,0.3) 9%, rgba(255,255,255,0.3) 10%)`, backgroundSize: '100% 10%' }}></div>
      <div className="absolute top-0 left-0 right-0 h-[8%] bg-orange-600/40 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-orange-600/40 pointer-events-none"></div>

      {formationElements.map(el => (
        <div
          key={el.id}
          onMouseDown={(e) => startDrag(e, 'element', el.id)}
          onTouchStart={(e) => startDrag(e, 'element', el.id)}
          className={`absolute flex items-center font-bold text-white shadow-lg border-2 z-30 cursor-move ${el.id === selectedElementId ? 'border-yellow-400 ring-4 ring-yellow-400/40 scale-110' : 'border-white/80'} ${el.color} ${el.type === 'O' ? 'rounded-full justify-center' : 'justify-center'}`}
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

      {formationElements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/70 text-white px-4 py-2 rounded-lg text-sm text-center">
            <Layers className="w-5 h-5 mx-auto mb-1 opacity-60" />
            <span className="opacity-80">Add players to create formation</span>
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs font-bold z-40">
        FORMATION: {formationName || 'Untitled'}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">System Playbook Editor</h1>
            <p className="text-sm text-slate-500">Create plays and formations for coaches to import</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex flex-col lg:flex-row min-h-[600px]">
          {/* Left Panel - Tabs */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-zinc-800 flex flex-col">
            {/* Tab Buttons */}
            <div className="flex border-b border-slate-200 dark:border-zinc-800">
              {(['formations', 'editor', 'library', 'playbooks'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === tab ? 'bg-white dark:bg-zinc-800 text-orange-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
                >
                  {tab === 'formations' && <><Layers className="w-4 h-4 inline mr-1" />Forms</>}
                  {tab === 'editor' && <><PenTool className="w-4 h-4 inline mr-1" />Design</>}
                  {tab === 'library' && <><BookOpen className="w-4 h-4 inline mr-1" />Plays</>}
                  {tab === 'playbooks' && <><FileStack className="w-4 h-4 inline mr-1" />Books</>}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* FORMATIONS TAB */}
              {activeTab === 'formations' && (
                <div className="space-y-4">
                  {isFormationDesignMode ? (
                    <>
                      <div className="space-y-3">
                        <input
                          value={formationName}
                          onChange={e => setFormationName(e.target.value)}
                          placeholder="Formation Name"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                        />
                        <select
                          value={formationCategory}
                          onChange={e => setFormationCategory(e.target.value as any)}
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                        >
                          <option value="Offense">Offense</option>
                          <option value="Defense">Defense</option>
                          <option value="Special Teams">Special Teams</option>
                        </select>
                      </div>

                      {/* Add Players */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-blue-600 uppercase">Offense</p>
                        <div className="flex flex-wrap gap-1">
                          {['QB', 'RB', 'WR', 'TE', 'C', 'G', 'T'].map(pos => (
                            <button key={pos} onClick={() => addElement('O', pos)} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs font-bold">{pos}</button>
                          ))}
                        </div>
                        <p className="text-xs font-bold text-red-600 uppercase mt-2">Defense</p>
                        <div className="flex flex-wrap gap-1">
                          {['DL', 'DE', 'DT', 'LB', 'CB', 'S', 'N'].map(pos => (
                            <button key={pos} onClick={() => addElement('X', pos)} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded text-xs font-bold">{pos}</button>
                          ))}
                        </div>
                      </div>

                      {selectedElementId && (
                        <button onClick={deleteSelectedElement} className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                          <Trash2 className="w-4 h-4" /> Delete Player
                        </button>
                      )}

                      <div className="flex gap-2">
                        <button onClick={clearFormationDesigner} className="flex-1 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold">Cancel</button>
                        <button onClick={handleSaveFormation} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" /> Save
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setIsFormationDesignMode(true)} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5" /> New Formation
                      </button>

                      {formations.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No formations yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {formations.map(f => {
                            const playCount = savedPlays.filter(p => p.formationId === f.id).length;
                            return (
                              <div key={f.id} className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{f.name}</p>
                                    <p className="text-xs text-slate-500">{f.category} • {f.elements?.length || 0} players • {playCount} plays</p>
                                  </div>
                                  <div className="flex gap-1">
                                    <button onClick={() => startPlayFromFormation(f)} className="p-1.5 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded" title="Create play">
                                      <Plus className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => loadFormationForEdit(f)} className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded" title="Edit">
                                      <PenTool className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setDeleteFormationConfirm({ id: f.id, name: f.name, playCount })} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" title="Delete">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* EDITOR TAB */}
              {activeTab === 'editor' && (
                <div className="space-y-4">
                  {/* Formation Selector */}
                  <div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Formation</p>
                    <select
                      value={playFormationId || ''}
                      onChange={e => {
                        const formationId = e.target.value;
                        if (formationId) {
                          const formation = formations.find(f => f.id === formationId);
                          if (formation) {
                            setPlayFormationId(formation.id);
                            setPlayFormationName(formation.name);
                            setCategory(formation.category);
                            // Only reset elements if creating a new play or changing formation
                            if (!selectedPlayId || playFormationId !== formationId) {
                              setElements(formation.elements?.map(el => ({ ...el, id: `${el.id}-${Date.now()}` })) || []);
                              setRoutes([]);
                              setLines([]);
                              setShapes([]);
                            }
                          }
                        } else {
                          setPlayFormationId(null);
                          setPlayFormationName('');
                        }
                      }}
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                    >
                      <option value="">Select a Formation...</option>
                      {formations.filter(f => f.category === 'Offense').length > 0 && (
                        <optgroup label="Offense">
                          {formations.filter(f => f.category === 'Offense').map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {formations.filter(f => f.category === 'Defense').length > 0 && (
                        <optgroup label="Defense">
                          {formations.filter(f => f.category === 'Defense').map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {formations.filter(f => f.category === 'Special Teams').length > 0 && (
                        <optgroup label="Special Teams">
                          {formations.filter(f => f.category === 'Special Teams').map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {!playFormationId && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Select a formation to design a play
                      </p>
                    )}
                  </div>

                  <input
                    value={playName}
                    onChange={e => setPlayName(e.target.value)}
                    placeholder="Play Name"
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                  />

                  {/* Play Notes */}
                  <div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Notes</p>
                    <textarea
                      value={playNotes}
                      onChange={e => setPlayNotes(e.target.value)}
                      placeholder="Add notes about this play..."
                      rows={2}
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm resize-none"
                    />
                  </div>

                  {category === 'Offense' && (
                    <div className="flex gap-2">
                      <button onClick={() => setOffenseType('Run')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${offenseType === 'Run' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600'}`}>🏃 Run</button>
                      <button onClick={() => setOffenseType('Pass')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${offenseType === 'Pass' ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600'}`}>🏈 Pass</button>
                    </div>
                  )}

                  {category === 'Defense' && (
                    <div className="flex gap-2">
                      <button onClick={() => setDefenseType('Normal')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${defenseType === 'Normal' ? 'bg-slate-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600'}`}>🛡️ Normal</button>
                      <button onClick={() => setDefenseType('Blitz')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${defenseType === 'Blitz' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600'}`}>⚡ Blitz</button>
                    </div>
                  )}



                  {/* Drawing Tools */}
                  {playFormationId && (
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

                      {/* Remove Line Button */}
                      {selectedLineId && (
                        <button
                          onClick={() => {
                            setLines(lines.filter(l => l.id !== selectedLineId));
                            setSelectedLineId(null);
                          }}
                          className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                        >
                          <Eraser className="w-4 h-4" /> Remove Line
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button onClick={handleSavePlay} disabled={!playFormationId} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" /> Save
                    </button>
                    <button onClick={clearBoard} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-bold flex items-center justify-center gap-2">
                      <X className="w-5 h-5" /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* LIBRARY TAB */}
              {activeTab === 'library' && (
                <div className="space-y-3">
                  <select
                    value={filterFormationId || ''}
                    onChange={e => setFilterFormationId(e.target.value || null)}
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm"
                  >
                    <option value="">All Formations</option>
                    {formations.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.category})</option>
                    ))}
                  </select>

                  <div className="flex gap-1 flex-wrap">
                    {(['All', 'Offense', 'Defense', 'Special Teams'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-2 py-1 rounded text-xs font-semibold ${filterCategory === cat ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-400'}`}
                      >
                        {cat === 'Special Teams' ? 'ST' : cat}
                      </button>
                    ))}
                  </div>

                  {filteredPlays.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No plays yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredPlays.map(play => (
                        <div
                          key={play.id}
                          onClick={() => loadPlay(play)}
                          className={`p-3 rounded-lg border cursor-pointer ${selectedPlayId === play.id ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-300' : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-orange-300'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white text-sm">{play.name}</p>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${play.category === 'Offense' ? 'bg-blue-100 text-blue-600' : play.category === 'Defense' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>{play.category}</span>
                                {play.formationName && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">{play.formationName}</span>}
                                {play.category === 'Offense' && play.offenseType && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${play.offenseType === 'Run' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                                    {play.offenseType === 'Run' ? '🏃' : '🏈'}
                                  </span>
                                )}
                                {play.category === 'Defense' && play.defenseType === 'Blitz' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-600">⚡</span>
                                )}
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setDeletePlayConfirm({ id: play.id, name: play.name }); }} className="text-slate-400 hover:text-red-500 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PLAYBOOKS TAB */}
              {activeTab === 'playbooks' && (
                <div className="space-y-4">
                  {isPlaybookEditMode ? (
                    <>
                      <div className="space-y-3">
                        <input
                          value={playbookName}
                          onChange={e => setPlaybookName(e.target.value)}
                          placeholder="Playbook Name"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                        />
                        <textarea
                          value={playbookDescription}
                          onChange={e => setPlaybookDescription(e.target.value)}
                          placeholder="Description (optional)"
                          rows={2}
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm resize-none"
                        />
                        <select
                          value={playbookCategory}
                          onChange={e => {
                            setPlaybookCategory(e.target.value as any);
                            setSelectedPlaybookPlays([]);
                          }}
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                        >
                          <option value="Offense">Offense</option>
                          <option value="Defense">Defense</option>
                          <option value="Special Teams">Special Teams</option>
                        </select>
                      </div>

                      <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-3">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                          Select Plays ({selectedPlaybookPlays.length} selected)
                        </p>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {playsForPlaybook.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4">No {playbookCategory} plays available</p>
                          ) : (
                            playsForPlaybook.map(play => (
                              <label
                                key={play.id}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedPlaybookPlays.includes(play.id) ? 'bg-orange-100 dark:bg-orange-900/30' : 'hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPlaybookPlays.includes(play.id)}
                                  onChange={() => togglePlayInPlaybook(play.id)}
                                  className="rounded text-orange-500 focus:ring-orange-500"
                                />
                                <span className="text-sm text-slate-900 dark:text-white">{play.name}</span>
                                {play.formationName && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 ml-auto">{play.formationName}</span>
                                )}
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={clearPlaybookEditor} className="flex-1 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold">Cancel</button>
                        <button onClick={handleSavePlaybook} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" /> Save
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setIsPlaybookEditMode(true)} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5" /> New Playbook
                      </button>

                      {playbooks.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <FileStack className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No playbooks yet</p>
                          <p className="text-xs mt-1">Create a playbook to organize plays for coaches</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {playbooks.map(pb => (
                            <div key={pb.id} className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{pb.name}</p>
                                    {pb.isPublished ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600 font-medium flex items-center gap-0.5">
                                        <Eye className="w-3 h-3" /> Live
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 font-medium flex items-center gap-0.5">
                                        <EyeOff className="w-3 h-3" /> Draft
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">{pb.category} • {getActualPlaybookPlayCount(pb)} plays</p>
                                  {pb.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pb.description}</p>}
                                </div>
                              </div>
                              <div className="flex gap-1 pt-2 border-t border-slate-200 dark:border-zinc-700">
                                <button onClick={() => togglePlaybookPublished(pb)} className={`flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 ${pb.isPublished ? 'bg-slate-200 dark:bg-zinc-700 text-slate-600' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
                                  {pb.isPublished ? <><EyeOff className="w-3 h-3" /> Unpublish</> : <><Eye className="w-3 h-3" /> Publish</>}
                                </button>
                                <button onClick={() => loadPlaybookForEdit(pb)} className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded" title="Edit">
                                  <PenTool className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeletePlaybookConfirm({ id: pb.id, name: pb.name })} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Field */}
          <div className="flex-1 p-4 flex items-center justify-center bg-slate-200 dark:bg-zinc-950">
            <div
              className="w-full max-w-3xl rounded-lg overflow-hidden border-4 border-slate-300 dark:border-zinc-700 shadow-xl relative"
              style={{ aspectRatio: `${FIELD_ASPECT_RATIO}` }}
            >
              {isFormationDesignMode ? renderFormationField() : renderField()}
              {!isFormationDesignMode && renderSelectionActions()}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Formation Modal */}
      {deleteFormationConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Formation</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Delete "{deleteFormationConfirm.name}"?</p>
            {deleteFormationConfirm.playCount > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {deleteFormationConfirm.playCount} plays will also be deleted
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDeleteFormationConfirm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium">Cancel</button>
              <button onClick={deleteFormation} disabled={deletingFormation} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                {deletingFormation ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Play Modal */}
      {deletePlayConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Play</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Delete "{deletePlayConfirm.name}"?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletePlayConfirm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium">Cancel</button>
              <button onClick={deletePlay} disabled={deletingPlay} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                {deletingPlay ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Playbook Modal */}
      {deletePlaybookConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Playbook</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Delete "{deletePlaybookConfirm.name}"?</p>
            <p className="text-xs text-slate-500 mb-4">This will not delete the plays inside, only the playbook collection.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletePlaybookConfirm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium">Cancel</button>
              <button onClick={deletePlaybook} disabled={deletingPlaybook} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                {deletingPlaybook ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-0 z-[100]" onClick={() => setToast(null)}>
          <div
            className={`fixed top-4 right-4 z-[101] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 cursor-pointer ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
            onClick={(e) => { e.stopPropagation(); setToast(null); }}
          >
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
            <X className="w-4 h-4 ml-2" />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlaybook;
