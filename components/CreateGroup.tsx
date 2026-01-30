import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, Loader2, Clock } from 'lucide-react';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface CreateGroupProps {
    isOpen: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

interface Department {
    company_id: number;
    company_name: string;
}

interface User {
    id: string;
    full_name: string;
    email: string;
    company_id?: number;
    role_id?: number;
}

const CreateGroup: React.FC<CreateGroupProps> = ({ isOpen, onCancel, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [fetchingOptions, setFetchingOptions] = useState(true);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [filteredSupervisors, setFilteredSupervisors] = useState<User[]>([]);
    const [businessHoursList, setBusinessHoursList] = useState<{ id: string, name: string }[]>([]);
    const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
    const [supervisorSearch, setSupervisorSearch] = useState('');
    const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);

    const [formData, setFormData] = useState({
        groupName: '',
        departmentId: '',
        agentSupervisor: '',
        isActive: true,
        assignTasksFirst: false,
        businessHourId: '',
        businessHourSchedule: undefined as any[] | undefined,
        slaPolicies: [] as any[] // Array of {id, name}
    });

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchOptions();
            // Reset form when drawer opens
            setFormData({
                groupName: '',
                departmentId: '',
                agentSupervisor: '',
                isActive: true,
                assignTasksFirst: false,
                businessHourId: '',
                businessHourSchedule: undefined,
                slaPolicies: []
            });
            setSupervisorSearch('');
            setShowSupervisorDropdown(false);
        }
    }, [isOpen]);

    useEffect(() => {
        // Filter supervisors based on selected department
        if (formData.departmentId && supervisors.length > 0) {
            const filtered = supervisors.filter((sup: User) => {
                // Assuming User has company_id field, we need to check it
                return (sup as any).company_id === parseInt(formData.departmentId);
            });
            setFilteredSupervisors(filtered);
            setSupervisorSearch('');
        } else {
            setFilteredSupervisors([]);
            setSupervisorSearch('');
        }
    }, [formData.departmentId, supervisors]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.supervisor-dropdown')) {
                setShowSupervisorDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchOptions = async () => {
        try {
            setFetchingOptions(true);

            // Fetch Departments
            const { data: deptData } = await supabase.from('company').select('*').order('company_id');
            if (deptData) setDepartments(deptData);

            // Fetch all profiles except Admin (role_id 1) and Requester (role_id 4)
            const { data: supervisorData } = await supabase
                .from('profiles')
                .select('id, full_name, email, company_id, role_id')
                .not('role_id', 'in', '(1,4)')
                .order('full_name');
            if (supervisorData) setSupervisors(supervisorData);

            // Fetch Business Hours
            const { data: bhData } = await supabase.from('business_hours').select('id, name').order('name');
            if (bhData) setBusinessHoursList(bhData);

            // Fetch SLA Policies
            const { data: slaData } = await supabase.from('sla_policies').select('id, name, company_id').eq('is_active', true).order('name');
            if (slaData) setSlaPolicies(slaData);

        } catch (err: any) {
            console.error('Error fetching options:', err);
            setError('Failed to load form options');
        } finally {
            setFetchingOptions(false);
        }
    };

    const fetchBusinessHourSchedule = async (id: string) => {
        const { data } = await supabase
            .from('business_hours')
            .select('weekly_schedule')
            .eq('id', id)
            .single();
        return data?.weekly_schedule || null;
    };

    const formatTime = (time: string) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHours = h % 12 || 12;
        return `${displayHours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    };

    const handleSlaSelect = (policyId: string) => {
        const policy = slaPolicies.find(p => p.id === policyId);
        if (policy && !formData.slaPolicies.some(p => p.id === policyId)) {
            setFormData(prev => ({
                ...prev,
                slaPolicies: [...prev.slaPolicies, { id: policy.id, name: policy.name }]
            }));
        }
    };

    const handleSlaRemove = (policyId: string) => {
        setFormData(prev => ({
            ...prev,
            slaPolicies: prev.slaPolicies.filter(p => p.id !== policyId)
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate required fields
            if (!formData.groupName.trim()) {
                throw new Error('Group Name is required');
            }
            if (!formData.departmentId) {
                throw new Error('Department is required');
            }

            console.log('Creating group:', formData);

            // If Agent Supervisor is selected, update their role to Agent Supervisor (role_id 2)
            if (formData.agentSupervisor) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role_id: 2 })
                    .eq('id', formData.agentSupervisor);

                if (updateError) {
                    console.error('Error updating supervisor role:', updateError);
                    throw new Error(`Failed to update supervisor role: ${updateError.message}`);
                }
                console.log('✅ Supervisor role updated to Agent Supervisor');
            }

            // Create Group
            const { error: groupError } = await supabase
                .from('groups')
                .insert({
                    name: formData.groupName,
                    company_id: parseInt(formData.departmentId),
                    is_active: formData.isActive,
                    business_hour_id: formData.businessHourId || null,
                    assign_to_supervisor_first: formData.assignTasksFirst
                });

            if (groupError) throw new Error(`Group error: ${groupError.message}`);

            // Get new group ID (since insert doesn't return data by default in some configurations, we might need select)
            const { data: newGroup, error: fetchError } = await supabase
                .from('groups')
                .select('id')
                .eq('name', formData.groupName)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (fetchError) throw fetchError;

            // Insert SLA policies
            if (formData.slaPolicies.length > 0) {
                const slaInserts = formData.slaPolicies.map(p => ({
                    group_id: newGroup.id,
                    sla_policy_id: p.id
                }));
                const { error: slaError } = await supabase
                    .from('group_sla_policies')
                    .insert(slaInserts);
                if (slaError) throw slaError;
            }

            console.log('✅ Group created successfully');

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Group created successfully',
                confirmButtonColor: '#4c40e6',
            });

            // Reset form
            setFormData({
                groupName: '',
                departmentId: '',
                agentSupervisor: '',
                isActive: true,
                assignTasksFirst: false,
                businessHourId: '',
                businessHourSchedule: undefined,
                slaPolicies: []
            });
            setSupervisorSearch('');

            onSuccess();

        } catch (err: any) {
            console.error('❌ Error creating group:', err);
            setError(err.message || 'Failed to create group');
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.message || 'Failed to create group',
                confirmButtonColor: '#4c40e6',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
                onClick={onCancel}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Add A New Group</h2>
                        <p className="text-xs text-gray-500 mt-1">Configuration for the new group</p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6" autoComplete="off">
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Mandatory Note */}
                        <div className="text-xs text-gray-500">
                            <span className="text-red-500">*</span> = Mandatory.
                        </div>

                        {/* Group Name */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">
                                Group Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="groupName"
                                required
                                value={formData.groupName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                                placeholder="Enter group name"
                                autoComplete="off"
                            />
                        </div>

                        {/* Department */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">
                                Department <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="departmentId"
                                required
                                value={formData.departmentId}
                                onChange={handleChange}
                                disabled={fetchingOptions}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
                            >
                                <option value="">{fetchingOptions ? "Loading departments..." : "Select Department"}</option>
                                {departments.map((dept: any) => (
                                    <option key={dept.company_id} value={dept.company_id}>{dept.company_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Agent Supervisor - Searchable Dropdown */}
                        <div className="space-y-1.5 supervisor-dropdown">
                            <label className="text-sm font-semibold text-gray-700">
                                Agent Supervisor <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={supervisorSearch}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setSupervisorSearch(e.target.value);
                                        setShowSupervisorDropdown(true);
                                    }}
                                    onFocus={() => setShowSupervisorDropdown(true)}
                                    placeholder="Select..."
                                    disabled={!formData.departmentId}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                                />

                                {showSupervisorDropdown && formData.departmentId && (
                                    <div className="absolute z-10 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredSupervisors
                                            .filter((sup: User) =>
                                                sup.full_name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
                                                sup.email.toLowerCase().includes(supervisorSearch.toLowerCase())
                                            )
                                            .map((sup: User) => (
                                                <div
                                                    key={sup.id}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, agentSupervisor: sup.id }));
                                                        setSupervisorSearch(sup.full_name);
                                                        setShowSupervisorDropdown(false);
                                                    }}
                                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                >
                                                    <div className="font-medium text-gray-900">{sup.full_name}</div>
                                                    <div className="text-xs text-gray-500">{sup.email}</div>
                                                </div>
                                            ))}
                                        {filteredSupervisors.filter((sup: User) =>
                                            sup.full_name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
                                            sup.email.toLowerCase().includes(supervisorSearch.toLowerCase())
                                        ).length === 0 && (
                                                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                                    No Agent found
                                                </div>
                                            )}
                                    </div>
                                )}
                                {!formData.departmentId && (
                                    <p className="text-xs text-orange-500 mt-1">Please select a department first.</p>
                                )}
                            </div>
                        </div>

                        {/* Set Group as Active */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-semibold text-gray-700">Set Group as Active?</label>
                            <div className="relative inline-flex items-center">
                                <input
                                    type="checkbox"
                                    name="isActive"
                                    checked={formData.isActive}
                                    onChange={handleChange}
                                    className="w-10 h-6 bg-gray-300 rounded-full appearance-none cursor-pointer transition-colors checked:bg-indigo-600"
                                />
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform pointer-events-none"
                                    style={{
                                        transform: formData.isActive ? 'translateX(16px) translateY(-50%)' : 'translateY(-50%)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Assign Tasks To Supervisor First? */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-semibold text-gray-700">Assign Tasks To Supervisor First?</label>
                            <div className="relative inline-flex items-center">
                                <input
                                    type="checkbox"
                                    name="assignTasksFirst"
                                    checked={formData.assignTasksFirst}
                                    onChange={handleChange}
                                    className="w-10 h-6 bg-gray-300 rounded-full appearance-none cursor-pointer transition-colors checked:bg-indigo-600"
                                />
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform pointer-events-none"
                                    style={{
                                        transform: formData.assignTasksFirst ? 'translateX(16px) translateY(-50%)' : 'translateY(-50%)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Choose Business Hours */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Choose Business Hours
                            </label>

                            <div className="space-y-3">
                                <select
                                    name="businessHourId"
                                    value={formData.businessHourId}
                                    onChange={async (e) => {
                                        const selectedId = e.target.value;
                                        const schedule = selectedId ? await fetchBusinessHourSchedule(selectedId) : undefined;
                                        setFormData(prev => ({
                                            ...prev,
                                            businessHourId: selectedId,
                                            businessHourSchedule: schedule
                                        }));
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white shadow-sm"
                                >
                                    <option value="">-- Select Business Hours --</option>
                                    {businessHoursList.map((bh) => (
                                        <option key={bh.id} value={bh.id}>
                                            {bh.name}
                                        </option>
                                    ))}
                                </select>

                                {formData.businessHourId && formData.businessHourSchedule && (
                                    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden shadow-sm">
                                        <div className="px-3 py-2 bg-gray-100/50 border-b border-gray-200 flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Schedule Preview</span>
                                        </div>
                                        <div className="p-3 grid grid-cols-1 gap-1.5">
                                            {formData.businessHourSchedule.map((day: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between text-[11px]">
                                                    <span className={`font-medium ${day.isActive ? 'text-gray-700' : 'text-gray-400'}`}>{day.day}</span>
                                                    <div className="flex items-center gap-2 text-[10px]">
                                                        {day.isActive ? (
                                                            <div className="flex items-center gap-1.5 font-semibold text-indigo-600">
                                                                <span>{formatTime(day.startTime)}</span>
                                                                <span className="text-gray-300">-</span>
                                                                <span>{formatTime(day.endTime)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic">Closed</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Choose Service-level Agreement */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-700">Choose Service-level Agreement:</label>

                            {/* Selected SLAs Tags */}
                            {formData.slaPolicies.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {formData.slaPolicies.map(policy => (
                                        <div key={policy.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 shadow-sm">
                                            <Clock size={12} />
                                            <span>{policy.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleSlaRemove(policy.id)}
                                                className="ml-1 hover:text-indigo-900 focus:outline-none transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <select
                                name="slaPolicyId"
                                value=""
                                onChange={(e) => handleSlaSelect(e.target.value)}
                                disabled={!formData.departmentId}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                            >
                                <option value="" disabled>-- Add SLA Policy --</option>
                                {slaPolicies
                                    .filter(p => (!p.company_id || p.company_id === parseInt(formData.departmentId)) && !formData.slaPolicies.some(selected => selected.id === p.id))
                                    .map((policy) => (
                                        <option key={policy.id} value={policy.id}>
                                            {policy.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || fetchingOptions}
                        onClick={handleSubmit}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Save
                    </button>
                </div>
            </div>
        </>
    );
};

export default CreateGroup;
