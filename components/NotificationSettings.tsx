import React, { useState, useEffect } from 'react';
import {
    Bell,
    Mail,
    MessageSquare,
    Users,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Save,
    RefreshCw,
    Settings,
    ChevronRight,
    Smartphone,
    Globe,
    Shield,
    Zap,
    UserCheck,
    FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NotificationCategory {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    settings: NotificationSetting[];
}

interface NotificationSetting {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    channels: {
        email: boolean;
        push: boolean;
        inApp: boolean;
    };
}

const NotificationSettings: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeTab, setActiveTab] = useState<'agent' | 'customer' | 'supervisor'>('agent');
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
        show: false,
        message: '',
        type: 'success'
    });

    // Handle auto-hide toast
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    // Notification settings state
    const [agentSettings, setAgentSettings] = useState<NotificationSetting[]>([
        {
            id: 'new_ticket_assigned',
            label: 'New Ticket Assigned',
            description: 'When a new ticket is assigned to you',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'customer_reply',
            label: 'Customer Replied',
            description: 'When a customer replies to your ticket',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'ticket_escalated',
            label: 'Ticket Escalated',
            description: 'When a ticket is escalated to you',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'mentioned_in_comment',
            label: 'Mentioned in Comment',
            description: 'When someone mentions you in a ticket comment',
            enabled: true,
            channels: { email: false, push: true, inApp: true }
        },
        {
            id: 'ticket_reassigned',
            label: 'Ticket Reassigned',
            description: 'When a ticket is reassigned from you',
            enabled: false,
            channels: { email: false, push: false, inApp: true }
        },
        {
            id: 'sla_warning',
            label: 'SLA Warning',
            description: 'When a ticket is approaching SLA breach',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'ticket_status_changed',
            label: 'Ticket Status Changed',
            description: 'When a ticket status is updated by customer or system',
            enabled: true,
            channels: { email: false, push: false, inApp: true }
        },
        {
            id: 'ticket_due_soon',
            label: 'Ticket Due Soon',
            description: 'Reminder when ticket deadline is approaching',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'kb_article_update',
            label: 'Knowledge Base Update',
            description: 'When a KB article you follow is updated',
            enabled: false,
            channels: { email: false, push: false, inApp: true }
        }
    ]);

    const [customerSettings, setCustomerSettings] = useState<NotificationSetting[]>([
        {
            id: 'ticket_created',
            label: 'Ticket Created Confirmation',
            description: 'Confirm when a new ticket is submitted',
            enabled: true,
            channels: { email: true, push: false, inApp: true }
        },
        {
            id: 'agent_replied',
            label: 'Agent Replied',
            description: 'When an agent replies to their ticket',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'ticket_status_update',
            label: 'Status Update',
            description: 'When ticket status changes (In Progress, On Hold, etc.)',
            enabled: true,
            channels: { email: true, push: false, inApp: true }
        },
        {
            id: 'ticket_resolved',
            label: 'Ticket Resolved',
            description: 'When their ticket is marked as resolved',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'ticket_closed',
            label: 'Ticket Closed',
            description: 'When their ticket is officially closed',
            enabled: false,
            channels: { email: true, push: false, inApp: true }
        },
        {
            id: 'auto_close_warning',
            label: 'Auto-Close Warning',
            description: 'Warning before ticket is auto-closed due to inactivity',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'satisfaction_survey',
            label: 'Satisfaction Survey',
            description: 'Send survey after ticket resolution',
            enabled: true,
            channels: { email: true, push: false, inApp: false }
        }
    ]);

    const [supervisorSettings, setSupervisorSettings] = useState<NotificationSetting[]>([
        {
            id: 'sla_breach_warning',
            label: 'SLA Breach Warning',
            description: 'When tickets are approaching or have breached SLA',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'escalation_triggered',
            label: 'Escalation Triggered',
            description: 'When an escalation rule is triggered',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'daily_summary',
            label: 'Daily Summary Report',
            description: 'Daily summary of team performance',
            enabled: false,
            channels: { email: true, push: false, inApp: false }
        },
        {
            id: 'weekly_report',
            label: 'Weekly Performance Report',
            description: 'Weekly report of team metrics',
            enabled: true,
            channels: { email: true, push: false, inApp: false }
        },
        {
            id: 'critical_ticket',
            label: 'Critical Ticket Created',
            description: 'When a critical/urgent ticket is created',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'agent_offline',
            label: 'Agent Offline Alert',
            description: 'When assigned agent goes offline with pending tickets',
            enabled: false,
            channels: { email: false, push: true, inApp: true }
        },
        {
            id: 'unassigned_ticket_alert',
            label: 'Unassigned Ticket Alert',
            description: 'When a ticket remains unassigned for too long',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        },
        {
            id: 'new_agent_joined',
            label: 'New Agent Joined Team',
            description: 'When a new agent is added to your team',
            enabled: false,
            channels: { email: true, push: false, inApp: true }
        },
        {
            id: 'customer_complaint',
            label: 'Customer Complaint',
            description: 'When a ticket receives negative feedback or complaint',
            enabled: true,
            channels: { email: true, push: true, inApp: true }
        }
    ]);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notification_settings')
                .select('*');

            if (error) throw error;

            if (data && data.length > 0) {
                const agent: NotificationSetting[] = [];
                const customer: NotificationSetting[] = [];
                const supervisor: NotificationSetting[] = [];

                data.forEach(item => {
                    const setting: NotificationSetting = {
                        id: item.setting_key,
                        label: item.setting_label,
                        description: item.setting_description,
                        enabled: item.is_enabled,
                        channels: {
                            email: item.email_enabled,
                            push: item.push_enabled,
                            inApp: item.in_app_enabled
                        }
                    };

                    if (item.role_type === 'agent') agent.push(setting);
                    else if (item.role_type === 'customer') customer.push(setting);
                    else if (item.role_type === 'supervisor') supervisor.push(setting);
                });

                // Update settings if found in DB, otherwise keep defaults
                if (agent.length > 0) setAgentSettings(prev => {
                    return prev.map(p => {
                        const db = agent.find(a => a.id === p.id);
                        return db ? db : p;
                    });
                });

                if (customer.length > 0) setCustomerSettings(prev => {
                    return prev.map(p => {
                        const db = customer.find(a => a.id === p.id);
                        return db ? db : p;
                    });
                });

                if (supervisor.length > 0) setSupervisorSettings(prev => {
                    return prev.map(p => {
                        const db = supervisor.find(a => a.id === p.id);
                        return db ? db : p;
                    });
                });
            }
        } catch (error) {
            console.error('Error fetching notification settings:', error);
            setToast({ show: true, message: 'Failed to load settings', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSetting = (
        settingsType: 'agent' | 'customer' | 'supervisor',
        settingId: string
    ) => {
        const updateSettings = (settings: NotificationSetting[]) =>
            settings.map(s => s.id === settingId ? { ...s, enabled: !s.enabled } : s);

        switch (settingsType) {
            case 'agent':
                setAgentSettings(updateSettings);
                break;
            case 'customer':
                setCustomerSettings(updateSettings);
                break;
            case 'supervisor':
                setSupervisorSettings(updateSettings);
                break;
        }
        setHasChanges(true);
    };

    const handleToggleChannel = (
        settingsType: 'agent' | 'customer' | 'supervisor',
        settingId: string,
        channel: 'email' | 'push' | 'inApp'
    ) => {
        const updateSettings = (settings: NotificationSetting[]) =>
            settings.map(s => s.id === settingId ? {
                ...s,
                channels: { ...s.channels, [channel]: !s.channels[channel] }
            } : s);

        switch (settingsType) {
            case 'agent':
                setAgentSettings(updateSettings);
                break;
            case 'customer':
                setCustomerSettings(updateSettings);
                break;
            case 'supervisor':
                setSupervisorSettings(updateSettings);
                break;
        }
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const allSettings: any[] = [];

            agentSettings.forEach(s => {
                allSettings.push({
                    role_type: 'agent',
                    setting_key: s.id,
                    setting_label: s.label,
                    setting_description: s.description,
                    is_enabled: s.enabled,
                    email_enabled: s.channels.email,
                    push_enabled: s.channels.push,
                    in_app_enabled: s.channels.inApp,
                    updated_at: new Date().toISOString()
                });
            });

            customerSettings.forEach(s => {
                allSettings.push({
                    role_type: 'customer',
                    setting_key: s.id,
                    setting_label: s.label,
                    setting_description: s.description,
                    is_enabled: s.enabled,
                    email_enabled: s.channels.email,
                    push_enabled: s.channels.push,
                    in_app_enabled: s.channels.inApp,
                    updated_at: new Date().toISOString()
                });
            });

            supervisorSettings.forEach(s => {
                allSettings.push({
                    role_type: 'supervisor',
                    setting_key: s.id,
                    setting_label: s.label,
                    setting_description: s.description,
                    is_enabled: s.enabled,
                    email_enabled: s.channels.email,
                    push_enabled: s.channels.push,
                    in_app_enabled: s.channels.inApp,
                    updated_at: new Date().toISOString()
                });
            });

            const { error } = await supabase
                .from('notification_settings')
                .upsert(allSettings, { onConflict: 'role_type,setting_key' });

            if (error) throw error;

            setHasChanges(false);
            setToast({ show: true, message: 'Settings saved successfully!', type: 'success' });
        } catch (error) {
            console.error('Error saving settings:', error);
            setToast({ show: true, message: 'Failed to save: ' + (error as any).message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        {
            id: 'agent' as const,
            label: 'Agent Notifications',
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            settings: agentSettings
        },
        {
            id: 'customer' as const,
            label: 'Customer Notifications',
            icon: UserCheck,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            settings: customerSettings
        },
        {
            id: 'supervisor' as const,
            label: 'Supervisor Notifications',
            icon: Shield,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            settings: supervisorSettings
        }
    ];

    const currentTab = tabs.find(t => t.id === activeTab)!;
    const currentSettings = currentTab.settings;

    const renderSettingCard = (setting: NotificationSetting) => (
        <div
            key={setting.id}
            className={`p-4 rounded-xl border transition-all ${setting.enabled
                ? 'bg-white border-gray-200 shadow-sm'
                : 'bg-gray-50 border-gray-100 opacity-75'
                }`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-800">{setting.label}</h4>
                        {setting.enabled && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                                ON
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{setting.description}</p>

                    {/* Channel toggles */}
                    {setting.enabled && (
                        <div className="flex items-center gap-3 mt-3">
                            <button
                                onClick={() => handleToggleChannel(activeTab, setting.id, 'email')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${setting.channels.email
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                    }`}
                            >
                                <Mail size={12} />
                                Email
                            </button>
                            <button
                                onClick={() => handleToggleChannel(activeTab, setting.id, 'push')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${setting.channels.push
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                    }`}
                            >
                                <Smartphone size={12} />
                                Push
                            </button>
                            <button
                                onClick={() => handleToggleChannel(activeTab, setting.id, 'inApp')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${setting.channels.inApp
                                    ? 'bg-emerald-100 text-emerald-700'
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
                    onClick={() => handleToggleSetting(activeTab, setting.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex-shrink-0 ${setting.enabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${setting.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>
        </div>
    );

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Premium Toast Notification */}
            {toast.show && (
                <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform scale-100 ${toast.type === 'success'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-red-600 text-white'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    <span className="font-bold text-sm tracking-wide">{toast.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Bell className="text-indigo-600" size={28} />
                        Notification Settings
                    </h1>
                    <p className="text-gray-500 mt-1">Configure automated notifications for your team</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${hasChanges
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    {saving ? (
                        <RefreshCw size={18} className="animate-spin" />
                    ) : (
                        <Save size={18} />
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-blue-600">Agent Notifications</p>
                            <p className="text-2xl font-bold text-blue-800 mt-1">
                                {agentSettings.filter(s => s.enabled).length}/{agentSettings.length}
                            </p>
                            <p className="text-xs text-blue-500">enabled</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Users size={24} className="text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-green-600">Customer Notifications</p>
                            <p className="text-2xl font-bold text-green-800 mt-1">
                                {customerSettings.filter(s => s.enabled).length}/{customerSettings.length}
                            </p>
                            <p className="text-xs text-green-500">enabled</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <UserCheck size={24} className="text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-purple-600">Supervisor Notifications</p>
                            <p className="text-2xl font-bold text-purple-800 mt-1">
                                {supervisorSettings.filter(s => s.enabled).length}/{supervisorSettings.length}
                            </p>
                            <p className="text-xs text-purple-500">enabled</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Shield size={24} className="text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="flex border-b border-gray-100">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 font-medium transition-colors relative ${activeTab === tab.id
                                ? 'text-indigo-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <tab.icon size={18} />
                            <span className="hidden sm:inline">{tab.label}</span>
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Settings List */}
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <currentTab.icon size={20} className={currentTab.color} />
                        <h3 className="font-semibold text-gray-800">{currentTab.label}</h3>
                    </div>

                    <div className="space-y-3">
                        {currentSettings.map(renderSettingCard)}
                    </div>
                </div>
            </div>

            {/* Channel Legend */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Settings size={16} />
                    Notification Channels
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Mail size={16} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-800 text-sm">Email</p>
                            <p className="text-xs text-gray-500">Sent to user's registered email</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Smartphone size={16} className="text-purple-600" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-800 text-sm">Push</p>
                            <p className="text-xs text-gray-500">Browser or mobile push notification</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Globe size={16} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-800 text-sm">In-App</p>
                            <p className="text-xs text-gray-500">Shows in notification bell</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Note */}
            <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
                <Zap size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-indigo-800">Pro Tip</p>
                    <p className="text-sm text-indigo-600 mt-1">
                        Enable in-app notifications for immediate alerts, and email for important updates that need to be tracked.
                    </p>
                </div>
            </div>

            {/* Unsaved Changes Warning */}
            {hasChanges && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom duration-300">
                    <AlertTriangle size={20} className="text-amber-400" />
                    <span>You have unsaved changes</span>
                    <button
                        onClick={handleSave}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
                    >
                        Save Now
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationSettings;
