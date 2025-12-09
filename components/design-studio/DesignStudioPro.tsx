// =============================================================================
// DESIGN STUDIO PRO - World-class flyer designer
// Full drag-drop-resize-delete element system
// =============================================================================
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUnsavedChanges } from '../../contexts/UnsavedChangesContext';
import QRCode from 'qrcode';

// Components
import HeaderBar from './HeaderBar';
import Toolbar from './Toolbar';
import DesignCanvas from './DesignCanvas';
import PropertiesPanel from './PropertiesPanel';
import LayersPanel from './LayersPanel';
import TemplateSelector from './TemplateSelector';
import QuickAddPanel from './QuickAddPanel';
import SavePromoModal from './SavePromoModal';
import PromoGallery from './PromoGallery';
import AICreatorModal from './AICreatorModal';
import UniformDesigner from './UniformDesigner';

// Utilities
import { useKeyboardShortcuts, copyToClipboard, getClipboard } from './useKeyboardShortcuts';
import { downloadImage } from './ExportUtils';
import { savePromoItem } from './promoService';
import type { SavePromoOptions, TeamOption, PlayerOption, PromoItem } from './promoTypes';

// Types & Data
import type { 
  DesignElement, 
  CanvasState, 
  DesignState, 
  ToolState,
  FlyerSize,
  Position,
  DesignTemplate,
} from './types';
import { FLYER_SIZES, generateId, createDefaultElement } from './types';
import { getTemplateById, DESIGN_TEMPLATES } from './templates';
import type { Season } from '../../types';

type ViewMode = 'selector' | 'editor' | 'preview' | 'fullscreen';


const DesignStudioPro: React.FC = () => {
  const { theme } = useTheme();
  const { teamData, userData } = useAuth();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Track if design has been modified
  const [hasChanges, setHasChanges] = useState(false);
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('selector');
  const [designName, setDesignName] = useState('Untitled Design');
  
  // Design state
  const [canvas, setCanvas] = useState<CanvasState>({
    width: 1080,
    height: 1080,
    backgroundColor: (teamData as any)?.primaryColor || '#1e3a5f',
  });
  
  const [elements, setElements] = useState<DesignElement[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(75);
  const [gridEnabled, setGridEnabled] = useState(false);
  
  // History for undo/redo
  const [history, setHistory] = useState<{ past: DesignElement[][]; future: DesignElement[][] }>({
    past: [],
    future: [],
  });
  
  // Tool state
  const [toolState, setToolState] = useState<ToolState>({
    activeTool: 'select',
    shapeType: 'rectangle',
  });

  // Current size
  const [currentSize, setCurrentSize] = useState<FlyerSize>('instagram');

  // Pending registrations
  const [pendingRegistrations, setPendingRegistrations] = useState<Season[]>([]);
  
  // Edit state for disabling shortcuts during text editing
  const [isEditingText, setIsEditingText] = useState(false);
  
  // Right panel tab state
  const [rightPanelTab, setRightPanelTab] = useState<'element' | 'canvas' | 'layers'>('element');
  
  // Panel collapse state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  
  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showAICreator, setShowAICreator] = useState(false);
  const [showUniformDesigner, setShowUniformDesigner] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<TeamOption[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerOption[]>([]);
  const [availableSeasons, setAvailableSeasons] = useState<{ id: string; name: string }[]>([]);
  const [availableEvents, setAvailableEvents] = useState<{ id: string; name: string; type: 'registration' | 'game' | 'event' | 'fundraiser' }[]>([]);
  
  // Design reminders - items without flyers/ticket designs
  const [designReminders, setDesignReminders] = useState<{
    id: string;
    type: 'registration' | 'game' | 'event';
    name: string;
    date?: string;
    suggestedTemplate: string;
  }[]>([]);

  // Track unsaved changes and warn on page leave
  useEffect(() => {
    setHasUnsavedChanges(hasChanges);
  }, [hasChanges, setHasUnsavedChanges]);
  
  // Browser beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && viewMode === 'editor') {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, viewMode]);
  
  // Mark as changed when elements are modified
  useEffect(() => {
    if (viewMode === 'editor' && elements.length > 0) {
      setHasChanges(true);
    }
  }, [elements, viewMode]);

  // Fetch pending registrations
  useEffect(() => {
    const fetchPendingRegistrations = async () => {
      if (!teamData?.id) return;
      
      try {
        const seasonsRef = collection(db, 'teams', teamData.id, 'seasons');
        const q = query(seasonsRef, where('status', 'in', ['registration', 'active']));
        const snapshot = await getDocs(q);
        
        const seasons: Season[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.flyerId) {
            seasons.push({ id: doc.id, ...data } as Season);
          }
        });
        
        setPendingRegistrations(seasons);
      } catch (error) {
        console.error('Error fetching pending registrations:', error);
      }
    };
    
    fetchPendingRegistrations();
  }, [teamData?.id]);

  // Fetch available teams for coaches
  useEffect(() => {
    const fetchTeams = async () => {
      if (!userData || (userData.role !== 'Coach' && userData.role !== 'SuperAdmin')) return;
      
      const teams: TeamOption[] = [];
      
      // Add current team
      if (teamData?.id && teamData?.name) {
        teams.push({
          id: teamData.id,
          name: teamData.name,
          logoUrl: (teamData as any).logoUrl,
          sport: teamData.sport,
        });
      }
      
      // Add additional teams from teamIds
      if (userData.teamIds) {
        for (const tid of userData.teamIds) {
          if (tid !== teamData?.id) {
            try {
              const teamDoc = await getDocs(query(collection(db, 'teams'), where('__name__', '==', tid)));
              teamDoc.forEach(doc => {
                const data = doc.data();
                teams.push({
                  id: doc.id,
                  name: data.name,
                  logoUrl: data.logoUrl,
                  sport: data.sport,
                });
              });
            } catch (e) {
              console.error('Error fetching team:', e);
            }
          }
        }
      }
      
      setAvailableTeams(teams);
    };
    
    fetchTeams();
  }, [userData, teamData]);

  // Fetch players for parents
  useEffect(() => {
    const fetchPlayers = async () => {
      if (!userData || userData.role !== 'Parent') return;
      
      try {
        // Get all players linked to this parent
        const playersRef = collection(db, 'athletes');
        const q = query(playersRef, where('parentUserId', '==', userData.uid));
        const snapshot = await getDocs(q);
        
        const players: PlayerOption[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          // Get team name
          let teamName = 'Unknown Team';
          if (data.teamId) {
            try {
              const teamSnap = await getDocs(query(collection(db, 'teams'), where('__name__', '==', data.teamId)));
              teamSnap.forEach(t => teamName = t.data().name);
            } catch (e) { /* ignore */ }
          }
          
          players.push({
            id: docSnap.id,
            name: data.name || data.displayName || 'Player',
            photoUrl: data.photoUrl,
            teamId: data.teamId,
            teamName,
          });
        }
        
        setAvailablePlayers(players);
      } catch (error) {
        console.error('Error fetching players:', error);
      }
    };
    
    fetchPlayers();
  }, [userData]);

  // Fetch seasons and events for current team
  useEffect(() => {
    const fetchSeasonsAndEvents = async () => {
      if (!teamData?.id) return;
      
      try {
        // Fetch active seasons
        const seasonsRef = collection(db, 'teams', teamData.id, 'seasons');
        const seasonsQ = query(seasonsRef, where('status', 'in', ['registration', 'active']));
        const seasonsSnap = await getDocs(seasonsQ);
        
        // Also fetch team's promo items to check for linked designs
        const promoItemsRef = collection(db, 'teams', teamData.id, 'promoItems');
        const promoSnap = await getDocs(promoItemsRef);
        
        // Build a set of season IDs that have linked flyers
        const seasonsWithFlyers = new Set<string>();
        const eventsWithDesigns = new Set<string>();
        
        promoSnap.docs.forEach(doc => {
          const data = doc.data();
          // Check if promo is linked to a season (registration flyer)
          if (data.linkedEventId && data.linkedEventType === 'registration') {
            seasonsWithFlyers.add(data.linkedEventId);
          }
          // Also check seasonId field for backwards compatibility
          if (data.seasonId) {
            seasonsWithFlyers.add(data.seasonId);
          }
          // Check for game/event linked designs
          if (data.linkedEventId && (data.linkedEventType === 'game' || data.linkedEventType === 'event')) {
            eventsWithDesigns.add(data.linkedEventId);
          }
        });
        
        const seasons: { id: string; name: string; hasFlyer: boolean; closeDate?: string }[] = [];
        const reminders: typeof designReminders = [];
        
        seasonsSnap.docs.forEach(doc => {
          const data = doc.data();
          // Check flyerId on season doc OR if there's a promo item linked to this season
          const hasFlyer = !!data.flyerId || !!data.flyerUrl || seasonsWithFlyers.has(doc.id);
          seasons.push({
            id: doc.id,
            name: data.name,
            hasFlyer,
          });
          
          // Add to reminders if no flyer and status is registration
          if (!hasFlyer && data.status === 'registration') {
            reminders.push({
              id: doc.id,
              type: 'registration',
              name: data.name,
              date: data.registrationCloseDate ? `Closes: ${data.registrationCloseDate}` : undefined,
              suggestedTemplate: 'registration-modern',
            });
          }
        });
        
        setAvailableSeasons(seasons);
        
        // Fetch upcoming events (games)
        const eventsRef = collection(db, 'events');
        const eventsQ = query(eventsRef, where('teamId', '==', teamData.id));
        const eventsSnap = await getDocs(eventsQ);
        
        const events: typeof availableEvents = [];
        
        eventsSnap.docs.forEach(doc => {
          const data = doc.data();
          const eventType = (data.eventType || data.type || 'event').toLowerCase();
          
          events.push({
            id: doc.id,
            name: data.title || data.name,
            type: eventType as any,
          });
          
          // Add game to reminders if no ticket design (check both ticketDesignId and promoItems)
          const hasDesign = !!data.ticketDesignId || eventsWithDesigns.has(doc.id);
          if (eventType === 'game' && !hasDesign) {
            reminders.push({
              id: doc.id,
              type: 'game',
              name: data.title || data.name,
              date: data.date ? `Game: ${data.date}` : undefined,
              suggestedTemplate: 'ticket-gameday',
            });
          }
        });
        
        setAvailableEvents(events);
        setDesignReminders(reminders);
      } catch (error) {
        console.error('Error fetching seasons/events:', error);
      }
    };
    
    fetchSeasonsAndEvents();
  }, [teamData?.id]);

  // Handle ESC key to exit fullscreen/preview modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewMode === 'preview' || viewMode === 'fullscreen') {
          setViewMode('editor');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  // ==========================================================================
  // HISTORY MANAGEMENT
  // ==========================================================================
  
  const saveToHistory = useCallback(() => {
    setHistory(prev => ({
      past: [...prev.past.slice(-50), elements], // Keep last 50 states
      future: [],
    }));
  }, [elements]);

  const undo = useCallback(() => {
    if (history.past.length === 0) return;
    
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    
    setHistory({
      past: newPast,
      future: [elements, ...history.future],
    });
    setElements(previous);
  }, [history, elements]);

  const redo = useCallback(() => {
    if (history.future.length === 0) return;
    
    const next = history.future[0];
    const newFuture = history.future.slice(1);
    
    setHistory({
      past: [...history.past, elements],
      future: newFuture,
    });
    setElements(next);
  }, [history, elements]);

  // ==========================================================================
  // KEYBOARD SHORTCUTS
  // ==========================================================================
  
  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    saveToHistory();
    setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
    setSelectedIds([]);
  }, [selectedIds, saveToHistory]);
  
  const handleCopy = useCallback(() => {
    const selectedElements = elements.filter(el => selectedIds.includes(el.id));
    copyToClipboard(selectedElements);
  }, [elements, selectedIds]);
  
  const handlePaste = useCallback(() => {
    const clipboard = getClipboard();
    if (clipboard.length === 0) return;
    
    saveToHistory();
    const newElements = clipboard.map(el => ({
      ...el,
      id: generateId(),
      position: { x: el.position.x + 20, y: el.position.y + 20 },
      zIndex: Date.now() + Math.random(),
    }));
    setElements(prev => [...prev, ...newElements]);
    setSelectedIds(newElements.map(el => el.id));
  }, [saveToHistory]);
  
  const handleCut = useCallback(() => {
    handleCopy();
    handleDelete();
  }, [handleCopy, handleDelete]);
  
  const handleSelectAll = useCallback(() => {
    setSelectedIds(elements.map(el => el.id));
  }, [elements]);
  
  const handleDuplicate = useCallback(() => {
    if (selectedIds.length === 0) return;
    saveToHistory();
    
    const selectedElements = elements.filter(el => selectedIds.includes(el.id));
    const newElements = selectedElements.map(el => ({
      ...el,
      id: generateId(),
      position: { x: el.position.x + 20, y: el.position.y + 20 },
      zIndex: Date.now() + Math.random(),
    }));
    
    setElements(prev => [...prev, ...newElements]);
    setSelectedIds(newElements.map(el => el.id));
  }, [elements, selectedIds, saveToHistory]);
  
  const handleNudge = useCallback((direction: 'up' | 'down' | 'left' | 'right', shift: boolean) => {
    if (selectedIds.length === 0) return;
    
    const amount = shift ? 10 : 1;
    const delta = {
      up: { x: 0, y: -amount },
      down: { x: 0, y: amount },
      left: { x: -amount, y: 0 },
      right: { x: amount, y: 0 },
    }[direction];
    
    setElements(prev => prev.map(el => 
      selectedIds.includes(el.id) 
        ? { ...el, position: { x: el.position.x + delta.x, y: el.position.y + delta.y } }
        : el
    ));
  }, [selectedIds]);
  
  const handleBringForward = useCallback(() => {
    if (selectedIds.length === 0) return;
    saveToHistory();
    
    setElements(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const selectedIndices = sorted.map((el, i) => selectedIds.includes(el.id) ? i : -1).filter(i => i >= 0);
      
      for (const idx of selectedIndices.reverse()) {
        if (idx < sorted.length - 1) {
          [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
        }
      }
      
      return sorted.map((el, i) => ({ ...el, zIndex: i }));
    });
  }, [selectedIds, saveToHistory]);
  
  const handleSendBackward = useCallback(() => {
    if (selectedIds.length === 0) return;
    saveToHistory();
    
    setElements(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const selectedIndices = sorted.map((el, i) => selectedIds.includes(el.id) ? i : -1).filter(i => i >= 0);
      
      for (const idx of selectedIndices) {
        if (idx > 0) {
          [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
        }
      }
      
      return sorted.map((el, i) => ({ ...el, zIndex: i }));
    });
  }, [selectedIds, saveToHistory]);
  
  const handleBringToFront = useCallback(() => {
    if (selectedIds.length === 0) return;
    saveToHistory();
    
    setElements(prev => {
      const maxZ = Math.max(...prev.map(el => el.zIndex));
      return prev.map(el => 
        selectedIds.includes(el.id) ? { ...el, zIndex: maxZ + 1 } : el
      );
    });
  }, [selectedIds, saveToHistory]);
  
  const handleSendToBack = useCallback(() => {
    if (selectedIds.length === 0) return;
    saveToHistory();
    
    setElements(prev => {
      const minZ = Math.min(...prev.map(el => el.zIndex));
      return prev.map(el => 
        selectedIds.includes(el.id) ? { ...el, zIndex: minZ - 1 } : el
      );
    });
  }, [selectedIds, saveToHistory]);
  
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 5, 400));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 5, 10));
  }, []);
  
  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);
  
  const handleZoomChange = useCallback((value: number) => {
    setZoom(Math.max(10, Math.min(400, value)));
  }, []);
  
  // Fit to screen - calculate zoom to fit canvas in viewport with padding
  const handleFitToScreen = useCallback(() => {
    // Get available viewport size (accounting for panels and padding)
    // Left toolbar ~64px, Quick Add panel ~240px, Right panel ~300px, padding ~64px
    const leftPanelWidth = leftPanelCollapsed ? 64 : 304; // toolbar + quick add
    const rightPanelWidth = rightPanelCollapsed ? 0 : 300;
    const headerHeight = 56;
    const padding = 64; // 32px on each side
    
    const availableWidth = window.innerWidth - leftPanelWidth - rightPanelWidth - padding;
    const availableHeight = window.innerHeight - headerHeight - padding;
    
    // Calculate zoom to fit both dimensions
    const zoomX = (availableWidth / canvas.width) * 100;
    const zoomY = (availableHeight / canvas.height) * 100;
    
    // Use the smaller zoom to ensure canvas fits
    const fitZoom = Math.floor(Math.min(zoomX, zoomY));
    
    // Clamp to valid range
    setZoom(Math.max(10, Math.min(400, fitZoom)));
  }, [canvas.width, canvas.height, leftPanelCollapsed, rightPanelCollapsed]);
  
  const handleSaveDesign = useCallback(() => {
    setShowSaveModal(true);
  }, []);
  
  const handleSavePromo = useCallback(async (options: SavePromoOptions) => {
    if (!userData) throw new Error('Not authenticated');
    
    await savePromoItem(
      designName,
      canvas,
      elements,
      currentSize,
      userData.uid,
      userData.name || 'Unknown',
      options
    );
    
    // Clear unsaved changes flag after successful save
    setHasChanges(false);
  }, [userData, designName, canvas, elements, currentSize]);
  
  // Handle loading a design from the gallery
  const handleLoadDesign = useCallback((promo: PromoItem) => {
    // Load the design into the editor
    setDesignName(promo.name);
    setCanvas(promo.canvas);
    setElements(promo.elements);
    setCurrentSize(promo.size);
    setSelectedIds([]);
    setHistory({ past: [], future: [] });
    setShowGallery(false);
    setViewMode('editor');
    setHasChanges(false); // Fresh load = no unsaved changes
  }, []);
  
  // Note: handleExportShortcut is defined as inline function in useKeyboardShortcuts
  // to avoid circular dependency with handleExport which is defined later
  
  // Use keyboard shortcuts hook
  useKeyboardShortcuts({
    onDelete: handleDelete,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onCut: handleCut,
    onUndo: undo,
    onRedo: redo,
    onSelectAll: handleSelectAll,
    onDeselect: () => setSelectedIds([]),
    onDuplicate: handleDuplicate,
    onBringForward: handleBringForward,
    onSendBackward: handleSendBackward,
    onBringToFront: handleBringToFront,
    onSendToBack: handleSendToBack,
    onNudge: handleNudge,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
    onToggleGrid: () => setGridEnabled(!gridEnabled),
    onSave: handleSaveDesign,
    onExport: () => {
      // Inline export handler - triggers a download with current canvas state
      // Full export is handled by handleExport in HeaderBar
    },
    hasSelection: selectedIds.length > 0,
    isEditing: isEditingText,
  });

  // ==========================================================================
  // ELEMENT MANAGEMENT
  // ==========================================================================
  
  const addElement = useCallback((type: 'text' | 'image' | 'shape' | 'qrcode') => {
    saveToHistory();
    
    // Add at center of canvas
    const position: Position = {
      x: canvas.width / 2 - 100,
      y: canvas.height / 2 - 50,
    };
    
    const newElement = createDefaultElement(type, position);
    
    // Apply team colors if available
    if (type === 'shape' && (teamData as any)?.secondaryColor) {
      newElement.backgroundColor = (teamData as any).secondaryColor;
    }
    
    // Set shape type if adding a shape
    if (type === 'shape') {
      newElement.shapeType = toolState.shapeType;
    }
    
    setElements(prev => [...prev, newElement]);
    setSelectedIds([newElement.id]);
    setToolState(prev => ({ ...prev, activeTool: 'select' }));
  }, [canvas, saveToHistory, teamData, toolState.shapeType]);

  const addElementAt = useCallback((type: 'text' | 'image' | 'shape', position: Position) => {
    saveToHistory();
    
    const newElement = createDefaultElement(type, position);
    setElements(prev => [...prev, newElement]);
    setSelectedIds([newElement.id]);
  }, [saveToHistory]);

  const updateElement = useCallback((id: string, updates: Partial<DesignElement>) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ));
  }, []);

  const deleteElement = useCallback((id: string) => {
    saveToHistory();
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedIds(prev => prev.filter(selId => selId !== id));
  }, [saveToHistory]);

  const duplicateElement = useCallback((id: string) => {
    saveToHistory();
    
    const element = elements.find(el => el.id === id);
    if (!element) return;
    
    const newElement: DesignElement = {
      ...element,
      id: generateId(),
      position: {
        x: element.position.x + 20,
        y: element.position.y + 20,
      },
      zIndex: Date.now(),
    };
    
    setElements(prev => [...prev, newElement]);
    setSelectedIds([newElement.id]);
  }, [elements, saveToHistory]);

  // ==========================================================================
  // SELECTION
  // ==========================================================================
  
  const selectElement = useCallback((id: string, addToSelection = false) => {
    if (addToSelection) {
      setSelectedIds(prev => 
        prev.includes(id) 
          ? prev.filter(selId => selId !== id)
          : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // ==========================================================================
  // CANVAS MANAGEMENT
  // ==========================================================================
  
  const updateCanvas = useCallback((updates: Partial<CanvasState>) => {
    setCanvas(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSizeChange = useCallback((size: FlyerSize) => {
    setCurrentSize(size);
    setCanvas(prev => ({
      ...prev,
      width: FLYER_SIZES[size].width,
      height: FLYER_SIZES[size].height,
    }));
  }, []);

  // ==========================================================================
  // TEMPLATE HANDLING
  // ==========================================================================
  
  const handleSelectTemplate = useCallback((template: DesignTemplate) => {
    setCanvas(template.canvas);
    setElements(template.elements.map(el => ({ ...el, id: generateId() })));
    setDesignName(template.name);
    setSelectedIds([]);
    
    // Determine size from template dimensions
    const matchingSize = Object.entries(FLYER_SIZES).find(
      ([_, size]) => size.width === template.canvas.width && size.height === template.canvas.height
    );
    if (matchingSize) {
      setCurrentSize(matchingSize[0] as FlyerSize);
    }
    
    setViewMode('editor');
  }, []);

  const handleStartBlank = useCallback((size: FlyerSize, customWidth?: number, customHeight?: number) => {
    // Use custom dimensions if provided, otherwise use preset size
    const width = customWidth || FLYER_SIZES[size].width;
    const height = customHeight || FLYER_SIZES[size].height;
    
    setCanvas({
      width,
      height,
      backgroundColor: (teamData as any)?.primaryColor || '#1e3a5f',
    });
    setElements([]);
    setSelectedIds([]);
    setCurrentSize(size);
    setDesignName('Untitled Design');
    setViewMode('editor');
  }, [teamData]);

  // Handle AI-generated design import
  const handleAIImport = useCallback((aiElements: DesignElement[], aiCanvas: CanvasState, size: FlyerSize) => {
    setCanvas(aiCanvas);
    setElements(aiElements.map(el => ({ ...el, id: generateId() })));
    setDesignName('AI Generated Design');
    setSelectedIds([]);
    setCurrentSize(size);
    setShowAICreator(false);
    setViewMode('editor');
  }, []);

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  
  const handleExport = useCallback(async (format: 'png' | 'jpg' | 'pdf') => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = canvas.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background gradient if present
    if (canvas.backgroundGradient) {
      const { type, angle, stops } = canvas.backgroundGradient;
      let gradient: CanvasGradient;
      
      if (type === 'linear') {
        const rad = (angle * Math.PI) / 180;
        gradient = ctx.createLinearGradient(
          canvas.width / 2 - Math.cos(rad) * canvas.width,
          canvas.height / 2 - Math.sin(rad) * canvas.height,
          canvas.width / 2 + Math.cos(rad) * canvas.width,
          canvas.height / 2 + Math.sin(rad) * canvas.height
        );
      } else {
        gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2
        );
      }
      
      stops.forEach(stop => {
        gradient.addColorStop(stop.offset, stop.color);
      });
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Sort elements by zIndex
    const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    // Draw each element
    for (const element of sortedElements) {
      if (!element.visible) continue;

      ctx.save();
      ctx.globalAlpha = element.opacity;

      // Apply rotation
      if (element.rotation !== 0) {
        const centerX = element.position.x + element.size.width / 2;
        const centerY = element.position.y + element.size.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((element.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      switch (element.type) {
        case 'text':
          ctx.fillStyle = element.color || '#ffffff';
          ctx.font = `${element.fontWeight || 'normal'} ${element.fontStyle || 'normal'} ${element.fontSize || 32}px ${element.fontFamily || 'Inter, sans-serif'}`;
          ctx.textAlign = element.textAlign || 'left';
          ctx.textBaseline = 'top';
          
          const textX = element.textAlign === 'center' 
            ? element.position.x + element.size.width / 2
            : element.textAlign === 'right'
              ? element.position.x + element.size.width
              : element.position.x;
          
          ctx.fillText(element.content || '', textX, element.position.y);
          break;

        case 'shape':
          ctx.fillStyle = element.backgroundColor || '#8b5cf6';
          
          if (element.shapeType === 'circle') {
            const radius = Math.min(element.size.width, element.size.height) / 2;
            ctx.beginPath();
            ctx.arc(
              element.position.x + element.size.width / 2,
              element.position.y + element.size.height / 2,
              radius, 0, Math.PI * 2
            );
            ctx.fill();
          } else {
            // Rectangle with border radius
            const r = element.borderRadius || 0;
            ctx.beginPath();
            ctx.moveTo(element.position.x + r, element.position.y);
            ctx.lineTo(element.position.x + element.size.width - r, element.position.y);
            ctx.quadraticCurveTo(element.position.x + element.size.width, element.position.y, element.position.x + element.size.width, element.position.y + r);
            ctx.lineTo(element.position.x + element.size.width, element.position.y + element.size.height - r);
            ctx.quadraticCurveTo(element.position.x + element.size.width, element.position.y + element.size.height, element.position.x + element.size.width - r, element.position.y + element.size.height);
            ctx.lineTo(element.position.x + r, element.position.y + element.size.height);
            ctx.quadraticCurveTo(element.position.x, element.position.y + element.size.height, element.position.x, element.position.y + element.size.height - r);
            ctx.lineTo(element.position.x, element.position.y + r);
            ctx.quadraticCurveTo(element.position.x, element.position.y, element.position.x + r, element.position.y);
            ctx.closePath();
            ctx.fill();
          }
          break;

        case 'image':
        case 'logo':
          if (element.src) {
            try {
              const img = await loadImage(element.src);
              ctx.drawImage(img, element.position.x, element.position.y, element.size.width, element.size.height);
            } catch (e) {
              // Skip if image fails to load
            }
          }
          break;

        case 'qrcode':
          if (element.src) {
            try {
              const img = await loadImage(element.src);
              ctx.fillStyle = element.backgroundColor || '#ffffff';
              ctx.fillRect(element.position.x, element.position.y, element.size.width, element.size.height);
              ctx.drawImage(img, element.position.x + 10, element.position.y + 10, element.size.width - 20, element.size.height - 20);
            } catch (e) {
              // Skip if image fails to load
            }
          }
          break;
      }

      ctx.restore();
    }

    // Download
    const link = document.createElement('a');
    link.download = `${designName || 'design'}.${format === 'pdf' ? 'pdf' : format}`;
    
    if (format === 'pdf') {
      // For PDF, we'd need a library like jsPDF - for now, export as PNG
      link.href = exportCanvas.toDataURL('image/png', 1.0);
      link.download = `${designName || 'design'}.png`;
    } else {
      link.href = exportCanvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
    }
    
    link.click();
  }, [canvas, elements, designName]);

  // Helper to load images
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  // ==========================================================================
  // LAYER REORDERING
  // ==========================================================================
  
  const handleReorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    saveToHistory();
    const newElements = [...elements];
    const [removed] = newElements.splice(fromIndex, 1);
    newElements.splice(toIndex, 0, removed);
    
    // Update zIndex values
    newElements.forEach((el, i) => {
      el.zIndex = i;
    });
    
    setElements(newElements);
  }, [elements, saveToHistory]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  const selectedElement = selectedIds.length === 1 
    ? elements.find(el => el.id === selectedIds[0]) || null
    : null;

  if (viewMode === 'selector') {
    return (
      <>
        <TemplateSelector
          onSelectTemplate={handleSelectTemplate}
          onStartBlank={handleStartBlank}
          onBack={() => window.history.back()}
          onOpenGallery={() => setShowGallery(true)}
          onOpenAICreator={() => setShowAICreator(true)}
          onOpenUniformDesigner={() => setShowUniformDesigner(true)}
          reminders={designReminders}
          onReminderClick={(reminder) => {
            // Load the suggested template for this reminder
            const template = DESIGN_TEMPLATES.find(t => t.id === reminder.suggestedTemplate);
            if (template) {
              handleSelectTemplate(template);
            }
          }}
        />
        
        {/* Promo Gallery Modal - Available from selector */}
        {showGallery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/80" onClick={() => setShowGallery(false)} />
            <div className="relative w-[90vw] max-w-5xl h-[80vh] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
              <button
                onClick={() => setShowGallery(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white"
              >
                ✕
              </button>
              <PromoGallery
                onEditDesign={handleLoadDesign}
                onClose={() => setShowGallery(false)}
              />
            </div>
          </div>
        )}
        
        {/* AI Creator Modal */}
        {showAICreator && (
          <AICreatorModal
            onClose={() => setShowAICreator(false)}
            onImportDesign={handleAIImport}
            teamData={teamData ? {
              id: teamData.id,
              name: teamData.name,
              sport: teamData.sport,
              logoUrl: (teamData as any)?.logoUrl,
              primaryColor: (teamData as any)?.primaryColor,
              secondaryColor: (teamData as any)?.secondaryColor,
            } : undefined}
            availableSeasons={availableSeasons}
            availableEvents={availableEvents}
          />
        )}
        
        {/* Uniform Designer Modal */}
        {showUniformDesigner && (
          <UniformDesigner
            onClose={() => setShowUniformDesigner(false)}
            teamData={teamData ? {
              name: teamData.name,
              primaryColor: (teamData as any)?.primaryColor,
              secondaryColor: (teamData as any)?.secondaryColor,
              logoUrl: (teamData as any)?.logoUrl,
            } : undefined}
          />
        )}
      </>
    );
  }

  // Calculate scale to fit canvas in viewport while maintaining aspect ratio
  const calculatePreviewScale = () => {
    const maxWidth = window.innerWidth - 100;
    const maxHeight = window.innerHeight - 160;
    const scaleX = maxWidth / canvas.width;
    const scaleY = maxHeight / canvas.height;
    return Math.min(scaleX, scaleY, 1);
  };

  // Preview Mode - View only, maintains aspect ratio
  if (viewMode === 'preview') {
    const previewScale = calculatePreviewScale();
    const scaledWidth = canvas.width * previewScale;
    const scaledHeight = canvas.height * previewScale;
    
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center">
        {/* Top bar with buttons */}
        <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-20">
          {/* Edit Fullscreen button */}
          <button
            onClick={() => setViewMode('fullscreen')}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white flex items-center gap-2 font-medium shadow-lg"
          >
            <span>✎</span> Edit Fullscreen
          </button>
          
          {/* Close button */}
          <button
            onClick={() => setViewMode('editor')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white flex items-center gap-2"
          >
            <span>✕</span> Back to Editor
          </button>
        </div>
        
        {/* Canvas Preview Container - Wrapper to handle scaled size */}
        <div 
          style={{
            width: scaledWidth,
            height: scaledHeight,
            overflow: 'hidden',
          }}
        >
          {/* Canvas - Using CSS transform for proper scaling */}
          <div 
            className="relative shadow-2xl"
            style={{
              width: canvas.width,
              height: canvas.height,
              backgroundColor: canvas.backgroundColor,
              backgroundImage: canvas.backgroundImage ? `url(${canvas.backgroundImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
              overflow: 'hidden',
            }}
          >
          {/* Gradient overlay if set */}
          {canvas.backgroundGradient && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: canvas.backgroundGradient.type === 'linear'
                  ? `linear-gradient(${canvas.backgroundGradient.angle}deg, ${canvas.backgroundGradient.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`
                  : `radial-gradient(circle, ${canvas.backgroundGradient.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`
              }}
            />
          )}
          
          {/* Elements - No manual scaling needed since parent uses CSS transform */}
          {elements
            .filter(el => el.visible)
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(element => (
              <div
                key={element.id}
                className="absolute"
                style={{
                  left: element.position.x,
                  top: element.position.y,
                  width: element.size.width,
                  height: element.size.height,
                  transform: `rotate(${element.rotation}deg)`,
                  opacity: element.opacity,
                }}
              >
                {element.type === 'text' && (
                  <div
                    className="w-full h-full overflow-hidden whitespace-pre-wrap break-words"
                    style={{
                      color: element.color,
                      fontSize: element.fontSize || 32,
                      fontFamily: element.fontFamily,
                      fontWeight: element.fontWeight,
                      fontStyle: element.fontStyle,
                      textAlign: element.textAlign,
                      lineHeight: element.lineHeight || 1.2,
                      textDecoration: element.textDecoration,
                      letterSpacing: element.letterSpacing,
                      textShadow: element.textShadow,
                    }}
                  >
                    {element.content}
                  </div>
                )}
                {element.type === 'shape' && (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: element.backgroundColor,
                      borderRadius: element.shapeType === 'circle' ? '50%' : element.borderRadius,
                    }}
                  />
                )}
                {(element.type === 'image' || element.type === 'logo') && element.src && (
                  <img 
                    src={element.src} 
                    alt="" 
                    className="w-full h-full" 
                    style={{ objectFit: 'contain', borderRadius: element.borderRadius }} 
                  />
                )}
                {element.type === 'qrcode' && element.content && (
                  <div className="w-full h-full bg-white flex items-center justify-center p-2" style={{ borderRadius: element.borderRadius }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(element.content)}`}
                      alt="QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Size indicator */}
        <div className="absolute bottom-4 text-slate-400 text-sm">
          {canvas.width} × {canvas.height}px • {Math.round(previewScale * 100)}% • Press ESC to exit
        </div>
      </div>
    );
  }

  // Fullscreen Edit Mode - Full editing capabilities at larger scale
  if (viewMode === 'fullscreen') {
    // Calculate optimal zoom for fullscreen
    const fullscreenScale = calculatePreviewScale() * 100;
    
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
        {/* Fullscreen Header */}
        <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('editor')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white flex items-center gap-2"
            >
              ← Exit Fullscreen
            </button>
            <span className="text-white font-medium">{designName}</span>
            <span className="text-slate-500 text-sm">Fullscreen Edit Mode</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <button
              onClick={undo}
              disabled={history.past.length === 0}
              className="p-2 rounded-lg text-slate-300 hover:bg-zinc-800 disabled:opacity-30"
              title="Undo"
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={history.future.length === 0}
              className="p-2 rounded-lg text-slate-300 hover:bg-zinc-800 disabled:opacity-30"
              title="Redo"
            >
              ↷
            </button>
            
            <div className="w-px h-6 bg-zinc-700 mx-2" />
            
            {/* Zoom controls */}
            <button
              onClick={() => setZoom(Math.max(25, zoom - 10))}
              className="p-2 rounded-lg text-slate-300 hover:bg-zinc-800"
            >
              −
            </button>
            <span className="text-slate-300 min-w-[50px] text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 10))}
              className="p-2 rounded-lg text-slate-300 hover:bg-zinc-800"
            >
              +
            </button>
            <button
              onClick={() => setZoom(Math.round(fullscreenScale))}
              className="px-2 py-1 rounded text-xs text-slate-400 hover:bg-zinc-800"
              title="Fit to screen"
            >
              Fit
            </button>
            
            <div className="w-px h-6 bg-zinc-700 mx-2" />
            
            {/* Preview mode */}
            <button
              onClick={() => setViewMode('preview')}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white flex items-center gap-2"
            >
              👁 Preview
            </button>
          </div>
        </div>
        
        {/* Fullscreen Canvas - Full editing capability */}
        <div className="flex-1 overflow-hidden">
          <DesignCanvas
            canvas={canvas}
            elements={elements}
            selectedIds={selectedIds}
            toolState={toolState}
            zoom={zoom}
            gridEnabled={gridEnabled}
            onSelectElement={selectElement}
            onDeselectAll={deselectAll}
            onUpdateElement={updateElement}
            onDeleteElement={deleteElement}
            onDuplicateElement={duplicateElement}
            onZoomChange={setZoom}
            onAddElementAt={addElementAt}
          />
        </div>
        
        {/* Quick Properties bar at bottom for selected element */}
        {selectedIds.length === 1 && (
          <div className="h-12 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 gap-4">
            {(() => {
              const el = elements.find(e => e.id === selectedIds[0]);
              if (!el) return null;
              return (
                <>
                  <span className="text-slate-400 text-sm">{el.type.charAt(0).toUpperCase() + el.type.slice(1)}</span>
                  <span className="text-slate-500 text-xs">
                    {Math.round(el.position.x)}, {Math.round(el.position.y)} • {Math.round(el.size.width)} × {Math.round(el.size.height)}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={() => duplicateElement(el.id)}
                    className="px-2 py-1 text-sm text-slate-300 hover:bg-zinc-800 rounded"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => deleteElement(el.id)}
                    className="px-2 py-1 text-sm text-red-400 hover:bg-zinc-800 rounded"
                  >
                    Delete
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-zinc-950' : 'bg-slate-100'}`}>
      {/* Header */}
      <HeaderBar
        designName={designName}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        gridEnabled={gridEnabled}
        currentSize={currentSize}
        zoom={zoom}
        onBack={() => setViewMode('selector')}
        onUndo={undo}
        onRedo={redo}
        onSave={() => setShowSaveModal(true)}
        onOpenGallery={() => setShowGallery(true)}
        onExport={handleExport}
        onToggleGrid={() => setGridEnabled(!gridEnabled)}
        onSizeChange={handleSizeChange}
        onNameChange={setDesignName}
        onPreview={() => setViewMode('preview')}
        onFullscreen={() => setViewMode('fullscreen')}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onZoomChange={handleZoomChange}
        onFitToScreen={handleFitToScreen}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <Toolbar
          toolState={toolState}
          onToolChange={(tool) => setToolState(prev => ({ ...prev, activeTool: tool }))}
          onShapeChange={(shape) => setToolState(prev => ({ ...prev, shapeType: shape }))}
          onAddElement={addElement}
        />

        {/* Quick Add Panel - Collapsible */}
        <div className={`relative transition-all duration-300 ${leftPanelCollapsed ? 'w-0' : 'w-auto'}`}>
          {!leftPanelCollapsed && (
            <QuickAddPanel
              canvasCenter={{ x: canvas.width / 2, y: canvas.height / 2 }}
              onAddElement={(element) => {
                saveToHistory();
                setElements(prev => [...prev, element]);
                setSelectedIds([element.id]);
              }}
            />
          )}
          {/* Collapse/Expand button for left panel */}
          <button
            onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            className={`absolute top-1/2 -translate-y-1/2 z-20 w-5 h-12 flex items-center justify-center rounded-r-md transition-colors ${
              theme === 'dark' 
                ? 'bg-zinc-800 hover:bg-zinc-700 text-slate-400 hover:text-white border border-l-0 border-zinc-700' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-900 border border-l-0 border-slate-300'
            } ${leftPanelCollapsed ? 'left-0' : '-right-5'}`}
            title={leftPanelCollapsed ? 'Show Quick Add' : 'Hide Quick Add'}
          >
            {leftPanelCollapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Canvas Area - Takes remaining space */}
        <DesignCanvas
          canvas={canvas}
          elements={elements}
          selectedIds={selectedIds}
          toolState={toolState}
          zoom={zoom}
          gridEnabled={gridEnabled}
          onSelectElement={selectElement}
          onDeselectAll={deselectAll}
          onUpdateElement={updateElement}
          onDeleteElement={deleteElement}
          onDuplicateElement={duplicateElement}
          onZoomChange={setZoom}
          onAddElementAt={addElementAt}
        />

        {/* Right Panel - Combined Element/Canvas/Layers - Collapsible */}
        <div className={`relative transition-all duration-300 flex ${rightPanelCollapsed ? 'w-0' : 'w-72'}`}>
          {/* Collapse/Expand button for right panel */}
          <button
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            className={`absolute top-1/2 -translate-y-1/2 z-20 w-5 h-12 flex items-center justify-center rounded-l-md transition-colors ${
              theme === 'dark' 
                ? 'bg-zinc-800 hover:bg-zinc-700 text-slate-400 hover:text-white border border-r-0 border-zinc-700' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-900 border border-r-0 border-slate-300'
            } ${rightPanelCollapsed ? 'right-0' : '-left-5'}`}
            title={rightPanelCollapsed ? 'Show Properties' : 'Hide Properties'}
          >
            {rightPanelCollapsed ? '‹' : '›'}
          </button>
          
          {!rightPanelCollapsed && (
            <div className={`w-72 border-l flex flex-col ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
              {/* Tab Bar */}
              <div className={`flex border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
                {[
                  { id: 'element', label: 'Element' },
                  { id: 'canvas', label: 'Canvas' },
                  { id: 'layers', label: 'Layers' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRightPanelTab(tab.id as 'element' | 'canvas' | 'layers')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                      rightPanelTab === tab.id
                        ? theme === 'dark' 
                          ? 'text-purple-400 border-b-2 border-purple-500 bg-zinc-800/50' 
                          : 'text-purple-600 border-b-2 border-purple-500 bg-slate-50'
                        : theme === 'dark' 
                          ? 'text-slate-400 hover:text-white hover:bg-zinc-800' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {rightPanelTab === 'layers' ? (
                  <LayersPanel
                    elements={elements}
                    selectedIds={selectedIds}
                    onSelect={selectElement}
                    onUpdate={updateElement}
                    onDelete={deleteElement}
                    onReorder={handleReorderLayers}
                  />
                ) : (
                  <PropertiesPanel
                    selectedElement={selectedElement}
                    canvas={canvas}
                    onUpdateElement={updateElement}
                    onUpdateCanvas={updateCanvas}
                    onDeleteElement={deleteElement}
                    onDuplicateElement={duplicateElement}
                    activeTab={rightPanelTab}
                    teamId={teamData?.id}
                    teamSlug={(teamData as any)?.slug}
                    seasons={availableSeasons}
                    events={availableEvents}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Save Promo Modal */}
      <SavePromoModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePromo}
        designName={designName}
        onNameChange={setDesignName}
        userRole={userData?.role as 'Coach' | 'Parent' | 'Fan' | 'SuperAdmin' | 'Athlete' || 'Fan'}
        userId={userData?.uid || ''}
        teams={availableTeams}
        players={availablePlayers}
        currentTeamId={teamData?.id}
        currentTeamName={teamData?.name}
        seasons={availableSeasons}
        events={availableEvents}
      />
      
      {/* Promo Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowGallery(false)} />
          <div className={`relative w-[90vw] max-w-5xl h-[80vh] rounded-2xl overflow-hidden shadow-2xl border ${
            theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
          }`}>
            <button
              onClick={() => setShowGallery(false)}
              className={`absolute top-4 right-4 z-10 p-2 rounded-lg ${
                theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
              }`}
            >
              ✕
            </button>
            <PromoGallery
              onEditDesign={handleLoadDesign}
              onClose={() => setShowGallery(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignStudioPro;
