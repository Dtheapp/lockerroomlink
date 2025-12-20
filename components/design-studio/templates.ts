// =============================================================================
// DESIGN TEMPLATES - Pre-built templates for quick start
// =============================================================================

import type { DesignTemplate, DesignElement, CanvasState } from './types';
import { generateId } from './types';

// Template categories
export const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: '🎨' },
  { id: 'registration', name: 'Registration', icon: '📝' },
  { id: 'event', name: 'Events', icon: '📅' },
  { id: 'fundraiser', name: 'Fundraiser', icon: '💰' },
  { id: 'gameday', name: 'Game Day', icon: '🏆' },
  { id: 'ticket', name: 'Tickets', icon: '🎟️' },
  { id: 'announcement', name: 'Announcements', icon: '📢' },
  { id: 'social', name: 'Social Media', icon: '📱' },
  // { id: 'uniform', name: 'Uniforms', icon: '👕' }, // Coming Soon - Uniform Designer Pro
];

// Z-index counter for proper layering within a template
let zCounter = 0;
const resetZ = () => { zCounter = 0; };
const nextZ = () => ++zCounter;

// Helper to create text element - centered by default for canvas width 1080
const createText = (
  content: string,
  y: number,
  fontSize: number,
  color: string = '#ffffff',
  fontWeight: 'normal' | 'bold' = 'bold',
  textAlign: 'left' | 'center' | 'right' = 'center',
  width: number = 900,
  canvasWidth: number = 1080
): DesignElement => ({
  id: generateId(),
  type: 'text',
  position: { x: (canvasWidth - width) / 2, y },
  size: { width, height: fontSize * 1.5 },
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex: nextZ(),
  content,
  color,
  fontSize,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight,
  fontStyle: 'normal',
  textAlign,
});

// Helper to create shape element - centered by default
const createShape = (
  y: number,
  width: number,
  height: number,
  backgroundColor: string,
  borderRadius: number = 0,
  shapeType: 'rectangle' | 'circle' = 'rectangle',
  canvasWidth: number = 1080,
  customX?: number
): DesignElement => ({
  id: generateId(),
  type: 'shape',
  position: { x: customX !== undefined ? customX : (canvasWidth - width) / 2, y },
  size: { width, height },
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex: nextZ(),
  shapeType,
  backgroundColor,
  borderRadius,
});

// Helper for non-centered shapes (absolute positioning)
const createShapeAbs = (
  x: number,
  y: number,
  width: number,
  height: number,
  backgroundColor: string,
  borderRadius: number = 0,
  shapeType: 'rectangle' | 'circle' = 'rectangle'
): DesignElement => ({
  id: generateId(),
  type: 'shape',
  position: { x, y },
  size: { width, height },
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex: nextZ(),
  shapeType,
  backgroundColor,
  borderRadius,
});

// Helper to create text with explicit positioning (not centered)
const createTextAbs = (
  content: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  color: string = '#ffffff',
  fontWeight: 'normal' | 'bold' = 'bold',
  textAlign: 'left' | 'center' | 'right' = 'center'
): DesignElement => ({
  id: generateId(),
  type: 'text',
  position: { x, y },
  size: { width, height: fontSize * 1.5 },
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex: nextZ(),
  content,
  color,
  fontSize,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight,
  fontStyle: 'normal',
  textAlign,
});

// =============================================================================
// TEMPLATE BUILDERS - Each returns elements with proper z-order
// =============================================================================

const buildRegistrationTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Layer 1: Background shapes (lowest)
    createShapeAbs(0, 0, 1080, 160, '#8b5cf6'),
    // Layer 2: Header text
    createText('REGISTRATION OPEN', 45, 48, '#ffffff', 'bold', 'center', 1000),
    createText('Season 2025', 105, 24, '#ffffffcc', 'normal', 'center', 1000),
    // Layer 3: Main content
    createText('JOIN OUR TEAM', 250, 72, '#ffffff', 'bold', 'center', 1000),
    createText('Ages 8-14 • All Skill Levels Welcome', 350, 22, '#ffffffbb', 'normal', 'center', 1000),
    // Layer 4: Date badge background
    createShape(450, 380, 56, '#8b5cf6', 28),
    // Layer 5: Date badge text (on top of badge)
    createText('📅 Jan 15 - Feb 28', 465, 22, '#ffffff', 'bold', 'center', 380),
    // Layer 6: Price section
    createText('$150 Registration Fee', 570, 40, '#fbbf24', 'bold', 'center', 1000),
    createText('Includes: Jersey, Equipment, Insurance', 640, 20, '#ffffffaa', 'normal', 'center', 1000),
    // Layer 7: CTA button background
    createShape(760, 380, 56, '#ffffff', 28),
    // Layer 8: CTA button text (on top)
    createText('REGISTER NOW', 775, 22, '#1e3a5f', 'bold', 'center', 380),
  ];
};

const buildSportsNightTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Layer 1: Large decorative circle (background)
    createShapeAbs(90, -150, 900, 900, '#8b5cf6', 450, 'circle'),
    // Layer 2+: All text on top
    createText('FAMILY', 340, 72, '#ffffff', 'bold', 'center', 1000),
    createText('SPORTS NIGHT', 430, 64, '#fbbf24', 'bold', 'center', 1000),
    createText('Join us for an evening of fun, games,', 530, 22, '#ffffffcc', 'normal', 'center', 900),
    createText('and friendly competition!', 560, 22, '#ffffffcc', 'normal', 'center', 900),
    // Date badge
    createShape(640, 420, 50, '#8b5cf6', 25),
    createText('Saturday, March 15th • 6PM', 653, 20, '#ffffff', 'bold', 'center', 420),
    // Rest of content
    createText('📍 Community Sports Center', 740, 22, '#ffffffbb', 'normal', 'center', 1000),
    createText('FREE ADMISSION', 840, 32, '#22c55e', 'bold', 'center', 1000),
    createText('Food • Games • Prizes • Fun for all ages!', 910, 20, '#ffffffaa', 'normal', 'center', 1000),
  ];
};

const buildFundraiserTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Layer 1: Icon
    createText('🎯', 70, 80, '#ffffff', 'bold', 'center', 1000),
    // Layer 2: Headlines
    createText('HELP US REACH', 200, 32, '#ffffffcc', 'normal', 'center', 1000),
    createText('$10,000', 260, 96, '#22c55e', 'bold', 'center', 1000),
    createText('FOR NEW EQUIPMENT', 380, 28, '#ffffffcc', 'normal', 'center', 1000),
    // Layer 3: Progress bar background (must come first)
    createShape(460, 800, 36, '#ffffff22', 18),
    // Layer 4: Progress bar fill (on top of background)
    createShapeAbs(140, 460, 480, 36, '#22c55e', 18),
    // Layer 5+: Text content
    createText('$6,000 raised so far!', 520, 24, '#ffffff', 'bold', 'center', 1000),
    createText('Your support helps our young athletes succeed.', 600, 20, '#ffffffbb', 'normal', 'center', 900),
    createText('Every dollar counts toward new uniforms,', 630, 20, '#ffffffbb', 'normal', 'center', 900),
    createText('equipment, and training facilities.', 660, 20, '#ffffffbb', 'normal', 'center', 900),
    // CTA
    createShape(750, 380, 56, '#ffffff', 28),
    createText('DONATE TODAY', 765, 22, '#064e3b', 'bold', 'center', 380),
    createText('Scan QR code or visit teamfund.org/donate', 860, 18, '#ffffffaa', 'normal', 'center', 1000),
  ];
};

const buildGameDayTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Layer 1: Title
    createText('GAME DAY', 50, 56, '#fbbf24', 'bold', 'center', 1000),
    // Layer 2: Team boxes (backgrounds)
    createShapeAbs(115, 160, 380, 280, '#1e3a5f', 24),
    createShapeAbs(585, 160, 380, 280, '#7f1d1d', 24),
    // Layer 3: Team labels (on top of boxes)
    createTextAbs('HOME', 115, 380, 380, 32, '#ffffff', 'bold', 'center'),
    createTextAbs('AWAY', 585, 380, 380, 32, '#ffffff', 'bold', 'center'),
    // Layer 4: VS badge
    createText('VS', 280, 72, '#fbbf24', 'bold', 'center', 1000),
    // Layer 5: Date/time/location
    createText('Saturday, March 22nd', 500, 28, '#ffffff', 'normal', 'center', 1000),
    createText('7:00 PM', 560, 56, '#fbbf24', 'bold', 'center', 1000),
    createText('📍 Main Stadium', 660, 24, '#ffffffbb', 'normal', 'center', 1000),
    // Layer 6: CTA
    createShape(760, 450, 56, '#fbbf24', 28),
    createText('GET YOUR TICKETS', 776, 22, '#171717', 'bold', 'center', 450),
  ];
};

const buildTicketTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Layer 1: Ticket outline/border
    createShapeAbs(40, 40, 1000, 500, '#fbbf24', 16),
    // Layer 2: Inner ticket background
    createShapeAbs(50, 50, 980, 480, '#1e1b4b', 12),
    // Layer 3: Decorative perforation line (left side)
    createShapeAbs(180, 50, 4, 480, '#fbbf2440'),
    // Layer 4: Stub area
    createShapeAbs(50, 50, 130, 480, '#312e81', 12),
    // Layer 5: Stub text (rotated would be ideal, but simplified)
    createTextAbs('ADMIT', 60, 200, 110, 18, '#fbbf24', 'bold', 'center'),
    createTextAbs('ONE', 60, 230, 110, 18, '#fbbf24', 'bold', 'center'),
    // Layer 6: Main ticket content
    createTextAbs('🎟️', 540, 80, 100, 48, '#fbbf24', 'bold', 'center'),
    createText('GAME DAY TICKET', 160, 36, '#ffffff', 'bold', 'center', 800),
    // Layer 7: Teams
    createText('HOME vs AWAY', 260, 48, '#fbbf24', 'bold', 'center', 800),
    // Layer 8: Details
    createText('Saturday, March 22nd • 7:00 PM', 350, 20, '#ffffffcc', 'normal', 'center', 800),
    createText('📍 Main Stadium', 390, 18, '#ffffffaa', 'normal', 'center', 800),
    // Layer 9: Ticket info
    createText('Section: GA • Row: -- • Seat: --', 450, 16, '#ffffff88', 'normal', 'center', 800),
    // Layer 10: Bottom decorative bar
    createShapeAbs(50, 560, 980, 60, '#fbbf24', 0),
    // Layer 11: Bottom text
    createText('SCAN QR CODE AT ENTRANCE', 610, 18, '#1e1b4b', 'bold', 'center', 1000),
    // Layer 12: Price badge
    createShapeAbs(800, 620, 200, 80, '#22c55e', 12),
    createTextAbs('$10', 810, 640, 180, 36, '#ffffff', 'bold', 'center'),
    // Layer 13: QR placeholder area
    createShapeAbs(80, 620, 120, 120, '#ffffff', 8),
    createTextAbs('QR', 100, 660, 80, 24, '#1e1b4b', 'bold', 'center'),
  ];
};

const buildAnnouncementTemplate = (): DesignElement[] => {
  resetZ();
  return [
    createText('⚠️', 80, 100, '#ffffff', 'bold', 'center', 1000),
    createText('IMPORTANT', 230, 48, '#fbbf24', 'bold', 'center', 1000),
    createText('ANNOUNCEMENT', 300, 56, '#ffffff', 'bold', 'center', 1000),
    createShape(400, 800, 4, '#fbbf24'),
    createText('Practice schedule has been updated.', 460, 26, '#ffffffdd', 'normal', 'center', 900),
    createText('Please check the team app for', 500, 26, '#ffffffdd', 'normal', 'center', 900),
    createText('new times and locations.', 540, 26, '#ffffffdd', 'normal', 'center', 900),
    createText('Effective: January 15, 2025', 640, 22, '#ffffffbb', 'normal', 'center', 1000),
    createText('Questions? Contact Coach Smith', 700, 20, '#ffffffaa', 'normal', 'center', 1000),
    createShape(800, 380, 56, '#ffffff', 28),
    createText('VIEW SCHEDULE', 816, 22, '#7f1d1d', 'bold', 'center', 380),
  ];
};

const buildCongratsTemplate = (): DesignElement[] => {
  resetZ();
  return [
    createText('🎉', 80, 100, '#ffffff', 'bold', 'center', 1000),
    createText('CONGRATULATIONS', 230, 52, '#fbbf24', 'bold', 'center', 1000),
    createText('PLAYER NAME', 320, 64, '#ffffff', 'bold', 'center', 1000),
    createShape(440, 400, 4, '#8b5cf6'),
    createText('MVP of the Week', 500, 36, '#a78bfa', 'bold', 'center', 1000),
    createText('Outstanding performance with 25 points,', 600, 22, '#ffffffcc', 'normal', 'center', 900),
    createText('10 assists, and a game-winning shot!', 632, 22, '#ffffffcc', 'normal', 'center', 900),
    createText('#TeamPride #MVP #Champions', 780, 20, '#8b5cf6', 'normal', 'center', 1000),
    createText('@YourTeamName', 840, 24, '#ffffffaa', 'normal', 'center', 1000),
  ];
};

const buildCountdownTemplate = (): DesignElement[] => {
  resetZ();
  return [
    createText('⏱️', 350, 150, '#ffffff', 'bold', 'center', 1000),
    createText('ONLY', 600, 48, '#ffffffcc', 'normal', 'center', 1000),
    createText('3 DAYS', 680, 96, '#38bdf8', 'bold', 'center', 1000),
    createText('LEFT!', 810, 48, '#ffffffcc', 'normal', 'center', 1000),
    createShape(920, 600, 4, '#38bdf8'),
    createText('Registration closes Friday', 1000, 32, '#ffffff', 'normal', 'center', 1000),
    createText("Don't miss out on the 2025 season!", 1070, 24, '#ffffffbb', 'normal', 'center', 1000),
    createShape(1250, 500, 80, '#38bdf8', 40),
    createText('REGISTER NOW', 1275, 28, '#0c4a6e', 'bold', 'center', 500),
    createText('Swipe up to sign up', 1550, 24, '#ffffffaa', 'normal', 'center', 1000),
  ];
};

// =============================================================================
// UNIFORM TEMPLATE BUILDERS
// =============================================================================

const buildJerseyFrontTemplate = (): DesignElement[] => {
  resetZ();
  const w = 800;
  return [
    // Jersey body shape
    createShapeAbs(100, 150, 600, 700, '#f97316', 20), // Main body (orange as example)
    // Collar
    createShapeAbs(300, 100, 200, 80, '#ffffff', 40),
    createShapeAbs(320, 120, 160, 60, '#1a1a2e', 30), // Collar opening
    // Sleeve panels
    createShapeAbs(50, 180, 100, 200, '#ffffff', 10), // Left sleeve accent
    createShapeAbs(650, 180, 100, 200, '#ffffff', 10), // Right sleeve accent
    // Logo placeholder
    createShapeAbs(300, 300, 200, 200, '#ffffff22', 100, 'circle'),
    createTextAbs('LOGO', 370, 380, 60, 24, '#ffffff88', 'bold', 'center'),
    // Team name
    createTextAbs('TEAM NAME', 100, 550, 600, 48, '#ffffff', 'bold', 'center'),
    // Side stripes
    createShapeAbs(100, 400, 15, 300, '#000000', 5),
    createShapeAbs(685, 400, 15, 300, '#000000', 5),
    // Label
    createTextAbs('Jersey Front', 300, 900, 200, 18, '#ffffff66', 'normal', 'center'),
  ];
};

const buildJerseyBackTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Jersey body shape
    createShapeAbs(100, 150, 600, 700, '#f97316', 20),
    // Collar
    createShapeAbs(300, 100, 200, 80, '#ffffff', 40),
    createShapeAbs(340, 150, 120, 30, '#1a1a2e', 5), // Back collar detail
    // Sleeve panels
    createShapeAbs(50, 180, 100, 200, '#ffffff', 10),
    createShapeAbs(650, 180, 100, 200, '#ffffff', 10),
    // Player name area
    createTextAbs('PLAYER NAME', 100, 280, 600, 36, '#ffffff', 'bold', 'center'),
    // Number (large)
    createTextAbs('00', 200, 350, 400, 200, '#ffffff', 'bold', 'center'),
    // Side stripes
    createShapeAbs(100, 400, 15, 300, '#000000', 5),
    createShapeAbs(685, 400, 15, 300, '#000000', 5),
    // Label
    createTextAbs('Jersey Back', 300, 900, 200, 18, '#ffffff66', 'normal', 'center'),
  ];
};

const buildShirtFrontTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Shirt body
    createShapeAbs(100, 120, 600, 650, '#f97316', 15),
    // Collar (crew neck)
    createShapeAbs(320, 80, 160, 70, '#f97316', 35),
    createShapeAbs(340, 100, 120, 50, '#1a1a2e', 25),
    // Sleeves
    createShapeAbs(60, 130, 80, 180, '#f97316', 8),
    createShapeAbs(660, 130, 80, 180, '#f97316', 8),
    // Logo area
    createShapeAbs(300, 250, 200, 200, '#ffffff22', 100, 'circle'),
    createTextAbs('LOGO', 370, 330, 60, 24, '#ffffff88', 'bold', 'center'),
    // Label
    createTextAbs('T-Shirt Front', 300, 820, 200, 18, '#ffffff66', 'normal', 'center'),
  ];
};

const buildShirtBackTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Shirt body
    createShapeAbs(100, 120, 600, 650, '#f97316', 15),
    // Collar back
    createShapeAbs(320, 80, 160, 70, '#f97316', 35),
    createShapeAbs(350, 110, 100, 30, '#1a1a2e', 5),
    // Sleeves
    createShapeAbs(60, 130, 80, 180, '#f97316', 8),
    createShapeAbs(660, 130, 80, 180, '#f97316', 8),
    // Back text/number area
    createTextAbs('TEXT OR', 100, 300, 600, 32, '#ffffff', 'bold', 'center'),
    createTextAbs('NUMBER', 100, 350, 600, 32, '#ffffff', 'bold', 'center'),
    // Label
    createTextAbs('T-Shirt Back', 300, 820, 200, 18, '#ffffff66', 'normal', 'center'),
  ];
};

const buildShortsFrontTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Waistband
    createShapeAbs(100, 50, 500, 60, '#000000', 5),
    // Left leg
    createShapeAbs(100, 110, 230, 400, '#f97316', 10),
    // Right leg
    createShapeAbs(370, 110, 230, 400, '#f97316', 10),
    // Side stripes
    createShapeAbs(100, 110, 30, 400, '#ffffff', 5),
    createShapeAbs(570, 110, 30, 400, '#ffffff', 5),
    // Logo area
    createShapeAbs(260, 200, 180, 100, '#ffffff22', 10),
    createTextAbs('LOGO', 310, 235, 80, 20, '#ffffff88', 'bold', 'center'),
    // Label
    createTextAbs('Shorts Front', 250, 540, 200, 18, '#ffffff66', 'normal', 'center'),
  ];
};

const buildShortsBackTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Waistband
    createShapeAbs(100, 50, 500, 60, '#000000', 5),
    // Left leg
    createShapeAbs(100, 110, 230, 400, '#f97316', 10),
    // Right leg
    createShapeAbs(370, 110, 230, 400, '#f97316', 10),
    // Side stripes
    createShapeAbs(100, 110, 30, 400, '#ffffff', 5),
    createShapeAbs(570, 110, 30, 400, '#ffffff', 5),
    // Label
    createTextAbs('Shorts Back', 250, 540, 200, 18, '#ffffff66', 'normal', 'center'),
  ];
};

const buildPantsFrontTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Waistband
    createShapeAbs(50, 50, 500, 80, '#000000', 5),
    // Left leg
    createShapeAbs(50, 130, 220, 1000, '#f97316', 10),
    // Right leg
    createShapeAbs(330, 130, 220, 1000, '#f97316', 10),
    // Side stripes
    createShapeAbs(50, 130, 30, 1000, '#ffffff', 5),
    createShapeAbs(520, 130, 30, 1000, '#ffffff', 5),
    // Logo on thigh
    createShapeAbs(220, 300, 160, 100, '#ffffff22', 10),
    createTextAbs('LOGO', 260, 335, 80, 20, '#ffffff88', 'bold', 'center'),
    // Label
    createTextAbs('Pants Front', 200, 1150, 200, 18, '#ffffff66', 'normal', 'center'),
  ];
};

const buildPantsBackTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Waistband
    createShapeAbs(50, 50, 500, 80, '#000000', 5),
    // Left leg
    createShapeAbs(50, 130, 220, 1000, '#f97316', 10),
    // Right leg
    createShapeAbs(330, 130, 220, 1000, '#f97316', 10),
    // Side stripes
    createShapeAbs(50, 130, 30, 1000, '#ffffff', 5),
    createShapeAbs(520, 130, 30, 1000, '#ffffff', 5),
    // Label
    createTextAbs('Pants Back', 200, 1150, 200, 18, '#ffffff66', 'normal', 'center'),
  ];
};

const buildSocksSideTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Main sock body
    createShapeAbs(50, 50, 200, 600, '#f97316', 15),
    // Foot section
    createShapeAbs(30, 600, 240, 150, '#f97316', 40),
    // Top stripe
    createShapeAbs(50, 50, 200, 40, '#ffffff', 10),
    // Middle stripe
    createShapeAbs(50, 250, 200, 30, '#000000', 5),
    // Logo area
    createShapeAbs(80, 350, 140, 100, '#ffffff22', 10),
    createTextAbs('LOGO', 110, 385, 80, 18, '#ffffff88', 'bold', 'center'),
    // Label
    createTextAbs('Socks Side', 50, 770, 200, 16, '#ffffff66', 'normal', 'center'),
  ];
};

const buildFullUniformTemplate = (): DesignElement[] => {
  resetZ();
  return [
    // Title
    createTextAbs('FULL UNIFORM', 200, 30, 400, 32, '#ffffff', 'bold', 'center'),
    
    // Jersey section
    createTextAbs('Jersey', 300, 100, 200, 20, '#ffffff88', 'normal', 'center'),
    createShapeAbs(200, 150, 400, 450, '#f97316', 15), // Body
    createShapeAbs(350, 120, 100, 50, '#ffffff', 25), // Collar
    createShapeAbs(160, 170, 60, 130, '#ffffff', 8), // Left sleeve
    createShapeAbs(580, 170, 60, 130, '#ffffff', 8), // Right sleeve
    createTextAbs('00', 300, 300, 200, 120, '#ffffff', 'bold', 'center'),
    
    // Separator
    createShapeAbs(100, 650, 600, 3, '#ffffff33', 1),
    
    // Shorts/Pants section
    createTextAbs('Shorts', 300, 680, 200, 20, '#ffffff88', 'normal', 'center'),
    createShapeAbs(200, 720, 180, 350, '#f97316', 10), // Left leg
    createShapeAbs(420, 720, 180, 350, '#f97316', 10), // Right leg
    createShapeAbs(200, 720, 25, 350, '#ffffff', 5), // Left stripe
    createShapeAbs(575, 720, 25, 350, '#ffffff', 5), // Right stripe
    
    // Socks
    createTextAbs('Socks', 300, 1100, 200, 20, '#ffffff88', 'normal', 'center'),
    createShapeAbs(220, 1140, 80, 350, '#f97316', 10), // Left sock
    createShapeAbs(500, 1140, 80, 350, '#f97316', 10), // Right sock
    createShapeAbs(220, 1140, 80, 30, '#ffffff', 5), // Left stripe
    createShapeAbs(500, 1140, 80, 30, '#ffffff', 5), // Right stripe
    
    // Label
    createTextAbs('Full Uniform Set', 250, 1550, 300, 18, '#ffffff66', 'normal', 'center'),
  ];
};

// =============================================================================
// TEMPLATES
// =============================================================================

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  // BLANK TEMPLATES
  {
    id: 'blank-instagram',
    name: 'Blank Canvas',
    description: 'Start fresh with a blank Instagram post',
    preview: '⬜',
    category: 'all',
    canvas: {
      width: 1080,
      height: 1080,
      backgroundColor: '#1e3a5f',
    },
    elements: [],
  },

  // REGISTRATION TEMPLATES
  {
    id: 'registration-modern',
    name: 'Team Registration',
    description: 'Clean, modern registration flyer',
    preview: '📝',
    category: 'registration',
    canvas: {
      width: 1080,
      height: 1080,
      backgroundColor: '#1e3a5f',
    },
    elements: buildRegistrationTemplate(),
  },

  // EVENT TEMPLATES
  {
    id: 'event-sports-night',
    name: 'Sports Night',
    description: 'Exciting event announcement',
    preview: '🌙',
    category: 'event',
    canvas: {
      width: 1080,
      height: 1080,
      backgroundColor: '#0f172a',
    },
    elements: buildSportsNightTemplate(),
  },

  // FUNDRAISER TEMPLATES
  {
    id: 'fundraiser-goal',
    name: 'Fundraiser Goal',
    description: 'Donation campaign with goal tracker',
    preview: '💰',
    category: 'fundraiser',
    canvas: {
      width: 1080,
      height: 1080,
      backgroundColor: '#064e3b',
    },
    elements: buildFundraiserTemplate(),
  },

  // GAME DAY TEMPLATES
  {
    id: 'gameday-matchup',
    name: 'Game Day Matchup',
    description: 'Exciting VS matchup announcement',
    preview: '🏆',
    category: 'gameday',
    canvas: {
      width: 1080,
      height: 1080,
      backgroundColor: '#171717',
    },
    elements: buildGameDayTemplate(),
  },

  // TICKET TEMPLATES
  {
    id: 'ticket-gameday',
    name: 'Game Day Ticket',
    description: 'Printable ticket design for games',
    preview: '🎟️',
    category: 'ticket',
    canvas: {
      width: 1080,
      height: 800,
      backgroundColor: '#0f172a',
    },
    elements: buildTicketTemplate(),
  },

  // ANNOUNCEMENT TEMPLATES
  {
    id: 'announcement-important',
    name: 'Important Update',
    description: 'Eye-catching announcement',
    preview: '📢',
    category: 'announcement',
    canvas: {
      width: 1080,
      height: 1080,
      backgroundColor: '#7f1d1d',
    },
    elements: buildAnnouncementTemplate(),
  },

  // SOCIAL MEDIA TEMPLATES
  {
    id: 'social-congrats',
    name: 'Congratulations Post',
    description: 'Celebrate achievements',
    preview: '🎉',
    category: 'social',
    canvas: {
      width: 1080,
      height: 1080,
      backgroundColor: '#1e1b4b',
      backgroundGradient: {
        type: 'radial',
        angle: 0,
        stops: [
          { offset: 0, color: '#312e81' },
          { offset: 1, color: '#1e1b4b' },
        ],
      },
    },
    elements: buildCongratsTemplate(),
  },

  // STORY TEMPLATES (1080x1920)
  {
    id: 'story-countdown',
    name: 'Event Countdown',
    description: 'Story-sized countdown',
    preview: '⏱️',
    category: 'social',
    canvas: {
      width: 1080,
      height: 1920,
      backgroundColor: '#0c4a6e',
    },
    elements: buildCountdownTemplate(),
  },

  // =============================================================================
  // UNIFORM TEMPLATES
  // =============================================================================

  // JERSEY FRONT
  {
    id: 'uniform-jersey-front',
    name: 'Jersey Front',
    description: 'Football/sports jersey front view',
    preview: '👕',
    category: 'uniform',
    canvas: {
      width: 800,
      height: 1000,
      backgroundColor: '#1a1a2e',
    },
    elements: buildJerseyFrontTemplate(),
  },

  // JERSEY BACK
  {
    id: 'uniform-jersey-back',
    name: 'Jersey Back',
    description: 'Jersey back with number and name',
    preview: '👕',
    category: 'uniform',
    canvas: {
      width: 800,
      height: 1000,
      backgroundColor: '#1a1a2e',
    },
    elements: buildJerseyBackTemplate(),
  },

  // T-SHIRT FRONT
  {
    id: 'uniform-shirt-front',
    name: 'T-Shirt Front',
    description: 'Casual team shirt front',
    preview: '👔',
    category: 'uniform',
    canvas: {
      width: 800,
      height: 900,
      backgroundColor: '#1a1a2e',
    },
    elements: buildShirtFrontTemplate(),
  },

  // T-SHIRT BACK
  {
    id: 'uniform-shirt-back',
    name: 'T-Shirt Back',
    description: 'Casual team shirt back',
    preview: '👔',
    category: 'uniform',
    canvas: {
      width: 800,
      height: 900,
      backgroundColor: '#1a1a2e',
    },
    elements: buildShirtBackTemplate(),
  },

  // SHORTS FRONT
  {
    id: 'uniform-shorts-front',
    name: 'Shorts Front',
    description: 'Athletic shorts front view',
    preview: '🩳',
    category: 'uniform',
    canvas: {
      width: 700,
      height: 600,
      backgroundColor: '#1a1a2e',
    },
    elements: buildShortsFrontTemplate(),
  },

  // SHORTS BACK
  {
    id: 'uniform-shorts-back',
    name: 'Shorts Back',
    description: 'Athletic shorts back view',
    preview: '🩳',
    category: 'uniform',
    canvas: {
      width: 700,
      height: 600,
      backgroundColor: '#1a1a2e',
    },
    elements: buildShortsBackTemplate(),
  },

  // PANTS FRONT
  {
    id: 'uniform-pants-front',
    name: 'Pants Front',
    description: 'Athletic pants front view',
    preview: '👖',
    category: 'uniform',
    canvas: {
      width: 600,
      height: 1200,
      backgroundColor: '#1a1a2e',
    },
    elements: buildPantsFrontTemplate(),
  },

  // PANTS BACK
  {
    id: 'uniform-pants-back',
    name: 'Pants Back',
    description: 'Athletic pants back view',
    preview: '👖',
    category: 'uniform',
    canvas: {
      width: 600,
      height: 1200,
      backgroundColor: '#1a1a2e',
    },
    elements: buildPantsBackTemplate(),
  },

  // SOCKS SIDE VIEW
  {
    id: 'uniform-socks-side',
    name: 'Socks Side View',
    description: 'Team socks side view',
    preview: '🧦',
    category: 'uniform',
    canvas: {
      width: 300,
      height: 800,
      backgroundColor: '#1a1a2e',
    },
    elements: buildSocksSideTemplate(),
  },

  // FULL UNIFORM
  {
    id: 'uniform-full',
    name: 'Full Uniform Set',
    description: 'Complete uniform overview',
    preview: '🏃',
    category: 'uniform',
    canvas: {
      width: 800,
      height: 1600,
      backgroundColor: '#1a1a2e',
    },
    elements: buildFullUniformTemplate(),
  },
];

// Get templates by category
export const getTemplatesByCategory = (category: string): DesignTemplate[] => {
  // Filter out uniform templates (Coming Soon - Uniform Designer Pro)
  const nonUniformTemplates = DESIGN_TEMPLATES.filter(t => t.category !== 'uniform');
  if (category === 'all') return nonUniformTemplates;
  return nonUniformTemplates.filter(t => t.category === category);
};

// Get a single template by ID
export const getTemplateById = (id: string): DesignTemplate | undefined => {
  return DESIGN_TEMPLATES.find(t => t.id === id);
};
