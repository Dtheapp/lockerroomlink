import React, { useState, useEffect } from 'react';
import { X, FileText, Shield, BookOpen, Edit2, Save, AlertCircle } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { RulesDocument, Team, League } from '../types';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId?: string;
  leagueId?: string;
  canEdit?: boolean; // Whether current user can edit
  type: 'rules' | 'codeOfConduct';
}

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  teamId,
  leagueId,
  canEdit = false,
  type,
}) => {
  const { user, userData } = useAuth();
  const [document, setDocument] = useState<RulesDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<'team' | 'league' | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDocument();
    }
  }, [isOpen, teamId, leagueId, type]);

  const loadDocument = async () => {
    setLoading(true);
    setError('');
    
    try {
      // First check if we're loading from a league directly
      if (leagueId && !teamId) {
        const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
        if (leagueDoc.exists()) {
          const leagueData = leagueDoc.data() as League;
          const rulesDoc = type === 'rules' ? leagueData.rules : leagueData.codeOfConduct;
          setDocument(rulesDoc || null);
          setSource('league');
        }
      }
      // Loading for a team
      else if (teamId) {
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (teamDoc.exists()) {
          const teamData = teamDoc.data() as Team;
          const rulesDoc = type === 'rules' ? teamData.rules : teamData.codeOfConduct;
          
          // If team is in a league, check league rules
          if (teamData.leagueId && teamData.leagueStatus === 'active') {
            const leagueDoc = await getDoc(doc(db, 'leagues', teamData.leagueId));
            if (leagueDoc.exists()) {
              const leagueData = leagueDoc.data() as League;
              const leagueRulesDoc = type === 'rules' ? leagueData.rules : leagueData.codeOfConduct;
              
              // League rules take precedence if they exist
              if (leagueRulesDoc?.content) {
                setDocument({
                  ...leagueRulesDoc,
                  source: 'league',
                  leagueOverride: true,
                });
                setSource('league');
              } else {
                setDocument(rulesDoc || null);
                setSource(rulesDoc?.source || 'team');
              }
            } else {
              setDocument(rulesDoc || null);
              setSource(rulesDoc?.source || 'team');
            }
          } else {
            setDocument(rulesDoc || null);
            setSource(rulesDoc?.source || 'team');
          }
        }
      }
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditContent(document?.content || '');
    setEditTitle(document?.title || (type === 'rules' ? 'Rules' : 'Code of Conduct'));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!user?.uid || !editContent.trim()) return;
    
    setSaving(true);
    setError('');
    
    try {
      const updatedDoc: RulesDocument = {
        content: editContent.trim(),
        title: editTitle.trim() || (type === 'rules' ? 'Rules' : 'Code of Conduct'),
        updatedAt: serverTimestamp() as any,
        updatedBy: user.uid,
        updatedByName: userData?.name || 'Unknown',
        source: leagueId ? 'league' : 'team',
      };

      if (leagueId && !teamId) {
        // Updating league rules
        await updateDoc(doc(db, 'leagues', leagueId), {
          [type === 'rules' ? 'rules' : 'codeOfConduct']: updatedDoc,
          updatedAt: serverTimestamp(),
        });
      } else if (teamId) {
        // Updating team rules
        await updateDoc(doc(db, 'teams', teamId), {
          [type === 'rules' ? 'rules' : 'codeOfConduct']: {
            ...updatedDoc,
            source: 'team',
          },
          updatedAt: serverTimestamp(),
        });
      }
      
      setDocument(updatedDoc);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving document:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent('');
    setEditTitle('');
  };

  if (!isOpen) return null;

  const title = type === 'rules' ? 'Rules' : 'Code of Conduct';
  const icon = type === 'rules' ? <FileText size={20} /> : <Shield size={20} />;
  const isFromLeague = source === 'league' || document?.source === 'league';
  const canActuallyEdit = canEdit && (!isFromLeague || (leagueId && !teamId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? `Edit ${title}` : (document?.title || title)}
              </h2>
              {isFromLeague && !isEditing && (
                <span className="text-xs text-purple-400 flex items-center gap-1">
                  <BookOpen size={12} /> From League
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canActuallyEdit && !isEditing && (
              <button
                onClick={handleEdit}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 hover:text-white transition-colors"
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-400">
              <AlertCircle size={32} className="mb-2" />
              <p>{error}</p>
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder={type === 'rules' ? 'Team Rules' : 'Code of Conduct'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={15}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm resize-none"
                  placeholder={`Enter your ${type === 'rules' ? 'rules' : 'code of conduct'} here...\n\nYou can use:\n- Numbered lists (1. 2. 3.)\n- Bullet points (- or *)\n- **Bold text**\n- Headers (# Title)`}
                />
              </div>
            </div>
          ) : document?.content ? (
            <div className="prose prose-invert max-w-none">
              <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                {document.content}
              </div>
              {document.updatedAt && (
                <p className="text-xs text-slate-500 mt-6 pt-4 border-t border-zinc-800">
                  Last updated: {new Date((document.updatedAt as any)?.toDate?.() || document.updatedAt).toLocaleDateString()}
                  {document.updatedByName && ` by ${document.updatedByName}`}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              {icon}
              <p className="mt-3 text-center">
                No {title.toLowerCase()} have been added yet.
              </p>
              {canActuallyEdit && (
                <button
                  onClick={handleEdit}
                  className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Add {title}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer - only show when editing */}
        {isEditing && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 bg-zinc-900/50">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RulesModal;
