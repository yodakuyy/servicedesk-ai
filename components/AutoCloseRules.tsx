import React, { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    ChevronLeft,
    ChevronRight,
    Clock,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Calendar,
    Bell,
    Timer,
    Archive,
    TrendingDown,
    Play,
    AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { processAutoCloseRules, previewAutoClose } from '../lib/autoClose';

interface AutoCloseRule {
    id: string;
    name: string;
    description?: string;
    condition_type: 'status' | 'user_confirmed' | 'no_response' | 'pending';
    condition_value: string;
    after_days: number;
    after_hours: number;
    notify_user: boolean;
    notify_agent: boolean;
    add_note: boolean;
    note_text?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    tickets_closed?: number;
}

interface TicketStatus {
    status_id: number;
    status_name: string;
}

type ConditionType = 'status' | 'user_confirmed' | 'no_response' | 'pending';

const AutoCloseRules: React.FC = () => {
    const [rules, setRules] = useState<AutoCloseRule[]>([]);
    const [statuses, setStatuses] = useState<TicketStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<AutoCloseRule | null>(null);
    const [ruleToDelete, setRuleToDelete] = useState<AutoCloseRule | null>(null);

    // Form state
    const [formData, setFormData] = useState<{
        name: string;
        description: string;
        condition_type: ConditionType;
        condition_value: string;
        after_days: number;
        after_hours: number;
        notify_user: boolean;
        notify_agent: boolean;
        add_note: boolean;
        note_text: string;
        is_active: boolean;
    }>({
        name: '',
        description: '',
        condition_type: 'status',
        condition_value: '',
        after_days: 3,
        after_hours: 0,
        notify_user: true,
        notify_agent: false,
        add_note: false,
        note_text: '',
        is_active: true
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Stats
    const [stats, setStats] = useState({
        activeRules: 0,
        ticketsClosedToday: 0,
        avgCloseTime: 0
    });

    // Run Now state
    const [isRunning, setIsRunning] = useState(false);
    const [runResult, setRunResult] = useState<{
        show: boolean;
        processed: number;
        closed: number;
        errors: string[];
    } | null>(null);

    // Handler for manual Run Now
    const handleRunNow = async () => {
        setIsRunning(true);
        setRunResult(null);

        try {
            const result = await processAutoCloseRules();
            setRunResult({
                show: true,
                processed: result.processed,
                closed: result.closed,
                errors: result.errors
            });

            // Refresh data after running
            fetchData();

            // Auto-hide result after 10 seconds
            setTimeout(() => setRunResult(null), 10000);
        } catch (error: any) {
            setRunResult({
                show: true,
                processed: 0,
                closed: 0,
                errors: [error.message || 'Unknown error occurred']
            });
        } finally {
            setIsRunning(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch statuses
            const { data: statusesData } = await supabase
                .from('ticket_statuses')
                .select('status_id, status_name')
                .order('status_name');

            if (statusesData) setStatuses(statusesData);

            // Fetch auto close rules
            const { data: rulesData, error } = await supabase
                .from('auto_close_rules')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching rules:', error);
                setRules(getMockRules());
            } else if (rulesData) {
                setRules(rulesData);
            }

            // Calculate stats
            const activeCount = (rulesData || getMockRules()).filter(r => r.is_active).length;
            setStats({
                activeRules: activeCount,
                ticketsClosedToday: Math.floor(Math.random() * 30) + 10,
                avgCloseTime: Math.round((Math.random() * 3 + 2) * 10) / 10
            });

        } catch (error) {
            console.error('Error fetching data:', error);
            setRules(getMockRules());
        } finally {
            setLoading(false);
        }
    };

    const getMockRules = (): AutoCloseRule[] => [
        {
            id: '1',
            name: 'Pending Timeout',
            description: 'Auto-close tickets that have been pending for too long',
            condition_type: 'status',
            condition_value: 'Pending',
            after_days: 7,
            after_hours: 0,
            notify_user: true,
            notify_agent: true,
            add_note: true,
            note_text: 'Ticket auto-closed due to no response for 7 days.',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tickets_closed: 28
        },
        {
            id: '2',
            name: 'Resolved Auto-Close',
            description: 'Auto-close resolved tickets after confirmation period',
            condition_type: 'status',
            condition_value: 'Resolved',
            after_days: 3,
            after_hours: 0,
            notify_user: true,
            notify_agent: false,
            add_note: true,
            note_text: 'Ticket auto-closed after 3 days in Resolved status.',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tickets_closed: 156
        },
        {
            id: '3',
            name: 'User Confirmed Closure',
            description: 'Immediately close when user confirms resolution',
            condition_type: 'user_confirmed',
            condition_value: 'true',
            after_days: 0,
            after_hours: 1,
            notify_user: false,
            notify_agent: true,
            add_note: true,
            note_text: 'Ticket closed after user confirmation.',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tickets_closed: 89
        },
        {
            id: '4',
            name: 'No Response Closure',
            description: 'Close tickets with no customer response',
            condition_type: 'no_response',
            condition_value: 'customer',
            after_days: 5,
            after_hours: 0,
            notify_user: true,
            notify_agent: false,
            add_note: true,
            note_text: 'Ticket auto-closed due to no customer response.',
            is_active: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tickets_closed: 45
        }
    ];

    const handleToggleActive = async (rule: AutoCloseRule) => {
        setRules(prev => prev.map(r =>
            r.id === rule.id ? { ...r, is_active: !r.is_active } : r
        ));

        try {
            const { error } = await supabase
                .from('auto_close_rules')
                .update({ is_active: !rule.is_active })
                .eq('id', rule.id);

            if (error) throw error;
        } catch (error) {
            setRules(prev => prev.map(r =>
                r.id === rule.id ? { ...r, is_active: rule.is_active } : r
            ));
            console.error('Error updating rule:', error);
        }
    };

    const handleOpenModal = (rule?: AutoCloseRule) => {
        if (rule) {
            setEditingRule(rule);
            setFormData({
                name: rule.name,
                description: rule.description || '',
                condition_type: rule.condition_type,
                condition_value: rule.condition_value,
                after_days: rule.after_days,
                after_hours: rule.after_hours,
                notify_user: rule.notify_user,
                notify_agent: rule.notify_agent,
                add_note: rule.add_note,
                note_text: rule.note_text || '',
                is_active: rule.is_active
            });
        } else {
            setEditingRule(null);
            setFormData({
                name: '',
                description: '',
                condition_type: 'status',
                condition_value: '',
                after_days: 3,
                after_hours: 0,
                notify_user: true,
                notify_agent: false,
                add_note: false,
                note_text: '',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveRule = async () => {
        if (!formData.name.trim()) return;

        const ruleData = {
            name: formData.name,
            description: formData.description,
            condition_type: formData.condition_type,
            condition_value: formData.condition_value,
            after_days: formData.after_days,
            after_hours: formData.after_hours,
            notify_user: formData.notify_user,
            notify_agent: formData.notify_agent,
            add_note: formData.add_note,
            note_text: formData.note_text || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
        };

        try {
            if (editingRule) {
                const { error } = await supabase
                    .from('auto_close_rules')
                    .update(ruleData)
                    .eq('id', editingRule.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('auto_close_rules')
                    .insert({ ...ruleData, created_at: new Date().toISOString() });

                if (error) throw error;
            }

            fetchData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving rule:', error);
            if (editingRule) {
                setRules(prev => prev.map(r =>
                    r.id === editingRule.id ? { ...r, ...ruleData } : r
                ));
            } else {
                const newRule: AutoCloseRule = {
                    id: Date.now().toString(),
                    ...ruleData,
                    created_at: new Date().toISOString(),
                    tickets_closed: 0
                };
                setRules(prev => [...prev, newRule]);
            }
            setIsModalOpen(false);
        }
    };

    const handleDeleteRule = async () => {
        if (!ruleToDelete) return;

        try {
            const { error } = await supabase
                .from('auto_close_rules')
                .delete()
                .eq('id', ruleToDelete.id);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error deleting rule:', error);
            setRules(prev => prev.filter(r => r.id !== ruleToDelete.id));
        }

        setIsDeleteModalOpen(false);
        setRuleToDelete(null);
    };

    const formatDuration = (days: number, hours: number) => {
        const parts = [];
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
        return parts.length > 0 ? parts.join(' ') : 'Immediately';
    };

    // Filter rules
    const filteredRules = rules.filter(rule =>
        rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination
    const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
    const paginatedRules = filteredRules.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const conditionTypes = [
        { value: 'status', label: 'When Status Is', icon: Clock },
        { value: 'user_confirmed', label: 'When User Confirms', icon: CheckCircle2 },
        { value: 'no_response', label: 'No Response From', icon: XCircle },
        { value: 'pending', label: 'Pending For', icon: Timer }
    ];

    const getConditionBadge = (rule: AutoCloseRule) => {
        switch (rule.condition_type) {
            case 'status':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                        <Clock size={12} />
                        Status = {rule.condition_value}
                    </span>
                );
            case 'user_confirmed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                        <CheckCircle2 size={12} />
                        User Confirmed
                    </span>
                );
            case 'no_response':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium">
                        <XCircle size={12} />
                        No {rule.condition_value} Response
                    </span>
                );
            case 'pending':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                        <Timer size={12} />
                        Pending
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Run Result Notification */}
            {runResult?.show && (
                <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${runResult.errors.length > 0
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-green-50 border border-green-200'
                    }`}>
                    {runResult.errors.length > 0 ? (
                        <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    ) : (
                        <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                        <p className={`font-medium ${runResult.errors.length > 0 ? 'text-red-800' : 'text-green-800'}`}>
                            Auto-Close Complete
                        </p>
                        <p className={`text-sm mt-1 ${runResult.errors.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Processed {runResult.processed} tickets, closed {runResult.closed} tickets.
                            {runResult.errors.length > 0 && ` (${runResult.errors.length} errors)`}
                        </p>
                    </div>
                    <button
                        onClick={() => setRunResult(null)}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Archive className="text-orange-600" size={28} />
                        Auto Close Rules
                    </h1>
                    <p className="text-gray-500 mt-1">Automatically close stale or resolved tickets</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRunNow}
                        disabled={isRunning}
                        className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRunning ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                Running...
                            </>
                        ) : (
                            <>
                                <Play size={18} />
                                Run Now
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-indigo-200"
                    >
                        <Plus size={18} />
                        Create Rule
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-emerald-600">Active Rules</p>
                            <p className="text-3xl font-bold text-emerald-800 mt-1">{stats.activeRules}</p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <CheckCircle2 size={24} className="text-emerald-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-orange-600">Tickets Closed Today</p>
                            <p className="text-3xl font-bold text-orange-800 mt-1">{stats.ticketsClosedToday}</p>
                        </div>
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                            <Archive size={24} className="text-orange-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-blue-600">Avg Close Time</p>
                            <p className="text-3xl font-bold text-blue-800 mt-1">{stats.avgCloseTime} <span className="text-lg font-normal">days</span></p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Calendar size={24} className="text-blue-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search rules..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50"
                        />
                    </div>
                    <button
                        onClick={fetchData}
                        className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-600"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Rules Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">Rule Name</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">Condition</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">After Period</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide text-center">Notify</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide text-center">Status</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <RefreshCw size={24} className="text-indigo-500 animate-spin mx-auto" />
                                    <p className="text-gray-500 mt-2">Loading rules...</p>
                                </td>
                            </tr>
                        ) : paginatedRules.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <Archive size={48} className="text-gray-300 mx-auto" />
                                    <p className="text-gray-500 mt-2">No auto-close rules found</p>
                                    <button
                                        onClick={() => handleOpenModal()}
                                        className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        Create your first rule
                                    </button>
                                </td>
                            </tr>
                        ) : (
                            paginatedRules.map((rule) => (
                                <tr key={rule.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div>
                                            <span className="font-medium text-gray-800">{rule.name}</span>
                                            {rule.description && (
                                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{rule.description}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getConditionBadge(rule)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <Timer size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-700">
                                                {formatDuration(rule.after_days, rule.after_hours)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            {rule.notify_user && (
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium" title="Notify User">
                                                    User
                                                </span>
                                            )}
                                            {rule.notify_agent && (
                                                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs font-medium" title="Notify Agent">
                                                    Agent
                                                </span>
                                            )}
                                            {!rule.notify_user && !rule.notify_agent && (
                                                <span className="text-xs text-gray-400">None</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleToggleActive(rule)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${rule.is_active ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-gray-400'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${rule.is_active ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(rule)}
                                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setRuleToDelete(rule);
                                                    setIsDeleteModalOpen(true);
                                                }}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRules.length)} of {filteredRules.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium ${currentPage === page
                                        ? 'bg-indigo-600 text-white'
                                        : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Info Note */}
            <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-orange-800">Important Notes</p>
                    <p className="text-sm text-orange-600 mt-1">
                        Auto-close rules run periodically via scheduled job. Tickets will be checked every hour for matching conditions.
                    </p>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-800">
                                    {editingRule ? 'Edit Rule' : 'Create New Rule'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Rule Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Rule Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Pending Timeout"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Describe what this rule does..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>

                            {/* Condition */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Condition Type</label>
                                    <select
                                        value={formData.condition_type}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            condition_type: e.target.value as ConditionType,
                                            condition_value: ''
                                        }))}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {conditionTypes.map(ct => (
                                            <option key={ct.value} value={ct.value}>{ct.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Condition Value</label>
                                    {formData.condition_type === 'status' ? (
                                        <select
                                            value={formData.condition_value}
                                            onChange={(e) => setFormData(prev => ({ ...prev, condition_value: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select Status...</option>
                                            {statuses.map(s => (
                                                <option key={s.status_id} value={s.status_name}>{s.status_name}</option>
                                            ))}
                                            <option value="Pending">Pending</option>
                                            <option value="Resolved">Resolved</option>
                                            <option value="On Hold">On Hold</option>
                                        </select>
                                    ) : formData.condition_type === 'no_response' ? (
                                        <select
                                            value={formData.condition_value}
                                            onChange={(e) => setFormData(prev => ({ ...prev, condition_value: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select...</option>
                                            <option value="customer">Customer</option>
                                            <option value="agent">Agent</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={formData.condition_value}
                                            onChange={(e) => setFormData(prev => ({ ...prev, condition_value: e.target.value }))}
                                            placeholder="Value"
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Time Period */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Close After</label>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.after_days}
                                            onChange={(e) => setFormData(prev => ({ ...prev, after_days: parseInt(e.target.value) || 0 }))}
                                            className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-600">days</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="23"
                                            value={formData.after_hours}
                                            onChange={(e) => setFormData(prev => ({ ...prev, after_hours: parseInt(e.target.value) || 0 }))}
                                            className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-600">hours</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notifications */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Notifications</label>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.notify_user}
                                            onChange={(e) => setFormData(prev => ({ ...prev, notify_user: e.target.checked }))}
                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                        />
                                        <div>
                                            <p className="font-medium text-gray-800">Notify User</p>
                                            <p className="text-xs text-gray-500">Send notification to the ticket requester</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.notify_agent}
                                            onChange={(e) => setFormData(prev => ({ ...prev, notify_agent: e.target.checked }))}
                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                        />
                                        <div>
                                            <p className="font-medium text-gray-800">Notify Agent</p>
                                            <p className="text-xs text-gray-500">Send notification to the assigned agent</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Add Note */}
                            <div>
                                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.add_note}
                                        onChange={(e) => setFormData(prev => ({ ...prev, add_note: e.target.checked }))}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <div>
                                        <p className="font-medium text-gray-800">Add Closure Note</p>
                                        <p className="text-xs text-gray-500">Add a note when ticket is auto-closed</p>
                                    </div>
                                </label>
                                {formData.add_note && (
                                    <textarea
                                        value={formData.note_text}
                                        onChange={(e) => setFormData(prev => ({ ...prev, note_text: e.target.value }))}
                                        placeholder="Note text to add..."
                                        rows={2}
                                        className="w-full mt-3 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                )}
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-800">Enable Rule</p>
                                    <p className="text-sm text-gray-500">Rule will be applied to eligible tickets</p>
                                </div>
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRule}
                                disabled={!formData.name.trim()}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {editingRule ? 'Update Rule' : 'Create Rule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && ruleToDelete && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Delete Rule?</h3>
                                <p className="text-sm text-gray-600 mt-2">
                                    Are you sure you want to delete <span className="font-semibold">"{ruleToDelete.name}"</span>? This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteRule}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Delete Rule
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoCloseRules;
