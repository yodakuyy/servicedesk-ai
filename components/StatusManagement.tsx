import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    GripVertical,
    Edit2,
    Lock,
    Check,
    X,
    AlertTriangle,
    HelpCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Status {
    status_id: string;
    status_name: string;
    status_code: string;
    sla_behavior: 'run' | 'pause' | 'stop';
    status_category: 'system' | 'agent';
    is_final: boolean;
    is_active: boolean;
    sort_order: number;
    description?: string;
    company_id?: number;
    is_used?: boolean;
}

const StatusManagement: React.FC = () => {
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState<Status | null>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [warningMessage, setWarningMessage] = useState('');
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [formData, setFormData] = useState({
        status_name: '',
        status_code: '',
        sla_behavior: 'run' as 'run' | 'pause' | 'stop',
        status_category: 'agent' as 'system' | 'agent',
        is_final: false,
        is_active: true,
        description: ''
    });

    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        fetchStatuses();
    }, []);

    const fetchStatuses = async () => {
        try {
            setLoading(true);
            console.log('🔍 Fetching statuses from ticket_statuses table...');

            const { data, error } = await supabase
                .from('ticket_statuses')
                .select('*')
                .order('sort_order', { ascending: true });

            console.log('📊 Fetched data:', data);
            console.log('❌ Error:', error);

            if (error) throw error;
            setStatuses(data || []);
        } catch (error) {
            console.error('Error fetching statuses:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateCode = (name: string) => {
        return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    };

    const handleOpenModal = (status?: Status) => {
        if (status) {
            setEditingStatus(status);
            setFormData({
                status_name: status.status_name,
                status_code: status.status_code,
                sla_behavior: status.sla_behavior,
                status_category: status.status_category,
                is_final: status.is_final,
                is_active: status.is_active,
                description: status.description || ''
            });
        } else {
            setEditingStatus(null);
            setFormData({
                status_name: '',
                status_code: '',
                sla_behavior: 'run',
                status_category: 'agent',
                is_final: false,
                is_active: true,
                description: ''
            });
        }
        setFormErrors({});
        setIsModalOpen(true);
    };

    const validateForm = (): boolean => {
        const errors: { [key: string]: string } = {};

        if (!formData.status_name.trim()) {
            errors.name = 'Status name is required';
        }

        if (!formData.status_code.trim()) {
            errors.code = 'Status code is required';
        }

        // Check for duplicate code
        const existingCode = statuses.find(
            s => s.status_code === formData.status_code && s.status_id !== editingStatus?.status_id
        );
        if (existingCode) {
            errors.code = 'Status code already exists';
        }

        // Validate: Final status cannot have SLA Behavior = Run
        if (formData.is_final && formData.sla_behavior === 'run') {
            errors.sla_behavior = 'Final status cannot have SLA running';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        // Check if editing status with changed SLA behavior
        if (editingStatus && editingStatus.sla_behavior !== formData.sla_behavior && editingStatus.is_used) {
            setWarningMessage('Changing SLA behavior may affect running SLA for existing tickets. Do you want to continue?');
            setPendingAction(() => () => performSave());
            setShowWarning(true);
            return;
        }

        await performSave();
    };

    const performSave = async () => {
        try {
            if (editingStatus) {
                const { error } = await supabase
                    .from('ticket_statuses')
                    .update({
                        status_name: formData.status_name,
                        status_code: formData.status_code,
                        sla_behavior: formData.sla_behavior,
                        status_category: formData.status_category,
                        is_final: formData.is_final,
                        is_active: formData.is_active,
                        description: formData.description
                    })
                    .eq('status_id', editingStatus.status_id);

                if (error) throw error;
            } else {
                const maxOrder = statuses.length > 0 ? Math.max(...statuses.map(s => s.sort_order || 0)) : 0;
                const { error } = await supabase
                    .from('ticket_statuses')
                    .insert([{
                        status_name: formData.status_name,
                        status_code: formData.status_code,
                        sla_behavior: formData.sla_behavior,
                        status_category: formData.status_category,
                        is_final: formData.is_final,
                        is_active: formData.is_active,
                        description: formData.description,
                        sort_order: maxOrder + 1
                    }]);

                if (error) throw error;
            }

            await fetchStatuses();
            setIsModalOpen(false);
            setShowWarning(false);
        } catch (error: any) {
            console.error('Error saving status:', error);
            alert('Error saving status: ' + error.message);
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newStatuses = [...statuses];
        const draggedItem = newStatuses[draggedIndex];
        newStatuses.splice(draggedIndex, 1);
        newStatuses.splice(index, 0, draggedItem);

        // Update sort_order
        newStatuses.forEach((s, i) => {
            s.sort_order = i + 1;
        });

        setStatuses(newStatuses);
        setDraggedIndex(index);
    };

    const handleDragEnd = async () => {
        setDraggedIndex(null);

        // Save new order to database
        try {
            for (const status of statuses) {
                await supabase
                    .from('ticket_statuses')
                    .update({ sort_order: status.sort_order })
                    .eq('status_id', status.status_id);
            }
        } catch (error) {
            console.error('Error saving order:', error);
        }
    };

    const getSLABadge = (behavior: string) => {
        switch (behavior) {
            case 'run':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">🟢 Run</span>;
            case 'pause':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">🟡 Pause</span>;
            case 'stop':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">🔴 Stop</span>;
            default:
                return null;
        }
    };

    const filteredStatuses = statuses.filter(s =>
        s.status_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.status_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination logic
    const totalPages = Math.ceil(filteredStatuses.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedStatuses = filteredStatuses.slice(startIndex, endIndex);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Empty state
    if (!loading && statuses.length === 0) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Status Management</h1>
                    <p className="text-gray-500">Manage master ticket statuses used across all departments</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">No statuses configured yet</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                        Statuses define ticket lifecycle and SLA behavior.
                    </p>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors mx-auto"
                    >
                        <Plus size={18} />
                        Add First Status
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800">Status Management</h1>
                <p className="text-gray-500">Manage master ticket statuses used across all departments</p>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Add Status
                </button>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search status..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64 bg-white"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-4 py-4 font-semibold text-xs text-gray-600 w-12">Order</th>
                            <th className="px-4 py-4 font-semibold text-xs text-gray-600">Status Name</th>
                            <th className="px-4 py-4 font-semibold text-xs text-gray-600">Code</th>
                            <th className="px-4 py-4 font-semibold text-xs text-gray-600">SLA Behavior</th>
                            <th className="px-4 py-4 font-semibold text-xs text-gray-600">Type</th>
                            <th className="px-4 py-4 font-semibold text-xs text-gray-600 text-center">Final</th>
                            <th className="px-4 py-4 font-semibold text-xs text-gray-600 text-center">Active</th>
                            <th className="px-4 py-4 font-semibold text-xs text-gray-600 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">Loading statuses...</td>
                            </tr>
                        ) : paginatedStatuses.map((status, index) => (
                            <tr
                                key={status.status_id}
                                draggable={status.status_category !== 'system'}
                                onDragStart={() => handleDragStart(startIndex + index)}
                                onDragOver={(e) => handleDragOver(e, startIndex + index)}
                                onDragEnd={handleDragEnd}
                                className={`hover:bg-gray-50/50 transition-colors ${draggedIndex === (startIndex + index) ? 'bg-indigo-50' : ''}`}
                            >
                                <td className="px-4 py-4">
                                    <div className={`cursor-${status.status_category === 'system' ? 'not-allowed' : 'grab'} text-gray-400`}>
                                        <GripVertical size={18} className={status.status_category === 'system' ? 'opacity-30' : ''} />
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="font-medium text-gray-800">{status.status_name}</span>
                                </td>
                                <td className="px-4 py-4">
                                    <code className="text-sm bg-gray-100 px-2 py-0.5 rounded text-gray-600">{status.status_code}</code>
                                </td>
                                <td className="px-4 py-4">
                                    {getSLABadge(status.sla_behavior)}
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`text-sm font-medium ${status.status_category === 'system' ? 'text-purple-600' : 'text-blue-600'}`}>
                                        {status.status_category === 'system' ? 'System' : 'Agent'}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-center">
                                    {status.is_final ? (
                                        <Check size={18} className="text-green-500 mx-auto" />
                                    ) : (
                                        <X size={18} className="text-gray-300 mx-auto" />
                                    )}
                                </td>
                                <td className="px-4 py-4 text-center">
                                    {status.is_active ? (
                                        <Check size={18} className="text-green-500 mx-auto" />
                                    ) : (
                                        <X size={18} className="text-gray-300 mx-auto" />
                                    )}
                                </td>
                                <td className="px-4 py-4 text-right">
                                    {status.status_category === 'system' ? (
                                        <Lock size={16} className="text-gray-400 inline" title="System status - cannot edit" />
                                    ) : (
                                        <button
                                            onClick={() => handleOpenModal(status)}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Showing {startIndex + 1} to {Math.min(endIndex, filteredStatuses.length)} of {filteredStatuses.length} statuses
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === page
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
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingStatus ? 'Edit Status' : 'Add Status'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Status Name */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Status Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.status_name}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        setFormData({
                                            ...formData,
                                            status_name: name,
                                            status_code: editingStatus ? formData.status_code : generateCode(name)
                                        });
                                    }}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm ${formErrors.name ? 'border-red-300' : 'border-gray-200'}`}
                                    placeholder="e.g. Pending – Vendor"
                                />
                                {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                            </div>

                            {/* Status Code */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Status Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.status_code}
                                    onChange={(e) => setFormData({ ...formData, status_code: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-mono ${formErrors.code ? 'border-red-300' : 'border-gray-200'}`}
                                    placeholder="e.g. pending_vendor"
                                />
                                {formErrors.code && <p className="text-xs text-red-500 mt-1">{formErrors.code}</p>}
                            </div>

                            {/* Status Type */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status Type</label>
                                <div className="flex gap-4">
                                    <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${formData.status_category === 'system' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input
                                            type="radio"
                                            name="status_category"
                                            value="system"
                                            checked={formData.status_category === 'system'}
                                            onChange={() => setFormData({ ...formData, status_category: 'system' })}
                                            className="text-indigo-600"
                                            disabled={editingStatus !== null}
                                        />
                                        <span className="text-sm font-medium">System</span>
                                    </label>
                                    <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${formData.status_category === 'agent' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input
                                            type="radio"
                                            name="status_category"
                                            value="agent"
                                            checked={formData.status_category === 'agent'}
                                            onChange={() => setFormData({ ...formData, status_category: 'agent' })}
                                            className="text-indigo-600"
                                        />
                                        <span className="text-sm font-medium">Agent</span>
                                    </label>
                                </div>
                            </div>

                            {/* SLA Behavior */}
                            <div>
                                <label className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-1.5">
                                    SLA Behavior <span className="text-red-500">*</span>
                                    <div className="group relative">
                                        <HelpCircle size={14} className="text-gray-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                            <p><strong>Run:</strong> SLA is running</p>
                                            <p><strong>Pause:</strong> SLA pauses temporarily</p>
                                            <p><strong>Stop:</strong> SLA stops permanently</p>
                                        </div>
                                    </div>
                                </label>
                                <div className="flex flex-col gap-2">
                                    {['run', 'pause', 'stop'].map((behavior) => (
                                        <label
                                            key={behavior}
                                            className={`flex items-center gap-3 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${formData.sla_behavior === behavior ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="sla_behavior"
                                                value={behavior}
                                                checked={formData.sla_behavior === behavior}
                                                onChange={() => setFormData({ ...formData, sla_behavior: behavior as any })}
                                                className="text-indigo-600"
                                            />
                                            <span className="text-sm font-medium capitalize flex items-center gap-2">
                                                {behavior === 'run' && '🟢'}
                                                {behavior === 'pause' && '🟡'}
                                                {behavior === 'stop' && '🔴'}
                                                {behavior.charAt(0).toUpperCase() + behavior.slice(1)}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {formErrors.sla_behavior && <p className="text-xs text-red-500 mt-1">{formErrors.sla_behavior}</p>}
                            </div>

                            {/* Is Final Status */}
                            <div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_final}
                                        onChange={(e) => setFormData({ ...formData, is_final: e.target.checked })}
                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Is Final Status</span>
                                        <p className="text-xs text-gray-500">Ticket cannot move to any other status</p>
                                    </div>
                                </label>
                            </div>

                            {/* Active */}
                            <div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Status is active</span>
                                </label>
                            </div>

                            {/* Description */}
                            <div className="border-t border-gray-100 pt-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm resize-none"
                                    placeholder="e.g. Used when waiting for external vendor"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm shadow-indigo-200"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={24} className="text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Warning</h3>
                                <p className="text-sm text-gray-600">{warningMessage}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowWarning(false);
                                    setPendingAction(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (pendingAction) pendingAction();
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusManagement;
