import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Settings, Save, RefreshCw, Shield, Users, Bell, 
    Database, AlertTriangle, Check, ToggleLeft, ToggleRight,
    Clock, FileText, MessageCircle, Lock, Unlock, Info
} from 'lucide-react';

interface AppConfig {
    // Registration Settings
    allowNewRegistrations: boolean;
    requireEmailVerification: boolean;
    defaultUserRole: 'Parent' | 'Coach';
    
    // Team Settings
    maxPlayersPerTeam: number;
    maxUsersPerTeam: number;
    allowCoachSelfRegistration: boolean;
    
    // Feature Toggles
    chatEnabled: boolean;
    videoLibraryEnabled: boolean;
    playbookEnabled: boolean;
    statsEnabled: boolean;
    messengerEnabled: boolean;
    
    // Content Settings
    maxBulletinPosts: number;
    maxChatMessages: number;
    
    // Maintenance Mode
    maintenanceMode: boolean;
    maintenanceMessage: string;
    
    // Last Updated
    lastUpdatedBy?: string;
    lastUpdatedAt?: any;
}

const defaultConfig: AppConfig = {
    allowNewRegistrations: true,
    requireEmailVerification: false,
    defaultUserRole: 'Parent',
    maxPlayersPerTeam: 30,
    maxUsersPerTeam: 50,
    allowCoachSelfRegistration: true,
    chatEnabled: true,
    videoLibraryEnabled: true,
    playbookEnabled: true,
    statsEnabled: true,
    messengerEnabled: true,
    maxBulletinPosts: 100,
    maxChatMessages: 500,
    maintenanceMode: false,
    maintenanceMessage: 'The app is currently undergoing maintenance. Please check back soon.'
};

const AppSettings: React.FC = () => {
    const { userData } = useAuth();
    const [config, setConfig] = useState<AppConfig>(defaultConfig);
    const [originalConfig, setOriginalConfig] = useState<AppConfig>(defaultConfig);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    useEffect(() => {
        // Check if config has changed
        setHasChanges(JSON.stringify(config) !== JSON.stringify(originalConfig));
    }, [config, originalConfig]);

    const loadConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const docRef = doc(db, 'appConfig', 'settings');
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data() as AppConfig;
                setConfig({ ...defaultConfig, ...data });
                setOriginalConfig({ ...defaultConfig, ...data });
            } else {
                // Document doesn't exist - use defaults and try to create it
                setConfig(defaultConfig);
                setOriginalConfig(defaultConfig);
                // Try to create the initial config doc
                try {
                    await setDoc(docRef, { ...defaultConfig, lastUpdatedAt: serverTimestamp() });
                } catch (createErr) {
                    // If we can't create, that's ok - we'll try again when saving
                    console.log('Could not create initial config doc, will create on first save');
                }
            }
        } catch (err: any) {
            console.error('Error loading config:', err);
            // If it's a permission error or doc doesn't exist, just use defaults
            if (err?.code === 'permission-denied' || err?.code === 'not-found') {
                setConfig(defaultConfig);
                setOriginalConfig(defaultConfig);
                // Don't show error - just use defaults
            } else {
                setError('Failed to load settings. Using defaults.');
                setConfig(defaultConfig);
                setOriginalConfig(defaultConfig);
            }
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        setError('');
        setSaveSuccess(false);

        try {
            const docRef = doc(db, 'appConfig', 'settings');
            await setDoc(docRef, {
                ...config,
                lastUpdatedBy: userData?.name || 'Unknown',
                lastUpdatedAt: serverTimestamp()
            });

            // Log activity
            await addDoc(collection(db, 'adminActivityLog'), {
                action: 'UPDATE',
                targetType: 'appConfig',
                targetId: 'settings',
                details: `Updated app configuration`,
                performedBy: userData?.uid || 'unknown',
                performedByName: userData?.name || 'Unknown Admin',
                timestamp: serverTimestamp()
            });

            setOriginalConfig(config);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Error saving config:', err);
            setError('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const resetToDefaults = () => {
        setConfig(defaultConfig);
    };

    const updateConfig = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const ToggleSwitch: React.FC<{ 
        enabled: boolean; 
        onChange: (val: boolean) => void;
        label: string;
        description?: string;
        icon?: React.ReactNode;
        danger?: boolean;
    }> = ({ enabled, onChange, label, description, icon, danger }) => (
        <div className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${
            danger 
                ? enabled 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
                : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
        }`}>
            <div className="flex items-start gap-3">
                {icon && <div className="mt-0.5 text-slate-500 dark:text-slate-400">{icon}</div>}
                <div>
                    <p className={`font-medium ${danger && enabled ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {label}
                    </p>
                    {description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
                    )}
                </div>
            </div>
            <button
                onClick={() => onChange(!enabled)}
                className={`flex-shrink-0 transition-colors ${
                    enabled 
                        ? danger 
                            ? 'text-red-500' 
                            : 'text-emerald-500' 
                        : 'text-slate-400'
                }`}
            >
                {enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
        </div>
    );

    const NumberInput: React.FC<{
        value: number;
        onChange: (val: number) => void;
        label: string;
        description?: string;
        min?: number;
        max?: number;
        icon?: React.ReactNode;
    }> = ({ value, onChange, label, description, min = 1, max = 1000, icon }) => (
        <div className="p-4 rounded-lg border bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
            <div className="flex items-start gap-3">
                {icon && <div className="mt-0.5 text-slate-500 dark:text-slate-400">{icon}</div>}
                <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{label}</p>
                    {description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 mb-2">{description}</p>
                    )}
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
                        min={min}
                        max={max}
                        className="w-24 px-3 py-1.5 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded text-slate-900 dark:text-white text-center font-mono"
                    />
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Settings className="w-8 h-8 text-orange-500" />
                        App Settings
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Configure global app settings and feature toggles
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={resetToDefaults}
                        className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm"
                    >
                        <RefreshCw className="w-4 h-4" /> Reset Defaults
                    </button>
                    <button 
                        onClick={saveConfig}
                        disabled={saving || !hasChanges}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            hasChanges 
                                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                                : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                        }`}
                    >
                        {saving ? (
                            <>Saving...</>
                        ) : saveSuccess ? (
                            <><Check className="w-4 h-4" /> Saved!</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Changes</>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> {error}
                </div>
            )}

            {hasChanges && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 px-4 py-3 rounded-lg flex items-center gap-2">
                    <Info className="w-5 h-5" /> You have unsaved changes
                </div>
            )}

            {/* Maintenance Mode - Top Priority */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-red-50 dark:bg-red-900/10">
                    <h2 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" /> Maintenance Mode
                    </h2>
                </div>
                <div className="p-4 space-y-4">
                    <ToggleSwitch
                        enabled={config.maintenanceMode}
                        onChange={(val) => updateConfig('maintenanceMode', val)}
                        label="Enable Maintenance Mode"
                        description="When enabled, users will see a maintenance message instead of the app"
                        icon={<Lock className="w-5 h-5" />}
                        danger
                    />
                    {config.maintenanceMode && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Maintenance Message
                            </label>
                            <textarea
                                value={config.maintenanceMessage}
                                onChange={(e) => updateConfig('maintenanceMessage', e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white resize-none"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Registration Settings */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-500" /> Registration Settings
                    </h2>
                </div>
                <div className="p-4 space-y-4">
                    <ToggleSwitch
                        enabled={config.allowNewRegistrations}
                        onChange={(val) => updateConfig('allowNewRegistrations', val)}
                        label="Allow New Registrations"
                        description="When disabled, no new users can sign up"
                        icon={<Unlock className="w-5 h-5" />}
                    />
                    <ToggleSwitch
                        enabled={config.requireEmailVerification}
                        onChange={(val) => updateConfig('requireEmailVerification', val)}
                        label="Require Email Verification"
                        description="Users must verify their email before accessing the app"
                        icon={<Shield className="w-5 h-5" />}
                    />
                    <ToggleSwitch
                        enabled={config.allowCoachSelfRegistration}
                        onChange={(val) => updateConfig('allowCoachSelfRegistration', val)}
                        label="Allow Coach Self-Registration"
                        description="Allow users to register as a Coach (otherwise Admin must assign)"
                        icon={<Users className="w-5 h-5" />}
                    />
                    <div className="p-4 rounded-lg border bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                        <p className="font-medium text-slate-900 dark:text-white mb-2">Default User Role</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Role assigned to new users who register without specifying</p>
                        <div className="flex gap-2">
                            {(['Parent', 'Coach'] as const).map(role => (
                                <button
                                    key={role}
                                    onClick={() => updateConfig('defaultUserRole', role)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        config.defaultUserRole === role
                                            ? 'bg-orange-600 text-white'
                                            : 'bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Toggles */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Bell className="w-5 h-5 text-orange-500" /> Feature Toggles
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enable or disable app features globally</p>
                </div>
                <div className="p-4 grid gap-4 md:grid-cols-2">
                    <ToggleSwitch
                        enabled={config.chatEnabled}
                        onChange={(val) => updateConfig('chatEnabled', val)}
                        label="Team Chat"
                        description="Real-time team messaging"
                        icon={<MessageCircle className="w-5 h-5" />}
                    />
                    <ToggleSwitch
                        enabled={config.messengerEnabled}
                        onChange={(val) => updateConfig('messengerEnabled', val)}
                        label="Direct Messenger"
                        description="Private 1-on-1 messaging"
                        icon={<MessageCircle className="w-5 h-5" />}
                    />
                    <ToggleSwitch
                        enabled={config.videoLibraryEnabled}
                        onChange={(val) => updateConfig('videoLibraryEnabled', val)}
                        label="Video Library"
                        description="Team video uploads and sharing"
                        icon={<FileText className="w-5 h-5" />}
                    />
                    <ToggleSwitch
                        enabled={config.playbookEnabled}
                        onChange={(val) => updateConfig('playbookEnabled', val)}
                        label="Playbook"
                        description="Team playbook and strategies"
                        icon={<FileText className="w-5 h-5" />}
                    />
                    <ToggleSwitch
                        enabled={config.statsEnabled}
                        onChange={(val) => updateConfig('statsEnabled', val)}
                        label="Stats & Analytics"
                        description="Player and team statistics"
                        icon={<Database className="w-5 h-5" />}
                    />
                </div>
            </div>

            {/* Limits */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Database className="w-5 h-5 text-orange-500" /> Limits & Quotas
                    </h2>
                </div>
                <div className="p-4 grid gap-4 md:grid-cols-2">
                    <NumberInput
                        value={config.maxPlayersPerTeam}
                        onChange={(val) => updateConfig('maxPlayersPerTeam', val)}
                        label="Max Players per Team"
                        description="Maximum roster size"
                        min={5}
                        max={100}
                        icon={<Users className="w-5 h-5" />}
                    />
                    <NumberInput
                        value={config.maxUsersPerTeam}
                        onChange={(val) => updateConfig('maxUsersPerTeam', val)}
                        label="Max Users per Team"
                        description="Max parents/coaches per team"
                        min={5}
                        max={200}
                        icon={<Users className="w-5 h-5" />}
                    />
                    <NumberInput
                        value={config.maxBulletinPosts}
                        onChange={(val) => updateConfig('maxBulletinPosts', val)}
                        label="Max Bulletin Posts"
                        description="Posts kept per team"
                        min={10}
                        max={500}
                        icon={<FileText className="w-5 h-5" />}
                    />
                    <NumberInput
                        value={config.maxChatMessages}
                        onChange={(val) => updateConfig('maxChatMessages', val)}
                        label="Max Chat Messages"
                        description="Messages kept per team"
                        min={100}
                        max={2000}
                        icon={<MessageCircle className="w-5 h-5" />}
                    />
                </div>
            </div>

            {/* Last Updated Info */}
            {originalConfig.lastUpdatedBy && (
                <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Last updated by {originalConfig.lastUpdatedBy}
                </div>
            )}
        </div>
    );
};

export default AppSettings;
