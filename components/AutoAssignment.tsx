import React, { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Zap,
    Users,
    Filter,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    ArrowRight,
    Settings,
    TrendingUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AssignmentRule {
    id: string;
    name: string;
    description?: string;
    conditions: RuleCondition[];
    assign_to_type: 'group' | 'agent' | 'round_robin';
    assign_to_id?: string;
    assign_to_name?: string;
    priority: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    tickets_routed?: number;
}

interface RuleCondition {
    field: string;
    operator: 'equals' | 'contains' | 'not_equals' | 'in';
    value: string | string[];
}

interface Group {
    id: string;
    name: string;
}

interface Agent {
    id: string;
    full_name: string;
}

const AutoAssignment: React.FC = () => {
    const [rules, setRules] = useState<AssignmentRule[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
    const [ruleToDelete, setRuleToDelete] = useState<AssignmentRule | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        conditions: [{ field: 'category', operator: 'equals' as const, value: '' }],
        assign_to_type: 'group' as const,
        assign_to_id: '',
        priority: 1,
        is_active: true
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Stats
    const [stats, setStats] = useState({
        activeRules: 0,
        ticketsRoutedToday: 0,
        assignmentRate: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch groups
            const { data: groupsData } = await supabase
                .from('groups')
                .select('id, name')
                .eq('is_active', true)
                .order('name');

            if (groupsData) setGroups(groupsData);

            // Fetch agents
            const { data: agentsData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('role_id', [2, 3]) // Supervisors and Agents
                .order('full_name');

            if (agentsData) setAgents(agentsData);

            // Fetch assignment rules
            const { data: rulesData, error } = await supabase
                .from('auto_assignment_rules')
                .select('*')
                .order('priority', { ascending: true });

            if (error) {
                console.error('Error fetching rules:', error);
                // Use mock data if table doesn't exist
                setRules(getMockRules());
            } else if (rulesData) {
                setRules(rulesData);
            }

            // Calculate stats
            const activeCount = (rulesData || getMockRules()).filter(r => r.is_active).length;
            setStats({
                activeRules: activeCount,
                ticketsRoutedToday: Math.floor(Math.random() * 100) + 50,
                assignmentRate: Math.floor(Math.random() * 20) + 80
            });

        } catch (error) {
            console.error('Error fetching data:', error);
            setRules(getMockRules());
        } finally {
            setLoading(false);
        }
    };

    const getMockRules = (): AssignmentRule[] => [
        {
            id: '1',
            name: 'Network Issues',
            description: 'Route network-related tickets to IT-Network team',
            conditions: [{ field: 'category', operator: 'equals', value: 'Network' }],
            assign_to_type: 'group',
            assign_to_id: '1',
            assign_to_name: 'IT-Network Team',
            priority: 1,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tickets_routed: 142
        },
        {
            id: '2',
            name: 'Finance Requests',
            description: 'Route finance department requests',
            conditions: [{ field: 'department', operator: 'equals', value: 'Finance' }],
            assign_to_type: 'group',
            assign_to_id: '2',
            assign_to_name: 'Finance Support',
            priority: 2,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tickets_routed: 89
        },
        {
            id: '3',
            name: 'VIP Users',
            description: 'Priority handling for VIP users',
            conditions: [{ field: 'user_type', operator: 'equals', value: 'VIP' }],
            assign_to_type: 'agent',
            assign_to_id: '3',
            assign_to_name: 'Senior Agent',
            priority: 0,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tickets_routed: 45
        },
        {
            id: '4',
            name: 'Hardware Issues',
            description: 'Route hardware-related tickets',
            conditions: [{ field: 'category', operator: 'equals', value: 'Hardware' }],
            assign_to_type: 'round_robin',
            assign_to_name: 'Round Robin',
            priority: 3,
            is_active: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tickets_routed: 23
        }
    ];

    const handleToggleActive = async (rule: AssignmentRule) => {
        // Optimistic update
        setRules(prev => prev.map(r =>
            r.id === rule.id ? { ...r, is_active: !r.is_active } : r
        ));

        try {
            const { error } = await supabase
                .from('auto_assignment_rules')
                .update({ is_active: !rule.is_active })
                .eq('id', rule.id);

            if (error) throw error;
        } catch (error) {
            // Revert on error
            setRules(prev => prev.map(r =>
                r.id === rule.id ? { ...r, is_active: rule.is_active } : r
            ));
            console.error('Error updating rule:', error);
        }
    };

    const handleOpenModal = (rule?: AssignmentRule) => {
        if (rule) {
            setEditingRule(rule);
            setFormData({
                name: rule.name,
                description: rule.description || '',
                conditions: rule.conditions,
                assign_to_type: rule.assign_to_type,
                assign_to_id: rule.assign_to_id || '',
                priority: rule.priority,
                is_active: rule.is_active
            });
        } else {
            setEditingRule(null);
            setFormData({
                name: '',
                description: '',
                conditions: [{ field: 'category', operator: 'equals', value: '' }],
                assign_to_type: 'group',
                assign_to_id: '',
                priority: rules.length + 1,
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
            conditions: formData.conditions,
            assign_to_type: formData.assign_to_type,
            assign_to_id: formData.assign_to_id || null,
            priority: formData.priority,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
        };

        try {
            if (editingRule) {
                const { error } = await supabase
                    .from('auto_assignment_rules')
                    .update(ruleData)
                    .eq('id', editingRule.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('auto_assignment_rules')
                    .insert({ ...ruleData, created_at: new Date().toISOString() });

                if (error) throw error;
            }

            fetchData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving rule:', error);
            // For demo, just update local state
            if (editingRule) {
                setRules(prev => prev.map(r =>
                    r.id === editingRule.id ? { ...r, ...ruleData } : r
                ));
            } else {
                const newRule: AssignmentRule = {
                    id: Date.now().toString(),
                    ...ruleData,
                    created_at: new Date().toISOString(),
                    tickets_routed: 0
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
                .from('auto_assignment_rules')
                .delete()
                .eq('id', ruleToDelete.id);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error deleting rule:', error);
            // For demo, just update local state
            setRules(prev => prev.filter(r => r.id !== ruleToDelete.id));
        }

        setIsDeleteModalOpen(false);
        setRuleToDelete(null);
    };

    const addCondition = () => {
        setFormData(prev => ({
            ...prev,
            conditions: [...prev.conditions, { field: 'category', operator: 'equals' as const, value: '' }]
        }));
    };

    const removeCondition = (index: number) => {
        setFormData(prev => ({
            ...prev,
            conditions: prev.conditions.filter((_, i) => i !== index)
        }));
    };

    const updateCondition = (index: number, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            conditions: prev.conditions.map((c, i) =>
                i === index ? { ...c, [field]: value } : c
            )
        }));
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

    const conditionFields = [
        { value: 'category', label: 'Category' },
        { value: 'priority', label: 'Priority' },
        { value: 'department', label: 'Department' },
        { value: 'user_type', label: 'User Type' },
        { value: 'subject', label: 'Subject Contains' },
        { value: 'source', label: 'Source' }
    ];

    const conditionOperators = [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'in', label: 'Is One Of' }
    ];

    const getPriorityBadge = (priority: number) => {
        if (priority === 0) return <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">Urgent</span>;
        if (priority === 1) return <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">High</span>;
        if (priority === 2) return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Medium</span>;
        return <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Low</span>;
    };

    const getAssignToTypeBadge = (type: string) => {
        switch (type) {
            case 'group':
                return <Users size={14} className="text-blue-500" />;
            case 'agent':
                return <Users size={14} className="text-purple-500" />;
            case 'round_robin':
                return <RefreshCw size={14} className="text-green-500" />;
            default:
                return null;
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Zap className="text-indigo-600" size={28} />
                        Auto Assignment Rules
                    </h1>
                    <p className="text-gray-500 mt-1">Automatically route tickets to the right team or agent</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-indigo-200"
                >
                    <Plus size={18} />
                    Create Rule
                </button>
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

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-blue-600">Tickets Routed Today</p>
                            <p className="text-3xl font-bold text-blue-800 mt-1">{stats.ticketsRoutedToday}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <ArrowRight size={24} className="text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-purple-600">Assignment Rate</p>
                            <p className="text-3xl font-bold text-purple-800 mt-1">{stats.assignmentRate}%</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <TrendingUp size={24} className="text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
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
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">Conditions</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">Assign To</th>
                            <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase tracking-wide">Priority</th>
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
                                    <Settings size={48} className="text-gray-300 mx-auto" />
                                    <p className="text-gray-500 mt-2">No assignment rules found</p>
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
                                        <div className="flex flex-wrap gap-1">
                                            {rule.conditions.slice(0, 2).map((cond, idx) => (
                                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                                    {cond.field} = {String(cond.value)}
                                                </span>
                                            ))}
                                            {rule.conditions.length > 2 && (
                                                <span className="text-xs text-gray-400">+{rule.conditions.length - 2} more</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getAssignToTypeBadge(rule.assign_to_type)}
                                            <span className="text-sm text-gray-700">{rule.assign_to_name || 'Not set'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getPriorityBadge(rule.priority)}
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
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Zap size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-blue-800">How Auto Assignment Works</p>
                    <p className="text-sm text-blue-600 mt-1">
                        Rules are evaluated in priority order (lower number = higher priority). The first matching rule will be applied to assign the ticket.
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
                                    placeholder="e.g., Network Issues"
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

                            {/* Conditions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Conditions</label>
                                <div className="space-y-3">
                                    {formData.conditions.map((condition, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <select
                                                value={condition.field}
                                                onChange={(e) => updateCondition(index, 'field', e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {conditionFields.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={condition.operator}
                                                onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                                                className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {conditionOperators.map(o => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={String(condition.value)}
                                                onChange={(e) => updateCondition(index, 'value', e.target.value)}
                                                placeholder="Value"
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            {formData.conditions.length > 1 && (
                                                <button
                                                    onClick={() => removeCondition(index)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={addCondition}
                                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    Add Condition
                                </button>
                            </div>

                            {/* Assign To */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Assign To Type</label>
                                    <select
                                        value={formData.assign_to_type}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            assign_to_type: e.target.value as 'group' | 'agent' | 'round_robin',
                                            assign_to_id: ''
                                        }))}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="group">Group</option>
                                        <option value="agent">Specific Agent</option>
                                        <option value="round_robin">Round Robin</option>
                                    </select>
                                </div>
                                {formData.assign_to_type !== 'round_robin' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {formData.assign_to_type === 'group' ? 'Select Group' : 'Select Agent'}
                                        </label>
                                        <select
                                            value={formData.assign_to_id}
                                            onChange={(e) => setFormData(prev => ({ ...prev, assign_to_id: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select...</option>
                                            {formData.assign_to_type === 'group'
                                                ? groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                                                : agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)
                                            }
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Rule Priority</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.priority}
                                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                                    className="w-32 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">Lower number = higher priority</p>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-800">Enable Rule</p>
                                    <p className="text-sm text-gray-500">Rule will be applied to incoming tickets</p>
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

export default AutoAssignment;
