import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { collection, doc, onSnapshot, deleteDoc, serverTimestamp, query, orderBy, addDoc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { CoachPlay, PlayElement, PlayRoute, TeamPlayAssignment, Team, OffensePlayType, DefensePlayType, Formation, DrawingLine, PlayShape, LineType, Player, PositionAssignment } from '../types';
import { BookOpen, Eye, X, Plus, Trash2, Shield, Sword, Zap, Users, AlertCircle, ChevronDown, ChevronUp, FolderOpen, Search, Layers, UserPlus, Check, User, Save } from 'lucide-react';

const ROUTE_COLORS = [
  '#FACC15', '#06b6d4', '#ec4899', '#a3e635', '#f87171', '#ffffff', '#a855f7', '#ea580c', '#3b82f6', '#14b8a6', '#8b5cf6'
];

// Field aspect ratio (width:height) - standard football field proportions
const FIELD_ASPECT_RATIO = 16 / 9;

const TeamPlaybook: React.FC = () => {
  const { teamData, userData, user } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // Play type selection - REQUIRED before viewing
  const [selectedPlayType, setSelectedPlayType] = useState<'Offense' | 'Defense' | 'Special Teams' | null>(null);
  const [filterOffenseType, setFilterOffenseType] = useState<'All' | 'Run' | 'Pass'>('All');
  const [filterDefenseType, setFilterDefenseType] = useState<'All' | 'Normal' | 'Blitz'>('All');
  const [filterFormationId, setFilterFormationId] = useState<string | null>(null);
  const [formationSearch, setFormationSearch] = useState('');
  const [showFormationDropdown, setShowFormationDropdown] = useState(false);

  // Formations from plays
  const [formations, setFormations] = useState<{id: string; name: string; category: string}[]>([]);

  // Team play assignments
  const [assignments, setAssignments] = useState<TeamPlayAssignment[]>([]);
  const [loadedPlays, setLoadedPlays] = useState<Map<string, CoachPlay>>(new Map());
  const [loadingPlays, setLoadingPlays] = useState(true);

  // View selected play
  const [viewingPlay, setViewingPlay] = useState<CoachPlay | null>(null);
  const [viewingAssignmentId, setViewingAssignmentId] = useState<string | null>(null);

  // Add play modal
  const [showAddPlayModal, setShowAddPlayModal] = useState(false);
  const [addPlayCategory, setAddPlayCategory] = useState<'Offense' | 'Defense' | 'Special Teams'>('Offense');
  const [coachPlays, setCoachPlays] = useState<CoachPlay[]>([]);
  const [loadingCoachPlays, setLoadingCoachPlays] = useState(false);
  const [addingPlay, setAddingPlay] = useState(false);
  const [selectedPlayToAdd, setSelectedPlayToAdd] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; playName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Player position assignment
  const [roster, setRoster] = useState<Player[]>([]);
  const [positionAssignments, setPositionAssignments] = useState<Map<string, PositionAssignment>>(new Map()); // Map<elementId, PositionAssignment>
  const [previewAssignments, setPreviewAssignments] = useState<Map<string, Map<string, PositionAssignment>>>(new Map()); // Map<assignmentId, Map<elementId, PositionAssignment>>
  const [assigningPosition, setAssigningPosition] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Canvas ref for field
  const canvasRef = useRef<HTMLDivElement>(null);

  // Check permissions
  const isCoach = userData?.role === 'Coach';
  const isHeadCoach = teamData?.headCoachId === user?.uid || teamData?.coachId === user?.uid;
  const isOC = teamData?.offensiveCoordinatorId === user?.uid;
  const isDC = teamData?.defensiveCoordinatorId === user?.uid;
  const isSTC = teamData?.specialTeamsCoordinatorId === user?.uid;

  // Permission checks for each play type
  const canManageOffense = isHeadCoach || isOC;
  const canManageDefense = isHeadCoach || isDC;
  const canManageSpecialTeams = isHeadCoach || isSTC; // HC or STC can manage special teams

  const canManagePlayType = (category: 'Offense' | 'Defense' | 'Special Teams') => {
    if (!isCoach) return false;
    switch (category) {
      case 'Offense': return canManageOffense;
      case 'Defense': return canManageDefense;
      case 'Special Teams': return canManageSpecialTeams;
      default: return false;
    }
  };

  // Load team play assignments
  useEffect(() => {
    if (!teamData?.id) return;
    
    const assignmentsQuery = query(
      collection(db, 'teams', teamData.id, 'assignedPlays'),
      orderBy('assignedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(assignmentsQuery, async (snapshot) => {
      const assignmentsData = snapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      } as TeamPlayAssignment));
      
      setAssignments(assignmentsData);
      
      // Load the actual plays from coaches' collections
      const playMap = new Map<string, CoachPlay>();
      const formationSet = new Map<string, {id: string; name: string; category: string}>();
      setLoadingPlays(true);
      
      for (const assignment of assignmentsData) {
        try {
          const playDoc = await getDoc(doc(db, 'users', assignment.coachId, 'plays', assignment.playId));
          if (playDoc.exists()) {
            const playData = { id: playDoc.id, ...playDoc.data() } as CoachPlay;
            playMap.set(assignment.playId, playData);
            
            // Collect unique formations from plays
            if (playData.formationId && playData.formationName) {
              formationSet.set(playData.formationId, {
                id: playData.formationId,
                name: playData.formationName,
                category: playData.category
              });
            }
          }
        } catch (err) {
          console.error('Error loading play:', err);
        }
      }
      
      setLoadedPlays(playMap);
      setFormations(Array.from(formationSet.values()));
      setLoadingPlays(false);
    });
    
    return () => unsubscribe();
  }, [teamData?.id]);

  // Load coach's plays when add modal opens
  useEffect(() => {
    if (!showAddPlayModal || !user?.uid) return;
    
    const loadCoachPlays = async () => {
      setLoadingCoachPlays(true);
      try {
        const playsQuery = query(
          collection(db, 'users', user.uid, 'plays'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(playsQuery);
        const plays = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CoachPlay));
        setCoachPlays(plays);
      } catch (err) {
        console.error('Error loading coach plays:', err);
      } finally {
        setLoadingCoachPlays(false);
      }
    };
    
    loadCoachPlays();
  }, [showAddPlayModal, user?.uid]);

  // Keep viewingPlay in sync with loadedPlays when data changes
  useEffect(() => {
    if (viewingPlay && loadedPlays.size > 0) {
      const updatedPlay = loadedPlays.get(viewingPlay.id);
      if (updatedPlay && JSON.stringify(updatedPlay) !== JSON.stringify(viewingPlay)) {
        setViewingPlay(updatedPlay);
      }
    }
  }, [loadedPlays]);

  // Helper function to view a play (sets both play and assignment ID)
  const handleViewPlay = (play: CoachPlay | null, assignmentId?: string) => {
    setViewingPlay(play);
    setViewingAssignmentId(assignmentId || null);
    // Clear any previous assignment selections
    setPositionAssignments(new Map());
  };

  // Load team roster
  useEffect(() => {
    if (!teamData?.id) return;
    
    const rosterQuery = query(
      collection(db, 'teams', teamData.id, 'players'),
      orderBy('name', 'asc')
    );
    
    const unsubscribe = onSnapshot(rosterQuery, (snapshot) => {
      const playersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setRoster(playersData);
    });
    
    return () => unsubscribe();
  }, [teamData?.id]);

  // Load position assignments when viewing a play
  useEffect(() => {
    if (!teamData?.id || !viewingAssignmentId) {
      setPositionAssignments(new Map());
      return;
    }
    
    const loadPositionAssignments = async () => {
      try {
        const posAssignQuery = collection(db, 'teams', teamData.id, 'assignedPlays', viewingAssignmentId, 'positionAssignments');
        const snapshot = await getDocs(posAssignQuery);
        const assignmentMap = new Map<string, PositionAssignment>();
        
        snapshot.docs.forEach(d => {
          const data = { id: d.id, ...d.data() } as PositionAssignment;
          assignmentMap.set(d.id, data); // d.id is the elementId
        });
        
        setPositionAssignments(assignmentMap);
        
        // Also update the preview assignments
        setPreviewAssignments(prev => {
          const newMap = new Map(prev);
          newMap.set(viewingAssignmentId, assignmentMap);
          return newMap;
        });
      } catch (err) {
        console.error('Error loading position assignments:', err);
      }
    };
    
    loadPositionAssignments();
  }, [teamData?.id, viewingAssignmentId]);

  // Load preview assignments for all plays
  useEffect(() => {
    if (!teamData?.id || assignments.length === 0) return;
    
    const loadAllPreviewAssignments = async () => {
      const allAssignments = new Map<string, Map<string, PositionAssignment>>();
      
      await Promise.all(assignments.map(async (assignment) => {
        try {
          const posAssignQuery = collection(db, 'teams', teamData.id, 'assignedPlays', assignment.id, 'positionAssignments');
          const snapshot = await getDocs(posAssignQuery);
          const assignmentMap = new Map<string, PositionAssignment>();
          
          snapshot.docs.forEach(d => {
            const data = { id: d.id, ...d.data() } as PositionAssignment;
            assignmentMap.set(d.id, data);
          });
          
          allAssignments.set(assignment.id, assignmentMap);
        } catch (err) {
          console.error('Error loading preview assignments for', assignment.id, err);
        }
      }));
      
      setPreviewAssignments(allAssignments);
    };
    
    loadAllPreviewAssignments();
  }, [teamData?.id, assignments]);

  // Filter formations for the current play type
  const filteredFormations = formations.filter(f => 
    (!selectedPlayType || f.category === selectedPlayType) &&
    (!formationSearch || f.name.toLowerCase().includes(formationSearch.toLowerCase()))
  );

  // Get selected formation name
  const selectedFormationName = filterFormationId 
    ? formations.find(f => f.id === filterFormationId)?.name 
    : null;

  // Filter plays by selected type, formation, offense type, and defense type
  const filteredAssignments = selectedPlayType 
    ? assignments.filter(a => {
        if (a.category !== selectedPlayType) return false;
        const play = loadedPlays.get(a.playId);
        if (!play) return false;
        // Filter by formation if selected
        if (filterFormationId && play.formationId !== filterFormationId) return false;
        // For offense plays, also filter by run/pass if selected
        if (selectedPlayType === 'Offense' && filterOffenseType !== 'All') {
          if (play.offenseType !== filterOffenseType) return false;
        }
        // For defense plays, also filter by normal/blitz if selected
        if (selectedPlayType === 'Defense' && filterDefenseType !== 'All') {
          if (play.defenseType !== filterDefenseType) return false;
        }
        return true;
      })
    : [];

  // Handle adding a play to team
  const handleAddPlay = async () => {
    if (!selectedPlayToAdd || !teamData?.id || !user?.uid) return;
    
    const playToAdd = coachPlays.find(p => p.id === selectedPlayToAdd);
    if (!playToAdd) return;
    
    // Check if already assigned
    const alreadyAssigned = assignments.some(a => a.playId === selectedPlayToAdd);
    if (alreadyAssigned) {
      alert('This play is already assigned to the team.');
      return;
    }
    
    setAddingPlay(true);
    try {
      const assignment: Omit<TeamPlayAssignment, 'id'> = {
        playId: selectedPlayToAdd,
        coachId: user.uid,
        category: addPlayCategory,
        assignedAt: serverTimestamp(),
        assignedBy: user.uid,
        assignedByName: userData?.name || 'Unknown Coach'
      };
      
      await addDoc(collection(db, 'teams', teamData.id, 'assignedPlays'), assignment);
      
      setShowAddPlayModal(false);
      setSelectedPlayToAdd(null);
    } catch (err) {
      console.error('Error adding play:', err);
      alert('Failed to add play. Please try again.');
    } finally {
      setAddingPlay(false);
    }
  };

  // Handle removing a play from team
  const handleRemovePlay = async () => {
    if (!deleteConfirm || !teamData?.id) return;
    
    setDeleting(true);
    try {
      // First delete all position assignments for this play
      const assignmentsRef = collection(db, 'teams', teamData.id, 'assignedPlays', deleteConfirm.id, 'positionAssignments');
      const assignmentsSnap = await getDocs(assignmentsRef);
      const deletePromises = assignmentsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      
      // Then delete the play assignment itself
      await deleteDoc(doc(db, 'teams', teamData.id, 'assignedPlays', deleteConfirm.id));
      setDeleteConfirm(null);
      if (viewingPlay?.id === assignments.find(a => a.id === deleteConfirm.id)?.playId) {
        handleViewPlay(null);
      }
    } catch (err) {
      console.error('Error removing play:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Handle assigning a player to a position
  const handleAssignPlayer = async (primaryId: string | null, secondaryId: string | null) => {
    // Convert empty strings to null
    const normalizedPrimaryId = primaryId && primaryId.trim() !== '' ? primaryId : null;
    const normalizedSecondaryId = secondaryId && secondaryId.trim() !== '' ? secondaryId : null;
    
    if (!selectedElementId || !viewingPlay || !teamData?.id || !user || !viewingAssignmentId) {
      console.error('Missing required data for assignment:', { selectedElementId, viewingPlay: !!viewingPlay, teamId: teamData?.id, user: !!user, viewingAssignmentId });
      return;
    }
    
    // Capture current values before any async operations
    const currentElementId = selectedElementId;
    const currentAssignmentId = viewingAssignmentId;
    
    setSavingAssignment(true);
    try {
      const primaryPlayer = normalizedPrimaryId ? roster.find(p => p.id === normalizedPrimaryId) : null;
      const secondaryPlayer = normalizedSecondaryId ? roster.find(p => p.id === normalizedSecondaryId) : null;
      
      // Get the element label
      const element = viewingPlay.elements?.find(e => e.id === currentElementId);
      const elementLabel = element?.label || element?.type || 'Unknown';
      
      // Build position data - only include fields that have values
      // Firestore doesn't accept undefined values, so we need to be explicit
      const positionData: Record<string, any> = {
        id: currentElementId,
        elementLabel,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      };
      
      // Only add primary player fields if we have a primary player
      if (normalizedPrimaryId && primaryPlayer) {
        positionData.primaryPlayerId = normalizedPrimaryId;
        positionData.primaryPlayerName = primaryPlayer.name;
        positionData.primaryPlayerNumber = primaryPlayer.number;
      } else {
        // Clear primary player fields if not set
        positionData.primaryPlayerId = null;
        positionData.primaryPlayerName = null;
        positionData.primaryPlayerNumber = null;
      }
      
      // Only add secondary player fields if we have a secondary player
      if (normalizedSecondaryId && secondaryPlayer) {
        positionData.secondaryPlayerId = normalizedSecondaryId;
        positionData.secondaryPlayerName = secondaryPlayer.name;
        positionData.secondaryPlayerNumber = secondaryPlayer.number;
      } else {
        // Clear secondary player fields if not set
        positionData.secondaryPlayerId = null;
        positionData.secondaryPlayerName = null;
        positionData.secondaryPlayerNumber = null;
      }
      
      console.log('[TeamPlaybook] Saving assignment - elementId:', currentElementId, 'assignmentId:', currentAssignmentId, 'positionData:', positionData);
      
      await setDoc(
        doc(db, 'teams', teamData.id, 'assignedPlays', currentAssignmentId, 'positionAssignments', currentElementId),
        positionData
      );
      
      // Update local state for modal view - use captured values
      setPositionAssignments(prev => {
        const newMap = new Map(prev);
        newMap.set(currentElementId, positionData as PositionAssignment);
        console.log('[TeamPlaybook] Updated positionAssignments - key:', currentElementId, 'map size:', newMap.size, 'keys:', Array.from(newMap.keys()));
        return newMap;
      });
      
      // Also update preview assignments so the card updates immediately
      setPreviewAssignments(prev => {
        const newMap = new Map(prev);
        const playAssignments = new Map(newMap.get(currentAssignmentId) || new Map());
        playAssignments.set(currentElementId, positionData as PositionAssignment);
        newMap.set(currentAssignmentId, playAssignments);
        return newMap;
      });
      
      setAssigningPosition(false);
      setSelectedElementId(null);
    } catch (err) {
      console.error('Error assigning player:', err);
      alert('Failed to assign player. Please try again.');
    } finally {
      setSavingAssignment(false);
    }
  };

  // --- Helper functions for line/shape rendering ---
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
    if (line.lineType === 'block') {
      return `url(#block-team-${line.color.replace('#','')})`;
    }
    if (line.lineType === 'route' || line.lineType === 'curved' || line.lineType === 'solid' || line.lineType === 'dashed') {
      return `url(#arrow-team-${line.color.replace('#','')})`;
    }
    return '';
  };

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

  // --- FIELD COMPONENT (view-only) ---
  const renderField = (play: CoachPlay) => (
    <div 
      ref={canvasRef}
      className="w-full h-full relative select-none overflow-hidden"
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

      {/* SVG LAYER for routes, lines, and shapes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {/* Arrow markers for routes and lines */}
          {ROUTE_COLORS.map(color => (
            <React.Fragment key={color}>
              <marker id={`arrow-team-${color.replace('#','')}`} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
                <polygon points="0 0, 4 1.5, 0 3" fill={color} />
              </marker>
              {/* Block marker (T-bar) */}
              <marker id={`block-team-${color.replace('#','')}`} markerWidth="4" markerHeight="5" refX="2" refY="2.5" orient="auto">
                <line x1="2" y1="0" x2="2" y2="5" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
              </marker>
            </React.Fragment>
          ))}
        </defs>
        
        {/* Legacy routes */}
        {(play.routes || []).map(route => {
          const startEl = (play.elements || []).find(e => e.id === route.startElementId);
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
              markerEnd={`url(#arrow-team-${route.color.replace('#','')})`}
            />
          );
        })}

        {/* Drawing lines */}
        {(play.lines || []).map(line => (
          <path
            key={line.id}
            d={generateLinePath(line)}
            stroke={line.color}
            strokeWidth="2"
            fill="none"
            strokeDasharray={getStrokeDash(line.lineType)}
            markerEnd={getMarkerEnd(line)}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Shapes */}
        {(play.shapes || []).map(shape => (
          <g key={shape.id}>
            {renderShapeSvg(shape)}
          </g>
        ))}
      </svg>

      {/* PLAYER ELEMENTS */}
      {(play.elements || []).map((el, idx) => {
        const assignment = positionAssignments.get(el.id);
        const hasAssignment = assignment && (assignment.primaryPlayerId || assignment.secondaryPlayerId);
        
        // Debug logging - log for elements that have assignments
        if (assignment) {
          console.log('[TeamPlaybook] Element with assignment - id:', el.id, 'label:', el.label, 'assignment:', assignment, 'hasAssignment:', hasAssignment);
        }
        
        return (
          <div
            key={el.id}
            onClick={() => {
              setSelectedElementId(el.id);
              setAssigningPosition(true);
            }}
            className={`absolute flex items-center font-bold text-white shadow-lg border-2 z-30 cursor-pointer hover:scale-110 transition-transform ${el.color} ${el.type === 'O' ? 'rounded-full justify-center' : 'justify-center'} ${hasAssignment ? 'ring-4 ring-yellow-400 ring-offset-2' : 'border-white/80'}`}
            style={{ 
              left: `${el.x}%`, 
              top: `${el.y}%`, 
              transform: 'translate(-50%, -50%)',
              width: '36px',
              height: '36px',
              fontSize: '10px',
              ['--tw-ring-offset-color' as string]: isDarkMode ? '#1f1f1f' : '#e5e5e5',
              ...(hasAssignment ? { boxShadow: '0 0 12px 4px rgba(250, 204, 21, 0.6), 0 0 20px 8px rgba(250, 204, 21, 0.3)' } : {}),
              ...(el.type === 'X' ? { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0', paddingTop: '12px' } : {})
            }}
            title={hasAssignment ? `1st: ${assignment.primaryPlayerName || 'Not set'}\n2nd: ${assignment.secondaryPlayerName || 'Not set'}` : 'Click to assign player'}
          >
            {el.label || el.type}
            {hasAssignment && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[8px] px-1 rounded whitespace-nowrap font-medium">
                {assignment.primaryPlayerName?.split(' ')[0] || '#'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // --- PREVIEW FIELD COMPONENT (for cards - simpler, cleaner) ---
  const renderPreviewField = (play: CoachPlay, assignmentId: string) => {
    const playAssignments = previewAssignments.get(assignmentId) || new Map();
    const filledCount = (play.elements || []).filter(el => {
      const a = playAssignments.get(el.id);
      return a && (a.primaryPlayerId || a.secondaryPlayerId);
    }).length;
    const totalCount = (play.elements || []).length;
    
    return (
      <div 
        className="w-full h-full relative select-none overflow-hidden"
        style={{ 
          backgroundColor: isDarkMode ? '#1f1f1f' : '#e5e5e5',
        }}
      >
        {/* Simple field markings */}
        <div className="absolute inset-0 pointer-events-none" style={{ 
          backgroundImage: isDarkMode 
            ? `repeating-linear-gradient(to bottom, transparent 0%, transparent 19%, rgba(255,255,255,0.08) 19%, rgba(255,255,255,0.08) 20%)`
            : `repeating-linear-gradient(to bottom, transparent 0%, transparent 19%, rgba(0,0,0,0.08) 19%, rgba(0,0,0,0.08) 20%)`,
          backgroundSize: '100% 20%' 
        }}></div>

        {/* SVG LAYER for routes/lines - simplified */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {ROUTE_COLORS.map(color => (
              <React.Fragment key={color}>
                <marker id={`arrow-preview-${color.replace('#','')}`} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
                  <polygon points="0 0, 4 1.5, 0 3" fill={color} />
                </marker>
              </React.Fragment>
            ))}
          </defs>
          
          {/* Legacy routes */}
          {(play.routes || []).map(route => {
            const startEl = (play.elements || []).find(e => e.id === route.startElementId);
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
          {(play.lines || []).map(line => (
            <path
              key={line.id}
              d={generateLinePath(line)}
              stroke={line.color}
              strokeWidth="0.5"
              fill="none"
              strokeDasharray={getStrokeDash(line.lineType)}
              markerEnd={getMarkerEnd(line).replace('-team-', '-preview-')}
            />
          ))}

          {/* Shapes */}
          {(play.shapes || []).map(shape => (
            <g key={shape.id}>
              {renderShapeSvg(shape)}
            </g>
          ))}
        </svg>

        {/* PLAYER ELEMENTS - smaller for preview */}
        {(play.elements || []).map(el => {
          const assignment = playAssignments.get(el.id);
          const hasAssignment = assignment && (assignment.primaryPlayerId || assignment.secondaryPlayerId);
          
          return (
            <div
              key={el.id}
              className={`absolute flex items-center justify-center font-bold text-white border z-30 ${el.color} ${el.type === 'O' ? 'rounded-full' : ''}`}
              style={{ 
                left: `${el.x}%`, 
                top: `${el.y}%`, 
                transform: 'translate(-50%, -50%)',
                width: '20px',
                height: '20px',
                fontSize: '7px',
                borderWidth: '1.5px',
                borderColor: hasAssignment ? '#facc15' : 'rgba(255,255,255,0.7)',
                ...(hasAssignment ? { 
                  boxShadow: '0 0 8px 2px rgba(250, 204, 21, 0.7)',
                } : {}),
                ...(el.type === 'X' ? { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0', paddingTop: '6px' } : {})
              }}
            >
              {el.label || el.type}
            </div>
          );
        })}

        {/* Assignment counter badge */}
        {totalCount > 0 && (
          <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
            filledCount === totalCount 
              ? 'bg-green-500 text-white' 
              : filledCount > 0 
                ? 'bg-yellow-500 text-black' 
                : 'bg-slate-500 text-white'
          }`}>
            {filledCount}/{totalCount}
          </div>
        )}
      </div>
    );
  };

  // Get plays available to add (filtered by category and not already assigned)
  const availablePlaysToAdd = coachPlays.filter(p => 
    p.category === addPlayCategory && 
    !assignments.some(a => a.playId === p.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Team Playbook</h1>
              <p className="text-orange-100">View plays assigned to your team</p>
            </div>
          </div>
          <div className="bg-white/20 rounded-lg px-4 py-2">
            <p className="text-white text-sm font-medium">{loadedPlays.size} plays loaded</p>
          </div>
        </div>
      </div>

      {/* Play Type Selection - REQUIRED */}
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-orange-500" />
          Select Play Type
        </h2>
        
        {!selectedPlayType && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Choose a play type to view</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">Select Offense, Defense, or Special Teams below to view the plays.</p>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Offense */}
          <button
            onClick={() => setSelectedPlayType('Offense')}
            className={`p-6 rounded-xl border-2 transition-all ${
              selectedPlayType === 'Offense'
                ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-600'
            }`}
          >
            <Sword className={`w-8 h-8 mx-auto mb-3 ${selectedPlayType === 'Offense' ? 'text-white' : 'text-blue-500'}`} />
            <p className={`font-bold text-lg ${selectedPlayType === 'Offense' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>Offense</p>
            <p className={`text-sm mt-1 ${selectedPlayType === 'Offense' ? 'text-blue-100' : 'text-slate-500'}`}>
              {assignments.filter(a => a.category === 'Offense' && loadedPlays.has(a.playId)).length} plays
            </p>
          </button>

          {/* Defense */}
          <button
            onClick={() => setSelectedPlayType('Defense')}
            className={`p-6 rounded-xl border-2 transition-all ${
              selectedPlayType === 'Defense'
                ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-red-400 dark:hover:border-red-600'
            }`}
          >
            <Shield className={`w-8 h-8 mx-auto mb-3 ${selectedPlayType === 'Defense' ? 'text-white' : 'text-red-500'}`} />
            <p className={`font-bold text-lg ${selectedPlayType === 'Defense' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>Defense</p>
            <p className={`text-sm mt-1 ${selectedPlayType === 'Defense' ? 'text-red-100' : 'text-slate-500'}`}>
              {assignments.filter(a => a.category === 'Defense' && loadedPlays.has(a.playId)).length} plays
            </p>
          </button>

          {/* Special Teams */}
          <button
            onClick={() => setSelectedPlayType('Special Teams')}
            className={`p-6 rounded-xl border-2 transition-all ${
              selectedPlayType === 'Special Teams'
                ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-purple-400 dark:hover:border-purple-600'
            }`}
          >
            <Zap className={`w-8 h-8 mx-auto mb-3 ${selectedPlayType === 'Special Teams' ? 'text-white' : 'text-purple-500'}`} />
            <p className={`font-bold text-lg ${selectedPlayType === 'Special Teams' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>Special Teams</p>
            <p className={`text-sm mt-1 ${selectedPlayType === 'Special Teams' ? 'text-purple-100' : 'text-slate-500'}`}>
              {assignments.filter(a => a.category === 'Special Teams' && loadedPlays.has(a.playId)).length} plays
            </p>
          </button>
        </div>
      </div>

      {/* Plays List - Only shown when play type is selected */}
      {selectedPlayType && (
        <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          {/* Section Header */}
          <div className={`p-4 border-b border-slate-200 dark:border-zinc-800 ${
            selectedPlayType === 'Offense' ? 'bg-blue-500/10' 
            : selectedPlayType === 'Defense' ? 'bg-red-500/10' 
            : 'bg-purple-500/10'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {selectedPlayType === 'Offense' && <Sword className="w-5 h-5 text-blue-500" />}
                {selectedPlayType === 'Defense' && <Shield className="w-5 h-5 text-red-500" />}
                {selectedPlayType === 'Special Teams' && <Zap className="w-5 h-5 text-purple-500" />}
                <h3 className="font-bold text-slate-900 dark:text-white">{selectedPlayType} Plays</h3>
                <span className="bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs font-medium text-slate-600 dark:text-slate-400">
                  {filteredAssignments.length} plays
                </span>
              </div>
              
              {/* Add Play Button - Only for authorized coaches */}
              {canManagePlayType(selectedPlayType) && (
                <button
                  onClick={() => {
                    setAddPlayCategory(selectedPlayType);
                    setShowAddPlayModal(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPlayType === 'Offense' ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : selectedPlayType === 'Defense' ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Play
                </button>
              )}
            </div>
            
            {/* Formation Filter with Search */}
            {filteredFormations.length > 0 && (
              <div className="mt-3 relative">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Formation:</span>
                  <div className="relative flex-1 max-w-xs">
                    <button
                      onClick={() => setShowFormationDropdown(!showFormationDropdown)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-left flex items-center justify-between hover:border-orange-400 transition-colors"
                    >
                      <span className={selectedFormationName ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                        {selectedFormationName || 'All Formations'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                    
                    {showFormationDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
                        {/* Search input */}
                        <div className="p-2 border-b border-slate-200 dark:border-zinc-700">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={formationSearch}
                              onChange={e => setFormationSearch(e.target.value)}
                              placeholder="Search formations..."
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-sm"
                              autoFocus
                            />
                          </div>
                        </div>
                        
                        {/* Options */}
                        <div className="max-h-48 overflow-y-auto">
                          <button
                            onClick={() => {
                              setFilterFormationId(null);
                              setShowFormationDropdown(false);
                              setFormationSearch('');
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 ${
                              !filterFormationId ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            All Formations
                          </button>
                          {filteredFormations.map(formation => (
                            <button
                              key={formation.id}
                              onClick={() => {
                                setFilterFormationId(formation.id);
                                setShowFormationDropdown(false);
                                setFormationSearch('');
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 ${
                                filterFormationId === formation.id ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {formation.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Clear filter button */}
                  {filterFormationId && (
                    <button
                      onClick={() => setFilterFormationId(null)}
                      className="text-xs text-slate-500 hover:text-orange-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Run/Pass Filter - Only for Offense */}
            {selectedPlayType === 'Offense' && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">Type:</span>
                {(['All', 'Run', 'Pass'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterOffenseType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filterOffenseType === type
                        ? type === 'Run' ? 'bg-emerald-500 text-white'
                        : type === 'Pass' ? 'bg-sky-500 text-white'
                        : 'bg-slate-600 text-white'
                        : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'
                    }`}
                  >
                    {type === 'Run' ? '🏃 Run' : type === 'Pass' ? '🏈 Pass' : 'All'}
                  </button>
                ))}
              </div>
            )}
            
            {/* Normal/Blitz Filter - Only for Defense */}
            {selectedPlayType === 'Defense' && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">Type:</span>
                {(['All', 'Normal', 'Blitz'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterDefenseType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filterDefenseType === type
                        ? type === 'Blitz' ? 'bg-amber-500 text-white'
                        : type === 'Normal' ? 'bg-slate-500 text-white'
                        : 'bg-slate-600 text-white'
                        : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'
                    }`}
                  >
                    {type === 'Blitz' ? '⚡ Blitz' : type === 'Normal' ? '🛡️ Normal' : 'All'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Plays Grid */}
          <div className="p-4">
            {loadingPlays ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500">Loading plays...</p>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-slate-500 mb-2">
                  {filterFormationId 
                    ? `No plays with this formation yet.`
                    : `No ${selectedPlayType.toLowerCase()} plays assigned yet.`}
                </p>
                {canManagePlayType(selectedPlayType) && !filterFormationId && (
                  <p className="text-sm text-slate-400">Click "Add Play" to assign plays from your collection.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAssignments.map(assignment => {
                  const play = loadedPlays.get(assignment.playId);
                  if (!play) return null;
                  
                  return (
                    <div 
                      key={assignment.id}
                      className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg transition-shadow group"
                    >
                      {/* Play Preview */}
                      <div 
                        className="h-36 relative cursor-pointer"
                        onClick={() => handleViewPlay(play, assignment.id)}
                      >
                        {renderPreviewField(play, assignment.id)}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                          <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      
                      {/* Play Info */}
                      <div className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-900 dark:text-white truncate">{play.name}</p>
                              {/* Run/Pass Tag for Offense plays */}
                              {play.category === 'Offense' && play.offenseType && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                  play.offenseType === 'Run' 
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                                }`}>
                                  {play.offenseType === 'Run' ? '🏃' : '🏈'} {play.offenseType}
                                </span>
                              )}
                              {/* Blitz Tag for Defense plays */}
                              {play.category === 'Defense' && play.defenseType === 'Blitz' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                  ⚡ Blitz
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              {/* Formation Tag */}
                              {play.formationName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                                  <Layers className="w-3 h-3" /> {play.formationName}
                                </span>
                              )}
                              <span className="text-xs text-slate-500">
                                {play.elements?.length || 0} players
                              </span>
                            </div>
                          </div>
                          {canManagePlayType(selectedPlayType) && (
                            <button
                              onClick={() => setDeleteConfirm({ id: assignment.id, playName: play.name })}
                              className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => handleViewPlay(play, assignment.id)}
                          className="w-full mt-3 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <Eye className="w-4 h-4" /> View Play
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Play Modal */}
      {viewingPlay && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-4xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className={`p-4 flex items-center justify-between ${
              viewingPlay.category === 'Offense' ? 'bg-blue-500' 
              : viewingPlay.category === 'Defense' ? 'bg-red-500' 
              : 'bg-purple-500'
            }`}>
              <div className="flex items-center gap-3">
                {viewingPlay.category === 'Offense' && <Sword className="w-6 h-6 text-white" />}
                {viewingPlay.category === 'Defense' && <Shield className="w-6 h-6 text-white" />}
                {viewingPlay.category === 'Special Teams' && <Zap className="w-6 h-6 text-white" />}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white">{viewingPlay.name}</h2>
                    {/* Run/Pass Tag */}
                    {viewingPlay.category === 'Offense' && viewingPlay.offenseType && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        viewingPlay.offenseType === 'Run' 
                          ? 'bg-emerald-500 text-white'
                          : 'bg-sky-500 text-white'
                      }`}>
                        {viewingPlay.offenseType === 'Run' ? '🏃' : '🏈'} {viewingPlay.offenseType}
                      </span>
                    )}
                    {/* Blitz Tag */}
                    {viewingPlay.category === 'Defense' && viewingPlay.defenseType === 'Blitz' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-amber-500 text-white">
                        ⚡ Blitz
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-white/80 text-sm">
                    <span>{viewingPlay.category}</span>
                    {viewingPlay.formationName && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" /> {viewingPlay.formationName}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{viewingPlay.elements?.length || 0} players</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleViewPlay(null)}
                className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Field */}
            <div className="p-4 bg-slate-200 dark:bg-zinc-800">
              <div 
                className="w-full rounded-lg overflow-hidden border-4 border-slate-300 dark:border-slate-700 shadow-xl"
                style={{ aspectRatio: `${FIELD_ASPECT_RATIO}` }}
              >
                {renderField(viewingPlay)}
              </div>
            </div>
            
            {/* Notes if any */}
            {viewingPlay.notes && (
              <div className="p-4 border-t border-slate-200 dark:border-zinc-800">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Notes</h4>
                <p className="text-slate-600 dark:text-slate-400">{viewingPlay.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Play Modal */}
      {showAddPlayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-zinc-800">
            {/* Header */}
            <div className={`p-4 flex items-center justify-between ${
              addPlayCategory === 'Offense' ? 'bg-blue-500' 
              : addPlayCategory === 'Defense' ? 'bg-red-500' 
              : 'bg-purple-500'
            }`}>
              <div className="flex items-center gap-3">
                <Plus className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-lg font-bold text-white">Add {addPlayCategory} Play</h2>
                  <p className="text-white/80 text-sm">Select from your saved plays</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddPlayModal(false); setSelectedPlayToAdd(null); }}
                className="text-white/80 hover:text-white p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Selector */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Play Type</label>
              <div className="flex gap-2">
                {(['Offense', 'Defense', 'Special Teams'] as const).map(cat => {
                  const canManage = canManagePlayType(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => canManage && setAddPlayCategory(cat)}
                      disabled={!canManage}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        addPlayCategory === cat
                          ? cat === 'Offense' ? 'bg-blue-500 text-white'
                          : cat === 'Defense' ? 'bg-red-500 text-white'
                          : 'bg-purple-500 text-white'
                          : canManage
                            ? 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plays List */}
            <div className="p-4 max-h-[300px] overflow-y-auto">
              {loadingCoachPlays ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Loading your plays...</p>
                </div>
              ) : availablePlaysToAdd.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-slate-500 text-sm">No {addPlayCategory.toLowerCase()} plays available.</p>
                  <p className="text-slate-400 text-xs mt-1">Create plays in your profile's Playbook first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availablePlaysToAdd.map(play => (
                    <div
                      key={play.id}
                      onClick={() => setSelectedPlayToAdd(play.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedPlayToAdd === play.id
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-slate-200 dark:border-zinc-800 hover:border-orange-300 dark:hover:border-orange-600 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          play.category === 'Offense' ? 'bg-blue-100 dark:bg-blue-900/50'
                          : play.category === 'Defense' ? 'bg-red-100 dark:bg-red-900/50'
                          : 'bg-purple-100 dark:bg-purple-900/50'
                        }`}>
                          {play.category === 'Offense' && <Sword className="w-5 h-5 text-blue-500" />}
                          {play.category === 'Defense' && <Shield className="w-5 h-5 text-red-500" />}
                          {play.category === 'Special Teams' && <Zap className="w-5 h-5 text-purple-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 dark:text-white">{play.name}</p>
                          <p className="text-xs text-slate-500">{play.elements?.length || 0} players</p>
                        </div>
                        {selectedPlayToAdd === play.id && (
                          <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => { setShowAddPlayModal(false); setSelectedPlayToAdd(null); }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlay}
                disabled={!selectedPlayToAdd || addingPlay}
                className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  addPlayCategory === 'Offense' ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : addPlayCategory === 'Defense' ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                {addingPlay ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add to Team
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Assignment Modal */}
      {assigningPosition && selectedElementId && viewingPlay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-zinc-800">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Assign Players</h3>
                  <p className="text-orange-100 text-sm">
                    Position: {viewingPlay.elements?.find(e => e.id === selectedElementId)?.label || 
                              viewingPlay.elements?.find(e => e.id === selectedElementId)?.type || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {loadingRoster ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : roster.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-zinc-600 mb-3" />
                  <p className="text-slate-600 dark:text-slate-400">No players in roster</p>
                  <p className="text-sm text-slate-500">Add players to the team roster first</p>
                </div>
              ) : (() => {
                // Get all player IDs already assigned as 1st string on OTHER positions
                const assignedPrimaryIds = new Set<string>();
                positionAssignments.forEach((assignment, elementId) => {
                  // Don't exclude the current position's assignment
                  if (elementId !== selectedElementId && assignment.primaryPlayerId) {
                    assignedPrimaryIds.add(assignment.primaryPlayerId);
                  }
                });
                
                // Filter roster for 1st string selection (exclude already assigned)
                const availableForPrimary = roster.filter(p => !assignedPrimaryIds.has(p.id));
                
                // Get current assignment for this position
                const currentAssignment = positionAssignments.get(selectedElementId || '');
                
                return (
                <>
                  {/* 1st String Player */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      1st String (Primary)
                      {assignedPrimaryIds.size > 0 && (
                        <span className="text-xs text-slate-500 ml-2">
                          ({assignedPrimaryIds.size} player{assignedPrimaryIds.size !== 1 ? 's' : ''} already assigned elsewhere)
                        </span>
                      )}
                    </label>
                    <select
                      id="primary-player-select"
                      defaultValue={currentAssignment?.primaryPlayerId || ''}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">-- Not Assigned --</option>
                      {availableForPrimary.map(player => (
                        <option key={player.id} value={player.id}>
                          #{player.number || '?'} - {player.name} ({player.position || 'No position'})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* 2nd String Player */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      2nd String (Backup)
                      <span className="text-xs text-slate-500 ml-2">(optional)</span>
                    </label>
                    <select
                      id="secondary-player-select"
                      defaultValue={currentAssignment?.secondaryPlayerId || ''}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">-- Not Assigned --</option>
                      {roster.map(player => (
                        <option key={player.id} value={player.id}>
                          #{player.number || '?'} - {player.name} ({player.position || 'No position'})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Current assignment info */}
                  {currentAssignment && (
                    <div className="bg-slate-50 dark:bg-zinc-800 rounded-lg p-3 text-sm">
                      <p className="text-slate-500 dark:text-slate-400">
                        Currently assigned:
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        1st: {currentAssignment?.primaryPlayerName || 'None'}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        2nd: {currentAssignment?.secondaryPlayerName || 'None'}
                      </p>
                    </div>
                  )}
                </>
                );
              })()}
            </div>
            
            {/* Modal Footer */}
            <div className="border-t border-slate-200 dark:border-zinc-800 p-4 flex gap-3">
              <button
                onClick={() => {
                  setAssigningPosition(false);
                  setSelectedElementId(null);
                }}
                disabled={savingAssignment}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const primarySelect = document.getElementById('primary-player-select') as HTMLSelectElement;
                  const secondarySelect = document.getElementById('secondary-player-select') as HTMLSelectElement;
                  const primaryId = primarySelect?.value || null;
                  const secondaryId = secondarySelect?.value || null;
                  handleAssignPlayer(primaryId, secondaryId);
                }}
                disabled={savingAssignment || loadingRoster || roster.length === 0}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {savingAssignment ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Remove Play</h3>
                <p className="text-sm text-slate-500">This will remove the play from the team</p>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to remove "<span className="font-medium text-slate-900 dark:text-white">{deleteConfirm.playName}</span>" from the team playbook?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemovePlay}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPlaybook;
