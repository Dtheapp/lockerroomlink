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
  { id: 'announcement', name: 'Announcements', icon: '📢' },
  { id: 'social', name: 'Social Media', icon: '📱' },
];

// Helper to create text element
const createText = (
  content: string,
  x: number,
  y: number,
  fontSize: number,
  color: string = '#ffffff',
  fontWeight: 'normal' | 'bold' = 'bold',
  textAlign: 'left' | 'center' | 'right' = 'center',
  width: number = 500
): DesignElement => ({
  id: generateId(),
  type: 'text',
  position: { x, y },
  size: { width, height: fontSize * 1.5 },
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex: Date.now() + Math.random() * 1000,
  content,
  color,
  fontSize,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight,
  fontStyle: 'normal',
  textAlign,
});

// Helper to create shape element
const createShape = (
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
  zIndex: Date.now() + Math.random() * 1000,
  shapeType,
  backgroundColor,
  borderRadius,
});

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
    elements: [
      createShape(0, 0, 1080, 200, 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'),
      createText('REGISTRATION OPEN', 290, 60, 48, '#ffffff', 'bold'),
      createText('Season 2025', 290, 130, 28, '#ffffffcc', 'normal'),
      createText('JOIN OUR TEAM', 190, 350, 64, '#ffffff', 'bold'),
      createText('Ages 8-14 • All Skill Levels Welcome', 190, 450, 24, '#ffffffbb', 'normal'),
      createShape(340, 550, 400, 60, '#8b5cf6', 30),
      createText('📅 Jan 15 - Feb 28', 390, 565, 24, '#ffffff', 'bold'),
      createText('$150 Registration Fee', 390, 680, 32, '#fbbf24', 'bold'),
      createText('Includes: Jersey, Equipment, Insurance', 190, 750, 20, '#ffffffaa', 'normal'),
      createShape(340, 880, 400, 56, '#ffffff', 28),
      createText('REGISTER NOW →', 415, 895, 22, '#1e3a5f', 'bold'),
    ],
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
    elements: [
      createShape(0, 0, 1080, 1080, '#8b5cf6', 0, 'circle'), // Decorative circle
      createText('🏀', 490, 150, 120, '#ffffff', 'bold'),
      createText('FAMILY', 290, 350, 72, '#ffffff', 'bold'),
      createText('SPORTS NIGHT', 140, 430, 72, '#fbbf24', 'bold'),
      createText('Join us for an evening of fun, games, and friendly competition!', 140, 550, 24, '#ffffffcc', 'normal', 'center', 800),
      createShape(340, 650, 400, 50, '#8b5cf6', 25),
      createText('Saturday, March 15th • 6PM', 365, 663, 20, '#ffffff', 'bold'),
      createText('📍 Community Sports Center', 340, 750, 22, '#ffffffbb', 'normal'),
      createText('FREE ADMISSION', 390, 850, 28, '#22c55e', 'bold'),
      createText('Food • Games • Prizes • Fun for all ages!', 190, 920, 20, '#ffffffaa', 'normal'),
    ],
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
    elements: [
      createText('🎯', 490, 80, 100, '#ffffff', 'bold'),
      createText('HELP US REACH', 290, 250, 36, '#ffffffcc', 'normal'),
      createText('$10,000', 290, 310, 96, '#22c55e', 'bold'),
      createText('FOR NEW EQUIPMENT', 240, 430, 32, '#ffffffcc', 'normal'),
      createShape(140, 520, 800, 40, '#ffffff22', 20),
      createShape(140, 520, 480, 40, '#22c55e', 20), // Progress bar
      createText('$6,000 raised so far!', 390, 590, 24, '#ffffff', 'bold'),
      createText("Your support helps our young athletes succeed. Every dollar counts toward new uniforms, equipment, and training facilities.", 140, 680, 20, '#ffffffbb', 'normal', 'center', 800),
      createShape(340, 820, 400, 60, '#ffffff', 30),
      createText('DONATE TODAY', 415, 838, 24, '#064e3b', 'bold'),
      createText('Scan QR code or visit teamfund.org/donate', 290, 920, 18, '#ffffffaa', 'normal'),
    ],
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
    elements: [
      createText('GAME DAY', 290, 60, 48, '#fbbf24', 'bold'),
      createShape(140, 200, 350, 350, '#1e3a5f', 24),
      createText('HOME', 240, 420, 32, '#ffffff', 'bold'),
      createShape(590, 200, 350, 350, '#7f1d1d', 24),
      createText('AWAY', 690, 420, 32, '#ffffff', 'bold'),
      createText('VS', 480, 340, 72, '#fbbf24', 'bold'),
      createText('Saturday, March 22nd', 340, 620, 28, '#ffffff', 'normal'),
      createText('7:00 PM', 440, 680, 48, '#fbbf24', 'bold'),
      createText('📍 Main Stadium', 390, 780, 24, '#ffffffbb', 'normal'),
      createShape(290, 860, 500, 60, '#fbbf24', 30),
      createText('GET YOUR TICKETS', 365, 878, 24, '#171717', 'bold'),
    ],
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
    elements: [
      createText('⚠️', 490, 100, 100, '#ffffff', 'bold'),
      createText('IMPORTANT', 340, 280, 48, '#fbbf24', 'bold'),
      createText('ANNOUNCEMENT', 240, 350, 56, '#ffffff', 'bold'),
      createShape(140, 450, 800, 4, '#fbbf24'),
      createText('Practice schedule has been updated. Please check the team app for new times and locations.', 140, 520, 28, '#ffffffdd', 'normal', 'center', 800),
      createText('Effective: January 15, 2025', 340, 680, 24, '#ffffffbb', 'normal'),
      createText('Questions? Contact Coach Smith', 290, 750, 20, '#ffffffaa', 'normal'),
      createShape(340, 850, 400, 56, '#ffffff', 28),
      createText('VIEW SCHEDULE', 400, 866, 22, '#7f1d1d', 'bold'),
    ],
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
    elements: [
      createText('🎉', 490, 100, 100, '#ffffff', 'bold'),
      createText('CONGRATULATIONS', 190, 280, 52, '#fbbf24', 'bold'),
      createText('PLAYER NAME', 240, 400, 64, '#ffffff', 'bold'),
      createShape(340, 520, 400, 4, '#8b5cf6'),
      createText('MVP of the Week', 340, 580, 36, '#a78bfa', 'bold'),
      createText('Outstanding performance with 25 points, 10 assists, and a game-winning shot!', 140, 680, 22, '#ffffffcc', 'normal', 'center', 800),
      createText('#TeamPride #MVP #Champions', 290, 850, 20, '#8b5cf6', 'normal'),
      createText('@YourTeamName', 390, 920, 24, '#ffffffaa', 'normal'),
    ],
  },

  // STORY TEMPLATES
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
    elements: [
      createText('⏱️', 440, 300, 150, '#ffffff', 'bold'),
      createText('ONLY', 440, 550, 48, '#ffffffcc', 'normal'),
      createText('3 DAYS', 290, 650, 96, '#38bdf8', 'bold'),
      createText('LEFT!', 440, 780, 48, '#ffffffcc', 'normal'),
      createShape(240, 920, 600, 4, '#38bdf8'),
      createText('Registration closes Friday', 240, 1000, 32, '#ffffff', 'normal'),
      createText("Don't miss out on the 2025 season!", 190, 1100, 24, '#ffffffbb', 'normal'),
      createShape(290, 1250, 500, 80, '#38bdf8', 40),
      createText('REGISTER NOW', 365, 1275, 28, '#0c4a6e', 'bold'),
      createText('Swipe up to sign up', 340, 1500, 24, '#ffffffaa', 'normal'),
    ],
  },
];

// Get templates by category
export const getTemplatesByCategory = (category: string): DesignTemplate[] => {
  if (category === 'all') return DESIGN_TEMPLATES;
  return DESIGN_TEMPLATES.filter(t => t.category === category);
};

// Get a single template by ID
export const getTemplateById = (id: string): DesignTemplate | undefined => {
  return DESIGN_TEMPLATES.find(t => t.id === id);
};
