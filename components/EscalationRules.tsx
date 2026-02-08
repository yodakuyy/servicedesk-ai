import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Search, Edit2, Trash2, X, ChevronDown, ChevronLeft, ChevronRight,
    Clock, AlertTriangle, Save, ArrowLeft, Bell, Users, User, Mail,
    RefreshCw, Copy, MessageSquare, ArrowUpCircle, Zap, PlayCircle, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Types
interface EscalationAction {
    type: 'notify_supervisor' | 'notify_group' | 'notify_user' | 'reassign' | 'change_priority' | 'add_note';
    target_id?: string;
    target_name?: string;
    note_text?: string;
    new_priority?: string;
}

interface EscalationRule {
    id: string;
    name: string;
    sla_policy_id: string;
    sla_policy_name?: string;
    sla_type: 'response' | 'resolution';
    trigger_type: 'percentage' | 'overdue_minutes';
    trigger_value: number;
    trigger_source: 'sla' | 'user_confirmation'; // NEW: Source of escalation
    actions: EscalationAction[];
    notification_channels: ('in_app' | 'email')[];
    notification_message?: string;
    is_active: boolean;
    created_at?: string;
}

interface SLAPolicy { id: string; name: string; }
interface Group { id: string; name: string; }
interface UserData { id: string; full_name: string; email: string; }

// Mock Data
const mockRules: EscalationRule[] = [
    {
        id: '1', name: 'IT General - 80% Warning', sla_policy_id: '1', sla_policy_name: 'IT Support - Standard',
        sla_type: 'response', trigger_type: 'percentage', trigger_value: 80, trigger_source: 'sla',
        actions: [{ type: 'notify_supervisor' }],
        notification_channels: ['in_app', 'email'],
        notification_message: 'SLA is at 80% for ticket #{ticket_id}. Please take action.',
        is_active: true
    },
    {
        id: '2', name: 'IT General - Breach Alert', sla_policy_id: '1', sla_policy_name: 'IT Support - Standard',
        sla_type: 'response', trigger_type: 'percentage', trigger_value: 100, trigger_source: 'sla',
        actions: [{ type: 'notify_supervisor' }, { type: 'notify_group', target_id: '1', target_name: 'IT Managers' }, { type: 'change_priority', new_priority: 'Urgent' }],
        notification_channels: ['in_app', 'email'],
        notification_message: 'SLA BREACH for ticket #{ticket_id}! Immediate action required.',
        is_active: true
    },
    {
        id: '3', name: 'HR - Resolution Overdue', sla_policy_id: '2', sla_policy_name: 'HR - General Request',
        sla_type: 'resolution', trigger_type: 'overdue_minutes', trigger_value: 60, trigger_source: 'sla',
        actions: [{ type: 'reassign' }, { type: 'add_note', note_text: 'Ticket reassigned due to SLA breach.' }],
        notification_channels: ['email'],
        notification_message: 'Resolution SLA breached by 1 hour. Ticket #{ticket_id} has been reassigned.',
        is_active: false
    }
];

const mockSLAPolicies: SLAPolicy[] = [
    { id: '1', name: 'IT Support - Standard' },
    { id: '2', name: 'HR - General Request' },
    { id: '3', name: 'Finance - Urgent' }
];

const triggerPercentages = [50, 80, 100];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];
const actionTypes = [
    { value: 'notify_supervisor', label: 'Notify Supervisor', icon: User },
    { value: 'notify_group', label: 'Notify Group', icon: Users },
    { value: 'notify_user', label: 'Notify Specific User', icon: User },
    { value: 'reassign', label: 'Reassign Ticket', icon: ArrowUpCircle },
    { value: 'change_priority', label: 'Change Priority', icon: Zap },
    { value: 'add_note', label: 'Add Internal Note', icon: MessageSquare }
];

// Searchable Dropdown Component
interface SearchableDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: { id: string; label: string }[];
    placeholder: string;
    searchPlaceholder?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
    value,
    onChange,
    options,
    placeholder,
    searchPlaceholder = 'Search...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(o => o.id === value);
    const filteredOptions = options.filter(o =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    return (
        <div ref={dropdownRef} className="relative mt-2">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-left flex items-center justify-between bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
                <span className={selectedOption ? 'text-gray-800' : 'text-gray-400'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-48 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center">No results found</div>
                        ) : (
                            filteredOptions.map(option => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.id);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`w-full px-3 py-2 text-sm text-left hover:bg-indigo-50 flex items-center gap-2 ${value === option.id ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-700'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const EscalationRules: React.FC = () => {
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [rules, setRules] = useState<EscalationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRule, setSelectedRule] = useState<EscalationRule | null>(null);

    // Reference data
    const [slaPolicies, setSLAPolicies] = useState<SLAPolicy[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);

    // Form state  
    const [formData, setFormData] = useState<EscalationRule>({
        id: '', name: '', sla_policy_id: '', sla_type: 'response',
        trigger_type: 'percentage', trigger_value: 80, trigger_source: 'sla',
        actions: [], notification_channels: ['in_app'],
        notification_message: 'SLA alert for ticket #{ticket_id}. Current status: {sla_status}.',
        is_active: true
    });
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState<EscalationRule | null>(null);
    const [showToggleConfirm, setShowToggleConfirm] = useState(false);
    const [ruleToToggle, setRuleToToggle] = useState<EscalationRule | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Run Now state
    const [isRunning, setIsRunning] = useState(false);
    const [runResult, setRunResult] = useState<{
        show: boolean;
        processed: number;
        triggered: number;
        success: boolean;
    } | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Handler for manual Run Now
    const handleRunNow = async () => {
        setIsRunning(true);
        setRunResult(null);

        try {
            // Try the new escalation_rules function first
            let result = await supabase.rpc('process_escalation_rules');

            if (result.error) {
                // Fallback to existing sla_percentage_escalations
                result = await supabase.rpc('check_sla_percentage_escalations');
            }

            if (result.error) {
                throw result.error;
            }

            const data = result.data as any;
            setRunResult({
                show: true,
                processed: data?.processed || data?.processed_tickets || 0,
                triggered: data?.triggered || data?.notifications_sent || 0,
                success: true
            });

            // Refresh data after running
            fetchData();

            // Auto-hide result after 10 seconds
            setTimeout(() => setRunResult(null), 10000);
        } catch (error: any) {
            setRunResult({
                show: true,
                processed: 0,
                triggered: 0,
                success: false
            });
            console.error('Error running escalation check:', error);
        } finally {
            setIsRunning(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [groupsRes, usersRes] = await Promise.all([
                supabase.from('groups').select('id, name').order('name'),
                supabase.from('profiles').select('id, full_name, email').order('full_name')
            ]);
            if (groupsRes.data) setGroups(groupsRes.data);
            if (usersRes.data) setUsers(usersRes.data);

            // Fetch SLA policies for dropdown
            const { data: policiesData } = await supabase
                .from('sla_policies')
                .select('id, name')
                .order('name');

            if (policiesData && policiesData.length > 0) {
                setSLAPolicies(policiesData.map((p: any) => ({ id: p.id?.toString(), name: p.name })));
            } else {
                setSLAPolicies(mockSLAPolicies);
            }

            // Fetch escalation rules
            const { data: escalationsData, error: escalationsError } = await supabase
                .from('sla_escalations')
                .select(`
                    *,
                    policy:sla_policy_id(id, name)
                `)
                .order('created_at', { ascending: false });

            if (escalationsError) {
                console.error('Error fetching escalations:', escalationsError);
                setRules(mockRules);
            } else if (escalationsData && escalationsData.length > 0) {
                // Transform data
                const transformedRules: EscalationRule[] = escalationsData.map((esc: any) => ({
                    id: esc.id?.toString(),
                    name: esc.name || 'Unnamed Rule',
                    sla_policy_id: esc.sla_policy_id?.toString() || '',
                    sla_policy_name: esc.policy?.name || 'Unknown Policy',
                    sla_type: esc.sla_type || 'response',
                    trigger_type: esc.trigger_type || 'percentage',
                    trigger_value: esc.trigger_value || 80,
                    trigger_source: esc.trigger_source || 'sla',
                    actions: esc.actions || [],
                    notification_channels: esc.notification_channels || ['in_app'],
                    notification_message: esc.notification_message || '',
                    is_active: esc.is_active ?? true,
                    created_at: esc.created_at
                }));
                setRules(transformedRules);
            } else {
                setRules(mockRules);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setSLAPolicies(mockSLAPolicies);
            setRules(mockRules);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setSelectedRule(null);
        setFormData({
            id: '', name: '', sla_policy_id: '', sla_type: 'response',
            trigger_type: 'percentage', trigger_value: 80, trigger_source: 'sla',
            actions: [], notification_channels: ['in_app'],
            notification_message: 'SLA alert for ticket #{ticket_id}. Current status: {sla_status}.',
            is_active: true
        });
        setErrors({});
        setView('editor');
    };

    const handleEdit = (rule: EscalationRule) => {
        setSelectedRule(rule);
        setFormData({ ...rule });
        setErrors({});
        setView('editor');
    };

    const handleDuplicate = (rule: EscalationRule) => {
        setSelectedRule(null);
        setFormData({ ...rule, id: '', name: `${rule.name} (Copy)` });
        setView('editor');
    };

    const addAction = (type: string) => {
        const newAction: EscalationAction = { type: type as any };
        setFormData({ ...formData, actions: [...formData.actions, newAction] });
    };

    const removeAction = (index: number) => {
        setFormData({ ...formData, actions: formData.actions.filter((_, i) => i !== index) });
    };

    const updateAction = (index: number, field: string, value: any) => {
        const newActions = [...formData.actions];
        newActions[index] = { ...newActions[index], [field]: value };
        setFormData({ ...formData, actions: newActions });
    };

    const toggleChannel = (channel: 'in_app' | 'email') => {
        const channels = formData.notification_channels.includes(channel)
            ? formData.notification_channels.filter(c => c !== channel)
            : [...formData.notification_channels, channel];
        setFormData({ ...formData, notification_channels: channels });
    };

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.name.trim()) newErrors.name = 'Rule name is required';
        if (!formData.sla_policy_id) newErrors.sla_policy_id = 'SLA Policy is required';
        if (formData.actions.length === 0) newErrors.actions = 'At least one action is required';
        if (formData.notification_channels.length === 0) newErrors.channels = 'At least one channel is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            const dataToSave: any = {
                name: formData.name,
                sla_policy_id: formData.sla_policy_id,
                sla_type: formData.sla_type,
                trigger_type: formData.trigger_type,
                trigger_value: formData.trigger_value,
                // Required columns
                trigger_percentage: formData.trigger_type === 'percentage' ? formData.trigger_value : 100,
                action_type: formData.actions.length > 0 ? formData.actions[0].type : 'notify_supervisor',
                trigger_source: formData.trigger_source,
                actions: formData.actions,
                notification_channels: formData.notification_channels,
                notification_message: formData.notification_message,
                is_active: formData.is_active
            };

            if (selectedRule) {
                const { error } = await supabase
                    .from('sla_escalations')
                    .update(dataToSave)
                    .eq('id', selectedRule.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('sla_escalations')
                    .insert(dataToSave);
                if (error) throw error;
            }

            await fetchData();
            setView('list');
        } catch (error: any) {
            console.error('Save Error:', error);
            alert('Error saving rule: ' + (error.message || 'Check console for details'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!ruleToDelete) return;
        try {
            const { error } = await supabase
                .from('sla_escalations')
                .delete()
                .eq('id', ruleToDelete.id);

            if (error) throw error;

            setRules(rules.filter(r => r.id !== ruleToDelete.id));
            setShowDeleteConfirm(false);
            setRuleToDelete(null);
        } catch (error: any) {
            console.error('Delete Error:', error);
            alert('Error deleting rule: ' + (error.message || 'Check console for details'));
        }
    };

    const getTriggerLabel = (rule: EscalationRule) => {
        if (rule.trigger_type === 'percentage') return `${rule.trigger_value}%`;
        return `+${rule.trigger_value} min`;
    };

    const getActionsLabel = (actions: EscalationAction[]) => {
        if (actions.length === 0) return 'No actions';
        if (actions.length === 1) return actionTypes.find(a => a.value === actions[0].type)?.label || actions[0].type;
        return `${actions.length} actions`;
    };

    const filteredRules = rules.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.sla_policy_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
    const paginatedRules = filteredRules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getPreviewMessage = () => {
        return formData.notification_message
            ?.replace('{ticket_id}', 'INC-12345')
            .replace('{sla_status}', formData.trigger_type === 'percentage' ? `${formData.trigger_value}% elapsed` : `${formData.trigger_value} min overdue`) || '';
    };

    // LIST VIEW
    if (view === 'list') {
        return (
            <div className="p-8 pb-20 max-w-7xl mx-auto min-h-screen">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Escalation Rules</h1>
                    <p className="text-gray-500 mt-1">Configure automated actions when SLA thresholds are reached</p>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <button onClick={handleCreateNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
                        <Plus size={18} />Create New Rule
                    </button>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input type="text" placeholder="Search rules..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                        </div>
                        <button onClick={fetchData} className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw size={18} className={loading ? 'animate-spin text-indigo-500' : 'text-gray-500'} /></button>
                        <button
                            onClick={handleRunNow}
                            disabled={isRunning}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg shadow-sm transition-colors"
                        >
                            <PlayCircle size={18} className={isRunning ? 'animate-pulse' : ''} />
                            {isRunning ? 'Running...' : 'Run Now'}
                        </button>
                    </div>
                </div>

                {/* Run Result Notification */}
                {runResult?.show && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${runResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center gap-3">
                            {runResult.success ? (
                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <AlertTriangle size={18} className="text-emerald-600" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                    <X size={18} className="text-red-600" />
                                </div>
                            )}
                            <div>
                                <p className={`font-medium ${runResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                                    {runResult.success ? 'Escalation Check Completed' : 'Escalation Check Failed'}
                                </p>
                                <p className={`text-sm ${runResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {runResult.success
                                        ? `Processed ${runResult.processed} tickets, triggered ${runResult.triggered} escalations`
                                        : 'An error occurred while running escalation check'}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setRunResult(null)} className="p-1 hover:bg-white/50 rounded">
                            <X size={18} className={runResult.success ? 'text-emerald-600' : 'text-red-600'} />
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase">SLA Policy</th>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase">Trigger</th>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase">Action</th>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase text-center">Status</th>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                            ) : paginatedRules.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No escalation rules found</td></tr>
                            ) : paginatedRules.map(rule => (
                                <tr key={rule.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div>
                                            <span className="font-medium text-gray-800">{rule.sla_policy_name}</span>
                                            <p className="text-xs text-gray-400 mt-0.5">{rule.name}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${rule.trigger_value >= 100 ? 'bg-red-100 text-red-700' : rule.trigger_value >= 80 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {getTriggerLabel(rule)}
                                            </span>
                                            <span className="text-xs text-gray-400 capitalize">{rule.sla_type}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            <Zap size={12} />{getActionsLabel(rule.actions)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <button
                                                type="button"
                                                onClick={() => { setRuleToToggle(rule); setShowToggleConfirm(true); }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer hover:opacity-80 ${rule.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                                                title={`Click to ${rule.is_active ? 'deactivate' : 'activate'} this rule`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${rule.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                            <span className="text-[10px] text-gray-400 mt-1">{rule.is_active ? 'Active' : 'Inactive'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(rule)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDuplicate(rule)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Copy size={16} /></button>
                                            <button onClick={() => { setRuleToDelete(rule); setShowDeleteConfirm(true); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {totalPages > 1 && (
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-sm text-gray-500">Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRules.length)} of {filteredRules.length}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16} /></button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Delete Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center"><AlertTriangle size={24} className="text-red-600" /></div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Delete Rule</h3>
                                    <p className="text-sm text-gray-600 mt-1">Are you sure you want to delete "{ruleToDelete?.name}"?</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border">Cancel</button>
                                <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toggle Status Confirmation Modal */}
                {showToggleConfirm && ruleToToggle && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 ${ruleToToggle.is_active ? 'bg-orange-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
                                    <PlayCircle size={24} className={ruleToToggle.is_active ? 'text-orange-600' : 'text-green-600'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">
                                        {ruleToToggle.is_active ? 'Deactivate Rule?' : 'Activate Rule?'}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {ruleToToggle.is_active
                                            ? `Rule "${ruleToToggle.name}" will be deactivated and won't trigger any escalations.`
                                            : `Rule "${ruleToToggle.name}" will be activated and start triggering escalations.`
                                        }
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => { setShowToggleConfirm(false); setRuleToToggle(null); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            const newStatus = !ruleToToggle.is_active;
                                            const { error } = await supabase
                                                .from('sla_escalations')
                                                .update({ is_active: newStatus })
                                                .eq('id', ruleToToggle.id);

                                            if (error) throw error;

                                            setRules(rules.map(r =>
                                                r.id === ruleToToggle.id ? { ...r, is_active: newStatus } : r
                                            ));
                                            setShowToggleConfirm(false);
                                            setRuleToToggle(null);
                                        } catch (error: any) {
                                            console.error('Toggle Error:', error);
                                            alert('Error updating status: ' + (error.message || 'Check console'));
                                        }
                                    }}
                                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${ruleToToggle.is_active ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
                                >
                                    {ruleToToggle.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // EDITOR VIEW
    return (
        <div className="w-full bg-slate-50/50">
            <div className="p-8 pb-64 max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} className="text-gray-500" /></button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{selectedRule ? 'Edit Escalation Rule' : 'Create Escalation Rule'}</h1>
                        <p className="text-gray-500 mt-1">Configure automated actions for SLA breaches</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Section 1: SLA Binding */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">1</span>SLA Binding</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-300' : 'border-gray-200'}`} placeholder="e.g. IT General - 80% Warning" />
                                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">SLA Policy <span className="text-red-500">*</span></label>
                                <select value={formData.sla_policy_id} onChange={(e) => setFormData({ ...formData, sla_policy_id: e.target.value })}
                                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.sla_policy_id ? 'border-red-300' : 'border-gray-200'}`}>
                                    <option value="">Select SLA Policy</option>
                                    {slaPolicies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                {errors.sla_policy_id && <p className="text-xs text-red-500 mt-1">{errors.sla_policy_id}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">SLA Type</label>
                                <div className="flex gap-3">
                                    {['response', 'resolution'].map(type => (
                                        <label key={type} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg cursor-pointer transition-colors ${formData.sla_type === type ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                                            <input type="radio" name="sla_type" value={type} checked={formData.sla_type === type} onChange={() => setFormData({ ...formData, sla_type: type as any })} className="sr-only" />
                                            <Clock size={16} /><span className="text-sm font-medium capitalize">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${formData.is_active ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-gray-400'}`}
                                        title={formData.is_active ? 'Click to deactivate' : 'Click to activate'}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                    <span className="text-sm font-medium text-gray-700">Rule is {formData.is_active ? 'Active' : 'Inactive'}</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Trigger Condition */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">2</span>Trigger Condition</h2>
                        <p className="text-sm text-gray-500 mb-4">When SLA reaches:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Type</label>
                                <div className="flex gap-3">
                                    <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded-lg cursor-pointer ${formData.trigger_type === 'percentage' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                                        <input type="radio" name="trigger_type" checked={formData.trigger_type === 'percentage'} onChange={() => setFormData({ ...formData, trigger_type: 'percentage', trigger_value: 80 })} className="sr-only" />
                                        <span className="text-sm font-medium">Percentage</span>
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded-lg cursor-pointer ${formData.trigger_type === 'overdue_minutes' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                                        <input type="radio" name="trigger_type" checked={formData.trigger_type === 'overdue_minutes'} onChange={() => setFormData({ ...formData, trigger_type: 'overdue_minutes', trigger_value: 30 })} className="sr-only" />
                                        <span className="text-sm font-medium">Minutes Overdue</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
                                {formData.trigger_type === 'percentage' ? (
                                    <div className="flex gap-2">
                                        {triggerPercentages.map(p => (
                                            <button key={p} onClick={() => setFormData({ ...formData, trigger_value: p })}
                                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${formData.trigger_value === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                                {p}%
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="1" value={formData.trigger_value} onChange={(e) => setFormData({ ...formData, trigger_value: parseInt(e.target.value) || 0 })}
                                            className="w-24 px-3 py-2 border border-gray-200 rounded-lg" />
                                        <span className="text-sm text-gray-500">minutes after SLA breach</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Actions */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">3</span>Actions</h2>
                        </div>
                        {errors.actions && <p className="text-xs text-red-500 mb-3">{errors.actions}</p>}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {actionTypes.map(action => {
                                const Icon = action.icon;
                                return (
                                    <button key={action.value} onClick={() => addAction(action.value)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                                        <Icon size={14} />{action.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Added actions */}
                        {formData.actions.length === 0 ? (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                                <Zap size={24} className="text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No actions added. Click buttons above to add actions.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {formData.actions.map((action, idx) => {
                                    const actionInfo = actionTypes.find(a => a.value === action.type);
                                    const Icon = actionInfo?.icon || Zap;
                                    return (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Icon size={16} className="text-indigo-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-800">{actionInfo?.label}</p>
                                                {action.type === 'notify_group' && (
                                                    <SearchableDropdown
                                                        value={action.target_id || ''}
                                                        onChange={(val) => updateAction(idx, 'target_id', val)}
                                                        options={groups.map(g => ({ id: g.id, label: g.name }))}
                                                        placeholder="Select Group"
                                                        searchPlaceholder="Search groups..."
                                                    />
                                                )}
                                                {action.type === 'notify_user' && (
                                                    <SearchableDropdown
                                                        value={action.target_id || ''}
                                                        onChange={(val) => updateAction(idx, 'target_id', val)}
                                                        options={users.map(u => ({ id: u.id, label: u.full_name }))}
                                                        placeholder="Select User"
                                                        searchPlaceholder="Search users..."
                                                    />
                                                )}
                                                {action.type === 'change_priority' && (
                                                    <select value={action.new_priority || ''} onChange={(e) => updateAction(idx, 'new_priority', e.target.value)} className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                                                        <option value="">Select Priority</option>
                                                        {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                )}
                                                {action.type === 'add_note' && (
                                                    <textarea value={action.note_text || ''} onChange={(e) => updateAction(idx, 'note_text', e.target.value)} placeholder="Note text..." rows={2} className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
                                                )}
                                            </div>
                                            <button onClick={() => removeAction(idx)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><X size={16} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Section 4: Notification */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">4</span>Notification</h2>
                            <button onClick={() => setShowPreview(!showPreview)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"><Eye size={16} />Preview</button>
                        </div>
                        {errors.channels && <p className="text-xs text-red-500 mb-3">{errors.channels}</p>}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Channels</label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); toggleChannel('in_app'); }}
                                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${formData.notification_channels.includes('in_app') ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <Bell size={16} /><span className="text-sm font-medium">In-App</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); toggleChannel('email'); }}
                                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${formData.notification_channels.includes('email') ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <Mail size={16} /><span className="text-sm font-medium">Email</span>
                                    </button>
                                    <div className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg opacity-50 cursor-not-allowed">
                                        <MessageSquare size={16} /><span className="text-sm font-medium">Slack</span><span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">Soon</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message Template</label>
                                <textarea value={formData.notification_message} onChange={(e) => setFormData({ ...formData, notification_message: e.target.value })} rows={3}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" placeholder="Use {ticket_id}, {sla_status} as variables..." />
                                <p className="text-xs text-gray-400 mt-1">Available: {'{ticket_id}'}, {'{sla_status}'}, {'{assignee}'}, {'{priority}'}</p>
                            </div>

                            {/* Preview */}
                            {showPreview && (
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Preview</p>
                                    <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center"><AlertTriangle size={16} className="text-orange-600" /></div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">SLA Escalation Alert</p>
                                                <p className="text-sm text-gray-600 mt-1">{getPreviewMessage()}</p>
                                                <p className="text-xs text-gray-400 mt-2">via {formData.notification_channels.join(', ')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Save */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={() => setView('list')} className="px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border bg-white">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save Rule'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EscalationRules;
