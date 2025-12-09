/**
 * OSYS Referee Assign Modal
 * For league owners/commissioners to assign referees to games
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { searchReferees, assignRefereeToGame, getGameReferees } from '../../services/refereeService';
import {
  X,
  Search,
  UserPlus,
  Star,
  MapPin,
  Check,
  Shield,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { RefereeProfile, RefereeAssignment, RefereeRole, RefereeSearchFilters } from '../../types/referee';
import type { SportType } from '../../types';

interface GameInfo {
  id: string;
  type: 'league' | 'team';
  sport: SportType;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  gameDate: Date | Timestamp;
  gameTime?: string;
  location?: string;
  fieldNumber?: string;
  leagueId?: string;
  leagueName?: string;
  seasonId?: string;
  seasonName?: string;
  scheduleId?: string;
  teamId?: string;
  teamName?: string;
  ageGroup?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  game: GameInfo;
  onAssigned?: () => void;
}

export const RefereeAssignModal: React.FC<Props> = ({ isOpen, onClose, game, onAssigned }) => {
  const { user, userData } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [referees, setReferees] = useState<(RefereeProfile & { id: string; userName: string })[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<RefereeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  
  // Assignment form
  const [selectedReferee, setSelectedReferee] = useState<(RefereeProfile & { id: string; userName: string }) | null>(null);
  const [role, setRole] = useState<RefereeRole>('official');
  const [position, setPosition] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [notes, setNotes] = useState('');
  
  // Filters
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, game]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [refs, existing] = await Promise.all([
        searchReferees({ sport: game.sport, verifiedOnly }),
        getGameReferees(game.type, game.id),
      ]);
      setReferees(refs);
      setExistingAssignments(existing);
    } catch (error) {
      console.error('Error loading referees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const filters: RefereeSearchFilters = {
        sport: game.sport,
        verifiedOnly,
        availableOnly: true,
      };
      const refs = await searchReferees(filters);
      setReferees(refs);
    } catch (error) {
      console.error('Error searching referees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedReferee || !user || !userData) return;

    const alreadyAssigned = existingAssignments.some(
      (a) => a.refereeId === selectedReferee.id && a.status !== 'cancelled' && a.status !== 'declined'
    );

    if (alreadyAssigned) {
      alert('This referee is already assigned to this game');
      return;
    }

    setAssigning(selectedReferee.id);
    try {
      const gameDate = game.gameDate instanceof Timestamp 
        ? game.gameDate 
        : Timestamp.fromDate(new Date(game.gameDate));

      await assignRefereeToGame({
        refereeId: selectedReferee.id,
        refereeName: selectedReferee.userName,
        gameType: game.type,
        leagueId: game.leagueId,
        leagueName: game.leagueName,
        seasonId: game.seasonId,
        seasonName: game.seasonName,
        leagueScheduleId: game.scheduleId,
        leagueGameId: game.type === 'league' ? game.id : undefined,
        teamId: game.teamId,
        teamName: game.teamName,
        teamGameId: game.type === 'team' ? game.id : undefined,
        role: role,
        position: position || undefined,
        notes: notes || undefined,
        assignedBy: user.uid,
        assignedByName: userData.name,
        assignedByRole: userData.role as any,
        assignedAt: Timestamp.now(),
        gameDate,
        gameTime: game.gameTime || '',
        location: game.location || '',
        fieldNumber: game.fieldNumber,
        homeTeamId: game.homeTeamId,
        homeTeamName: game.homeTeamName,
        awayTeamId: game.awayTeamId,
        awayTeamName: game.awayTeamName,
        sport: game.sport,
        ageGroup: game.ageGroup,
        paymentAmount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        paymentStatus: paymentAmount ? 'pending' : undefined,
      });

      // Reset form
      setSelectedReferee(null);
      setRole('official');
      setPosition('');
      setPaymentAmount('');
      setNotes('');
      
      // Refresh existing assignments
      const existing = await getGameReferees(game.type, game.id);
      setExistingAssignments(existing);
      
      onAssigned?.();
    } catch (error) {
      console.error('Error assigning referee:', error);
      alert('Failed to assign referee');
    } finally {
      setAssigning(null);
    }
  };

  const filteredReferees = referees.filter((ref) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return ref.userName.toLowerCase().includes(q) || ref.bio?.toLowerCase().includes(q);
  });

  const isAlreadyAssigned = (refereeId: string) => {
    return existingAssignments.some(
      (a) => a.refereeId === refereeId && a.status !== 'cancelled' && a.status !== 'declined'
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Assign Referee</h2>
            <p className="text-slate-400 text-sm mt-1">
              {game.homeTeamName} vs {game.awayTeamName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left: Referee List */}
          <div className="w-full md:w-1/2 border-r border-slate-800 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-slate-800">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search referees..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => {
                    setVerifiedOnly(e.target.checked);
                    handleSearch();
                  }}
                  className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-600"
                />
                Show verified only
              </label>
            </div>

            {/* Referee List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : filteredReferees.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No referees found</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : (
                filteredReferees.map((ref) => {
                  const assigned = isAlreadyAssigned(ref.id);
                  return (
                    <button
                      key={ref.id}
                      onClick={() => !assigned && setSelectedReferee(ref)}
                      disabled={assigned}
                      className={`w-full p-4 rounded-xl text-left transition-all ${
                        selectedReferee?.id === ref.id
                          ? 'bg-blue-600/20 border-2 border-blue-500'
                          : assigned
                          ? 'bg-slate-800/30 border-2 border-slate-700 opacity-50'
                          : 'bg-slate-800/50 border-2 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{ref.userName}</span>
                            {ref.verificationStatus === 'verified' && (
                              <Shield className="w-4 h-4 text-green-400" />
                            )}
                            {assigned && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                Assigned
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                            <span>{ref.yearsExperience} years exp</span>
                            {ref.averageRating && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-yellow-400" />
                                {ref.averageRating.toFixed(1)}
                              </span>
                            )}
                            {ref.homeLocation && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {ref.homeLocation.city}, {ref.homeLocation.state}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            {ref.totalGamesReffed} games total
                          </p>
                        </div>
                        {selectedReferee?.id === ref.id && (
                          <Check className="w-5 h-5 text-blue-400 shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Assignment Form */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto">
            {selectedReferee ? (
              <div className="space-y-6">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {selectedReferee.userName}
                  </h3>
                  {selectedReferee.bio && (
                    <p className="text-sm text-slate-400 mb-3">{selectedReferee.bio}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selectedReferee.sports.map((sport) => (
                      <span
                        key={sport}
                        className={`px-2 py-1 rounded text-xs capitalize ${
                          sport === game.sport
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {sport}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as RefereeRole)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="official">Official</option>
                    <option value="head">Head Referee</option>
                    <option value="assistant">Assistant</option>
                    <option value="line_judge">Line Judge</option>
                    <option value="scorer">Scorer</option>
                    <option value="timekeeper">Timekeeper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Position (Optional)</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g., Center Referee, Line Judge 1"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Payment Amount (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="e.g., 50"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions for the referee..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleAssign}
                  disabled={assigning === selectedReferee.id}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assigning === selectedReferee.id ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Send Assignment Request
                    </>
                  )}
                </button>

                <p className="text-sm text-slate-500 text-center">
                  The referee will receive a request they must accept before being confirmed
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <UserPlus className="w-16 h-16 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Select a Referee</h3>
                <p className="text-slate-400 text-sm">
                  Choose a referee from the list to assign them to this game
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Existing Assignments */}
        {existingAssignments.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-800/30">
            <h4 className="text-sm font-medium text-slate-400 mb-2">
              Currently Assigned ({existingAssignments.filter(a => a.status !== 'cancelled' && a.status !== 'declined').length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {existingAssignments
                .filter(a => a.status !== 'cancelled' && a.status !== 'declined')
                .map((a) => (
                  <div
                    key={a.id}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                      a.status === 'accepted'
                        ? 'bg-green-500/20 text-green-400'
                        : a.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {a.refereeName}
                    <span className="text-xs opacity-70 capitalize">({a.status})</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RefereeAssignModal;
