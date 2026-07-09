/**
 * PracticeItinerary
 * Reusable time-block itinerary builder + read-only timeline for practice events.
 *
 * - PracticeItineraryEditor: coaches add/remove/edit time blocks (start, end, activity)
 * - PracticeItineraryTimeline: read-only display shown to players/parents on event details
 *
 * This is how real teams run practice: a schedule broken into timed segments
 * (e.g. Warmup 4:00–4:15, Individual Drills 4:15–4:45, Team Scrimmage 4:45–5:15).
 */

import React from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';

export interface PracticeTimeBlock {
  id: string;
  startTime: string; // HH:MM (24h)
  endTime: string;   // HH:MM (24h)
  activity: string;
}

// Create an empty block, defaulting its start to the previous block's end time
export const makeTimeBlock = (previousEnd?: string): PracticeTimeBlock => ({
  id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  startTime: previousEnd || '',
  endTime: '',
  activity: '',
});

// Convert HH:MM (24h) to a friendly 12h label
const to12Hour = (time24?: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? '00'} ${period}`;
};

// Duration in minutes between two HH:MM times (returns null if invalid)
const durationMinutes = (start?: string, end?: string): number | null => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : null;
};

interface EditorProps {
  value: PracticeTimeBlock[];
  onChange: (blocks: PracticeTimeBlock[]) => void;
  theme: 'dark' | 'light' | string;
}

export const PracticeItineraryEditor: React.FC<EditorProps> = ({ value, onChange, theme }) => {
  const isDark = theme === 'dark';
  const blocks = value || [];

  const inputClass = `w-full px-3 py-2 rounded-lg text-sm ${
    isDark
      ? 'bg-white/10 border border-white/20 text-white placeholder-slate-500'
      : 'bg-slate-100 border border-slate-300 text-zinc-900 placeholder-slate-400'
  }`;

  const addBlock = () => {
    const last = blocks[blocks.length - 1];
    onChange([...blocks, makeTimeBlock(last?.endTime)]);
  };

  const updateBlock = (id: string, patch: Partial<PracticeTimeBlock>) => {
    onChange(blocks.map(b => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={`flex items-center gap-2 text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <Clock className="w-4 h-4" />
          Practice Itinerary
        </label>
        <button
          type="button"
          onClick={addBlock}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Time Block
        </button>
      </div>

      {blocks.length === 0 && (
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Break practice into timed segments (warmup, drills, scrimmage...). Everyone sees the schedule on the event.
        </p>
      )}

      <div className="space-y-2">
        {blocks.map((block, index) => {
          const mins = durationMinutes(block.startTime, block.endTime);
          return (
            <div
              key={block.id}
              className={`p-3 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}
            >
              <div className="flex items-start gap-2">
                <div className={`mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-100 text-purple-700'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Start</label>
                      <input
                        type="time"
                        value={block.startTime}
                        onChange={e => updateBlock(block.id, { startTime: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>End</label>
                      <input
                        type="time"
                        value={block.endTime}
                        onChange={e => updateBlock(block.id, { endTime: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={block.activity}
                    onChange={e => updateBlock(block.id, { activity: e.target.value })}
                    placeholder="What are we doing? (e.g., Warmup & stretching)"
                    maxLength={200}
                    className={inputClass}
                  />
                  {mins !== null && (
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{mins} min</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className={`mt-1 p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-white/5' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'}`}
                  aria-label="Remove time block"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TimelineProps {
  blocks: PracticeTimeBlock[];
  theme: 'dark' | 'light' | string;
}

export const PracticeItineraryTimeline: React.FC<TimelineProps> = ({ blocks, theme }) => {
  const isDark = theme === 'dark';
  const items = (blocks || []).filter(b => b.startTime || b.activity);
  if (items.length === 0) return null;

  return (
    <div>
      <h5 className={`flex items-center gap-2 text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
        <Clock className="w-4 h-4" />
        Practice Itinerary
      </h5>
      <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
        {items.map((block, index) => {
          const mins = durationMinutes(block.startTime, block.endTime);
          return (
            <div
              key={block.id}
              className={`flex items-start gap-3 p-3 ${
                index !== items.length - 1 ? (isDark ? 'border-b border-white/10' : 'border-b border-slate-200') : ''
              }`}
            >
              <div className={`shrink-0 text-xs font-semibold tabular-nums pt-0.5 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                {to12Hour(block.startTime)}
                {block.endTime ? (
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}> – {to12Hour(block.endTime)}</span>
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{block.activity}</p>
                {mins !== null && (
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{mins} min</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
