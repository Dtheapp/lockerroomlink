import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, UserProfile } from '../../types';
import { 
    BarChart3, Users, Shield, TrendingUp, TrendingDown, Minus,
    Trophy, MessageCircle, FileText, ChevronDown, ChevronUp,
    Download, Search, Filter, ArrowUpDown, Activity, UserCheck
} from 'lucide-react';

interface TeamStats {
    team: Team;
    coachName: string;
    userCount: number;
    playerCount: number;
    postCount: number;
    messageCount: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
    engagementScore: number;
}

type SortField = 'name' | 'users' | 'players' | 'posts' | 'messages' | 'winRate' | 'engagement';
type SortDirection = 'asc' | 'desc';

const TeamReports: React.FC = () => {
    const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
    const [filterCoachless, setFilterCoachless] = useState(false);

    useEffect(() => {
        fetchAllTeamStats();
    }, []);

    const fetchAllTeamStats = async () => {
        setLoading(true);
        try {
            // Fetch all teams
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));

            // Fetch all users for coach lookup and user counts
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
            
            const coachLookup: { [key: string]: string } = {};
            const userCountByTeam: { [key: string]: number } = {};
            
            users.forEach(user => {
                if (user.role === 'Coach') {
                    coachLookup[user.uid] = user.name || user.username || 'Unknown Coach';
                }
                if (user.teamId) {
                    userCountByTeam[user.teamId] = (userCountByTeam[user.teamId] || 0) + 1;
                }
            });

            // Fetch stats for each team
            const statsPromises = teams.map(async (team) => {
                // Player count
                const playersSnapshot = await getDocs(collection(db, 'teams', team.id, 'players'));
                const playerCount = playersSnapshot.size;

                // Post count
                const postsSnapshot = await getDocs(collection(db, 'teams', team.id, 'bulletin'));
                const postCount = postsSnapshot.size;

                // Message count
                const messagesSnapshot = await getDocs(collection(db, 'teams', team.id, 'messages'));
                const messageCount = messagesSnapshot.size;

                // Record
                const wins = team.record?.wins || 0;
                const losses = team.record?.losses || 0;
                const ties = team.record?.ties || 0;
                const totalGames = wins + losses + ties;
                const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

                // Engagement score (weighted formula)
                const userCount = userCountByTeam[team.id] || 0;
                const engagementScore = Math.min(100, Math.round(
                    (playerCount * 2) + 
                    (userCount * 3) + 
                    (postCount * 5) + 
                    (messageCount * 0.5)
                ));

                return {
                    team,
                    coachName: team.coachId ? coachLookup[team.coachId] || 'Unknown' : 'No Coach',
                    userCount,
                    playerCount,
                    postCount,
                    messageCount,
                    wins,
                    losses,
                    ties,
                    winRate,
                    engagementScore
                } as TeamStats;
            });

            const allStats = await Promise.all(statsPromises);
            setTeamStats(allStats);
        } catch (error) {
            console.error('Error fetching team stats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Sorting and filtering
    const filteredAndSortedStats = teamStats
        .filter(stat => {
            const matchesSearch = stat.team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                stat.team.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                stat.coachName.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = !filterCoachless || !stat.team.coachId;
            return matchesSearch && matchesFilter;
        })
        .sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'name': comparison = a.team.name.localeCompare(b.team.name); break;
                case 'users': comparison = a.userCount - b.userCount; break;
                case 'players': comparison = a.playerCount - b.playerCount; break;
                case 'posts': comparison = a.postCount - b.postCount; break;
                case 'messages': comparison = a.messageCount - b.messageCount; break;
                case 'winRate': comparison = a.winRate - b.winRate; break;
                case 'engagement': comparison = a.engagementScore - b.engagementScore; break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

    // Aggregate stats
    const totals = teamStats.reduce((acc, stat) => ({
        users: acc.users + stat.userCount,
        players: acc.players + stat.playerCount,
        posts: acc.posts + stat.postCount,
        messages: acc.messages + stat.messageCount,
        wins: acc.wins + stat.wins,
        losses: acc.losses + stat.losses,
    }), { users: 0, players: 0, posts: 0, messages: 0, wins: 0, losses: 0 });

    const avgEngagement = teamStats.length > 0 
        ? Math.round(teamStats.reduce((sum, s) => sum + s.engagementScore, 0) / teamStats.length)
        : 0;

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const exportToCSV = () => {
        const headers = ['Team Name', 'Team ID', 'Coach', 'Users', 'Players', 'Posts', 'Messages', 'Wins', 'Losses', 'Ties', 'Win Rate', 'Engagement'];
        const rows = filteredAndSortedStats.map(stat => [
            stat.team.name,
            stat.team.id,
            stat.coachName,
            stat.userCount,
            stat.playerCount,
            stat.postCount,
            stat.messageCount,
            stat.wins,
            stat.losses,
            stat.ties,
            `${stat.winRate}%`,
            stat.engagementScore
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `team-reports-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const SortHeader: React.FC<{ field: SortField; label: string; className?: string }> = ({ field, label, className }) => (
        <th 
            className={`px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors ${className || ''}`}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortField === field && (
                    <ArrowUpDown className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                )}
            </div>
        </th>
    );

    const getEngagementColor = (score: number) => {
        if (score >= 70) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30';
        if (score >= 40) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
    };

    const getWinRateIcon = (winRate: number) => {
        if (winRate >= 60) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
        if (winRate >= 40) return <Minus className="w-4 h-4 text-yellow-500" />;
        return <TrendingDown className="w-4 h-4 text-red-500" />;
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-orange-500" />
                        Team Reports
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Aggregated analytics and performance metrics across all teams
                    </p>
                </div>
                <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
                >
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                        <Shield className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Teams</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{teamStats.length}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Users</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.users}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                        <UserCheck className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Players</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.players}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Posts</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.posts}</p>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-1">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Messages</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.messages}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Avg Engagement</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{avgEngagement}</p>
                </div>
            </div>

            {/* Leaderboard Cards */}
            <div className="grid md:grid-cols-3 gap-4">
                {/* Most Engaged */}
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-4">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" /> Most Engaged
                    </h3>
                    <div className="space-y-2">
                        {[...teamStats].sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 3).map((stat, i) => (
                            <div key={stat.team.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-zinc-900">
                                <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                        i === 0 ? 'bg-yellow-400 text-yellow-900' : 
                                        i === 1 ? 'bg-slate-300 text-slate-700' : 
                                        'bg-orange-300 text-orange-800'
                                    }`}>{i + 1}</span>
                                    <span className="font-medium text-slate-900 dark:text-white truncate">{stat.team.name}</span>
                                </div>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{stat.engagementScore}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Best Win Rate */}
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-4">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Best Win Rate
                    </h3>
                    <div className="space-y-2">
                        {[...teamStats].filter(s => (s.wins + s.losses + s.ties) > 0).sort((a, b) => b.winRate - a.winRate).slice(0, 3).map((stat, i) => (
                            <div key={stat.team.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-zinc-900">
                                <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                        i === 0 ? 'bg-yellow-400 text-yellow-900' : 
                                        i === 1 ? 'bg-slate-300 text-slate-700' : 
                                        'bg-orange-300 text-orange-800'
                                    }`}>{i + 1}</span>
                                    <span className="font-medium text-slate-900 dark:text-white truncate">{stat.team.name}</span>
                                </div>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{stat.winRate}%</span>
                            </div>
                        ))}
                        {teamStats.filter(s => (s.wins + s.losses + s.ties) > 0).length === 0 && (
                            <p className="text-sm text-slate-500 italic text-center py-4">No games recorded yet</p>
                        )}
                    </div>
                </div>

                {/* Most Active (Messages) */}
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-4">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-cyan-500" /> Most Messages
                    </h3>
                    <div className="space-y-2">
                        {[...teamStats].sort((a, b) => b.messageCount - a.messageCount).slice(0, 3).map((stat, i) => (
                            <div key={stat.team.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-zinc-900">
                                <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                        i === 0 ? 'bg-yellow-400 text-yellow-900' : 
                                        i === 1 ? 'bg-slate-300 text-slate-700' : 
                                        'bg-orange-300 text-orange-800'
                                    }`}>{i + 1}</span>
                                    <span className="font-medium text-slate-900 dark:text-white truncate">{stat.team.name}</span>
                                </div>
                                <span className="font-bold text-cyan-600 dark:text-cyan-400">{stat.messageCount}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search teams..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>
                <button
                    onClick={() => setFilterCoachless(!filterCoachless)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        filterCoachless 
                            ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                            : 'bg-white dark:bg-zinc-950 border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900'
                    }`}
                >
                    <Filter className="w-4 h-4" />
                    Without Coach
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                {/* Mobile View */}
                <div className="md:hidden divide-y divide-slate-200 dark:divide-zinc-800">
                    {filteredAndSortedStats.length === 0 ? (
                        <p className="p-8 text-center text-slate-500">No teams found</p>
                    ) : filteredAndSortedStats.map(stat => (
                        <div key={stat.team.id} className="p-4">
                            <div 
                                className="flex items-start justify-between cursor-pointer"
                                onClick={() => setExpandedTeam(expandedTeam === stat.team.id ? null : stat.team.id)}
                            >
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{stat.team.name}</h3>
                                    <p className="text-xs text-slate-500 font-mono">{stat.team.id}</p>
                                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">{stat.coachName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getEngagementColor(stat.engagementScore)}`}>
                                        {stat.engagementScore}
                                    </span>
                                    {expandedTeam === stat.team.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                            </div>
                            {expandedTeam === stat.team.id && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800 grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-slate-500 text-xs">Users</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{stat.userCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs">Players</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{stat.playerCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs">Posts</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{stat.postCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs">Messages</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{stat.messageCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs">Record</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{stat.wins}W-{stat.losses}L-{stat.ties}T</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs">Win Rate</p>
                                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                            {stat.winRate}% {getWinRateIcon(stat.winRate)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 uppercase text-xs">
                            <tr>
                                <SortHeader field="name" label="Team" className="text-left" />
                                <th className="px-4 py-3 text-left">Coach</th>
                                <SortHeader field="users" label="Users" />
                                <SortHeader field="players" label="Players" />
                                <SortHeader field="posts" label="Posts" />
                                <SortHeader field="messages" label="Messages" />
                                <th className="px-4 py-3">Record</th>
                                <SortHeader field="winRate" label="Win %" />
                                <SortHeader field="engagement" label="Engagement" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                            {filteredAndSortedStats.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-500">No teams found</td>
                                </tr>
                            ) : filteredAndSortedStats.map(stat => (
                                <tr key={stat.team.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-900 dark:text-white">{stat.team.name}</div>
                                        <div className="text-xs text-slate-500 font-mono">{stat.team.id}</div>
                                    </td>
                                    <td className="px-4 py-3 text-orange-600 dark:text-orange-400 font-medium">
                                        {stat.coachName}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium text-slate-900 dark:text-white">
                                        {stat.userCount}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium text-slate-900 dark:text-white">
                                        {stat.playerCount}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium text-slate-900 dark:text-white">
                                        {stat.postCount}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium text-slate-900 dark:text-white">
                                        {stat.messageCount}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-slate-900 dark:text-white font-medium">
                                            {stat.wins}-{stat.losses}-{stat.ties}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="flex items-center justify-center gap-1 font-medium text-slate-900 dark:text-white">
                                            {stat.winRate}% {getWinRateIcon(stat.winRate)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getEngagementColor(stat.engagementScore)}`}>
                                            {stat.engagementScore}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Stats */}
            <div className="text-sm text-slate-500 dark:text-slate-400">
                Showing {filteredAndSortedStats.length} of {teamStats.length} teams
            </div>
        </div>
    );
};

export default TeamReports;
