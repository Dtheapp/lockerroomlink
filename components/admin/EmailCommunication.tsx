import React, { useState, useEffect } from 'react';
import { 
    collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit,
    Timestamp, where
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Team, UserProfile } from '../../types';
import { 
    Mail, Send, Users, Shield, CheckSquare, Square, X, Globe,
    Target, History, Clock, AlertTriangle, User, Filter,
    ChevronDown, ChevronUp, Inbox, FileText, Loader2
} from 'lucide-react';

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
}

interface EmailLog {
    id: string;
    subject: string;
    recipientCount: number;
    targetType: string;
    sentBy: string;
    sentAt: Timestamp;
}

type RecipientType = 'all' | 'coaches' | 'parents' | 'team' | 'custom';

const EMAIL_TEMPLATES: EmailTemplate[] = [
    {
        id: 'welcome',
        name: 'Welcome Message',
        subject: 'Welcome to Locker Room Link!',
        body: `Hello {name},

Welcome to Locker Room Link! We're excited to have you join our community.

Here are some things you can do:
• Check your team's dashboard for updates
• View the roster and connect with other parents/coaches
• Chat with your team members
• Stay updated with announcements

If you have any questions, feel free to reach out.

Best regards,
The Locker Room Link Team`
    },
    {
        id: 'reminder',
        name: 'General Reminder',
        subject: 'Reminder from Locker Room Link',
        body: `Hello {name},

This is a friendly reminder from Locker Room Link.

{custom_message}

Thank you,
The Locker Room Link Team`
    },
    {
        id: 'update',
        name: 'Important Update',
        subject: 'Important Update - Locker Room Link',
        body: `Hello {name},

We have an important update to share with you:

{custom_message}

Please log in to your account to learn more.

Thank you,
The Locker Room Link Team`
    },
    {
        id: 'maintenance',
        name: 'Maintenance Notice',
        subject: 'Scheduled Maintenance - Locker Room Link',
        body: `Hello {name},

We will be performing scheduled maintenance on Locker Room Link.

{custom_message}

We apologize for any inconvenience and appreciate your patience.

Thank you,
The Locker Room Link Team`
    }
];

const EmailCommunication: React.FC = () => {
    const { userData } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    
    // Form State
    const [recipientType, setRecipientType] = useState<RecipientType>('all');
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    
    // UI State
    const [showUserSelector, setShowUserSelector] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch users (excluding SuperAdmins)
            const usersQuery = query(collection(db, 'users'), where('role', '!=', 'SuperAdmin'));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
            setUsers(usersData);

            // Fetch teams
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const teamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
            setTeams(teamsData);

            // Fetch email logs
            const logsQuery = query(
                collection(db, 'emailLogs'),
                orderBy('sentAt', 'desc'),
                limit(20)
            );
            const logsSnapshot = await getDocs(logsQuery);
            const logsData = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailLog));
            setEmailLogs(logsData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getRecipients = (): UserProfile[] => {
        switch (recipientType) {
            case 'all':
                return users;
            case 'coaches':
                return users.filter(u => u.role === 'Coach');
            case 'parents':
                return users.filter(u => u.role === 'Parent');
            case 'team':
                return users.filter(u => u.teamId === selectedTeam);
            case 'custom':
                return users.filter(u => selectedUsers.has(u.uid));
            default:
                return [];
        }
    };

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplate(templateId);
        const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            setSubject(template.subject);
            setBody(template.body);
        }
    };

    const toggleUserSelection = (userId: string) => {
        const newSelection = new Set(selectedUsers);
        if (newSelection.has(userId)) {
            newSelection.delete(userId);
        } else {
            newSelection.add(userId);
        }
        setSelectedUsers(newSelection);
    };

    const handleSend = async () => {
        setError('');
        setSuccess('');

        if (!subject.trim()) {
            setError('Subject is required');
            return;
        }
        if (!body.trim()) {
            setError('Email body is required');
            return;
        }

        const recipients = getRecipients();
        if (recipients.length === 0) {
            setError('No recipients selected');
            return;
        }

        setSending(true);

        try {
            // Process body with custom message
            const processedBody = body.replace('{custom_message}', customMessage);

            // In a real app, this would call a Cloud Function to send emails
            // For now, we'll simulate the email sending and log it
            
            // Log each "email" to a collection (in production, this would trigger actual emails)
            const emailBatch = recipients.map(recipient => ({
                to: recipient.email,
                subject: subject,
                body: processedBody.replace('{name}', recipient.name || 'User'),
                recipientId: recipient.uid,
                recipientName: recipient.name,
                status: 'queued', // In production: 'sent', 'failed', 'bounced'
                createdAt: serverTimestamp()
            }));

            // Store in emailQueue collection (would be processed by Cloud Function)
            for (const email of emailBatch) {
                await addDoc(collection(db, 'emailQueue'), email);
            }

            // Log the batch send
            await addDoc(collection(db, 'emailLogs'), {
                subject: subject,
                recipientCount: recipients.length,
                targetType: recipientType === 'all' ? 'All Users' : 
                           recipientType === 'coaches' ? 'All Coaches' :
                           recipientType === 'parents' ? 'All Parents' :
                           recipientType === 'team' ? `Team: ${teams.find(t => t.id === selectedTeam)?.name || selectedTeam}` :
                           `${selectedUsers.size} Selected Users`,
                sentBy: userData?.name || 'Unknown',
                sentAt: serverTimestamp()
            });

            // Log activity
            await addDoc(collection(db, 'adminActivityLog'), {
                action: 'EMAIL',
                targetType: 'communication',
                targetId: 'batch',
                details: `Sent email "${subject}" to ${recipients.length} recipients (${recipientType})`,
                performedBy: userData?.uid || 'unknown',
                performedByName: userData?.name || 'Unknown Admin',
                timestamp: serverTimestamp()
            });

            setSuccess(`Email queued for ${recipients.length} recipients!`);
            
            // Reset form
            setSubject('');
            setBody('');
            setCustomMessage('');
            setSelectedTemplate('');
            setSelectedUsers(new Set());
            
            // Refresh logs
            fetchData();
        } catch (err) {
            console.error('Error sending emails:', err);
            setError('Failed to send emails. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const filteredUsers = users.filter(u => 
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );

    const formatDate = (timestamp: Timestamp | undefined) => {
        if (!timestamp) return 'Unknown';
        return timestamp.toDate().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const recipientCount = getRecipients().length;

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
                        <Mail className="w-8 h-8 text-orange-500" />
                        Email Communication
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Send email notifications to users and teams
                    </p>
                </div>
                <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${
                        showHistory 
                            ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                            : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-800'
                    }`}
                >
                    <History className="w-4 h-4" />
                    {showHistory ? 'Hide History' : 'View History'}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Total Users</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{users.length}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                        <User className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Coaches</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                        {users.filter(u => u.role === 'Coach').length}
                    </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Parents</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                        {users.filter(u => u.role === 'Parent').length}
                    </p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                        <Inbox className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Emails Sent</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{emailLogs.length}</p>
                </div>
            </div>

            {/* Email History */}
            {showHistory && (
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <History className="w-5 h-5 text-orange-500" /> Recent Email History
                        </h2>
                    </div>
                    {emailLogs.length === 0 ? (
                        <p className="p-8 text-center text-slate-500">No emails sent yet</p>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-zinc-800">
                            {emailLogs.map(log => (
                                <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{log.subject}</p>
                                            <p className="text-sm text-slate-500 mt-1">
                                                To: {log.targetType} • {log.recipientCount} recipients
                                            </p>
                                        </div>
                                        <div className="text-right text-sm text-slate-500">
                                            <p>{log.sentBy}</p>
                                            <p className="flex items-center gap-1 justify-end">
                                                <Clock className="w-3 h-3" /> {formatDate(log.sentAt)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Compose Email */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                    <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-orange-500" /> Compose Email
                    </h2>
                </div>
                
                <div className="p-5 space-y-5">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2">
                            <Mail className="w-5 h-5" /> {success}
                        </div>
                    )}

                    {/* Recipients */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Recipients
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[
                                { type: 'all' as const, label: 'All Users', icon: Globe },
                                { type: 'coaches' as const, label: 'Coaches', icon: User },
                                { type: 'parents' as const, label: 'Parents', icon: Users },
                                { type: 'team' as const, label: 'Specific Team', icon: Shield },
                                { type: 'custom' as const, label: 'Select Users', icon: Target },
                            ].map(({ type, label, icon: Icon }) => (
                                <button
                                    key={type}
                                    onClick={() => setRecipientType(type)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                        recipientType === type
                                            ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                                            : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" /> {label}
                                </button>
                            ))}
                        </div>

                        {/* Team Selector */}
                        {recipientType === 'team' && (
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white"
                            >
                                <option value="">Select a team...</option>
                                {teams.map(team => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                            </select>
                        )}

                        {/* Custom User Selector */}
                        {recipientType === 'custom' && (
                            <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                                <div 
                                    className="p-3 bg-slate-50 dark:bg-zinc-900 flex items-center justify-between cursor-pointer"
                                    onClick={() => setShowUserSelector(!showUserSelector)}
                                >
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {selectedUsers.size} users selected
                                    </span>
                                    {showUserSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                                {showUserSelector && (
                                    <div className="border-t border-slate-200 dark:border-zinc-800">
                                        <div className="p-2">
                                            <input
                                                type="text"
                                                placeholder="Search users..."
                                                value={userSearch}
                                                onChange={(e) => setUserSearch(e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded text-sm text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                                            {filteredUsers.map(user => (
                                                <button
                                                    key={user.uid}
                                                    onClick={() => toggleUserSelection(user.uid)}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-left"
                                                >
                                                    {selectedUsers.has(user.uid) ? (
                                                        <CheckSquare className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
                                                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                                    </div>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                        user.role === 'Coach' 
                                                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Recipient Count */}
                        <p className="text-sm text-slate-500 mt-2">
                            📧 {recipientCount} recipient{recipientCount !== 1 ? 's' : ''} will receive this email
                        </p>
                    </div>

                    {/* Template */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Email Template (optional)
                        </label>
                        <select
                            value={selectedTemplate}
                            onChange={(e) => handleTemplateChange(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white"
                        >
                            <option value="">Start from scratch...</option>
                            {EMAIL_TEMPLATES.map(template => (
                                <option key={template.id} value={template.id}>{template.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Subject *
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Email subject line..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
                        />
                    </div>

                    {/* Custom Message (for templates with placeholder) */}
                    {body.includes('{custom_message}') && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Custom Message
                            </label>
                            <textarea
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                placeholder="Enter your custom message..."
                                rows={3}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 resize-none"
                            />
                        </div>
                    )}

                    {/* Body */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Email Body *
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Write your email message..."
                            rows={8}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 resize-none font-mono text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Use <code className="bg-slate-100 dark:bg-zinc-800 px-1 rounded">{'{name}'}</code> to personalize with recipient's name
                        </p>
                    </div>

                    {/* Preview */}
                    {(subject || body) && (
                        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <div className="p-3 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
                                <p className="text-xs text-slate-500 uppercase font-bold">Preview</p>
                            </div>
                            <div className="p-4">
                                <p className="font-bold text-slate-900 dark:text-white mb-2">{subject || '(No subject)'}</p>
                                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {body.replace('{name}', 'John Doe').replace('{custom_message}', customMessage || '[Custom message]')}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Send Button */}
                    <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-zinc-800">
                        <button
                            onClick={handleSend}
                            disabled={sending || recipientCount === 0}
                            className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
                            ) : (
                                <><Send className="w-5 h-5" /> Send to {recipientCount} Recipient{recipientCount !== 1 ? 's' : ''}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Note about email functionality */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-blue-800 dark:text-blue-300">Email Queue System</p>
                        <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                            Emails are queued in the database and would be processed by a Cloud Function in production. 
                            This system allows you to compose and target emails to specific user groups.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailCommunication;
