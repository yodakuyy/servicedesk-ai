import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Edit2, Save, Loader2 } from 'lucide-react';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface GroupDetailProps {
    isOpen: boolean;
    groupId: string | null;
    onClose: () => void;
    onUpdate: () => void;
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
    role_name?: string;
}

interface GroupData {
    id: string;
    name: string;
    company_id: number;
    company_name?: string;
    is_active: boolean;
    supervisors: User[];
    assign_to_supervisor_first: boolean;
    business_hour_id?: string | null;
    business_hour_name?: string;
    business_hour_schedule?: any[];
}

interface BusinessHourOption {
    id: string;
    name: string;
}

const GroupDetail: React.FC<GroupDetailProps> = ({ isOpen, groupId, onClose, onUpdate }) => {
    const [groupData, setGroupData] = useState<GroupData | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [businessHoursList, setBusinessHoursList] = useState<BusinessHourOption[]>([]);
    const [supervisorSearch, setSupervisorSearch] = useState('');
    const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);

    // Fetch group data
    useEffect(() => {
        if (isOpen && groupId) {
            fetchGroupData();
            fetchDepartments();
            fetchSupervisors();
            fetchBusinessHoursList();
        }
    }, [isOpen, groupId]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen]);

    // Close supervisor dropdown when clicking outside
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

    const fetchGroupData = async () => {
        if (!groupId) return;

        try {
            setLoading(true);

            // 1. First Pass: Fetch Group Info, Supervisor IDs, and Roles concurrently
            const [groupRes, groupSupervisorsRes, rolesRes] = await Promise.all([
                supabase.from('groups').select('*').eq('id', groupId).single(),
                supabase.from('group_supervisors').select('user_id').eq('group_id', groupId),
                supabase.from('roles').select('role_id, role_name')
            ]);

            if (groupRes.error) throw groupRes.error;

            const groupInfo = groupRes.data;
            const supervisorIds = (groupSupervisorsRes.data || []).map((i: any) => i.user_id);
            const roles = rolesRes.data || [];

            // 2. Second Pass: Fetch Company Name and Supervisor Profiles concurrently
            // Department fetch depends on groupInfo.company_id from first pass
            const promises: any[] = [
                supabase.from('company').select('company_name').eq('company_id', groupInfo.company_id).single()
            ];

            // Supervisor Profiles fetch depends on supervisorIds from first pass
            if (supervisorIds.length > 0) {
                promises.push(
                    supabase.from('profiles')
                        .select('id, full_name, email, company_id, role_id')
                        .in('id', supervisorIds)
                );
            } else {
                promises.push(Promise.resolve({ data: [] }));
            }

            const [companyRes, profilesRes] = await Promise.all(promises) as [any, any];

            // 3. Combine Data and Set State
            const supervisorsList = (profilesRes.data || []).map((p: any) => {
                const role = roles.find((r: any) => r.role_id === p.role_id);
                return {
                    id: p.id,
                    full_name: p.full_name || 'Unknown',
                    email: p.email || 'N/A',
                    company_id: p.company_id,
                    role_id: p.role_id,
                    role_name: role?.role_name || 'Unknown Role'
                };
            });

            setGroupData({
                id: groupInfo.id,
                name: groupInfo.name,
                company_id: groupInfo.company_id,
                company_name: companyRes.data?.company_name || 'Unknown',
                is_active: groupInfo.is_active || false,
                supervisors: supervisorsList,
                assign_to_supervisor_first: groupInfo.assign_to_supervisor_first || false,
                business_hour_id: groupInfo.business_hour_id,
                business_hour_name: groupInfo.business_hour_id ? await fetchBusinessHourName(groupInfo.business_hour_id) : undefined,
                business_hour_schedule: groupInfo.business_hour_id ? await fetchBusinessHourSchedule(groupInfo.business_hour_id) : undefined
            });

        } catch (error: any) {
            console.error('Error fetching group data:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to load group data',
                confirmButtonColor: '#4c40e6',
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        const { data } = await supabase
            .from('company')
            .select('company_id, company_name')
            .order('company_id', { ascending: true });

        setDepartments(data || []);
    };

    const fetchSupervisors = async () => {
        // Fetch all profiles except Admin (role_id 1) and Requester (role_id 4)
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, company_id, role_id')
            .not('role_id', 'in', '(1,4)')
            .order('full_name');

        if (data) {
            setSupervisors(data);
        }
    };

    const fetchBusinessHoursList = async () => {
        const { data } = await supabase
            .from('business_hours')
            .select('id, name')
            .order('name');

        if (data) {
            setBusinessHoursList(data);
        }
    };

    const fetchBusinessHourName = async (id: string) => {
        const { data } = await supabase
            .from('business_hours')
            .select('name')
            .eq('id', id)
            .single();
        return data?.name || 'Unknown';
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

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        fetchGroupData(); // Reset to original data
        setSupervisorSearch(''); // Clear search
    };

    const handleClose = () => {
        if (isEditing) {
            Swal.fire({
                icon: 'warning',
                title: 'Unsaved Changes',
                text: 'You have unsaved changes. Are you sure you want to close?',
                showCancelButton: true,
                confirmButtonText: 'Yes, close',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
            }).then((result) => {
                if (result.isConfirmed) {
                    setIsEditing(false);
                    onClose();
                }
            });
        } else {
            onClose();
        }
    };

    const handleDepartmentChange = (companyId: number) => {
        if (!groupData) return;

        const dept = departments.find(d => d.company_id === companyId);
        setGroupData({
            ...groupData,
            company_id: companyId,
            company_name: dept?.company_name || 'Unknown',
            supervisors: [] // Clear supervisors when department changes
        });
        setSupervisorSearch('');
    };

    const handleSupervisorSelect = (supervisor: User) => {
        if (!groupData) return;

        // Prevent adding duplicate
        if (groupData.supervisors.some(s => s.id === supervisor.id)) {
            setSupervisorSearch('');
            setShowSupervisorDropdown(false);
            return;
        }

        setGroupData({
            ...groupData,
            supervisors: [...groupData.supervisors, supervisor]
        });
        setSupervisorSearch('');
        setShowSupervisorDropdown(false);
    };

    const handleSupervisorRemove = (supervisorId: string) => {
        if (!groupData) return;

        setGroupData({
            ...groupData,
            supervisors: groupData.supervisors.filter(s => s.id !== supervisorId)
        });
    };

    const handleSave = async () => {
        if (!groupData) return;

        // Validation
        if (!groupData.name.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Validation Error',
                text: 'Group name is required',
                confirmButtonColor: '#4c40e6',
            });
            return;
        }

        try {
            setIsSaving(true);

            // Update supervisors' role to Agent Supervisor (role_id 2)
            if (groupData.supervisors.length > 0) {
                const supervisorIds = groupData.supervisors.map(s => s.id);
                await supabase
                    .from('profiles')
                    .update({ role_id: 2 })
                    .in('id', supervisorIds);
            }

            // Update group info
            const { error: updateError } = await supabase
                .from('groups')
                .update({
                    name: groupData.name,
                    company_id: groupData.company_id,
                    is_active: groupData.is_active,
                    assign_to_supervisor_first: groupData.assign_to_supervisor_first,
                    business_hour_id: groupData.business_hour_id
                })
                .eq('id', groupData.id);

            if (updateError) throw updateError;

            // Delete existing supervisors
            await supabase
                .from('group_supervisors')
                .delete()
                .eq('group_id', groupData.id);

            // Insert new supervisors
            if (groupData.supervisors.length > 0) {
                const groupSupervisorsInsert = groupData.supervisors.map(supervisor => ({
                    group_id: groupData.id,
                    user_id: supervisor.id
                }));

                const { error: insertSupervisorsError } = await supabase
                    .from('group_supervisors')
                    .insert(groupSupervisorsInsert);

                if (insertSupervisorsError) throw insertSupervisorsError;
            }

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Group updated successfully',
                confirmButtonColor: '#4c40e6',
            });

            setIsEditing(false);
            onUpdate();
            fetchGroupData();
        } catch (error: any) {
            console.error('Error updating group:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to update group',
                confirmButtonColor: '#4c40e6',
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    // Filter supervisors by department and exclude already selected ones
    const filteredSupervisors = supervisors.filter((sup: User) =>
        groupData &&
        sup.company_id === groupData.company_id &&
        !groupData.supervisors.some(selected => selected.id === sup.id)
    );

    return (
        <div className="fixed inset-0 z-50 flex justify-end transition-opacity duration-300">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
                onClick={handleClose}
            />

            {/* Drawer Content */}
            <div
                ref={drawerRef}
                className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 animate-in slide-in-from-right"
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            <p className="text-gray-600 font-medium">Loading group data...</p>
                        </div>
                    </div>
                ) : groupData ? (
                    <>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {isEditing ? 'Edit Group' : 'Group Details'}
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    {isEditing ? 'Configuration for the group' : 'View group information'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleClose}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>



                        {/* Scrollable Form Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Mandatory Note */}
                            {isEditing && (
                                <div className="text-xs text-gray-500">
                                    <span className="text-red-500">*</span> = Mandatory.
                                </div>
                            )}

                            {/* Group Name */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">
                                    Group Name {isEditing && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                    type="text"
                                    value={groupData.name}
                                    onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="Enter group name"
                                />
                            </div>

                            {/* Department */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">
                                    Department {isEditing && <span className="text-red-500">*</span>}
                                </label>
                                <select
                                    value={groupData.company_id}
                                    onChange={(e) => handleDepartmentChange(Number(e.target.value))}
                                    disabled={!isEditing}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500 bg-white"
                                >
                                    {departments.map((dept) => (
                                        <option key={dept.company_id} value={dept.company_id}>
                                            {dept.company_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Agent Supervisors (Multiple) */}
                            <div className="space-y-1.5 supervisor-dropdown">
                                <label className="text-sm font-semibold text-gray-700">
                                    Agent Supervisors {isEditing && <span className="text-red-500">*</span>}
                                </label>

                                {/* Selected Supervisors Tags */}
                                {groupData.supervisors.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {groupData.supervisors.map(supervisor => (
                                            <div key={supervisor.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                                                <span>{supervisor.full_name}</span>
                                                {isEditing && (
                                                    <button
                                                        onClick={() => handleSupervisorRemove(supervisor.id)}
                                                        className="hover:text-indigo-900 focus:outline-none"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {isEditing ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={supervisorSearch}
                                            onChange={(e) => {
                                                setSupervisorSearch(e.target.value);
                                                setShowSupervisorDropdown(true);
                                            }}
                                            onFocus={() => setShowSupervisorDropdown(true)}
                                            placeholder="Search & add supervisors..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />

                                        {showSupervisorDropdown && (
                                            <div className="absolute z-10 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {filteredSupervisors
                                                    .filter((sup: User) =>
                                                        sup.full_name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
                                                        sup.email.toLowerCase().includes(supervisorSearch.toLowerCase())
                                                    )
                                                    .map((sup: User) => (
                                                        <div
                                                            key={sup.id}
                                                            onClick={() => handleSupervisorSelect(sup)}
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
                                                            No more supervisors found
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // View Mode - if no supervisors selected
                                    groupData.supervisors.length === 0 && (
                                        <div className="text-sm text-gray-500 italic">No supervisors selected</div>
                                    )
                                )}
                            </div>

                            {/* Set Group as Active */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-semibold text-gray-700">Set Group as Active?</label>
                                <div className="relative inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={groupData.is_active}
                                        onChange={(e) => setGroupData({ ...groupData, is_active: e.target.checked })}
                                        disabled={!isEditing}
                                        className="w-10 h-6 bg-gray-300 rounded-full appearance-none cursor-pointer transition-colors checked:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <span
                                        className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform pointer-events-none"
                                        style={{
                                            transform: groupData.is_active ? 'translateX(16px) translateY(-50%)' : 'translateY(-50%)'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Assign Tasks To Supervisor First */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-semibold text-gray-700">Assign Tasks To Supervisor First?</label>
                                <div className="relative inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={groupData.assign_to_supervisor_first}
                                        onChange={(e) => setGroupData({ ...groupData, assign_to_supervisor_first: e.target.checked })}
                                        disabled={!isEditing}
                                        className="w-10 h-6 bg-gray-300 rounded-full appearance-none cursor-pointer transition-colors checked:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <span
                                        className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform pointer-events-none"
                                        style={{
                                            transform: groupData.assign_to_supervisor_first ? 'translateX(16px) translateY(-50%)' : 'translateY(-50%)'
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
                                    Business Hours
                                </label>

                                {isEditing ? (
                                    <div className="space-y-3">
                                        <select
                                            value={groupData.business_hour_id || ''}
                                            onChange={async (e) => {
                                                const selectedId = e.target.value;
                                                const selectedName = businessHoursList.find(b => b.id === selectedId)?.name;
                                                const selectedSchedule = selectedId ? await fetchBusinessHourSchedule(selectedId) : undefined;
                                                setGroupData({
                                                    ...groupData,
                                                    business_hour_id: selectedId || null,
                                                    business_hour_name: selectedName,
                                                    business_hour_schedule: selectedSchedule
                                                });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm"
                                        >
                                            <option value="">-- Select Business Hours --</option>
                                            {businessHoursList.map((bh) => (
                                                <option key={bh.id} value={bh.id}>
                                                    {bh.name}
                                                </option>
                                            ))}
                                        </select>

                                        {groupData.business_hour_id && groupData.business_hour_schedule && (
                                            <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                                                <div className="px-3 py-2 bg-gray-100/50 border-b border-gray-200 flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Schedule Preview</span>
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-medium">Selected</span>
                                                </div>
                                                <div className="p-3 grid grid-cols-1 gap-1.5">
                                                    {groupData.business_hour_schedule.map((day: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between text-[11px]">
                                                            <span className={`font-medium ${day.isActive ? 'text-gray-700' : 'text-gray-400'}`}>{day.day}</span>
                                                            <div className="flex items-center gap-2">
                                                                {day.isActive ? (
                                                                    <>
                                                                        <span className="text-indigo-600 font-semibold">{formatTime(day.startTime)}</span>
                                                                        <span className="text-gray-300">-</span>
                                                                        <span className="text-indigo-600 font-semibold">{formatTime(day.endTime)}</span>
                                                                    </>
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
                                ) : (
                                    <div className="group relative">
                                        {groupData.business_hour_id && groupData.business_hour_name ? (
                                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                                                <div className="px-4 py-3 bg-indigo-50/30 border-b border-gray-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                        <span className="font-bold text-gray-900 text-sm tracking-tight">{groupData.business_hour_name}</span>
                                                    </div>
                                                </div>

                                                {groupData.business_hour_schedule && (
                                                    <div className="p-4 space-y-2">
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {groupData.business_hour_schedule.map((day: any, idx: number) => (
                                                                <div key={idx} className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${day.isActive ? 'bg-gray-50' : 'opacity-40'}`}>
                                                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${day.isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                                                                        {day.day.substring(0, 3)}
                                                                    </span>
                                                                    <div className="flex items-center gap-3">
                                                                        {day.isActive ? (
                                                                            <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                                                                <span className="px-2 py-0.5 bg-white border border-gray-100 rounded shadow-sm">{formatTime(day.startTime)}</span>
                                                                                <span className="text-gray-400 text-[10px]">to</span>
                                                                                <span className="px-2 py-0.5 bg-white border border-gray-100 rounded shadow-sm">{formatTime(day.endTime)}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">OFF</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-full px-4 py-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 bg-gray-50/30 transition-colors">
                                                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-xs text-gray-400 font-medium">No business hours assigned</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Choose Service-level Agreement */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Choose Service-level Agreement:</label>
                                <button
                                    type="button"
                                    disabled={!isEditing}
                                    className="w-full px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span>+</span> Add SLA
                                </button>
                            </div>
                        </div>



                        {/* Footer Actions */}
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50 sticky bottom-0 z-10">
                            {!isEditing ? (
                                <button
                                    onClick={handleEdit}
                                    className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    <Edit2 size={18} />
                                    Edit Group
                                </button>
                            ) : (
                                <button
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            )}

                            {isEditing && (
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            Save
                                        </>
                                    )}
                                </button>
                            )}
                        </div>


                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Group not found</p>
                    </div>
                )}
            </div>
        </div >
    );
};

export default GroupDetail;
