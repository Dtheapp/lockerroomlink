// =============================================================================
// AI CREATOR MODAL - Premium AI-powered design generation
// Create logos, flyers, posters, and more with AI assistance
// =============================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  Loader2,
  RefreshCw,
  Check,
  Wand2,
  Palette,
  Type,
  Layout,
  Zap,
  Crown,
  MessageSquare,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Coins
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useCredits } from '../../hooks/useCredits';
import type { DesignElement, CanvasState, FlyerSize } from './types';
import { FLYER_SIZES, generateId } from './types';

// =============================================================================
// TYPES
// =============================================================================

type DesignType = 
  | 'logo' 
  | 'registration-flyer' 
  | 'event-poster' 
  | 'social-post' 
  | 'player-spotlight' 
  | 'announcement' 
  | 'celebration';

type StylePreset = 
  | 'modern' 
  | 'vintage' 
  | 'playful' 
  | 'bold' 
  | 'minimal' 
  | 'grunge' 
  | 'elegant';

type MoodPreset = 
  | 'energetic' 
  | 'professional' 
  | 'fun' 
  | 'intense' 
  | 'celebratory';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  instruction: string; // What to do with this image
}

interface GeneratedDesign {
  id: string;
  imageUrl: string;
  prompt: string;
  elements: DesignElement[]; // Parsed elements for import
}

interface AICreatorModalProps {
  onClose: () => void;
  onImportDesign: (elements: DesignElement[], canvas: CanvasState, size: FlyerSize) => void;
  teamData?: {
    id: string;
    name: string;
    sport?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  availableSeasons?: { id: string; name: string }[];
  availableEvents?: { id: string; name: string; type: string }[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DESIGN_TYPES: { id: DesignType; icon: string; label: string; description: string; examplePrompt: string }[] = [
  { id: 'logo', icon: '🎨', label: 'Team Logo', description: 'Professional logo for your team', examplePrompt: 'Create a fierce tiger mascot logo with sharp teeth and intense eyes. Use orange and black colors. Make it look powerful and intimidating.' },
  { id: 'registration-flyer', icon: '📄', label: 'Registration Flyer', description: 'Promote upcoming season signups', examplePrompt: 'Create a registration flyer for Spring 2026 season. Include dates March 1-15, ages 8-14, registration fee $150. Make it exciting and eye-catching with action photos.' },
  { id: 'event-poster', icon: '🎟️', label: 'Event Poster', description: 'Game day, fundraiser, or special event', examplePrompt: 'Create a game day poster for our championship match vs the Eagles on December 15. Include "GO TIGERS!" and make it feel like a big event.' },
  { id: 'social-post', icon: '📱', label: 'Social Media Post', description: 'Instagram, Facebook graphics', examplePrompt: 'Create an Instagram post announcing our next practice schedule. Keep it clean and modern with team colors.' },
  { id: 'player-spotlight', icon: '🏆', label: 'Player Spotlight', description: 'Highlight athlete achievements', examplePrompt: 'Create a player of the week spotlight. Include space for player photo, name, stats, and a quote. Make it feel prestigious.' },
  { id: 'announcement', icon: '📢', label: 'Announcement', description: 'Team news, schedule changes', examplePrompt: 'Create an announcement graphic for a schedule change. Practice moved from Tuesday to Thursday at 5pm.' },
  { id: 'celebration', icon: '🎉', label: 'Celebration', description: 'Win announcement, milestones', examplePrompt: 'Create a victory celebration graphic for winning the regional championship! Include confetti, trophy elements, and "CHAMPIONS" text.' },
];

const STYLE_PRESETS: { id: StylePreset; label: string; preview: string }[] = [
  { id: 'modern', label: 'Modern', preview: '🔷' },
  { id: 'vintage', label: 'Vintage', preview: '📜' },
  { id: 'playful', label: 'Playful', preview: '🎈' },
  { id: 'bold', label: 'Bold', preview: '💪' },
  { id: 'minimal', label: 'Minimal', preview: '◻️' },
  { id: 'grunge', label: 'Grunge', preview: '🎸' },
  { id: 'elegant', label: 'Elegant', preview: '✨' },
];

const MOOD_PRESETS: { id: MoodPreset; label: string }[] = [
  { id: 'energetic', label: '⚡ Energetic' },
  { id: 'professional', label: '💼 Professional' },
  { id: 'fun', label: '🎉 Fun' },
  { id: 'intense', label: '🔥 Intense' },
  { id: 'celebratory', label: '🏆 Celebratory' },
];

const OUTPUT_SIZES: { id: FlyerSize | 'custom'; label: string }[] = [
  { id: 'instagram', label: 'Instagram Post (1080×1080)' },
  { id: 'story', label: 'Story (1080×1920)' },
  { id: 'flyer', label: 'Flyer (8.5×11)' },
  { id: 'poster', label: 'Poster (18×24)' },
  { id: 'banner', label: 'Banner (1500×500)' },
  { id: 'facebook', label: 'Facebook Post (1200×630)' },
  { id: 'custom', label: 'Custom Size' },
];

const CREDIT_COSTS = {
  generate: 5,
  regenerate: 3,
  refine: 3,
};

// =============================================================================
// COMPONENT
// =============================================================================

const AICreatorModal: React.FC<AICreatorModalProps> = ({
  onClose,
  onImportDesign,
  teamData,
  availableSeasons = [],
  availableEvents = [],
}) => {
  const { userData } = useAuth();
  const { theme } = useTheme();
  const { balance: creditBalance, loading: loadingCredits, checkFeature, consumeFeature, refreshBalance, getFeaturePricing } = useCredits();
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  // Step 1: Design type
  const [designType, setDesignType] = useState<DesignType | null>(null);
  
  // Step 2: Reference images
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Step 3: Design brief
  const [teamName, setTeamName] = useState(teamData?.name || '');
  const [primaryColor, setPrimaryColor] = useState(teamData?.primaryColor || '#f97316');
  const [secondaryColor, setSecondaryColor] = useState(teamData?.secondaryColor || '#000000');
  const [sport, setSport] = useState(teamData?.sport || '');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [style, setStyle] = useState<StylePreset>('modern');
  const [mood, setMood] = useState<MoodPreset>('energetic');
  const [briefText, setBriefText] = useState('');
  
  // Step 4: Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outputSize, setOutputSize] = useState<FlyerSize | 'custom'>('instagram');
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [additionalText, setAdditionalText] = useState('');
  const [avoidElements, setAvoidElements] = useState('');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [generatedDesigns, setGeneratedDesigns] = useState<GeneratedDesign[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [refinementFeedback, setRefinementFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Get pricing info for display
  const aiGeneratePricing = getFeaturePricing('ai_design_generate');
  const creditsPerGenerate = aiGeneratePricing?.creditsPerUse ?? CREDIT_COSTS.generate;
  
  // Refresh credit balance on mount
  useEffect(() => {
    if (userData?.uid) {
      refreshBalance();
    }
  }, [userData?.uid, refreshBalance]);
  
  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newImages: UploadedImage[] = [];
    Array.from(files).slice(0, 5 - uploadedImages.length).forEach(file => {
      if (file.type.startsWith('image/')) {
        newImages.push({
          id: generateId(),
          file,
          preview: URL.createObjectURL(file),
          instruction: '',
        });
      }
    });
    
    setUploadedImages(prev => [...prev, ...newImages].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadedImages.length]);
  
  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  }, []);
  
  const updateImageInstruction = useCallback((id: string, instruction: string) => {
    setUploadedImages(prev => 
      prev.map(img => img.id === id ? { ...img, instruction } : img)
    );
  }, []);
  
  // Build the AI prompt from all inputs
  const buildPrompt = useCallback(() => {
    const typeInfo = DESIGN_TYPES.find(t => t.id === designType);
    const parts: string[] = [];
    
    // Design type
    parts.push(`Create a ${typeInfo?.label || 'design'} for a ${sport || 'sports'} team.`);
    
    // Team info
    if (teamName) parts.push(`Team name: "${teamName}".`);
    parts.push(`Primary color: ${primaryColor}, Secondary color: ${secondaryColor}.`);
    
    // Style and mood
    parts.push(`Style: ${style}, Mood: ${mood}.`);
    
    // User's brief
    if (briefText) parts.push(briefText);
    
    // Image instructions
    uploadedImages.forEach((img, idx) => {
      if (img.instruction) {
        parts.push(`Reference image ${idx + 1}: ${img.instruction}`);
      }
    });
    
    // Additional text to include
    if (additionalText) parts.push(`Include this text: ${additionalText}`);
    
    // Things to avoid
    if (avoidElements) parts.push(`Avoid: ${avoidElements}`);
    
    // Size context - handle custom size
    let sizeWidth: number;
    let sizeHeight: number;
    if (outputSize === 'custom') {
      sizeWidth = customWidth;
      sizeHeight = customHeight;
    } else {
      const sizeInfo = FLYER_SIZES[outputSize];
      sizeWidth = sizeInfo.width;
      sizeHeight = sizeInfo.height;
    }
    parts.push(`Output size: ${sizeWidth}x${sizeHeight} pixels.`);
    
    return parts.join(' ');
  }, [designType, teamName, primaryColor, secondaryColor, sport, style, mood, briefText, uploadedImages, additionalText, avoidElements, outputSize, customWidth, customHeight]);
  
  // Generate designs (mock for now - will connect to real AI API)
  const handleGenerate = useCallback(async () => {
    if (!userData?.uid) return;
    
    setIsGenerating(true);
    setError(null);
    setGeneratedDesigns([]);
    
    try {
      // Check if user can use this feature
      setGenerationStep('Checking credits...');
      const canUse = await checkFeature('ai_design_generate');
      
      if (!canUse.canUse) {
        throw new Error(canUse.reason || `Not enough credits. You need ${creditsPerGenerate} credits to generate designs.`);
      }
      
      // Build the prompt
      const prompt = buildPrompt();
      console.log('AI Prompt:', prompt);
      
      // Get the actual dimensions for the selected size
      const actualWidth = outputSize === 'custom' ? customWidth : FLYER_SIZES[outputSize].width;
      const actualHeight = outputSize === 'custom' ? customHeight : FLYER_SIZES[outputSize].height;
      
      // Call the real AI generation API
      setGenerationStep('Generating AI design with DALL-E 3...');
      
      let aiImages: { url: string; revisedPrompt?: string }[] = [];
      let aiError: string | null = null;
      
      const response = await fetch('/.netlify/functions/generate-ai-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.uid}`,
        },
        body: JSON.stringify({
          prompt,
          width: actualWidth,
          height: actualHeight,
          designType: designType!,
          style,
          mood,
        }),
      });
      
      console.log('AI Response status:', response.status);
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('AI Response data:', data);
        
        if (response.ok && data.success && data.images?.length > 0) {
          aiImages = data.images;
          console.log('AI Generation successful:', data.images.length, 'images');
        } else {
          aiError = data.error || data.details || `AI returned status ${response.status}`;
          console.error('AI Generation failed:', aiError);
        }
      } else {
        const text = await response.text();
        aiError = `AI endpoint returned non-JSON: ${text.substring(0, 200)}`;
        console.error(aiError);
      }
      
      // If AI failed, throw the error - don't silently fallback
      if (aiImages.length === 0) {
        throw new Error(aiError || 'AI generation failed. Please try again.');
      }
      
      // Consume credits AFTER successful generation
      setGenerationStep('Processing...');
      const consumed = await consumeFeature('ai_design_generate', {
        itemName: `AI Design Generation: ${DESIGN_TYPES.find(t => t.id === designType)?.label}`,
      });
      
      if (!consumed) {
        throw new Error('Failed to process credits. Please try again.');
      }
      
      // Refresh balance after consuming
      await refreshBalance();
      
      // Create designs from AI images
      const designs: GeneratedDesign[] = aiImages.map((img) => ({
        id: generateId(),
        imageUrl: img.url,
        prompt: img.revisedPrompt || prompt,
        elements: [], // AI images don't need mock elements
      }));
      
      setGeneratedDesigns(designs);
      setCurrentStep(5); // Go to results step
      
    } catch (err) {
      console.error('Generation failed:', err);
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  }, [userData?.uid, designType, buildPrompt, teamName, primaryColor, secondaryColor, outputSize, customWidth, customHeight, checkFeature, consumeFeature, refreshBalance, creditsPerGenerate, style, mood, briefText, additionalText, selectedEvent, sport]);
  
  // Handle refinement
  const handleRefine = useCallback(async () => {
    if (!refinementFeedback.trim()) return;
    if (!userData?.uid) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Check credits for refine
      setGenerationStep('Checking credits...');
      const canUse = await checkFeature('ai_design_generate');
      if (!canUse.canUse) {
        throw new Error(canUse.reason || `Not enough credits to refine. You need ${creditsPerGenerate} credits.`);
      }
      
      // Build refined prompt
      const basePrompt = buildPrompt();
      const refinedPrompt = `${basePrompt} Additional feedback: ${refinementFeedback}`;
      console.log('Refined AI Prompt:', refinedPrompt);
      
      // Get dimensions
      const actualWidth = outputSize === 'custom' ? customWidth : FLYER_SIZES[outputSize].width;
      const actualHeight = outputSize === 'custom' ? customHeight : FLYER_SIZES[outputSize].height;
      
      // Try real AI generation
      setGenerationStep('Refining designs with AI...');
      
      let aiImages: { url: string; revisedPrompt?: string }[] = [];
      let usedRealAI = false;
      
      try {
        const response = await fetch('/.netlify/functions/generate-ai-design', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userData.uid}`,
          },
          body: JSON.stringify({
            prompt: refinedPrompt,
            width: actualWidth,
            height: actualHeight,
            designType: designType!,
            style,
            mood,
            numVariations: 3,
          }),
        });
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          if (response.ok && data.success && data.images?.length > 0) {
            aiImages = data.images;
            usedRealAI = true;
          } else if (data.error) {
            console.warn('AI Refinement returned error:', data.error);
          }
        }
      } catch (aiError) {
        console.warn('AI refinement failed, using fallback:', aiError);
      }
      
      // Consume credits for refinement
      const consumed = await consumeFeature('ai_design_generate', {
        itemName: `AI Design Refinement: ${refinementFeedback.substring(0, 30)}...`,
      });
      
      if (!consumed) {
        throw new Error('Failed to process credits. Please try again.');
      }
      
      // Refresh balance after consuming
      await refreshBalance();
      
      // Create refined designs
      let designs: GeneratedDesign[];
      
      if (usedRealAI && aiImages.length > 0) {
        designs = aiImages.map((img) => ({
          id: generateId(),
          imageUrl: img.url,
          prompt: img.revisedPrompt || refinedPrompt,
          elements: [],
        }));
      } else {
        // Fallback to mock
        designs = [1, 2, 3].map(variation => ({
          id: generateId(),
          imageUrl: '',
          prompt: refinedPrompt,
          elements: createMockElements({
            designType: designType!,
            teamName,
            primaryColor,
            secondaryColor,
            width: actualWidth,
            height: actualHeight,
            variation,
            style,
            mood,
            briefText: `${briefText} ${refinementFeedback}`,
            additionalText,
            selectedEvent,
            sport,
          }),
        }));
      }
      
      setGeneratedDesigns(designs);
      setSelectedDesign(null);
      setRefinementFeedback('');
      
    } catch (err) {
      console.error('Refinement failed:', err);
      setError(err instanceof Error ? err.message : 'Refinement failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  }, [refinementFeedback, userData?.uid, checkFeature, consumeFeature, refreshBalance, creditsPerGenerate, buildPrompt, designType, teamName, primaryColor, secondaryColor, outputSize, customWidth, customHeight, style, mood, briefText, additionalText, selectedEvent, sport]);
  
  // Import selected design to editor (auto-selects first design since we only generate one)
  const handleImport = useCallback(() => {
    // Use the first generated design since we only generate one
    const design = generatedDesigns[0];
    if (!design) return;
    
    // Handle custom size vs preset size
    let width: number;
    let height: number;
    let sizeKey: FlyerSize;
    
    if (outputSize === 'custom') {
      width = customWidth;
      height = customHeight;
      sizeKey = 'instagram'; // Default for custom - won't affect canvas size
    } else {
      const sizeInfo = FLYER_SIZES[outputSize];
      width = sizeInfo.width;
      height = sizeInfo.height;
      sizeKey = outputSize;
    }
    
    const canvas: CanvasState = {
      width,
      height,
      backgroundColor: '#1a1a2e',
      backgroundImage: undefined,
    };
    
    // If we have an AI-generated image URL, create an image element for it
    let elements = design.elements;
    if (design.imageUrl && (!elements || elements.length === 0)) {
      const aiImageElement: DesignElement = {
        id: generateId(),
        type: 'image',
        content: design.imageUrl,
        imageUrl: design.imageUrl,
        position: { x: 0, y: 0 },
        size: { width, height },
        rotation: 0,
        opacity: 100,
        visible: true,
        locked: false,
        zIndex: 0,
        name: 'AI Generated Design',
      };
      elements = [aiImageElement];
    }
    
    onImportDesign(elements, canvas, sizeKey);
    onClose();
  }, [generatedDesigns, outputSize, customWidth, customHeight, onImportDesign, onClose]);
  
  // Check if can proceed to next step
  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1: return designType !== null;
      case 2: return true; // Images are optional
      case 3: return teamName.trim() !== '' && briefText.trim() !== '';
      case 4: return true;
      default: return false;
    }
  }, [currentStep, designType, teamName, briefText]);
  
  // Navigation
  const nextStep = () => {
    if (currentStep === 4) {
      handleGenerate();
    } else if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================
  
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map(step => (
        <React.Fragment key={step}>
          <button
            onClick={() => step < currentStep && setCurrentStep(step)}
            disabled={step > currentStep}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              step === currentStep
                ? 'bg-gradient-to-r from-purple-500 to-orange-500 text-white'
                : step < currentStep
                  ? 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/50 cursor-pointer'
                  : theme === 'dark' ? 'bg-zinc-800 text-zinc-500' : 'bg-slate-200 text-slate-400'
            }`}
          >
            {step < currentStep ? <Check className="w-4 h-4" /> : step}
          </button>
          {step < 4 && (
            <div className={`w-12 h-0.5 ${step < currentStep ? 'bg-purple-500' : theme === 'dark' ? 'bg-zinc-700' : 'bg-slate-300'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
  
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>What are you creating?</h3>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Choose the type of design you want to generate</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {DESIGN_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => setDesignType(type.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              designType === type.id
                ? 'border-purple-500 bg-purple-500/20'
                : theme === 'dark' 
                  ? 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600' 
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            }`}
          >
            <div className="text-3xl mb-2">{type.icon}</div>
            <div className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{type.label}</div>
            <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{type.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
  
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Upload Reference Images</h3>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Optional: Add images to guide the AI (logos, inspiration, player photos)</p>
      </div>
      
      {/* Upload area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          theme === 'dark' 
            ? 'border-zinc-700 hover:border-purple-500/50' 
            : 'border-slate-300 hover:border-purple-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
        <Upload className={`w-10 h-10 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Click to upload or drag & drop</p>
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Up to 5 images (PNG, JPG)</p>
      </div>
      
      {/* Uploaded images */}
      {uploadedImages.length > 0 && (
        <div className="space-y-3 mt-4">
          <h4 className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Uploaded Images</h4>
          {uploadedImages.map((img, idx) => (
            <div key={img.id} className={`flex gap-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'}`}>
              <img
                src={img.preview}
                alt={`Upload ${idx + 1}`}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Image {idx + 1}</span>
                  <button
                    onClick={() => removeImage(img.id)}
                    className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={img.instruction}
                  onChange={(e) => updateImageInstruction(img.id, e.target.value)}
                  placeholder="How should AI use this image? (e.g., 'Use as team logo', 'This is our mascot')"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:border-purple-500 focus:outline-none ${
                    theme === 'dark'
                      ? 'bg-zinc-700 border-zinc-600 text-white placeholder-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Design Brief</h3>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Tell us about your design</p>
      </div>
      
      {/* Quick inputs - 2 column grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Team Name *</label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., Tigers"
            className={`w-full px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none ${
              theme === 'dark'
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-slate-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>
        <div>
          <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Sport</label>
          <input
            type="text"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            placeholder="e.g., Football, Basketball"
            className={`w-full px-3 py-2 border rounded-lg placeholder-slate-500 focus:border-purple-500 focus:outline-none ${
              theme === 'dark'
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          />
        </div>
      </div>
      
      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Primary Color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className={`flex-1 px-3 py-2 border rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none ${
                theme === 'dark'
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>
        <div>
          <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Secondary Color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className={`flex-1 px-3 py-2 border rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none ${
                theme === 'dark'
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>
      </div>
      
      {/* Link to season/event */}
      {(availableSeasons.length > 0 || availableEvents.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {availableSeasons.length > 0 && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Link to Season</label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none ${
                  theme === 'dark'
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="">None</option>
                {availableSeasons.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {availableEvents.length > 0 && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Link to Event</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none ${
                  theme === 'dark'
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="">None</option>
                {availableEvents.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      
      {/* Style */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Style</label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map(s => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                style === s.id
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                  : theme === 'dark'
                    ? 'border-zinc-700 bg-zinc-800 text-slate-300 hover:border-zinc-600'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {s.preview} {s.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Mood */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Mood</label>
        <div className="flex flex-wrap gap-2">
          {MOOD_PRESETS.map(m => (
            <button
              key={m.id}
              onClick={() => setMood(m.id)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                mood === m.id
                  ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                  : theme === 'dark'
                    ? 'border-zinc-700 bg-zinc-800 text-slate-300 hover:border-zinc-600'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* The big idea */}
      <div>
        <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
          <Wand2 className="w-4 h-4 inline mr-1" />
          Describe Your Vision *
        </label>
        <textarea
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          placeholder={DESIGN_TYPES.find(t => t.id === designType)?.examplePrompt || "Describe what you want in detail..."}
          rows={5}
          className={`w-full px-3 py-2 border rounded-lg placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none ${
            theme === 'dark'
              ? 'bg-zinc-800 border-zinc-700 text-white'
              : 'bg-white border-slate-300 text-slate-900'
          }`}
        />
        <div className="flex items-center justify-between mt-1">
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
            The more detail you provide, the better the results!
          </p>
          {designType && (
            <button
              onClick={() => setBriefText(DESIGN_TYPES.find(t => t.id === designType)?.examplePrompt || '')}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Use example →
            </button>
          )}
        </div>
      </div>
    </div>
  );
  
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Final Options</h3>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Choose output size and additional settings</p>
      </div>
      
      {/* Output size */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Output Size</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {OUTPUT_SIZES.map(size => (
            <button
              key={size.id}
              onClick={() => setOutputSize(size.id)}
              className={`p-3 rounded-lg border transition-all text-left ${
                outputSize === size.id
                  ? 'border-purple-500 bg-purple-500/20'
                  : theme === 'dark'
                    ? 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                    : 'border-slate-300 bg-white hover:border-slate-400'
              }`}
            >
              <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{size.label.split(' ')[0]}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{size.label.match(/\(.*\)/)?.[0]}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Custom size inputs */}
      {outputSize === 'custom' && (
        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Width (px)</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setCustomWidth('' as any); // Allow empty while typing
                  } else {
                    setCustomWidth(parseInt(val) || 100);
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  setCustomWidth(Math.max(100, Math.min(5000, val || 1080)));
                }}
                min={100}
                max={5000}
                className={`w-full px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Height (px)</label>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setCustomHeight('' as any); // Allow empty while typing
                  } else {
                    setCustomHeight(parseInt(val) || 100);
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  setCustomHeight(Math.max(100, Math.min(5000, val || 1080)));
                }}
                min={100}
                max={5000}
                className={`w-full px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
              />
            </div>
          </div>
          <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Tip: Use smaller sizes for logos (e.g., 500×500), larger for banners</p>
        </div>
      )}
      
      {/* Advanced options */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={`flex items-center justify-between w-full p-3 rounded-lg ${
          theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-750' : 'bg-slate-100 hover:bg-slate-200'
        }`}
      >
        <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
          <Settings2 className="w-4 h-4" />
          <span className="text-sm font-medium">Advanced Options</span>
        </div>
        {showAdvanced ? <ChevronUp className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} /> : <ChevronDown className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />}
      </button>
      
      {showAdvanced && (
        <div className={`space-y-4 p-4 rounded-lg border ${
          theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <div>
            <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Additional Text to Include</label>
            <textarea
              value={additionalText}
              onChange={(e) => setAdditionalText(e.target.value)}
              placeholder="Dates, prices, contact info, website, etc."
              rows={2}
              className={`w-full px-3 py-2 border rounded-lg placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none text-sm ${
                theme === 'dark'
                  ? 'bg-zinc-700 border-zinc-600 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Elements to Avoid</label>
            <input
              type="text"
              value={avoidElements}
              onChange={(e) => setAvoidElements(e.target.value)}
              placeholder="e.g., 'No clip art, no generic stock images'"
              className={`w-full px-3 py-2 border rounded-lg placeholder-slate-500 focus:border-purple-500 focus:outline-none text-sm ${
                theme === 'dark'
                  ? 'bg-zinc-700 border-zinc-600 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>
      )}
      
      {/* Cost summary */}
      <div className="p-4 bg-gradient-to-r from-purple-500/20 to-orange-500/20 rounded-xl border border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Generation Cost</span>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{CREDIT_COSTS.generate} credits</div>
            <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Generates 3 design variations</div>
          </div>
        </div>
        {creditBalance !== null && (
          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between text-sm">
            <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Your balance:</span>
            <span className={creditBalance >= CREDIT_COSTS.generate ? 'text-green-400' : 'text-red-400'}>
              {creditBalance} credits
            </span>
          </div>
        )}
      </div>
    </div>
  );
  
  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-orange-500 animate-pulse" />
        <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-white animate-bounce" />
      </div>
      <h3 className={`text-xl font-bold mt-6 mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Creating Your Designs</h3>
      <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{generationStep}</p>
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
  
  const renderResults = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Your Generated Designs</h3>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Select a design to import and edit</p>
      </div>
      
      {/* Generated designs - centered single image */}
      <div className="flex justify-center">
        {generatedDesigns.map((design, idx) => (
          <div
            key={design.id}
            className={`relative w-64 aspect-square rounded-xl overflow-hidden border-2 transition-all border-purple-500 ring-2 ring-purple-500/50`}
          >
            {/* Render actual design preview */}
            <DesignPreviewCanvas 
              elements={design.elements} 
              width={outputSize === 'custom' ? customWidth : FLYER_SIZES[outputSize].width}
              height={outputSize === 'custom' ? customHeight : FLYER_SIZES[outputSize].height}
              backgroundColor={secondaryColor}
              imageUrl={design.imageUrl}
            />
            
            {/* Variation label */}
            <div className="absolute bottom-2 left-2 right-2 text-center">
              <div className={`text-xs px-2 py-1 rounded bg-black/60 ${theme === 'dark' ? 'text-white' : 'text-white'}`}>
                Variation {idx + 1}
              </div>
            </div>
            
            {/* Always show selected checkmark */}
            <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Refinement feedback */}
      <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'}`}>
        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
          <MessageSquare className="w-4 h-4 inline mr-1" />
          Want changes? Describe them here:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={refinementFeedback}
            onChange={(e) => setRefinementFeedback(e.target.value)}
            placeholder="e.g., 'Make the logo bigger', 'Use darker background', 'Add more energy'"
            className={`flex-1 px-3 py-2 border rounded-lg placeholder-slate-500 focus:border-purple-500 focus:outline-none ${
              theme === 'dark'
                ? 'bg-zinc-700 border-zinc-600 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          />
          <button
            onClick={handleRefine}
            disabled={!refinementFeedback.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refine ({CREDIT_COSTS.refine} credits)
          </button>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setGeneratedDesigns([]);
            setSelectedDesign(null);
            setCurrentStep(1);
          }}
          className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
            theme === 'dark'
              ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
              : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
          }`}
        >
          Start Over
        </button>
        <button
          onClick={handleImport}
          disabled={generatedDesigns.length === 0}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 disabled:from-zinc-600 disabled:to-zinc-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          Import to Editor
        </button>
      </div>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className={`absolute inset-0 backdrop-blur-sm ${theme === 'dark' ? 'bg-black/80' : 'bg-black/50'}`} onClick={onClose} />
      
      {/* Modal */}
      <div className={`relative w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${
        theme === 'dark'
          ? 'bg-zinc-900 border-zinc-800'
          : 'bg-white border-slate-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-orange-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>AI Design Creator</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Create stunning designs with AI</p>
            </div>
          </div>
          
          {/* Credit balance */}
          <div className="flex items-center gap-4">
            {loadingCredits ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'
              }`}>
                <Coins className="w-4 h-4 text-yellow-500 animate-pulse" />
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>...</span>
              </div>
            ) : (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'
              }`}>
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{creditBalance}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'text-slate-400 hover:text-white hover:bg-zinc-800' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error message */}
          {error && (
            <div className={`mb-4 p-3 border rounded-lg flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-red-500/20 border-red-500/50 text-red-300'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <AlertCircle className="w-5 h-5" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Step indicator (not shown during generation or results) */}
          {currentStep <= 4 && !isGenerating && renderStepIndicator()}
          
          {/* Step content */}
          {isGenerating ? renderGenerating() : (
            <>
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderResults()}
            </>
          )}
        </div>
        
        {/* Footer - Navigation buttons (not shown during generation or results) */}
        {currentStep <= 4 && !isGenerating && (
          <div className={`flex items-center justify-between p-4 border-t ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                currentStep === 4
                  ? 'bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              } disabled:bg-zinc-500 disabled:cursor-not-allowed`}
            >
              {currentStep === 4 ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Designs
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// HELPER: Create mock elements for import with variations
// =============================================================================

interface CreateMockElementsParams {
  designType: DesignType;
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  width: number;
  height: number;
  variation?: number;
  style?: StylePreset;
  mood?: MoodPreset;
  briefText?: string;
  additionalText?: string;
  selectedEvent?: string;
  sport?: string;
}

function createMockElements(params: CreateMockElementsParams): DesignElement[] {
  const {
    designType,
    teamName,
    primaryColor,
    secondaryColor,
    width,
    height,
    variation = 1,
    style = 'modern',
    mood = 'energetic',
    briefText = '',
    additionalText = '',
    selectedEvent = '',
    sport = '',
  } = params;
  
  const elements: DesignElement[] = [];
  
  // Color variations based on variation number
  const bgColors = [
    { bg: secondaryColor, accent: primaryColor },
    { bg: primaryColor, accent: secondaryColor },
    { bg: '#1a1a2e', accent: primaryColor },
  ];
  const colors = bgColors[(variation - 1) % 3];
  
  // Layout variations
  const layouts = [
    { titleY: 0.15, subtitleY: 0.30, accentY: 0.85, centerText: true },
    { titleY: 0.40, subtitleY: 0.55, accentY: 0.10, centerText: true },
    { titleY: 0.70, subtitleY: 0.82, accentY: 0.05, centerText: false },
  ];
  const layout = layouts[(variation - 1) % 3];
  
  // Font variations based on style
  const fontFamilies: Record<StylePreset, string> = {
    modern: 'Arial Black',
    vintage: 'Georgia',
    playful: 'Comic Sans MS',
    bold: 'Impact',
    minimal: 'Helvetica',
    grunge: 'Verdana',
    elegant: 'Times New Roman',
  };
  const fontFamily = fontFamilies[style] || 'Impact';
  
  // Background shape with gradient feel (using multiple shapes for variation)
  if (variation === 1) {
    // Solid background
    elements.push({
      id: generateId(),
      type: 'shape',
      position: { x: 0, y: 0 },
      size: { width, height },
      rotation: 0,
      opacity: 100,
      zIndex: 1,
      locked: false,
      visible: true,
      shapeType: 'rectangle',
      color: colors.bg,
      backgroundColor: colors.bg,
      borderRadius: 0,
    });
  } else if (variation === 2) {
    // Two-tone split
    elements.push({
      id: generateId(),
      type: 'shape',
      position: { x: 0, y: 0 },
      size: { width, height: height / 2 },
      rotation: 0,
      opacity: 100,
      zIndex: 1,
      locked: false,
      visible: true,
      shapeType: 'rectangle',
      color: colors.bg,
      backgroundColor: colors.bg,
      borderRadius: 0,
    });
    elements.push({
      id: generateId(),
      type: 'shape',
      position: { x: 0, y: height / 2 },
      size: { width, height: height / 2 },
      rotation: 0,
      opacity: 100,
      zIndex: 1,
      locked: false,
      visible: true,
      shapeType: 'rectangle',
      color: colors.accent,
      backgroundColor: colors.accent,
      borderRadius: 0,
    });
  } else {
    // Diagonal feel with accent stripe
    elements.push({
      id: generateId(),
      type: 'shape',
      position: { x: 0, y: 0 },
      size: { width, height },
      rotation: 0,
      opacity: 100,
      zIndex: 1,
      locked: false,
      visible: true,
      shapeType: 'rectangle',
      color: colors.bg,
      backgroundColor: colors.bg,
      borderRadius: 0,
    });
    // Accent stripe
    elements.push({
      id: generateId(),
      type: 'shape',
      position: { x: 0, y: height * 0.3 },
      size: { width, height: height * 0.15 },
      rotation: 0,
      opacity: 80,
      zIndex: 2,
      locked: false,
      visible: true,
      shapeType: 'rectangle',
      color: colors.accent,
      backgroundColor: colors.accent,
      borderRadius: 0,
    });
  }
  
  // Team name with variation in positioning and style
  const textWidth = Math.min(width * 0.9, 500);
  const textX = layout.centerText ? (width - textWidth) / 2 : width * 0.05;
  const titleSize = variation === 1 ? 64 : variation === 2 ? 72 : 56;
  
  elements.push({
    id: generateId(),
    type: 'text',
    position: { x: textX, y: height * layout.titleY },
    size: { width: textWidth, height: 100 },
    rotation: 0,
    opacity: 100,
    zIndex: 10,
    locked: false,
    visible: true,
    content: teamName.toUpperCase(),
    fontFamily,
    fontSize: Math.min(titleSize, width * 0.08),
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: layout.centerText ? 'center' : 'left',
    color: variation === 2 && layout.titleY > 0.35 ? colors.bg : '#ffffff',
    backgroundColor: 'transparent',
    textDecoration: 'none',
    lineHeight: 1.1,
    letterSpacing: variation === 1 ? 2 : variation === 2 ? 4 : 1,
    textShadow: '0 4px 20px rgba(0,0,0,0.5)',
  });
  
  // Subtitle based on design type with variations - use user input when available
  const defaultSubtitles: Record<DesignType, string[]> = {
    'logo': ['EST.', 'TEAM SPIRIT', 'ATHLETICS'],
    'registration-flyer': ['REGISTRATION OPEN', 'SIGN UP NOW', 'JOIN THE TEAM'],
    'event-poster': ['GAME DAY', 'LET\'S GO!', 'MATCH DAY'],
    'social-post': ['FOLLOW US', 'TEAM UPDATE', '#TEAMSPIRIT'],
    'player-spotlight': ['PLAYER OF THE WEEK', 'MVP SPOTLIGHT', 'STAR PLAYER'],
    'announcement': ['ANNOUNCEMENT', 'NEWS UPDATE', 'IMPORTANT'],
    'celebration': ['CHAMPIONS!', 'VICTORY!', 'WE WON!'],
  };
  
  // Use additionalText, selectedEvent, or extract key phrases from briefText
  let subtitle: string;
  if (additionalText && additionalText.trim()) {
    // User specified exact text to include
    subtitle = additionalText.trim().toUpperCase();
  } else if (selectedEvent && selectedEvent.trim()) {
    // Use the selected event name
    subtitle = selectedEvent.toUpperCase();
  } else if (briefText && briefText.trim()) {
    // Extract key info from brief - take first meaningful phrase (up to 30 chars)
    const cleaned = briefText.trim().replace(/[,.!?;:]/g, ' ').split(/\s+/);
    const keyWords = cleaned.slice(0, 4).join(' ').toUpperCase().substring(0, 30);
    subtitle = keyWords || defaultSubtitles[designType]?.[variation - 1] || 'TEAM SPIRIT';
  } else {
    subtitle = defaultSubtitles[designType]?.[variation - 1] || 'TEAM SPIRIT';
  }
  
  const subtitleWidth = Math.min(width * 0.7, 350);
  const subtitleX = layout.centerText ? (width - subtitleWidth) / 2 : width * 0.05;
  
  elements.push({
    id: generateId(),
    type: 'text',
    position: { x: subtitleX, y: height * layout.subtitleY },
    size: { width: subtitleWidth, height: 50 },
    rotation: 0,
    opacity: 100,
    zIndex: 11,
    locked: false,
    visible: true,
    content: subtitle,
    fontFamily: 'Arial',
    fontSize: Math.min(28, width * 0.03),
    fontWeight: variation === 2 ? 'normal' : 'bold',
    fontStyle: 'normal',
    textAlign: layout.centerText ? 'center' : 'left',
    color: colors.accent,
    backgroundColor: variation === 1 ? 'rgba(255,255,255,0.9)' : 'transparent',
    textDecoration: 'none',
    lineHeight: 1.2,
    letterSpacing: variation === 1 ? 6 : variation === 2 ? 3 : 2,
  });
  
  // Decorative accent element (varies by variation)
  if (variation === 1) {
    // Bottom line
    elements.push({
      id: generateId(),
      type: 'shape',
      position: { x: width * 0.1, y: height * layout.accentY },
      size: { width: width * 0.8, height: 4 },
      rotation: 0,
      opacity: 100,
      zIndex: 5,
      locked: false,
      visible: true,
      shapeType: 'rectangle',
      color: colors.accent,
      borderRadius: 2,
    });
  } else if (variation === 2) {
    // Top decorative bar
    elements.push({
      id: generateId(),
      type: 'shape',
      position: { x: 0, y: height * layout.accentY },
      size: { width: width, height: 20 },
      rotation: 0,
      opacity: 100,
      zIndex: 5,
      locked: false,
      visible: true,
      shapeType: 'rectangle',
      color: colors.bg,
      borderRadius: 0,
    });
  } else {
    // Corner accent
    elements.push({
      id: generateId(),
      type: 'shape',
      position: { x: width - 80, y: height - 80 },
      size: { width: 60, height: 60 },
      rotation: 45,
      opacity: 80,
      zIndex: 5,
      locked: false,
      visible: true,
      shapeType: 'rectangle',
      color: colors.accent,
      borderRadius: 8,
    });
  }
  
  // Add mood-based extra elements
  if (mood === 'celebratory' || mood === 'fun') {
    // Add a star or celebratory element
    elements.push({
      id: generateId(),
      type: 'text',
      position: { x: width * 0.85, y: height * 0.05 },
      size: { width: 50, height: 50 },
      rotation: variation * 15,
      opacity: 80,
      zIndex: 15,
      locked: false,
      visible: true,
      content: mood === 'celebratory' ? '⭐' : '🎉',
      fontFamily: 'Arial',
      fontSize: 40,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#ffffff',
      backgroundColor: 'transparent',
    });
  }
  
  // Add sport-specific icon if sport is specified
  const sportIcons: Record<string, string> = {
    'baseball': '⚾',
    'softball': '🥎',
    'basketball': '🏀',
    'football': '🏈',
    'soccer': '⚽',
    'volleyball': '🏐',
    'tennis': '🎾',
    'hockey': '🏒',
    'lacrosse': '🥍',
    'swimming': '🏊',
    'track': '🏃',
    'wrestling': '🤼',
    'gymnastics': '🤸',
    'cheerleading': '📣',
  };
  
  const sportLower = sport?.toLowerCase() || '';
  const sportIcon = Object.entries(sportIcons).find(([key]) => sportLower.includes(key))?.[1];
  
  if (sportIcon && variation !== 2) {
    elements.push({
      id: generateId(),
      type: 'text',
      position: { x: width * 0.08, y: height * 0.88 },
      size: { width: 60, height: 60 },
      rotation: 0,
      opacity: 60,
      zIndex: 8,
      locked: false,
      visible: true,
      content: sportIcon,
      fontFamily: 'Arial',
      fontSize: 48,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#ffffff',
      backgroundColor: 'transparent',
    });
  }
  
  // Add brief text as a tagline if it's short enough and not already used
  if (briefText && briefText.trim().length > 0 && briefText.trim().length <= 60 && !additionalText) {
    const taglineY = variation === 1 ? 0.92 : variation === 2 ? 0.92 : 0.55;
    elements.push({
      id: generateId(),
      type: 'text',
      position: { x: width * 0.1, y: height * taglineY },
      size: { width: width * 0.8, height: 40 },
      rotation: 0,
      opacity: 90,
      zIndex: 12,
      locked: false,
      visible: true,
      content: briefText.trim(),
      fontFamily: 'Arial',
      fontSize: Math.min(18, width * 0.02),
      fontWeight: 'normal',
      fontStyle: style === 'elegant' ? 'italic' : 'normal',
      textAlign: 'center',
      color: variation === 2 ? colors.bg : colors.accent,
      backgroundColor: 'transparent',
      letterSpacing: 1,
    });
  }
  
  return elements;
}

// =============================================================================
// DESIGN PREVIEW CANVAS - Renders design elements to a canvas for preview
// =============================================================================

interface DesignPreviewCanvasProps {
  elements: DesignElement[];
  width: number;
  height: number;
  backgroundColor: string;
  className?: string;
  imageUrl?: string; // For AI-generated images
}

const DesignPreviewCanvas: React.FC<DesignPreviewCanvasProps> = ({ 
  elements, 
  width, 
  height, 
  backgroundColor,
  className,
  imageUrl 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match container aspect ratio
    const containerSize = 300; // Preview size
    const scale = containerSize / Math.max(width, height);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, scaledWidth, scaledHeight);
    
    // Apply scale
    ctx.scale(scale, scale);
    
    // Sort elements by zIndex
    const sortedElements = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    
    // Render each element
    sortedElements.forEach(element => {
      if (!element.visible) return;
      
      ctx.save();
      ctx.globalAlpha = (element.opacity ?? 100) / 100;
      
      const { x, y } = element.position;
      const { width: w, height: h } = element.size;
      
      // Handle rotation
      if (element.rotation) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate((element.rotation * Math.PI) / 180);
        ctx.translate(-(x + w / 2), -(y + h / 2));
      }
      
      if (element.type === 'shape') {
        ctx.fillStyle = element.backgroundColor || element.color || '#6366f1';
        
        const radius = element.borderRadius || 0;
        if (radius > 0 && ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, Math.min(radius, Math.min(w, h) / 2));
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
      } else if (element.type === 'text') {
        // Draw text background if set
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
          ctx.fillStyle = element.backgroundColor;
          ctx.fillRect(x, y, w, h);
        }
        
        // Draw text
        const fontSize = element.fontSize || 24;
        const fontFamily = element.fontFamily || 'Arial';
        const fontWeight = element.fontWeight || 'normal';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = element.color || '#ffffff';
        ctx.textAlign = (element.textAlign as CanvasTextAlign) || 'left';
        ctx.textBaseline = 'top';
        
        // Calculate text position based on alignment
        let textX = x;
        if (element.textAlign === 'center') textX = x + w / 2;
        else if (element.textAlign === 'right') textX = x + w;
        
        // Simple text rendering with word wrap
        const words = (element.content || '').split(' ');
        let line = '';
        let lineY = y + fontSize * 0.2;
        const lineHeight = fontSize * (element.lineHeight || 1.2);
        
        words.forEach((word: string) => {
          const testLine = line + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > w && line !== '') {
            ctx.fillText(line.trim(), textX, lineY);
            line = word + ' ';
            lineY += lineHeight;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line.trim(), textX, lineY);
      }
      
      ctx.restore();
    });
  }, [elements, width, height, backgroundColor]);
  
  // If we have an AI-generated image URL (data URL or regular URL), show the image
  if (imageUrl) {
    return (
      <img 
        src={imageUrl} 
        alt="AI Generated Design"
        className={`w-full h-full object-cover ${className || ''}`}
        style={{ display: 'block' }}
        onError={(e) => {
          console.error('Image failed to load:', imageUrl.substring(0, 100));
        }}
      />
    );
  }

  return (
    <canvas 
      ref={canvasRef} 
      className={`w-full h-full object-contain ${className || ''}`}
      style={{ display: 'block' }}
    />
  );
};

export default AICreatorModal;
