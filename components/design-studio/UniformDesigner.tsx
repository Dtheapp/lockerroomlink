// =============================================================================
// UNIFORM DESIGNER PRO - World-class uniform creation tool
// Multi-piece uniform design with 3D player preview
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw,
  Eye,
  Palette,
  Shirt,
  Settings,
  Download,
  Save,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  Plus,
  Trash2,
  Wand2,
  Crown,
  Loader2,
  Upload,
  FolderOpen,
  Image as ImageIcon
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';

// =============================================================================
// TYPES
// =============================================================================

type Sport = 'football' | 'basketball' | 'baseball' | 'soccer' | 'volleyball' | 'hockey' | 'lacrosse' | 'track';

type GarmentCategory = 'top' | 'bottom' | 'accessory';

type TopStyle = 
  | 'football-jersey' 
  | 'basketball-jersey' 
  | 'baseball-jersey'
  | 'soccer-jersey'
  | 'tshirt-short'
  | 'tshirt-long'
  | 'tank-top'
  | 'hoodie';

type BottomStyle = 
  | 'football-pants'
  | 'basketball-shorts'
  | 'baseball-pants'
  | 'soccer-shorts'
  | 'athletic-shorts'
  | 'compression-pants';

type AccessoryType = 
  | 'socks-crew'
  | 'socks-knee'
  | 'hat-fitted'
  | 'hat-snapback'
  | 'headband'
  | 'arm-sleeve'
  | 'wristband';

interface GarmentPiece {
  id: string;
  category: GarmentCategory;
  style: TopStyle | BottomStyle | AccessoryType;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: 'solid' | 'stripes' | 'gradient' | 'camo' | 'panels';
  numberFront?: string;
  numberBack?: string;
  numberColor?: string;
  nameBack?: string;
  nameColor?: string;
  logoUrl?: string;
  logoPosition?: 'chest-left' | 'chest-center' | 'chest-right' | 'back';
  // AI-generated design
  aiGeneratedImage?: string; // base64 or URL
  aiPromptUsed?: string;
}

interface UniformSet {
  id: string;
  name: string;
  sport: Sport;
  pieces: GarmentPiece[];
  createdAt: Date;
  teamId?: string;
}

interface SavedUniform {
  id: string;
  name: string;
  sport: Sport;
  pieces: GarmentPiece[];
  createdAt: any;
  teamId: string;
  userId: string;
  quality: 'standard' | 'high';
  // High quality saves include rendered images in Storage
  previewImageUrl?: string;
  pieceImageUrls?: { pieceId: string; url: string; storagePath: string }[];
}

interface UniformDesignerProps {
  onClose: () => void;
  onSave?: (uniform: UniformSet) => void;
  teamData?: {
    name: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    id?: string;
  };
}

// AI Generation cost per piece
const AI_CREDITS_PER_PIECE = 3;

// High quality save cost (for print-ready images)
const HIGH_QUALITY_SAVE_CREDITS = 5;

// =============================================================================
// CONSTANTS
// =============================================================================

const SPORTS: { id: Sport; label: string; icon: string }[] = [
  { id: 'football', label: 'Football', icon: '🏈' },
  { id: 'basketball', label: 'Basketball', icon: '🏀' },
  { id: 'baseball', label: 'Baseball', icon: '⚾' },
  { id: 'soccer', label: 'Soccer', icon: '⚽' },
  { id: 'volleyball', label: 'Volleyball', icon: '🏐' },
  { id: 'hockey', label: 'Hockey', icon: '🏒' },
  { id: 'lacrosse', label: 'Lacrosse', icon: '🥍' },
  { id: 'track', label: 'Track & Field', icon: '🏃' },
];

const TOP_STYLES: { id: TopStyle; label: string; sports: Sport[]; icon: string }[] = [
  { id: 'football-jersey', label: 'Football Jersey', sports: ['football'], icon: '🏈' },
  { id: 'basketball-jersey', label: 'Basketball Jersey', sports: ['basketball'], icon: '🏀' },
  { id: 'baseball-jersey', label: 'Baseball Jersey', sports: ['baseball'], icon: '⚾' },
  { id: 'soccer-jersey', label: 'Soccer Jersey', sports: ['soccer'], icon: '⚽' },
  { id: 'tank-top', label: 'Tank Top', sports: ['basketball', 'volleyball', 'track'], icon: '👕' },
  { id: 'tshirt-short', label: 'T-Shirt (Short Sleeve)', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '👕' },
  { id: 'tshirt-long', label: 'T-Shirt (Long Sleeve)', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '👔' },
  { id: 'hoodie', label: 'Hoodie', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '🧥' },
];

const BOTTOM_STYLES: { id: BottomStyle; label: string; sports: Sport[]; icon: string }[] = [
  { id: 'football-pants', label: 'Football Pants', sports: ['football'], icon: '👖' },
  { id: 'basketball-shorts', label: 'Basketball Shorts', sports: ['basketball'], icon: '🩳' },
  { id: 'baseball-pants', label: 'Baseball Pants', sports: ['baseball'], icon: '👖' },
  { id: 'soccer-shorts', label: 'Soccer Shorts', sports: ['soccer'], icon: '🩳' },
  { id: 'athletic-shorts', label: 'Athletic Shorts', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '🩳' },
  { id: 'compression-pants', label: 'Compression Pants', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '👖' },
];

const ACCESSORY_STYLES: { id: AccessoryType; label: string; icon: string }[] = [
  { id: 'socks-crew', label: 'Crew Socks', icon: '🧦' },
  { id: 'socks-knee', label: 'Knee-High Socks', icon: '🧦' },
  { id: 'hat-fitted', label: 'Fitted Cap', icon: '🧢' },
  { id: 'hat-snapback', label: 'Snapback Cap', icon: '🧢' },
  { id: 'headband', label: 'Headband', icon: '🎀' },
  { id: 'arm-sleeve', label: 'Arm Sleeve', icon: '💪' },
  { id: 'wristband', label: 'Wristband', icon: '⌚' },
];

const PATTERNS = [
  { id: 'solid', label: 'Solid', preview: '■' },
  { id: 'stripes', label: 'Stripes', preview: '≡' },
  { id: 'gradient', label: 'Gradient', preview: '▓' },
  { id: 'camo', label: 'Camo', preview: '◈' },
  { id: 'panels', label: 'Panels', preview: '▤' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const generateId = () => `piece_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getAvailableTops = (sport: Sport) => TOP_STYLES.filter(s => s.sports.includes(sport));
const getAvailableBottoms = (sport: Sport) => BOTTOM_STYLES.filter(s => s.sports.includes(sport));

// =============================================================================
// COMPONENT
// =============================================================================

const UniformDesigner: React.FC<UniformDesignerProps> = ({
  onClose,
  onSave,
  teamData
}) => {
  const { theme } = useTheme();
  const { userData } = useAuth();
  
  // Wizard step
  const [currentStep, setCurrentStep] = useState<'sport' | 'pieces' | 'customize' | 'preview'>('sport');
  
  // Selected sport
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  
  // Uniform pieces
  const [pieces, setPieces] = useState<GarmentPiece[]>([]);
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  
  // 3D Preview state
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  
  // Uniform name
  const [uniformName, setUniformName] = useState(teamData?.name ? `${teamData.name} Uniform` : 'New Uniform');
  
  // AI Generation state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGeneratingPieceId, setAiGeneratingPieceId] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  
  // Save/Load state
  const [savedUniforms, setSavedUniforms] = useState<SavedUniform[]>([]);
  const [showSavedUniforms, setShowSavedUniforms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Save quality modal
  const [showSaveQualityModal, setShowSaveQualityModal] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  
  // Auto-apply team colors option
  const [autoApplyTeamColors, setAutoApplyTeamColors] = useState(true);
  
  // Home/Away variation state
  const [uniformVariation, setUniformVariation] = useState<'home' | 'away'>('home');
  const [awayPieces, setAwayPieces] = useState<GarmentPiece[]>([]);
  
  // Get the active piece for editing
  const activePiece = pieces.find(p => p.id === activePieceId);
  
  // Fetch user credits on mount
  useEffect(() => {
    const fetchCredits = async () => {
      if (!userData?.uid) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', userData.uid));
        if (userDoc.exists()) {
          setUserCredits(userDoc.data()?.credits || 0);
        }
      } catch (err) {
        console.error('Error fetching credits:', err);
      }
    };
    fetchCredits();
  }, [userData?.uid]);
  
  // Fetch saved uniforms
  useEffect(() => {
    const fetchSavedUniforms = async () => {
      if (!userData?.uid) return;
      try {
        const q = query(
          collection(db, 'savedUniforms'),
          where('userId', '==', userData.uid)
        );
        const snapshot = await getDocs(q);
        const uniforms: SavedUniform[] = [];
        snapshot.forEach(doc => {
          uniforms.push({ id: doc.id, ...doc.data() } as SavedUniform);
        });
        setSavedUniforms(uniforms);
      } catch (err) {
        console.error('Error fetching saved uniforms:', err);
      }
    };
    fetchSavedUniforms();
  }, [userData?.uid]);
  
  // AI Generate design for a piece
  const generateAIDesign = async (pieceId: string) => {
    if (userCredits < AI_CREDITS_PER_PIECE) {
      setShowBuyCredits(true);
      return;
    }
    
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return;
    
    setIsGeneratingAI(true);
    setAiGeneratingPieceId(pieceId);
    
    try {
      // Build prompt for this specific garment
      const prompt = `Professional ${piece.label} uniform design for ${selectedSport} team. 
        Primary color: ${piece.primaryColor}, Secondary color: ${piece.secondaryColor}, Accent: ${piece.accentColor}.
        Pattern style: ${piece.pattern}. ${piece.numberBack ? `Number ${piece.numberBack} on back.` : ''}
        ${teamData?.name ? `Team: ${teamData.name}.` : ''}
        Flat lay product photography, white background, high quality, detailed fabric texture.`;
      
      const response = await fetch('/.netlify/functions/generate-ai-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          size: '1024x1024',
          quality: 'standard',
        }),
      });
      
      if (!response.ok) throw new Error('AI generation failed');
      
      const data = await response.json();
      
      // Update piece with AI image
      updatePiece(pieceId, { 
        aiGeneratedImage: `data:image/png;base64,${data.image}`,
        aiPromptUsed: prompt 
      });
      
      // Deduct credits
      if (userData?.uid) {
        const userRef = doc(db, 'users', userData.uid);
        await updateDoc(userRef, { credits: userCredits - AI_CREDITS_PER_PIECE });
        setUserCredits(prev => prev - AI_CREDITS_PER_PIECE);
      }
    } catch (err) {
      console.error('AI generation error:', err);
      alert('Failed to generate AI design. Please try again.');
    } finally {
      setIsGeneratingAI(false);
      setAiGeneratingPieceId(null);
    }
  };
  
  // Render a piece to high-quality canvas image
  const renderPieceToCanvas = async (piece: GarmentPiece, width: number = 2000, height: number = 2500): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    
    // High quality settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Fill background with primary color
    ctx.fillStyle = piece.primaryColor;
    ctx.fillRect(0, 0, width, height);
    
    // Add pattern if not solid
    if (piece.pattern === 'stripes') {
      ctx.fillStyle = piece.secondaryColor;
      for (let i = 0; i < width; i += 100) {
        ctx.fillRect(i, 0, 50, height);
      }
    } else if (piece.pattern === 'gradient') {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, piece.primaryColor);
      gradient.addColorStop(1, piece.secondaryColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else if (piece.pattern === 'panels') {
      // Side panels
      ctx.fillStyle = piece.secondaryColor;
      ctx.fillRect(0, 0, width * 0.15, height);
      ctx.fillRect(width * 0.85, 0, width * 0.15, height);
    }
    
    // Add accent stripe
    ctx.fillStyle = piece.accentColor;
    ctx.fillRect(0, height * 0.02, width, height * 0.04);
    
    // Add number if present
    if (piece.numberBack || piece.numberFront) {
      ctx.fillStyle = piece.numberColor || '#ffffff';
      ctx.font = 'bold 400px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add shadow for depth
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 10;
      ctx.shadowOffsetY = 10;
      
      ctx.fillText(piece.numberBack || piece.numberFront || '', width / 2, height * 0.5);
      ctx.shadowColor = 'transparent';
    }
    
    // Add name if present
    if (piece.nameBack) {
      ctx.fillStyle = piece.nameColor || '#ffffff';
      ctx.font = 'bold 100px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(piece.nameBack.toUpperCase(), width / 2, height * 0.25);
    }
    
    // Add label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${piece.label} - ${uniformName}`, width / 2, height - 50);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png', 1.0);
    });
  };
  
  // Render full mannequin preview to canvas
  const renderPreviewToCanvas = async (): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Dark background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#27272a');
    bgGradient.addColorStop(1, '#18181b');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid floor effect
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, canvas.height - 200);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let j = canvas.height - 200; j < canvas.height; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(canvas.width, j);
      ctx.stroke();
    }
    
    const displayPieces = uniformVariation === 'away' && awayPieces.length > 0 ? awayPieces : pieces;
    const topPiece = displayPieces.find(p => p.category === 'top');
    const bottomPiece = displayPieces.find(p => p.category === 'bottom');
    
    const centerX = canvas.width / 2;
    let y = 100;
    
    // Head
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(centerX, y + 60, 60, 75, 0, 0, Math.PI * 2);
    ctx.fill();
    y += 150;
    
    // Jersey/Top
    if (topPiece) {
      ctx.fillStyle = topPiece.primaryColor;
      ctx.fillRect(centerX - 170, y, 340, 400);
      
      // Sleeves
      ctx.fillRect(centerX - 230, y + 20, 80, 200);
      ctx.fillRect(centerX + 150, y + 20, 80, 200);
      
      // Add number
      if (topPiece.numberBack) {
        ctx.fillStyle = topPiece.numberColor || '#ffffff';
        ctx.font = 'bold 180px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(topPiece.numberBack, centerX, y + 280);
      }
      y += 400;
    } else {
      y += 400;
    }
    
    // Shorts/Pants
    if (bottomPiece) {
      ctx.fillStyle = bottomPiece.primaryColor;
      const bottomHeight = bottomPiece.style.includes('shorts') ? 200 : 400;
      ctx.fillRect(centerX - 150, y, 130, bottomHeight);
      ctx.fillRect(centerX + 20, y, 130, bottomHeight);
      
      // Side stripes
      ctx.fillStyle = bottomPiece.accentColor;
      ctx.fillRect(centerX - 150, y, 20, bottomHeight);
      ctx.fillRect(centerX + 130, y, 20, bottomHeight);
      y += bottomHeight;
    }
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(uniformName, centerX, canvas.height - 100);
    ctx.font = '24px Arial';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(`${uniformVariation.toUpperCase()} UNIFORM`, centerX, canvas.height - 60);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png', 1.0);
    });
  };
  
  // Save uniform with quality option
  const saveUniform = async (quality: 'standard' | 'high') => {
    if (!userData?.uid || !selectedSport) return;
    
    // Check credits for high quality
    if (quality === 'high' && userCredits < HIGH_QUALITY_SAVE_CREDITS) {
      alert(`High quality save requires ${HIGH_QUALITY_SAVE_CREDITS} credits. You have ${userCredits}.`);
      setShowBuyCredits(true);
      return;
    }
    
    setIsSaving(true);
    setSaveProgress(0);
    
    try {
      let previewImageUrl: string | undefined;
      let pieceImageUrls: { pieceId: string; url: string; storagePath: string }[] = [];
      
      if (quality === 'high') {
        const displayPieces = uniformVariation === 'away' && awayPieces.length > 0 ? awayPieces : pieces;
        const totalSteps = displayPieces.length + 2; // pieces + preview + save
        let currentStep = 0;
        
        // Upload preview image
        setSaveProgress(Math.round((currentStep / totalSteps) * 100));
        const previewBlob = await renderPreviewToCanvas();
        const previewPath = `uniforms/${userData.uid}/${Date.now()}_preview.png`;
        const previewRef = ref(storage, previewPath);
        await uploadBytes(previewRef, previewBlob);
        previewImageUrl = await getDownloadURL(previewRef);
        currentStep++;
        
        // Upload each piece as high-quality image
        for (const piece of displayPieces) {
          setSaveProgress(Math.round((currentStep / totalSteps) * 100));
          const pieceBlob = await renderPieceToCanvas(piece);
          const piecePath = `uniforms/${userData.uid}/${Date.now()}_${piece.id}.png`;
          const pieceRef = ref(storage, piecePath);
          await uploadBytes(pieceRef, pieceBlob);
          const pieceUrl = await getDownloadURL(pieceRef);
          pieceImageUrls.push({ pieceId: piece.id, url: pieceUrl, storagePath: piecePath });
          currentStep++;
        }
        
        // Deduct credits
        const userRef = doc(db, 'users', userData.uid);
        await updateDoc(userRef, { credits: userCredits - HIGH_QUALITY_SAVE_CREDITS });
        setUserCredits(prev => prev - HIGH_QUALITY_SAVE_CREDITS);
      }
      
      setSaveProgress(90);
      
      const uniformData = {
        name: uniformName,
        sport: selectedSport,
        pieces: pieces.map(p => ({
          ...p,
          // Don't save huge base64 AI images to Firestore document
          aiGeneratedImage: p.aiGeneratedImage ? 'has_image' : undefined,
        })),
        awayPieces: awayPieces.length > 0 ? awayPieces.map(p => ({
          ...p,
          aiGeneratedImage: p.aiGeneratedImage ? 'has_image' : undefined,
        })) : undefined,
        teamId: teamData?.id || null,
        userId: userData.uid,
        createdAt: new Date(),
        quality,
        previewImageUrl,
        pieceImageUrls: pieceImageUrls.length > 0 ? pieceImageUrls : undefined,
      };
      
      const docRef = await addDoc(collection(db, 'savedUniforms'), uniformData);
      setSavedUniforms(prev => [...prev, { id: docRef.id, ...uniformData } as SavedUniform]);
      setSaveProgress(100);
      
      setShowSaveQualityModal(false);
      alert(quality === 'high' 
        ? `✨ High-quality uniform saved! ${HIGH_QUALITY_SAVE_CREDITS} credits used. Print-ready images are stored.` 
        : 'Uniform saved successfully!');
    } catch (err) {
      console.error('Error saving uniform:', err);
      alert('Failed to save uniform.');
    } finally {
      setIsSaving(false);
      setSaveProgress(0);
    }
  };
  
  // Load a saved uniform
  const loadUniform = (uniform: SavedUniform) => {
    setSelectedSport(uniform.sport);
    setPieces(uniform.pieces);
    setUniformName(uniform.name);
    setShowSavedUniforms(false);
    setCurrentStep('customize');
  };
  
  // Delete a saved uniform
  const deleteUniform = async (uniformId: string) => {
    if (!confirm('Delete this saved uniform?')) return;
    try {
      await deleteDoc(doc(db, 'savedUniforms', uniformId));
      setSavedUniforms(prev => prev.filter(u => u.id !== uniformId));
    } catch (err) {
      console.error('Error deleting uniform:', err);
    }
  };
  
  // Apply team colors to all pieces
  const applyTeamColorsToAll = () => {
    if (!teamData?.primaryColor) return;
    setPieces(prev => prev.map(p => ({
      ...p,
      primaryColor: teamData.primaryColor || p.primaryColor,
      secondaryColor: teamData.secondaryColor || p.secondaryColor,
    })));
  };
  
  // Generate away variation by swapping primary/secondary colors
  const generateAwayVariation = () => {
    const awayVariant = pieces.map(p => ({
      ...p,
      id: `${p.id}_away`,
      // Swap primary and secondary
      primaryColor: p.secondaryColor,
      secondaryColor: p.primaryColor,
      // Keep accent same or make it the old primary
      accentColor: p.primaryColor,
      // Invert number/name colors for contrast
      numberColor: p.primaryColor,
      nameColor: p.primaryColor,
    }));
    setAwayPieces(awayVariant);
    setUniformVariation('away');
  };
  
  // Get current pieces based on variation
  const getCurrentPieces = () => uniformVariation === 'away' ? awayPieces : pieces;
  
  // Add a new piece
  const addPiece = useCallback((category: GarmentCategory, style: TopStyle | BottomStyle | AccessoryType, label: string) => {
    const newPiece: GarmentPiece = {
      id: generateId(),
      category,
      style,
      label,
      primaryColor: teamData?.primaryColor || '#f97316',
      secondaryColor: teamData?.secondaryColor || '#ffffff',
      accentColor: '#000000',
      pattern: 'solid',
      numberFront: '',
      numberBack: '00',
      numberColor: '#ffffff',
      nameBack: 'PLAYER',
      nameColor: '#ffffff',
      logoUrl: teamData?.logoUrl,
      logoPosition: 'chest-left',
    };
    setPieces(prev => [...prev, newPiece]);
    setActivePieceId(newPiece.id);
  }, [teamData]);
  
  // Remove a piece
  const removePiece = useCallback((pieceId: string) => {
    setPieces(prev => prev.filter(p => p.id !== pieceId));
    if (activePieceId === pieceId) {
      setActivePieceId(pieces.length > 1 ? pieces[0].id : null);
    }
  }, [activePieceId, pieces]);
  
  // Update a piece
  const updatePiece = useCallback((pieceId: string, updates: Partial<GarmentPiece>) => {
    setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, ...updates } : p));
  }, []);

  // ==========================================================================
  // RENDER: Sport Selection
  // ==========================================================================
  const renderSportSelection = () => (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Sport</h2>
        <p className="text-slate-400">Select the sport to see available uniform options</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SPORTS.map(sport => (
          <button
            key={sport.id}
            onClick={() => setSelectedSport(sport.id)}
            className={`p-6 rounded-xl border-2 transition-all ${
              selectedSport === sport.id
                ? 'border-orange-500 bg-orange-500/20 shadow-lg shadow-orange-500/20'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            }`}
          >
            <div className="text-4xl mb-3">{sport.icon}</div>
            <div className="font-semibold text-white">{sport.label}</div>
          </button>
        ))}
      </div>
      
      <div className="flex justify-end mt-8">
        <button
          onClick={() => selectedSport && setCurrentStep('pieces')}
          disabled={!selectedSport}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
        >
          Continue <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: Piece Selection  
  // ==========================================================================
  const renderPieceSelection = () => {
    const availableTops = selectedSport ? getAvailableTops(selectedSport) : [];
    const availableBottoms = selectedSport ? getAvailableBottoms(selectedSport) : [];
    
    return (
      <div className="p-6 space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Build Your Uniform</h2>
          <p className="text-slate-400">Select the pieces you want to include</p>
        </div>
        
        {/* Selected pieces */}
        {pieces.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Selected Pieces ({pieces.length})</h3>
            <div className="flex flex-wrap gap-2">
              {pieces.map(piece => (
                <div 
                  key={piece.id}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/50 rounded-lg"
                >
                  <span className="text-white text-sm">{piece.label}</span>
                  <button 
                    onClick={() => removePiece(piece.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Tops */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Shirt className="w-4 h-4" /> Tops
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableTops.map(top => {
              const isAdded = pieces.some(p => p.style === top.id);
              return (
                <button
                  key={top.id}
                  onClick={() => !isAdded && addPiece('top', top.id, top.label)}
                  disabled={isAdded}
                  className={`p-4 rounded-lg border transition-all ${
                    isAdded
                      ? 'border-green-500/50 bg-green-500/10 cursor-not-allowed'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-orange-500/50 hover:bg-orange-500/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{top.icon}</div>
                  <div className="text-sm text-white">{top.label}</div>
                  {isAdded && <Check className="w-4 h-4 text-green-400 mx-auto mt-2" />}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Bottoms */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            👖 Bottoms
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableBottoms.map(bottom => {
              const isAdded = pieces.some(p => p.style === bottom.id);
              return (
                <button
                  key={bottom.id}
                  onClick={() => !isAdded && addPiece('bottom', bottom.id, bottom.label)}
                  disabled={isAdded}
                  className={`p-4 rounded-lg border transition-all ${
                    isAdded
                      ? 'border-green-500/50 bg-green-500/10 cursor-not-allowed'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-orange-500/50 hover:bg-orange-500/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{bottom.icon}</div>
                  <div className="text-sm text-white">{bottom.label}</div>
                  {isAdded && <Check className="w-4 h-4 text-green-400 mx-auto mt-2" />}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Accessories */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            🎽 Accessories
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ACCESSORY_STYLES.map(acc => {
              const isAdded = pieces.some(p => p.style === acc.id);
              return (
                <button
                  key={acc.id}
                  onClick={() => !isAdded && addPiece('accessory', acc.id, acc.label)}
                  disabled={isAdded}
                  className={`p-4 rounded-lg border transition-all ${
                    isAdded
                      ? 'border-green-500/50 bg-green-500/10 cursor-not-allowed'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-orange-500/50 hover:bg-orange-500/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{acc.icon}</div>
                  <div className="text-sm text-white">{acc.label}</div>
                  {isAdded && <Check className="w-4 h-4 text-green-400 mx-auto mt-2" />}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStep('sport')}
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <button
            onClick={() => pieces.length > 0 && setCurrentStep('customize')}
            disabled={pieces.length === 0}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
          >
            Customize Pieces <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDER: Customization Panel
  // ==========================================================================
  const renderCustomization = () => {
    if (!activePiece && pieces.length > 0) {
      setActivePieceId(pieces[0].id);
    }
    
    return (
      <div className="flex h-[600px]">
        {/* Piece tabs - left sidebar */}
        <div className="w-48 border-r border-zinc-700 p-3 space-y-2 overflow-y-auto">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Pieces</h3>
          {pieces.map(piece => (
            <button
              key={piece.id}
              onClick={() => setActivePieceId(piece.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                activePieceId === piece.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-slate-300 hover:bg-zinc-700'
              }`}
            >
              {piece.label}
            </button>
          ))}
        </div>
        
        {/* Editor panel - center */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activePiece ? (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Customize: {activePiece.label}
              </h2>
              
              {/* Colors */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activePiece.primaryColor}
                      onChange={(e) => updatePiece(activePiece.id, { primaryColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={activePiece.primaryColor}
                      onChange={(e) => updatePiece(activePiece.id, { primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activePiece.secondaryColor}
                      onChange={(e) => updatePiece(activePiece.id, { secondaryColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={activePiece.secondaryColor}
                      onChange={(e) => updatePiece(activePiece.id, { secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activePiece.accentColor}
                      onChange={(e) => updatePiece(activePiece.id, { accentColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={activePiece.accentColor}
                      onChange={(e) => updatePiece(activePiece.id, { accentColor: e.target.value })}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {/* Pattern */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Pattern Style</label>
                <div className="flex gap-2 flex-wrap">
                  {PATTERNS.map(pattern => (
                    <button
                      key={pattern.id}
                      onClick={() => updatePiece(activePiece.id, { pattern: pattern.id as GarmentPiece['pattern'] })}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        activePiece.pattern === pattern.id
                          ? 'border-orange-500 bg-orange-500/20 text-white'
                          : 'border-zinc-700 bg-zinc-800 text-slate-400 hover:border-zinc-600'
                      }`}
                    >
                      <span className="mr-2">{pattern.preview}</span>
                      {pattern.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Numbers - only for tops */}
              {activePiece.category === 'top' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Front Number</label>
                    <input
                      type="text"
                      value={activePiece.numberFront || ''}
                      onChange={(e) => updatePiece(activePiece.id, { numberFront: e.target.value.slice(0, 2) })}
                      placeholder="e.g. 23"
                      maxLength={2}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Back Number</label>
                    <input
                      type="text"
                      value={activePiece.numberBack || ''}
                      onChange={(e) => updatePiece(activePiece.id, { numberBack: e.target.value.slice(0, 2) })}
                      placeholder="e.g. 23"
                      maxLength={2}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Number Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activePiece.numberColor || '#ffffff'}
                        onChange={(e) => updatePiece(activePiece.id, { numberColor: e.target.value })}
                        className="w-12 h-10 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={activePiece.numberColor || '#ffffff'}
                        onChange={(e) => updatePiece(activePiece.id, { numberColor: e.target.value })}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Player Name (Back)</label>
                    <input
                      type="text"
                      value={activePiece.nameBack || ''}
                      onChange={(e) => updatePiece(activePiece.id, { nameBack: e.target.value.toUpperCase() })}
                      placeholder="PLAYER"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white uppercase"
                    />
                  </div>
                </div>
              )}
              
              {/* Logo */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Team Logo Position</label>
                <div className="flex gap-2 flex-wrap">
                  {['chest-left', 'chest-center', 'chest-right', 'back'].map(pos => (
                    <button
                      key={pos}
                      onClick={() => updatePiece(activePiece.id, { logoPosition: pos as GarmentPiece['logoPosition'] })}
                      className={`px-4 py-2 rounded-lg border transition-all capitalize ${
                        activePiece.logoPosition === pos
                          ? 'border-orange-500 bg-orange-500/20 text-white'
                          : 'border-zinc-700 bg-zinc-800 text-slate-400 hover:border-zinc-600'
                      }`}
                    >
                      {pos.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 py-12">
              <p>Select a piece to customize</p>
            </div>
          )}
        </div>
        
        {/* Mini preview - right sidebar */}
        <div className="w-64 border-l border-zinc-700 p-4 space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Preview</h3>
          {activePiece && (
            <>
              {/* Show AI image if exists, otherwise color preview */}
              {activePiece.aiGeneratedImage ? (
                <div className="relative">
                  <img 
                    src={activePiece.aiGeneratedImage} 
                    alt="AI Generated" 
                    className="w-full rounded-xl border border-zinc-700"
                  />
                  <button
                    onClick={() => updatePiece(activePiece.id, { aiGeneratedImage: undefined })}
                    className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div 
                  className="aspect-square rounded-xl border border-zinc-700 flex items-center justify-center"
                  style={{ 
                    background: activePiece.pattern === 'gradient' 
                      ? `linear-gradient(135deg, ${activePiece.primaryColor}, ${activePiece.secondaryColor})`
                      : activePiece.primaryColor 
                  }}
                >
                  <div className="text-center">
                    <div 
                      className="text-4xl font-bold"
                      style={{ color: activePiece.numberColor }}
                    >
                      {activePiece.numberFront || activePiece.numberBack || '00'}
                    </div>
                    {activePiece.nameBack && (
                      <div 
                        className="text-sm font-semibold mt-1"
                        style={{ color: activePiece.nameColor }}
                      >
                        {activePiece.nameBack}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* AI Generation Button */}
              <button
                onClick={() => generateAIDesign(activePiece.id)}
                disabled={isGeneratingAI}
                className="w-full p-3 rounded-xl border border-purple-500/50 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-center gap-2">
                  {aiGeneratingPieceId === activePiece.id ? (
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  ) : (
                    <Wand2 className="w-5 h-5 text-purple-400" />
                  )}
                  <span className="text-white font-medium text-sm">
                    {aiGeneratingPieceId === activePiece.id ? 'Generating...' : 'Generate with AI'}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Crown className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs text-slate-400">{AI_CREDITS_PER_PIECE} credits</span>
                </div>
              </button>
              
              {/* Credits display */}
              <div className="text-center text-xs text-slate-500">
                Your credits: <span className="text-orange-400 font-bold">{userCredits}</span>
              </div>
            </>
          )}
          
          {/* Team Colors Quick Apply */}
          {teamData?.primaryColor && (
            <div className="pt-4 border-t border-zinc-700">
              <button
                onClick={applyTeamColorsToAll}
                className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg text-sm text-slate-300 flex items-center justify-center gap-2"
              >
                <Palette className="w-4 h-4" />
                Apply Team Colors to All
              </button>
              <div className="flex items-center gap-2 mt-2 justify-center">
                <div className="w-5 h-5 rounded" style={{ backgroundColor: teamData.primaryColor }} />
                <div className="w-5 h-5 rounded" style={{ backgroundColor: teamData.secondaryColor }} />
                <span className="text-xs text-slate-500">Team colors</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Navigation for customize step - rendered separately
  const renderCustomizeNav = () => (
    <div className="flex justify-between p-4 border-t border-zinc-700">
      <button
        onClick={() => setCurrentStep('pieces')}
        className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
      >
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <button
        onClick={() => setCurrentStep('preview')}
        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg flex items-center gap-2"
      >
        View on Player <Eye className="w-5 h-5" />
      </button>
    </div>
  );

  // ==========================================================================
  // RENDER: 3D Player Preview
  // ==========================================================================
  const renderPreview = () => {
    // Use current variation's pieces
    const displayPieces = uniformVariation === 'away' && awayPieces.length > 0 ? awayPieces : pieces;
    const topPiece = displayPieces.find(p => p.category === 'top');
    const bottomPiece = displayPieces.find(p => p.category === 'bottom');
    const socksPiece = displayPieces.find(p => p.style.includes('socks'));
    
    // Calculate rotation for 3D effect
    const getTransform = () => {
      const rotateY = previewRotation;
      return `perspective(1000px) rotateY(${rotateY}deg) scale(${previewZoom})`;
    };
    
    // Get pattern CSS
    const getPatternStyle = (piece: GarmentPiece) => {
      switch (piece.pattern) {
        case 'gradient':
          return { background: `linear-gradient(135deg, ${piece.primaryColor}, ${piece.secondaryColor})` };
        case 'stripes':
          return { background: `repeating-linear-gradient(90deg, ${piece.primaryColor}, ${piece.primaryColor} 20px, ${piece.secondaryColor} 20px, ${piece.secondaryColor} 40px)` };
        case 'panels':
          return { background: `linear-gradient(90deg, ${piece.secondaryColor} 0%, ${piece.secondaryColor} 20%, ${piece.primaryColor} 20%, ${piece.primaryColor} 80%, ${piece.secondaryColor} 80%)` };
        default:
          return { backgroundColor: piece.primaryColor };
      }
    };
    
    return (
      <div className="flex h-[600px]">
        {/* Controls sidebar */}
        <div className="w-64 border-r border-zinc-700 p-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <RotateCw className="w-4 h-4" /> Rotation
            </h3>
            <input
              type="range"
              min="-180"
              max="180"
              value={previewRotation}
              onChange={(e) => setPreviewRotation(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Back</span>
              <span>Front</span>
              <span>Back</span>
            </div>
            <button
              onClick={() => setPreviewRotation(0)}
              className="mt-2 w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-sm rounded-lg flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset View
            </button>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <ZoomIn className="w-4 h-4" /> Zoom
            </h3>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={previewZoom}
              onChange={(e) => setPreviewZoom(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between mt-2">
              <button
                onClick={() => setPreviewZoom(Math.max(0.5, previewZoom - 0.1))}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-slate-400 text-sm">{Math.round(previewZoom * 100)}%</span>
              <button
                onClick={() => setPreviewZoom(Math.min(1.5, previewZoom + 0.1))}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Uniform name */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Uniform Name</h3>
            <input
              type="text"
              value={uniformName}
              onChange={(e) => setUniformName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
            />
          </div>
          
          {/* Home/Away Variation Toggle */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Uniform Variation</h3>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setUniformVariation('home')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                  uniformVariation === 'home' 
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                    : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
                }`}
              >
                🏠 Home
              </button>
              <button
                onClick={() => {
                  if (awayPieces.length === 0) {
                    generateAwayVariation();
                  } else {
                    setUniformVariation('away');
                  }
                }}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                  uniformVariation === 'away' 
                    ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg' 
                    : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
                }`}
              >
                ✈️ Away
              </button>
            </div>
            {uniformVariation === 'home' && pieces.length > 0 && (
              <button
                onClick={generateAwayVariation}
                className="w-full py-2 px-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3 h-3" />
                Auto-Generate Away Variation
              </button>
            )}
            {uniformVariation === 'away' && awayPieces.length > 0 && (
              <p className="text-xs text-slate-500 mt-1 text-center">
                Colors swapped from home uniform
              </p>
            )}
          </div>
          
          {/* Pieces list */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">
              {uniformVariation === 'away' ? 'Away Pieces' : 'Home Pieces'}
            </h3>
            <div className="space-y-1">
              {displayPieces.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: p.primaryColor }} />
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: p.secondaryColor }} />
                  {p.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 3D Preview area */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-900 relative overflow-hidden">
          {/* Grid floor effect */}
          <div className="absolute bottom-0 left-0 right-0 h-40">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
            {/* Floor grid lines */}
            <svg className="absolute bottom-0 w-full h-20 opacity-20">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          {/* Spotlight effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-radial from-orange-500/10 to-transparent rounded-full blur-3xl" />
          
          {/* Player mannequin - Athletic Build */}
          <div 
            className="relative transition-transform duration-200"
            style={{ transform: getTransform() }}
          >
            {/* Head with neck */}
            <div className="relative mx-auto">
              {/* Neck */}
              <div className="w-8 h-6 mx-auto bg-gradient-to-b from-amber-300 to-amber-400 rounded-sm" />
              {/* Head */}
              <div className="w-16 h-20 mx-auto -mt-4 bg-gradient-to-b from-amber-200 to-amber-300 rounded-full relative">
                {/* Face details */}
                <div className="absolute top-6 left-3 w-2 h-1 bg-amber-400/50 rounded-full" />
                <div className="absolute top-6 right-3 w-2 h-1 bg-amber-400/50 rounded-full" />
                {/* Hair */}
                <div className="absolute -top-1 left-2 right-2 h-6 bg-zinc-800 rounded-t-full" />
              </div>
            </div>
            
            {/* Shoulders/Upper body frame */}
            <div className="relative -mt-2">
              {/* Shoulder muscles */}
              <div className="absolute -left-12 top-0 w-8 h-10 bg-gradient-to-br from-amber-200 to-amber-300 rounded-full transform -rotate-12" />
              <div className="absolute -right-12 top-0 w-8 h-10 bg-gradient-to-bl from-amber-200 to-amber-300 rounded-full transform rotate-12" />
            </div>
            
            {/* Top (Jersey/Shirt) */}
            {topPiece ? (
              <div 
                className="relative w-44 h-52 mx-auto rounded-lg flex flex-col items-center justify-center transition-colors shadow-2xl"
                style={getPatternStyle(topPiece)}
              >
                {/* Collar - V-neck style */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2">
                  <div 
                    className="w-16 h-8 rounded-b-xl"
                    style={{ backgroundColor: topPiece.accentColor }}
                  />
                  <div 
                    className="absolute top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-[16px] border-l-transparent border-r-transparent"
                    style={{ borderBottomColor: topPiece.primaryColor }}
                  />
                </div>
                
                {/* Jersey seams/details */}
                <div className="absolute top-12 left-4 w-0.5 h-32 bg-black/10 rounded" />
                <div className="absolute top-12 right-4 w-0.5 h-32 bg-black/10 rounded" />
                
                {/* Number/Name */}
                {(previewRotation >= -90 && previewRotation <= 90) ? (
                  <div className="text-center mt-6">
                    {topPiece.logoUrl && (
                      <div className="w-8 h-8 mx-auto mb-2 bg-white/20 rounded-full flex items-center justify-center text-xs">
                        Logo
                      </div>
                    )}
                    {topPiece.numberFront && (
                      <div 
                        className="text-5xl font-black tracking-tight"
                        style={{ 
                          color: topPiece.numberColor,
                          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                        }}
                      >
                        {topPiece.numberFront}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center mt-4">
                    {topPiece.nameBack && (
                      <div 
                        className="text-sm font-black tracking-[0.2em] mb-2"
                        style={{ 
                          color: topPiece.nameColor,
                          textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                        }}
                      >
                        {topPiece.nameBack}
                      </div>
                    )}
                    {topPiece.numberBack && (
                      <div 
                        className="text-6xl font-black"
                        style={{ 
                          color: topPiece.numberColor,
                          textShadow: '3px 3px 6px rgba(0,0,0,0.4)'
                        }}
                      >
                        {topPiece.numberBack}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Arms with muscle definition */}
                <div 
                  className="absolute -left-10 top-0 w-12 h-32 rounded-lg shadow-lg overflow-hidden"
                  style={getPatternStyle(topPiece)}
                >
                  {/* Bicep shadow */}
                  <div className="absolute top-4 right-0 w-3 h-12 bg-black/10 rounded-l-full" />
                  {/* Arm opening */}
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-amber-300 rounded-t-lg" />
                </div>
                <div 
                  className="absolute -right-10 top-0 w-12 h-32 rounded-lg shadow-lg overflow-hidden"
                  style={getPatternStyle(topPiece)}
                >
                  {/* Bicep shadow */}
                  <div className="absolute top-4 left-0 w-3 h-12 bg-black/10 rounded-r-full" />
                  {/* Arm opening */}
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-amber-300 rounded-t-lg" />
                </div>
                
                {/* Side panels if pattern is panels */}
                {topPiece.pattern === 'panels' && (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 w-4 rounded-l-lg" style={{ backgroundColor: topPiece.secondaryColor }} />
                    <div className="absolute right-0 top-0 bottom-0 w-4 rounded-r-lg" style={{ backgroundColor: topPiece.secondaryColor }} />
                  </>
                )}
              </div>
            ) : (
              <div className="w-44 h-52 mx-auto rounded-lg bg-zinc-700 border-2 border-dashed border-zinc-600 flex items-center justify-center">
                <span className="text-zinc-500 text-sm">No Top</span>
              </div>
            )}
            
            {/* Waist/Belt area */}
            <div className="w-36 h-2 mx-auto bg-zinc-800 rounded-full -mt-1 relative z-10" />
            
            {/* Bottom (Pants/Shorts) */}
            {bottomPiece ? (
              <div 
                className="relative w-40 mx-auto rounded-b-lg shadow-xl overflow-hidden"
                style={{ 
                  height: bottomPiece.style.includes('shorts') ? '80px' : '140px',
                  ...getPatternStyle(bottomPiece)
                }}
              >
                {/* Crotch seam */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-black/20" />
                
                {/* Leg separation */}
                <div 
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 bg-zinc-900"
                  style={{ height: bottomPiece.style.includes('shorts') ? '40px' : '100px' }}
                />
                
                {/* Side stripes */}
                <div 
                  className="absolute left-0 top-0 w-3 h-full"
                  style={{ backgroundColor: bottomPiece.accentColor }}
                />
                <div 
                  className="absolute right-0 top-0 w-3 h-full"
                  style={{ backgroundColor: bottomPiece.accentColor }}
                />
                
                {/* Inner leg shadows for muscle definition */}
                <div className="absolute bottom-0 left-8 w-4 h-full bg-black/10 rounded-r-full" />
                <div className="absolute bottom-0 right-8 w-4 h-full bg-black/10 rounded-l-full" />
              </div>
            ) : (
              <div className="w-40 h-32 mx-auto rounded-b-lg bg-zinc-700 border-2 border-dashed border-zinc-600 flex items-center justify-center">
                <span className="text-zinc-500 text-sm">No Bottom</span>
              </div>
            )}
            
            {/* Lower legs (visible below shorts) */}
            {bottomPiece?.style.includes('shorts') && (
              <div className="flex justify-center gap-6 -mt-1">
                <div className="w-10 h-20 bg-gradient-to-b from-amber-300 to-amber-400 rounded-b-lg shadow-lg">
                  {/* Knee definition */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-6 h-4 bg-amber-400/50 rounded-full" />
                </div>
                <div className="w-10 h-20 bg-gradient-to-b from-amber-300 to-amber-400 rounded-b-lg shadow-lg">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-6 h-4 bg-amber-400/50 rounded-full" />
                </div>
              </div>
            )}
            
            {/* Socks */}
            {socksPiece ? (
              <div className="flex justify-center gap-6 mt-1">
                <div 
                  className="w-10 h-20 rounded-b-lg shadow-lg relative overflow-hidden"
                  style={getPatternStyle(socksPiece)}
                >
                  {/* Sock stripes */}
                  <div className="absolute top-2 left-0 right-0 h-1" style={{ backgroundColor: socksPiece.accentColor }} />
                  <div className="absolute top-4 left-0 right-0 h-1" style={{ backgroundColor: socksPiece.accentColor }} />
                </div>
                <div 
                  className="w-10 h-20 rounded-b-lg shadow-lg relative overflow-hidden"
                  style={getPatternStyle(socksPiece)}
                >
                  <div className="absolute top-2 left-0 right-0 h-1" style={{ backgroundColor: socksPiece.accentColor }} />
                  <div className="absolute top-4 left-0 right-0 h-1" style={{ backgroundColor: socksPiece.accentColor }} />
                </div>
              </div>
            ) : (
              <div className="flex justify-center gap-6 mt-1">
                <div className="w-10 h-20 rounded-b-lg bg-zinc-600 shadow-lg" />
                <div className="w-10 h-20 rounded-b-lg bg-zinc-600 shadow-lg" />
              </div>
            )}
            
            {/* Shoes */}
            <div className="flex justify-center gap-4 mt-1">
              <div className="w-12 h-6 bg-zinc-900 rounded-lg shadow-lg" />
              <div className="w-12 h-6 bg-zinc-900 rounded-lg shadow-lg" />
            </div>
          </div>
          
          {/* Rotation indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-800/80 backdrop-blur-sm rounded-full text-slate-400 text-sm border border-zinc-700">
            {previewRotation >= -45 && previewRotation <= 45 ? '👀 Front View' : 
             previewRotation > 45 && previewRotation <= 135 ? '👈 Left Side' :
             previewRotation < -45 && previewRotation >= -135 ? '👉 Right Side' : '🔙 Back View'}
          </div>
        </div>
      </div>
    );
  };

  // Navigation for preview step
  const renderPreviewNav = () => (
    <div className="flex justify-between p-4 border-t border-zinc-700">
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('customize')}
          className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" /> Edit Pieces
        </button>
        <button
          onClick={() => setShowSavedUniforms(true)}
          className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
        >
          <FolderOpen className="w-5 h-5" /> My Uniforms
        </button>
      </div>
      <div className="flex gap-3">
        <button
          onClick={exportFlatTemplates}
          className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
          title="Export flat templates for manufacturing"
        >
          <ImageIcon className="w-5 h-5" /> Export Flat
        </button>
        <button
          onClick={() => setShowSaveQualityModal(true)}
          disabled={isSaving}
          className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save to Cloud
        </button>
        <button
          onClick={() => {
            if (onSave && selectedSport) {
              onSave({
                id: generateId(),
                name: uniformName,
                sport: selectedSport,
                pieces,
                createdAt: new Date()
              });
            }
            onClose();
          }}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg flex items-center gap-2"
        >
          <Download className="w-5 h-5" /> Done & Export
        </button>
      </div>
    </div>
  );
  
  // Export flat templates for manufacturing
  const exportFlatTemplates = () => {
    // Create a canvas for each piece and download
    pieces.forEach((piece, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Fill with piece color
      ctx.fillStyle = piece.primaryColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add pattern if not solid
      if (piece.pattern === 'stripes') {
        ctx.fillStyle = piece.secondaryColor;
        for (let i = 0; i < canvas.width; i += 80) {
          ctx.fillRect(i, 0, 40, canvas.height);
        }
      } else if (piece.pattern === 'gradient') {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, piece.primaryColor);
        gradient.addColorStop(1, piece.secondaryColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Add number if top
      if (piece.category === 'top' && piece.numberBack) {
        ctx.fillStyle = piece.numberColor || '#ffffff';
        ctx.font = 'bold 200px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(piece.numberBack, canvas.width / 2, canvas.height / 2 + 60);
      }
      
      // Add name
      if (piece.nameBack) {
        ctx.fillStyle = piece.nameColor || '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(piece.nameBack, canvas.width / 2, canvas.height / 2 - 80);
      }
      
      // Download
      const link = document.createElement('a');
      link.download = `${uniformName.replace(/\s+/g, '_')}_${piece.label.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
    
    alert(`Exported ${pieces.length} flat templates for manufacturing!`);
  };
  
  // ==========================================================================
  // RENDER: Saved Uniforms Modal
  // ==========================================================================
  const renderSavedUniformsModal = () => {
    if (!showSavedUniforms) return null;
    
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowSavedUniforms(false)} />
        <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-orange-400" />
              My Saved Uniforms
            </h2>
            <button onClick={() => setShowSavedUniforms(false)} className="text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {savedUniforms.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No saved uniforms yet</p>
                <p className="text-sm mt-1">Design and save a uniform to see it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {savedUniforms.map(uniform => (
                  <div 
                    key={uniform.id}
                    className={`p-4 bg-zinc-800 border rounded-xl hover:border-orange-500/50 transition-all ${
                      uniform.quality === 'high' ? 'border-orange-500/30' : 'border-zinc-700'
                    }`}
                  >
                    {/* Preview image for high quality saves */}
                    {uniform.previewImageUrl && (
                      <div className="mb-3 -mx-4 -mt-4">
                        <img 
                          src={uniform.previewImageUrl} 
                          alt={uniform.name}
                          className="w-full h-32 object-cover rounded-t-xl"
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-white flex items-center gap-2">
                          {uniform.name}
                          {uniform.quality === 'high' && (
                            <span title="High Quality">
                              <Crown className="w-3.5 h-3.5 text-orange-400" />
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {uniform.sport} • {uniform.pieces.length} pieces
                          {uniform.quality === 'high' && ' • Print-ready'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteUniform(uniform.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-1 mb-3">
                      {uniform.pieces.slice(0, 3).map((p, i) => (
                        <div 
                          key={i} 
                          className="w-6 h-6 rounded" 
                          style={{ backgroundColor: p.primaryColor }}
                        />
                      ))}
                      {uniform.pieces.length > 3 && (
                        <div className="w-6 h-6 rounded bg-zinc-600 flex items-center justify-center text-xs text-slate-300">
                          +{uniform.pieces.length - 3}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => loadUniform(uniform)}
                      className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg"
                    >
                      Load Uniform
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // ==========================================================================
  // RENDER: Save Quality Modal
  // ==========================================================================
  const renderSaveQualityModal = () => {
    if (!showSaveQualityModal) return null;
    
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={() => !isSaving && setShowSaveQualityModal(false)} />
        <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Save className="w-5 h-5 text-orange-400" />
              Save Uniform
            </h2>
            {!isSaving && (
              <button onClick={() => setShowSaveQualityModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
          
          <div className="p-6 space-y-4">
            {isSaving ? (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 mx-auto text-orange-400 animate-spin mb-4" />
                <p className="text-white font-medium">Saving uniform...</p>
                <p className="text-sm text-slate-400 mt-1">
                  {saveProgress < 90 ? 'Rendering high-quality images...' : 'Finalizing...'}
                </p>
                <div className="w-full bg-zinc-700 rounded-full h-2 mt-4">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${saveProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">{saveProgress}%</p>
              </div>
            ) : (
              <>
                <p className="text-slate-300 text-sm">
                  Choose save quality for your uniform:
                </p>
                
                {/* Standard Option */}
                <button
                  onClick={() => saveUniform('standard')}
                  className="w-full p-4 bg-zinc-800 border border-zinc-700 rounded-xl hover:border-zinc-600 transition-all text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Save className="w-4 h-4 text-slate-400" />
                        Standard Save
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">FREE</span>
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Save uniform configuration to your account
                      </p>
                      <ul className="text-xs text-slate-500 mt-2 space-y-1">
                        <li>✓ Colors & patterns saved</li>
                        <li>✓ Names & numbers saved</li>
                        <li>✓ Load & edit anytime</li>
                        <li className="text-slate-600">✗ No print-ready images</li>
                      </ul>
                    </div>
                  </div>
                </button>
                
                {/* High Quality Option */}
                <button
                  onClick={() => saveUniform('high')}
                  disabled={userCredits < HIGH_QUALITY_SAVE_CREDITS}
                  className={`w-full p-4 border rounded-xl transition-all text-left group ${
                    userCredits >= HIGH_QUALITY_SAVE_CREDITS
                      ? 'bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/50 hover:border-orange-400'
                      : 'bg-zinc-800/50 border-zinc-700 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Crown className="w-4 h-4 text-orange-400" />
                        High Quality Save
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                          {HIGH_QUALITY_SAVE_CREDITS} Credits
                        </span>
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Save with print-ready images for manufacturing
                      </p>
                      <ul className="text-xs text-slate-500 mt-2 space-y-1">
                        <li>✓ Everything in Standard</li>
                        <li className="text-orange-400">✓ 2000x2500px per piece</li>
                        <li className="text-orange-400">✓ Full mannequin preview</li>
                        <li className="text-orange-400">✓ Print-ready PNG files</li>
                      </ul>
                      {userCredits < HIGH_QUALITY_SAVE_CREDITS && (
                        <p className="text-xs text-red-400 mt-2">
                          Need {HIGH_QUALITY_SAVE_CREDITS - userCredits} more credits
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                
                {/* Credits display */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
                  <span className="text-sm text-slate-400">Your credits:</span>
                  <span className="font-bold text-orange-400">{userCredits}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDER: Main Modal
  // ==========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Shirt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Uniform Designer Pro</h1>
              <p className="text-sm text-slate-400">Create world-class team uniforms</p>
            </div>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {['sport', 'pieces', 'customize', 'preview'].map((step, idx) => (
              <div
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  currentStep === step
                    ? 'bg-orange-500 text-white'
                    : idx < ['sport', 'pieces', 'customize', 'preview'].indexOf(currentStep)
                      ? 'bg-green-500 text-white'
                      : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {idx + 1}
              </div>
            ))}
          </div>
          
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 'sport' && renderSportSelection()}
          {currentStep === 'pieces' && renderPieceSelection()}
          {currentStep === 'customize' && renderCustomization()}
          {currentStep === 'preview' && renderPreview()}
        </div>
        
        {/* Footer nav for customize */}
        {currentStep === 'customize' && renderCustomizeNav()}
        {currentStep === 'preview' && renderPreviewNav()}
      </div>
      
      {/* Saved Uniforms Modal */}
      {renderSavedUniformsModal()}
      
      {/* Save Quality Modal */}
      {renderSaveQualityModal()}
    </div>
  );
};

export default UniformDesigner;
