import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Edit2, Trash2, X, ChevronDown, ChevronLeft, ChevronRight,
    Clock, CheckCircle2, AlertTriangle, Building2, Save, ArrowLeft,
    Filter, RefreshCw, Copy, Eye, PlayCircle, PauseCircle, StopCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Types
interface SLAMetric {
    priority: string;
    time_value: number;
    time_unit: 'minutes' | 'hours' | 'days';
}

interface SLACondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'in' | 'not_in';
    value: string | string[];
}

interface SLAPolicy {
    id: string;
    name: string;
    description: string;
    company_id: number | null;
    company_name?: string;
    business_hours_id: string | null;
    business_hours_name?: string;
    is_active: boolean;
    conditions: SLACondition[];
    response_sla: SLAMetric[];
    resolution_sla: SLAMetric[];
    enable_resolution_sla: boolean;
    created_at?: string;
    updated_at?: string;
}

interface Company { company_id: number; company_name: string; }
interface BusinessHour { id: string; name: string; }
interface Category { id: string; name: string; }
interface Status { status_id: string; status_name: string; sla_behavior: string; }

// Mock Data
const mockPolicies: SLAPolicy[] = [
    {
        id: '1', name: 'IT Support - Standard', description: 'Standard SLA for IT support tickets',
        company_id: 1, company_name: 'IT Department', business_hours_id: '1', business_hours_name: '24/7 Support',
        is_active: true,
        conditions: [
            { field: 'company', operator: 'equals', value: 'IT Department' },
            { field: 'ticket_type', operator: 'equals', value: 'Incident' }
        ],
        response_sla: [
            { priority: 'Urgent', time_value: 15, time_unit: 'minutes' },
            { priority: 'High', time_value: 30, time_unit: 'minutes' },
            { priority: 'Medium', time_value: 2, time_unit: 'hours' },
            { priority: 'Low', time_value: 4, time_unit: 'hours' }
        ],
        resolution_sla: [
            { priority: 'Urgent', time_value: 2, time_unit: 'hours' },
            { priority: 'High', time_value: 4, time_unit: 'hours' },
            { priority: 'Medium', time_value: 24, time_unit: 'hours' },
            { priority: 'Low', time_value: 72, time_unit: 'hours' }
        ],
        enable_resolution_sla: true
    },
    {
        id: '2', name: 'HR - General Request', description: 'General HR service requests',
        company_id: 2, company_name: 'HR Department', business_hours_id: '2', business_hours_name: 'Business Hours',
        is_active: true,
        conditions: [{ field: 'company', operator: 'equals', value: 'HR Department' }],
        response_sla: [
            { priority: 'High', time_value: 2, time_unit: 'hours' },
            { priority: 'Medium', time_value: 8, time_unit: 'hours' },
            { priority: 'Low', time_value: 24, time_unit: 'hours' }
        ],
        resolution_sla: [], enable_resolution_sla: false
    }
];

const priorities = ['Urgent', 'High', 'Medium', 'Low'];
const timeUnits = [
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' }
];
const conditionFields = [
    { value: 'company', label: 'Company / Department' },
    { value: 'ticket_type', label: 'Ticket Type' },
    { value: 'category', label: 'Category' },
    { value: 'priority', label: 'Priority' }
];
const conditionOperators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'in', label: 'In' },
    { value: 'not_in', label: 'Not In' }
];

interface SLAPoliciesProps {
    initialPolicyId?: string | null;
    onClearInitial?: () => void;
}

const SLAPolicies: React.FC<SLAPoliciesProps> = ({ initialPolicyId, onClearInitial }) => {
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [policies, setPolicies] = useState<SLAPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPolicy, setSelectedPolicy] = useState<SLAPolicy | null>(null);

    // Reference data
    const [companies, setCompanies] = useState<Company[]>([]);
    const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [statuses, setStatuses] = useState<Status[]>([]);

    // Form state
    const [formData, setFormData] = useState<SLAPolicy>({
        id: '', name: '', description: '', company_id: null, business_hours_id: null,
        is_active: true, conditions: [], response_sla: priorities.map(p => ({ priority: p, time_value: 4, time_unit: 'hours' })),
        resolution_sla: priorities.map(p => ({ priority: p, time_value: 24, time_unit: 'hours' })),
        enable_resolution_sla: false
    });
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [policyToDelete, setPolicyToDelete] = useState<SLAPolicy | null>(null);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [warningCount, setWarningCount] = useState(0);

    // Toast notification
    const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({
        show: false, type: 'success', message: ''
    });
    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ show: true, type, message });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    };

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [companiesRes, businessHoursRes, categoriesRes, statusesRes] = await Promise.all([
                supabase.from('company').select('company_id, company_name').order('company_name'),
                supabase.from('business_hours').select('id, name').order('name'),
                supabase.from('ticket_categories').select('id, name').order('name'),
                supabase.from('ticket_statuses').select('status_id, status_name, sla_behavior').order('sort_order')
            ]);
            if (companiesRes.data) setCompanies(companiesRes.data);
            if (businessHoursRes.data) setBusinessHours(businessHoursRes.data);
            if (categoriesRes.data) setCategories(categoriesRes.data);
            if (statusesRes.data) setStatuses(statusesRes.data);

            // Fetch SLA policies with company join
            const { data: policiesData, error: policiesError } = await supabase
                .from('sla_policies')
                .select(`
                    *,
                    company:company_id(company_name)
                `)
                .order('name');

            // Fetch SLA targets
            const { data: targetsData } = await supabase
                .from('sla_targets')
                .select('*');

            if (policiesError) {
                console.error('Error fetching SLA policies:', policiesError);
                setPolicies(mockPolicies);
            } else if (policiesData) {
                // Transform data
                const transformedPolicies: SLAPolicy[] = policiesData.map((policy: any) => {
                    // Get targets for this policy
                    const policyTargets = targetsData?.filter((t: any) => t.sla_policy_id === policy.id) || [];

                    // Helper to parse time
                    const parseTime = (minutes: number) => {
                        if (!minutes) return { value: 4, unit: 'hours' as const };
                        if (minutes % (24 * 60) === 0) return { value: minutes / (24 * 60), unit: 'days' as const };
                        if (minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' as const };
                        return { value: minutes, unit: 'minutes' as const };
                    };

                    // Transform targets to response/resolution SLA format
                    const responseSLA: SLAMetric[] = policyTargets
                        .filter((t: any) => t.sla_type === 'response')
                        .map((t: any) => {
                            const { value, unit } = parseTime(t.target_minutes);
                            return {
                                priority: t.priority || 'Medium',
                                time_value: value,
                                time_unit: unit
                            };
                        });

                    const resolutionSLA: SLAMetric[] = policyTargets
                        .filter((t: any) => t.sla_type === 'resolution')
                        .map((t: any) => {
                            const { value, unit } = parseTime(t.target_minutes);
                            return {
                                priority: t.priority || 'Medium',
                                time_value: value,
                                time_unit: unit
                            };
                        });

                    return {
                        id: policy.id?.toString(),
                        name: policy.name || 'Unnamed Policy',
                        description: policy.description || '',
                        company_id: policy.company_id,
                        company_name: policy.company?.company_name || 'Unknown',
                        business_hours_id: policy.business_hours_id?.toString() || null,
                        is_active: policy.is_active ?? true,
                        conditions: policy.conditions || [],
                        response_sla: responseSLA.length > 0 ? responseSLA : priorities.map(p => ({ priority: p, time_value: 4, time_unit: 'hours' as any })),
                        resolution_sla: resolutionSLA.length > 0 ? resolutionSLA : priorities.map(p => ({ priority: p, time_value: 24, time_unit: 'hours' as any })),
                        enable_resolution_sla: resolutionSLA.length > 0,
                        created_at: policy.created_at,
                        updated_at: policy.updated_at
                    };
                });
                setPolicies(transformedPolicies);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setPolicies(mockPolicies);
        } finally {
            setLoading(false);
        }
    };

    // Handle initial policy selection (from dashboard navigation)
    useEffect(() => {
        if (initialPolicyId && policies.length > 0 && view === 'list') {
            const policyToEdit = policies.find(p => p.id === initialPolicyId);
            if (policyToEdit) {
                console.log('Auto-opening policy for edit:', policyToEdit.name);
                handleEdit(policyToEdit);
                if (onClearInitial) onClearInitial(); // Clear ID to prevent re-opening if data refreshes
            }
        }
    }, [initialPolicyId, policies, view, onClearInitial]);

    const handleCreateNew = () => {
        setSelectedPolicy(null);
        setFormData({
            id: '', name: '', description: '', company_id: null, business_hours_id: null,
            is_active: true, conditions: [],
            response_sla: priorities.map(p => ({ priority: p, time_value: 4, time_unit: 'hours' })),
            resolution_sla: priorities.map(p => ({ priority: p, time_value: 24, time_unit: 'hours' })),
            enable_resolution_sla: false
        });
        setErrors({});
        setView('editor');
    };

    const handleEdit = (policy: SLAPolicy) => {
        setSelectedPolicy(policy);
        setFormData({ ...policy });
        setErrors({});
        setView('editor');
    };

    const handleDuplicate = (policy: SLAPolicy) => {
        setSelectedPolicy(null);
        setFormData({ ...policy, id: '', name: `${policy.name} (Copy)` });
        setErrors({});
        setView('editor');
    };

    const addCondition = () => {
        setFormData({
            ...formData,
            conditions: [...formData.conditions, { field: 'company', operator: 'equals', value: '' }]
        });
    };

    const removeCondition = (index: number) => {
        setFormData({
            ...formData,
            conditions: formData.conditions.filter((_, i) => i !== index)
        });
    };

    const updateCondition = (index: number, updates: { [key: string]: any }) => {
        const newConditions = [...formData.conditions];
        newConditions[index] = { ...newConditions[index], ...updates };
        setFormData({ ...formData, conditions: newConditions });
    };

    const updateResponseSLA = (priority: string, field: string, value: any) => {
        setFormData({
            ...formData,
            response_sla: formData.response_sla.map(s => s.priority === priority ? { ...s, [field]: value } : s)
        });
    };

    const updateResolutionSLA = (priority: string, field: string, value: any) => {
        setFormData({
            ...formData,
            resolution_sla: formData.resolution_sla.map(s => s.priority === priority ? { ...s, [field]: value } : s)
        });
    };

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.name.trim()) newErrors.name = 'Policy name is required';
        if (!formData.company_id) newErrors.company_id = 'Department is required';
        if (formData.conditions.length === 0) newErrors.conditions = 'At least one condition is required';
        formData.conditions.forEach((c, i) => {
            if (!c.value || (Array.isArray(c.value) && c.value.length === 0)) {
                newErrors[`condition_${i}`] = 'Condition value is required';
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const [showSaveConfirm, setShowSaveConfirm] = useState(false);

    const handleSave = () => {
        if (!validateForm()) return;
        setShowSaveConfirm(true);
    };

    const confirmSave = async () => {
        setShowSaveConfirm(false);

        // Check for overlapping policies first
        const overlapping = policies.filter(p =>
            p.id !== formData.id &&
            p.company_id === formData.company_id &&
            p.is_active
        );

        if (overlapping.length > 0) {
            setWarningCount(overlapping.length);
            setShowWarningModal(true);
            return;
        }

        await performSave();
    };

    const performSave = async () => {
        setSaving(true);
        try {
            // Convert time to minutes for database storage
            const convertToMinutes = (value: number, unit: string): number => {
                switch (unit) {
                    case 'minutes': return value;
                    case 'hours': return value * 60;
                    case 'days': return value * 60 * 24;
                    default: return value * 60;
                }
            };

            // Prepare policy data
            const policyData = {
                name: formData.name,
                description: formData.description,
                company_id: formData.company_id,
                business_hours_id: formData.business_hours_id || null,
                is_active: formData.is_active,
                conditions: formData.conditions,
                updated_at: new Date().toISOString()
            };

            let policyId: string;

            if (selectedPolicy) {
                // Update existing policy
                const { error } = await supabase
                    .from('sla_policies')
                    .update(policyData)
                    .eq('id', selectedPolicy.id);

                if (error) throw error;
                policyId = selectedPolicy.id;

                // Delete existing targets for this policy
                await supabase
                    .from('sla_targets')
                    .delete()
                    .eq('sla_policy_id', policyId);
            } else {
                // Insert new policy
                const { data: newPolicy, error } = await supabase
                    .from('sla_policies')
                    .insert(policyData)
                    .select()
                    .single();

                if (error) throw error;
                policyId = newPolicy.id.toString();
            }

            // Insert response SLA targets
            const responseTargets = formData.response_sla.map((sla) => ({
                sla_policy_id: policyId,
                sla_type: 'response',
                priority: sla.priority,
                // We populate both new and legacy columns to satisfy constraints and ensure compatibility
                target_minutes: convertToMinutes(sla.time_value, sla.time_unit),
                response_time_minutes: convertToMinutes(sla.time_value, sla.time_unit)
            }));

            if (responseTargets.length > 0) {
                const { error: responseError } = await supabase
                    .from('sla_targets')
                    .insert(responseTargets);

                if (responseError) {
                    console.error('Error saving response targets:', responseError);
                    throw new Error(`Failed to save response targets: ${responseError.message}`);
                }
            }

            // Insert resolution SLA targets (if enabled)
            if (formData.enable_resolution_sla && formData.resolution_sla.length > 0) {
                const resolutionTargets = formData.resolution_sla.map((sla) => ({
                    sla_policy_id: policyId,
                    sla_type: 'resolution',
                    priority: sla.priority,
                    target_minutes: convertToMinutes(sla.time_value, sla.time_unit),
                    // For resolution targets, we satisfy the NOT NULL constraint on response_time_minutes with 0
                    // This is a workaround until the schema constraint is relaxed
                    response_time_minutes: 0,
                    resolution_time_minutes: convertToMinutes(sla.time_value, sla.time_unit)
                }));

                const { error: resolutionError } = await supabase
                    .from('sla_targets')
                    .insert(resolutionTargets);

                if (resolutionError) {
                    console.error('Error saving resolution targets:', resolutionError);
                    throw new Error(`Failed to save resolution targets: ${resolutionError.message}`);
                }
            }

            // Refresh data from database
            await fetchData();
            showToast('success', `Policy "${formData.name}" saved successfully!`);
            setView('list');
        } catch (error: any) {
            console.error('Error saving policy:', error);
            showToast('error', 'Error saving policy: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const confirmSaveWithWarning = async () => {
        setShowWarningModal(false);
        await performSave();
    };

    const handleDelete = async () => {
        if (!policyToDelete) return;
        try {
            // Delete targets first (foreign key constraint)
            await supabase
                .from('sla_targets')
                .delete()
                .eq('sla_policy_id', policyToDelete.id);

            // Delete the policy
            const { error } = await supabase
                .from('sla_policies')
                .delete()
                .eq('id', policyToDelete.id);

            if (error) throw error;

            // Refresh data from database
            await fetchData();
            showToast('success', `Policy "${policyToDelete.name}" deleted successfully!`);
            setShowDeleteConfirm(false);
            setPolicyToDelete(null);
        } catch (error: any) {
            console.error('Error deleting policy:', error);
            showToast('error', 'Error deleting policy: ' + error.message);
        }
    };

    const formatTime = (value: number, unit: string) => {
        if (unit === 'minutes') return `${value} min`;
        if (unit === 'hours') return value === 1 ? '1 hour' : `${value} hours`;
        return value === 1 ? '1 day' : `${value} days`;
    };

    const getSLABehaviorIcon = (behavior: string) => {
        if (behavior === 'run') return <PlayCircle size={16} className="text-green-500" />;
        if (behavior === 'pause') return <PauseCircle size={16} className="text-yellow-500" />;
        return <StopCircle size={16} className="text-red-500" />;
    };

    const filteredPolicies = policies.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredPolicies.length / itemsPerPage);
    const paginatedPolicies = filteredPolicies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // RENDER LIST VIEW
    if (view === 'list') {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                {/* Toast Notification */}
                {toast.show && (
                    <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-top duration-300 ${toast.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        {toast.type === 'success' ? (
                            <CheckCircle2 size={20} className="text-green-600" />
                        ) : (
                            <AlertTriangle size={20} className="text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${toast.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>{toast.message}</span>
                        <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-2 text-gray-400 hover:text-gray-600">
                            <X size={16} />
                        </button>
                    </div>
                )}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">SLA Policies</h1>
                    <p className="text-gray-500 mt-1">Define SLA rules and conditions for tickets</p>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <button onClick={handleCreateNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
                        <Plus size={18} />Create New Policy
                    </button>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input type="text" placeholder="Search policies..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                        </div>
                        <button onClick={fetchData} className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-500' : 'text-gray-500'} />
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase">Policy Name</th>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase">Department</th>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase">Conditions</th>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase text-center">Status</th>
                                <th className="px-6 py-4 font-semibold text-xs text-gray-600 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                            ) : paginatedPolicies.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No policies found</td></tr>
                            ) : paginatedPolicies.map(policy => (
                                <tr key={policy.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div>
                                            <span className="font-medium text-gray-800">{policy.name}</span>
                                            {policy.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{policy.description}</p>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{policy.company_name}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {policy.conditions.length} condition{policy.conditions.length !== 1 ? 's' : ''}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${policy.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${policy.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </div>
                                            <span className="text-[10px] text-gray-400 mt-1">{policy.is_active ? 'Active' : 'Inactive'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(policy)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDuplicate(policy)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Duplicate"><Copy size={16} /></button>
                                            <button onClick={() => { setPolicyToDelete(policy); setShowDeleteConfirm(true); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {totalPages > 1 && (
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-sm text-gray-500">Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredPolicies.length)} of {filteredPolicies.length}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16} /></button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle size={24} className="text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Delete Policy</h3>
                                    <p className="text-sm text-gray-600 mt-1">Are you sure you want to delete "{policyToDelete?.name}"? This action cannot be undone.</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200">Cancel</button>
                                <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
                            </div>
                        </div>
                    </div>
                )}


            </div>
        );
    }

    // RENDER EDITOR VIEW
    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft size={20} className="text-gray-500" /></button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{selectedPolicy ? 'Edit Policy' : 'Create New Policy'}</h1>
                    <p className="text-gray-500 mt-1">Define SLA rules and response times</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Section 1: Basic Info */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">1</span>Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Policy Name <span className="text-red-500">*</span></label>
                            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-300' : 'border-gray-200'}`} placeholder="e.g. IT Support - Standard" />
                            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Brief description of this policy..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select value={formData.company_id?.toString() || ''} onChange={(e) => setFormData({ ...formData, company_id: parseInt(e.target.value) })}
                                    className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none ${errors.company_id ? 'border-red-300' : 'border-gray-200'}`}>
                                    <option value="">Select Department</option>
                                    {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                            {errors.company_id && <p className="text-xs text-red-500 mt-1">{errors.company_id}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Business Hours</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select value={formData.business_hours_id || ''} onChange={(e) => setFormData({ ...formData, business_hours_id: e.target.value || null })}
                                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                                    <option value="">Select Business Hours</option>
                                    {businessHours.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
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
                                <span className="text-sm font-medium text-gray-700">Policy is {formData.is_active ? 'Active' : 'Inactive'}</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Section 2: Conditions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">2</span>Conditions</h2>
                        <button onClick={addCondition} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"><Plus size={16} />Add Condition</button>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Apply this SLA when the following conditions are met:</p>
                    {errors.conditions && <p className="text-xs text-red-500 mb-3">{errors.conditions}</p>}
                    {formData.conditions.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                            <Filter size={24} className="text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No conditions added yet</p>
                            <button onClick={addCondition} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add your first condition</button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {formData.conditions.map((condition, idx) => {
                                // Get options based on selected field
                                const getFieldOptions = () => {
                                    switch (condition.field) {
                                        case 'company':
                                            return companies.map(c => ({ value: c.company_name, label: c.company_name }));
                                        case 'category':
                                            return categories.map(c => ({ value: c.name, label: c.name }));
                                        case 'priority':
                                            return priorities.map(p => ({ value: p, label: p }));
                                        case 'ticket_type':
                                            return [
                                                { value: 'Incident', label: 'Incident' },
                                                { value: 'Service Request', label: 'Service Request' },
                                                { value: 'Change Request', label: 'Change Request' }
                                            ];
                                        default:
                                            return [];
                                    }
                                };
                                const fieldOptions = getFieldOptions();

                                return (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        {idx > 0 && <span className="text-xs font-bold text-gray-400 uppercase">AND</span>}
                                        <select value={condition.field} onChange={(e) => updateCondition(idx, { field: e.target.value, value: '' })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            {conditionFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                        <select value={condition.operator} onChange={(e) => updateCondition(idx, { operator: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            {conditionOperators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                        <select
                                            value={Array.isArray(condition.value) ? condition.value[0] || '' : condition.value}
                                            onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                            className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors[`condition_${idx}`] ? 'border-red-300' : 'border-gray-200'}`}
                                        >
                                            <option value="">Select value...</option>
                                            {fieldOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => removeCondition(idx)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><X size={16} /></button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Section 3: SLA Metrics */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">3</span>SLA Metrics</h2>

                    {/* Response SLA */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock size={16} className="text-blue-500" />Response SLA <span className="text-red-500">*</span></h3>
                        <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                            <table className="w-full">
                                <thead><tr><th className="text-left text-xs font-medium text-gray-500 pb-2">Priority</th><th className="text-left text-xs font-medium text-gray-500 pb-2">Time</th><th className="text-left text-xs font-medium text-gray-500 pb-2">Unit</th></tr></thead>
                                <tbody>
                                    {formData.response_sla.map(sla => (
                                        <tr key={sla.priority}>
                                            <td className="py-2 pr-4"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${sla.priority === 'Urgent' ? 'bg-red-100 text-red-700' : sla.priority === 'High' ? 'bg-orange-100 text-orange-700' : sla.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{sla.priority}</span></td>
                                            <td className="py-2 pr-4"><input type="number" min="1" value={sla.time_value} onChange={(e) => updateResponseSLA(sla.priority, 'time_value', parseInt(e.target.value) || 1)} className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></td>
                                            <td className="py-2"><select value={sla.time_unit} onChange={(e) => updateResponseSLA(sla.priority, 'time_unit', e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">{timeUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Resolution SLA */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" />Resolution SLA</h3>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, enable_resolution_sla: !formData.enable_resolution_sla })}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${formData.enable_resolution_sla ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-gray-400'}`}
                                    title={formData.enable_resolution_sla ? 'Click to disable' : 'Click to enable'}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-md transition-transform ${formData.enable_resolution_sla ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                                <span className="text-sm text-gray-600">{formData.enable_resolution_sla ? 'Enabled' : 'Disabled'}</span>
                            </label>
                        </div>
                        {formData.enable_resolution_sla ? (
                            <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-100">
                                <table className="w-full">
                                    <thead><tr><th className="text-left text-xs font-medium text-gray-500 pb-2">Priority</th><th className="text-left text-xs font-medium text-gray-500 pb-2">Time</th><th className="text-left text-xs font-medium text-gray-500 pb-2">Unit</th></tr></thead>
                                    <tbody>
                                        {formData.resolution_sla.map(sla => (
                                            <tr key={sla.priority}>
                                                <td className="py-2 pr-4"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${sla.priority === 'Urgent' ? 'bg-red-100 text-red-700' : sla.priority === 'High' ? 'bg-orange-100 text-orange-700' : sla.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{sla.priority}</span></td>
                                                <td className="py-2 pr-4"><input type="number" min="1" value={sla.time_value} onChange={(e) => updateResolutionSLA(sla.priority, 'time_value', parseInt(e.target.value) || 1)} className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></td>
                                                <td className="py-2"><select value={sla.time_unit} onChange={(e) => updateResolutionSLA(sla.priority, 'time_unit', e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">{timeUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">Resolution SLA is disabled. Enable to configure resolution times.</div>
                        )}
                    </div>
                </div>

                {/* Section 4: SLA Behavior Mapping (Read-only) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">4</span>SLA Behavior Mapping</h2>
                    <p className="text-sm text-gray-500 mb-4">Reference from Status Management (read-only)</p>
                    <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-100"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Status</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-600">SLA Behavior</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {statuses.length > 0 ? statuses.slice(0, 5).map(s => (
                                    <tr key={s.status_id}>
                                        <td className="px-4 py-2.5 text-sm text-gray-800">{s.status_name}</td>
                                        <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 text-sm">{getSLABehaviorIcon(s.sla_behavior)}<span className="capitalize">{s.sla_behavior}</span></span></td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={2} className="px-4 py-4 text-center text-sm text-gray-500">No statuses configured</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Go to Settings → Ticket Configuration → Status Management to modify SLA behaviors</p>
                </div>

                {/* Save Actions */}
                <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => setView('list')} className="px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 bg-white transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save Policy'}
                    </button>
                </div>

                {/* Save Confirmation Modal */}
                {showSaveConfirm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Save Changes?</h3>
                            <p className="text-sm text-gray-600 mb-6">Are you sure you want to save this SLA policy? This will update the system configuration.</p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowSaveConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200">Cancel</button>
                                <button onClick={confirmSave} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Confirm Save</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Warning Modal - Policy Conflict */}
                {showWarningModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle size={24} className="text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Policy Conflict Warning</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        There {warningCount === 1 ? 'is' : 'are'} <span className="font-bold text-amber-600">{warningCount}</span> other active {warningCount === 1 ? 'policy' : 'policies'} for this department.
                                        This may cause conflicts when processing tickets.
                                    </p>
                                    <p className="text-sm text-gray-500 mt-2">Do you want to continue saving anyway?</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setShowWarningModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200">Cancel</button>
                                <button onClick={confirmSaveWithWarning} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg">Continue Anyway</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SLAPolicies;
