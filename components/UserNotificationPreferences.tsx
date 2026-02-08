import React, { useState, useEffect } from 'react';
import {
    Bell,
    Mail,
    Smartphone,
    Globe,
    Save,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Info,
    X
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NotificationPreference {
    setting_key: string;
    setting_label: string;
    setting_description: string;
    is_enabled: boolean;
    email_enabled: boolean;
    push_enabled: boolean;
    in_app_enabled: boolean;
}

const UserNotificationPreferences: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [toast, setToast] = useState<{
        show: boolean;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({ show: false, message: '', type: 'success' });

    useEffect(() => {
        fetchPreferences();
    }, []);

    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    const fetchPreferences = async () => {
        setLoading(true);
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setToast({ show: true, message: 'User not authenticated', type: 'error' });
                return;
            }

            // Get user's role to filter notification settings
            const { data: profile } = await supabase
                .from('profiles')
                .select('role_id')
                .eq('id', user.id)
                .single();

            // Determine role type
            let roleType = 'customer';
            if (profile?.role_id === 1 || profile?.role_id === 2) {
                roleType = 'supervisor';
            } else if (profile?.role_id === 3) {
                roleType = 'agent';
            }

            // Fetch global notification settings for this role
            const { data: globalSettings, error: globalError } = await supabase
                .from('notification_settings')
                .select('*')
                .eq('role_type', roleType);

            if (globalError) throw globalError;

            // Fetch user-specific overrides
            const { data: userPrefs } = await supabase
                .from('user_notification_preferences')
                .select('*')
                .eq('user_id', user.id);

            // Merge global settings with user overrides
            const merged: NotificationPreference[] = (globalSettings || []).map((gs: any) => {
                const userOverride = userPrefs?.find((up: any) => up.setting_key === gs.setting_key);
                return {
                    setting_key: gs.setting_key,
                    setting_label: gs.setting_label,
                    setting_description: gs.setting_description || '',
                    is_enabled: userOverride?.is_enabled ?? gs.is_enabled,
                    email_enabled: userOverride?.email_enabled ?? gs.email_enabled,
                    push_enabled: userOverride?.push_enabled ?? gs.push_enabled,
                    in_app_enabled: userOverride?.in_app_enabled ?? gs.in_app_enabled
                };
            });

            setPreferences(merged);
        } catch (error) {
            console.error('Error fetching preferences:', error);
            setToast({ show: true, message: 'Failed to load preferences', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (settingKey: string, field: 'is_enabled' | 'email_enabled' | 'push_enabled' | 'in_app_enabled') => {
        setPreferences(prev =>
            prev.map(p =>
                p.setting_key === settingKey
                    ? { ...p, [field]: !p[field] }
                    : p
            )
        );
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setToast({ show: true, message: 'User not authenticated', type: 'error' });
                return;
            }

            // Prepare upsert data
            const upsertData = preferences.map(pref => ({
                user_id: user.id,
                setting_key: pref.setting_key,
                is_enabled: pref.is_enabled,
                email_enabled: pref.email_enabled,
                push_enabled: pref.push_enabled,
                in_app_enabled: pref.in_app_enabled,
                updated_at: new Date().toISOString()
            }));

            // Upsert all preferences at once
            const { error } = await supabase
                .from('user_notification_preferences')
                .upsert(upsertData, {
                    onConflict: 'user_id,setting_key',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error('Error saving preferences:', error);
                setToast({ show: true, message: 'Failed to save: ' + error.message, type: 'error' });
                return;
            }

            setHasChanges(false);
            setToast({ show: true, message: 'Preferences saved successfully!', type: 'success' });
        } catch (error: any) {
            console.error('Error saving preferences:', error);
            setToast({ show: true, message: 'Failed to save preferences', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const enabledCount = preferences.filter(p => p.is_enabled).length;

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="space-y-3 mt-8">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-20 bg-gray-100 rounded-xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto pb-24">
            {/* Toast */}
            {toast.show && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl ${toast.type === 'success' ? 'bg-emerald-600 text-white' :
                    toast.type === 'error' ? 'bg-red-600 text-white' :
                        'bg-blue-600 text-white'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> :
                        toast.type === 'error' ? <AlertTriangle size={18} /> :
                            <Info size={18} />}
                    <span className="font-medium">{toast.message}</span>
                    <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-2 hover:opacity-70">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                <Bell className="text-indigo-600" size={22} />
                            </div>
                            My Notification Preferences
                        </h1>
                        <p className="text-gray-500 mt-2">
                            Customize which notifications you want to receive
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${hasChanges
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                    <p className="text-sm font-medium text-indigo-600">Total</p>
                    <p className="text-2xl font-bold text-indigo-800">{preferences.length}</p>
                    <p className="text-xs text-indigo-500">notification types</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                    <p className="text-sm font-medium text-green-600">Enabled</p>
                    <p className="text-2xl font-bold text-green-800">{enabledCount}</p>
                    <p className="text-xs text-green-500">active notifications</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-sm font-medium text-gray-600">Disabled</p>
                    <p className="text-2xl font-bold text-gray-800">{preferences.length - enabledCount}</p>
                    <p className="text-xs text-gray-500">muted notifications</p>
                </div>
            </div>

            {/* Preferences List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800">Notification Settings</h3>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <Mail size={12} className="text-blue-500" />
                                Email
                            </div>
                            <div className="flex items-center gap-1">
                                <Smartphone size={12} className="text-purple-500" />
                                Push
                            </div>
                            <div className="flex items-center gap-1">
                                <Globe size={12} className="text-green-500" />
                                In-App
                            </div>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-gray-50">
                    {preferences.map(pref => (
                        <div
                            key={pref.setting_key}
                            className={`p-5 transition-colors ${pref.is_enabled ? 'bg-white' : 'bg-gray-50 opacity-75'}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-gray-800">{pref.setting_label}</h4>
                                        {pref.is_enabled && (
                                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                                                ON
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-0.5">{pref.setting_description}</p>

                                    {/* Channel toggles */}
                                    {pref.is_enabled && (
                                        <div className="flex items-center gap-2 mt-3">
                                            <button
                                                onClick={() => handleToggle(pref.setting_key, 'email_enabled')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${pref.email_enabled
                                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                    }`}
                                            >
                                                <Mail size={12} />
                                                Email
                                            </button>
                                            <button
                                                onClick={() => handleToggle(pref.setting_key, 'push_enabled')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${pref.push_enabled
                                                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                    }`}
                                            >
                                                <Smartphone size={12} />
                                                Push
                                            </button>
                                            <button
                                                onClick={() => handleToggle(pref.setting_key, 'in_app_enabled')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${pref.in_app_enabled
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                    }`}
                                            >
                                                <Globe size={12} />
                                                In-App
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Main toggle */}
                                <button
                                    onClick={() => handleToggle(pref.setting_key, 'is_enabled')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${pref.is_enabled
                                        ? 'bg-green-500 hover:bg-green-600'
                                        : 'bg-gray-300 hover:bg-gray-400'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${pref.is_enabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Info Banner */}
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Info size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-amber-800">Note</p>
                    <p className="text-sm text-amber-700 mt-1">
                        Disabling a notification here will override the global settings set by your administrator.
                        You can always re-enable them if needed.
                    </p>
                </div>
            </div>

            {/* Unsaved Changes Bar */}
            {hasChanges && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-4 z-40">
                    <AlertTriangle size={20} className="text-amber-400" />
                    <span>You have unsaved changes</span>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg font-medium transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save Now'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserNotificationPreferences;
