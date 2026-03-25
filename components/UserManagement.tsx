import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Upload, Download, ChevronDown, Eye, Edit2, Loader2, Clock, User as UserIcon, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CreateUser from './CreateUser';
import StatusBadge from './StatusBadge';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface User {
    id: string;
    name: string;
    email: string;
    role_id: string;
    role_name?: string;
    department: string;
    group: string;
    groups: string[];
    status: 'Active' | 'Inactive';
    is_department_admin: boolean;
    last_active: string;
    is_external: boolean;
}

interface Role {
    id: string;
    role_name: string;
}

interface Department {
    id: number;
    name: string;
}

interface Group {
    id: string;
    name: string;
    company_id: number;
}

interface GroupsModalProps {
    isOpen: boolean;
    groups: string[];
    userName: string;
    onClose: () => void;
}

const GroupsModal: React.FC<GroupsModalProps> = ({ isOpen, groups, userName, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Groups for {userName}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>
                <div className="space-y-2">
                    {groups.map((group, idx) => (
                        <div
                            key={idx}
                            className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200"
                        >
                            {group}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface GroupsDisplayProps {
    groups: string[];
    maxDisplay?: number;
    userName?: string;
}

const GroupsDisplay: React.FC<GroupsDisplayProps> = ({ groups, maxDisplay = 2, userName = "" }) => {
    const [showModal, setShowModal] = useState(false);
    const displayedGroups = groups.slice(0, maxDisplay);
    const remainingCount = groups.length - maxDisplay;

    if (groups.length === 0) {
        return <span className="text-gray-500">No Group</span>;
    }

    return (
        <>
            <div className="flex flex-wrap gap-2 items-center">
                {displayedGroups.map((group, idx) => (
                    <span
                        key={idx}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100"
                    >
                        {group}
                    </span>
                ))}
                {remainingCount > 0 && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200 hover:bg-gray-200 transition-colors"
                    >
                        +{remainingCount} more
                    </button>
                )}
            </div>
            <GroupsModal
                isOpen={showModal}
                groups={groups}
                userName={userName}
                onClose={() => setShowModal(false)}
            />
        </>
    );
};

interface UserDetailProps {
    user: User;
    onBack: () => void;
    onSave?: () => void;
    isViewOnly?: boolean;
}

interface MenuItem {
    id: string;
    name: string;
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    source: 'ROLE' | 'CUSTOM';
}

const UserDetail: React.FC<UserDetailProps> = ({ user, onBack, onSave, isViewOnly = false }) => {
    const [activeTab, setActiveTab] = useState('Profile');
    const [accessType, setAccessType] = useState<'default' | 'custom'>('default');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        full_name: user.name,
        email: user.email,
        role_id: user.role_id,
        status: user.status,
        is_department_admin: user.is_department_admin,
        groups: user.groups
    });
    const [allGroups, setAllGroups] = useState<Group[]>([]);
    const [allRoles, setAllRoles] = useState<Role[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loadingMenus, setLoadingMenus] = useState(true);
    const [editedMenus, setEditedMenus] = useState<Map<string, MenuItem>>(new Map());
    const [userActivities, setUserActivities] = useState<any[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [activitiesLimit, setActivitiesLimit] = useState(10);
    const [hasMoreActivities, setHasMoreActivities] = useState(true);

    useEffect(() => {
        // Update formData ketika user prop berubah
        setFormData({
            full_name: user.name,
            email: user.email,
            role_id: user.role_id,
            status: user.status,
            is_department_admin: user.is_department_admin,
            groups: user.groups
        });
    }, [user]);

    useEffect(() => {
        // Fetch user data and groups by department
        const fetchData = async () => {
            // Fetch user profile to get is_department_admin
            const { data: profileData } = await supabase
                .from('profiles')
                .select('is_department_admin, company_id')
                .eq('id', user.id)
                .single();

            if (profileData) {
                setFormData(prev => ({
                    ...prev,
                    is_department_admin: profileData.is_department_admin || false
                }));

                // Fetch groups by department (company_id)
                const { data: groupsData } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('company_id', profileData.company_id)
                    .eq('is_active', true);

                if (groupsData) {
                    setAllGroups(groupsData.map((g: any) => ({
                        id: String(g.id || g.group_id),
                        name: g.name || g.group_name || g.group_id || g.id || 'Unnamed Group',
                        company_id: g.company_id
                    })));
                }
            }

            // Fetch all roles
            const { data: rolesData } = await supabase.from('roles').select('*');
            if (rolesData) {
                setAllRoles(rolesData.map((r: any) => ({
                    id: r.id || r.role_id,
                    role_name: r.role_name || r.name || 'Unknown Role'
                })));
            }

            // Fetch menu access data
            await fetchMenuAccess();
        };
        fetchData();
    }, [user.id]);

    const fetchMenuAccess = async () => {
        try {
            setLoadingMenus(true);

            // Fetch all menus
            const { data: menusData } = await supabase
                .from('menus')
                .select('*');

            // Fetch role menu permissions
            const { data: rolePermissionsData } = await supabase
                .from('role_menu_permissions')
                .select('*')
                .eq('role_id', user.role_id);

            // Fetch user menu permissions
            const { data: userPermissionsData } = await supabase
                .from('user_menu_permissions')
                .select('*')
                .eq('user_id', user.id);

            if (menusData) {
                const menus: MenuItem[] = menusData.map((menu: any) => {
                    // Check if user has custom permission
                    const userPerm = userPermissionsData?.find(p => String(p.menu_key) === String(menu.id));

                    if (userPerm) {
                        // Use custom user permission
                        return {
                            id: menu.id,
                            name: menu.name || menu.menu_name || menu.title || menu.label || 'Unknown Menu',
                            view: userPerm.can_view || false,
                            create: userPerm.can_create || false,
                            update: userPerm.can_update || false,
                            delete: userPerm.can_delete || false,
                            source: 'CUSTOM'
                        };
                    } else {
                        // Use role permission
                        const rolePerm = rolePermissionsData?.find(p => String(p.menu_id) === String(menu.id));
                        return {
                            id: menu.id,
                            name: menu.name || menu.menu_name || menu.title || menu.label || 'Unknown Menu',
                            view: rolePerm?.can_view || false,
                            create: rolePerm?.can_create || false,
                            update: rolePerm?.can_update || false,
                            delete: rolePerm?.can_delete || false,
                            source: 'ROLE'
                        };
                    }
                });

                setMenuItems(menus);
                setEditedMenus(new Map());

                // Update access type based on permissions
                if (menus.some(m => m.source === 'CUSTOM')) {
                    setAccessType('custom');
                } else {
                    setAccessType('default');
                }
            }
        } catch (error) {
            console.error('Error fetching menu access:', error);
        } finally {
            setLoadingMenus(false);
        }
    };

    const fetchUserActivities = async () => {
        try {
            setLoadingActivities(true);
            
            // 1. Fetch ticket activity logs where this user is the actor
            const { data: logData, error: logError } = await supabase
                .from('ticket_activity_log')
                .select('*, tickets(ticket_number, subject)')
                .eq('actor_id', user.id)
                .order('created_at', { ascending: false })
                .limit(activitiesLimit);

            if (logError) console.error('Error fetching logs:', logError);

            // 2. Fetch tickets requested by this user
            const { data: requestedTickets, error: reqError } = await supabase
                .from('tickets')
                .select('id, ticket_number, subject, created_at, status_id, ticket_statuses(status_name)')
                .eq('requester_id', user.id)
                .order('created_at', { ascending: false })
                .limit(activitiesLimit);
                
            if (reqError) console.error('Error fetching requested tickets:', reqError);

            // 3. Fetch tickets assigned to this user
            const { data: assignedTickets, error: assError } = await supabase
                .from('tickets')
                .select('id, ticket_number, subject, created_at, status_id, ticket_statuses(status_name)')
                .eq('assigned_to', user.id)
                .order('created_at', { ascending: false })
                .limit(activitiesLimit);

            if (assError) console.error('Error fetching assigned tickets:', assError);

            // Combine and format activities
            const activities: any[] = [];

            // Transform logs
            (logData || []).forEach((log: any) => {
                activities.push({
                    id: `log-${log.id}`,
                    type: 'action',
                    title: log.action,
                    subtitle: log.tickets ? `${log.tickets.ticket_number}: ${log.tickets.subject}` : 'Unknown Ticket',
                    timestamp: log.created_at,
                    icon: 'activity'
                });
            });

            // Transform requested tickets
            (requestedTickets || []).forEach((ticket: any) => {
                activities.push({
                    id: `req-${ticket.id}`,
                    type: 'creation',
                    title: `Created Ticket ${ticket.ticket_number}`,
                    subtitle: ticket.subject,
                    timestamp: ticket.created_at,
                    icon: 'plus',
                    status: ticket.ticket_statuses?.status_name
                });
            });

            // Transform assigned tickets
            (assignedTickets || []).forEach((ticket: any) => {
                activities.push({
                    id: `ass-${ticket.id}`,
                    type: 'assignment',
                    title: `Assigned to Ticket ${ticket.ticket_number}`,
                    subtitle: ticket.subject,
                    timestamp: ticket.created_at,
                    icon: 'user',
                    status: ticket.ticket_statuses?.status_name
                });
            });

            // Add last active activity if significantly different from last activity log
            if (user.last_active) {
                activities.push({
                    id: 'last-active',
                    type: 'system',
                    title: 'Last System Activity',
                    subtitle: 'Most recent interaction with the platform',
                    timestamp: user.last_active,
                    icon: 'clock'
                });
            }

            // Sort by timestamp descending
            activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Check if we might have more data (if any category hit the limit)
            const reachedLimit = 
                (logData?.length === activitiesLimit) || 
                (requestedTickets?.length === activitiesLimit) || 
                (assignedTickets?.length === activitiesLimit);
            
            setHasMoreActivities(reachedLimit);

            setUserActivities(activities);
        } catch (error) {
            console.error('Error in fetchUserActivities:', error);
        } finally {
            setLoadingActivities(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'Activity') {
            fetchUserActivities();
        }
    }, [activeTab, activitiesLimit]);

    const handleSaveProfile = async () => {
        try {
            setIsSaving(true);

            // Update profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    email: formData.email,
                    role_id: formData.role_id,
                    status: formData.status,
                    is_department_admin: formData.is_department_admin
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Update user_groups table
            // First delete existing groups
            const { error: deleteError } = await supabase
                .from('user_groups')
                .delete()
                .eq('user_id', user.id);

            if (deleteError) throw deleteError;

            // Then insert new groups
            if (formData.groups.length > 0) {
                const groupIds = allGroups
                    .filter(g => formData.groups.includes(g.name))
                    .map(g => ({ user_id: user.id, group_id: g.id }));

                if (groupIds.length > 0) {
                    const { error: insertError } = await supabase
                        .from('user_groups')
                        .insert(groupIds);

                    if (insertError) throw insertError;

                    // Sync group_supervisors logic
                    // 1. Always remove existing supervisor entries for this user first
                    const { error: deleteSupervisorError } = await supabase
                        .from('group_supervisors')
                        .delete()
                        .eq('user_id', user.id);

                    if (deleteSupervisorError) throw deleteSupervisorError;

                    // 2. If role is Agent Supervisor (role_id 2), add to group_supervisors
                    // Validasi role_id bisa string "2" atau number 2
                    if (String(formData.role_id) === '2') {
                        const supervisorIds = groupIds.map(g => ({
                            user_id: user.id,
                            group_id: g.group_id
                        }));

                        const { error: insertSupervisorError } = await supabase
                            .from('group_supervisors')
                            .insert(supervisorIds);

                        if (insertSupervisorError) throw insertSupervisorError;
                    }
                }
            } else {
                // If no groups selected, ensure supervisor entries are also removed
                const { error: deleteSupervisorError } = await supabase
                    .from('group_supervisors')
                    .delete()
                    .eq('user_id', user.id);

                if (deleteSupervisorError) throw deleteSupervisorError;
            }

            setIsEditing(false);

            // Update local state dengan data terbaru
            const updatedUser: User = {
                ...user,
                name: formData.full_name,
                email: formData.email,
                role_id: formData.role_id,
                status: formData.status as 'Active' | 'Inactive',
                is_department_admin: formData.is_department_admin,
                groups: formData.groups
            };

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'User profile updated successfully',
                confirmButtonColor: '#4c40e6',
            });

            // Call onSave callback to refresh parent data
            if (onSave) {
                onSave();
            }
        } catch (error: any) {
            console.error('Error saving profile:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error saving profile: ' + error.message,
                confirmButtonColor: '#4c40e6',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 transition-colors mb-4 flex items-center gap-2">
                    &larr; Back
                </button>
                <h1 className="text-2xl font-bold text-gray-900">User Detail — {activeTab}</h1>
            </div>

            {/* User Info Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">Name</div>
                        <div className="text-lg font-bold text-gray-900">{user.name}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">Role</div>
                        <div className="text-lg font-medium text-gray-900">{user.role_name}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">Department</div>
                        <div className="text-lg font-medium text-gray-900">{user.department}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">Status</div>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${(user.status?.toLowerCase() === 'active') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-100 text-gray-600'
                            }`}>
                            {user.status?.charAt(0).toUpperCase() + user.status?.slice(1)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100/50 p-1 rounded-lg w-fit">
                {['Profile', 'Menu Access', 'Activity'].filter(tab => !isViewOnly || tab === 'Profile' || tab === 'Activity').map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'Profile' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-end">
                        {!isViewOnly && (
                            <>
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        Edit Profile
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                        {/* Full Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                disabled={!isEditing || isViewOnly}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={!isEditing || isViewOnly}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                            />
                        </div>

                        {/* Role */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                            <select
                                value={formData.role_id}
                                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                disabled={!isEditing || isViewOnly}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                            >
                                <option value="">Select a role</option>
                                {allRoles.map(role => (
                                    <option key={role.id} value={role.id}>{role.role_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Department */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                            <input
                                type="text"
                                value={user.department}
                                disabled
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                                disabled={!isEditing || isViewOnly}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>

                        {/* Is Department Admin */}
                        <div>
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={formData.is_department_admin}
                                    onChange={(e) => setFormData({ ...formData, is_department_admin: e.target.checked })}
                                    disabled={!isEditing || isViewOnly}
                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                />
                                <span className="text-sm font-medium text-gray-700">Is Department Admin</span>
                            </label>
                        </div>

                        {/* Group Assignment */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Group Assignment</label>
                            <div className="border border-gray-200 rounded-lg p-4">
                                {allGroups.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-4">
                                        {allGroups.map((group) => (
                                            <label key={group.id} className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.groups.includes(group.name)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({
                                                                ...formData,
                                                                groups: [...formData.groups, group.name]
                                                            });
                                                        } else {
                                                            setFormData({
                                                                ...formData,
                                                                groups: formData.groups.filter(g => g !== group.name)
                                                            });
                                                        }
                                                    }}
                                                    disabled={!isEditing || isViewOnly}
                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                                />
                                                <span className="text-sm text-gray-700">{group.name || `Group ${group.id}`}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No groups available in department</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'Menu Access' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {!isViewOnly && (
                        <div className="flex justify-between items-center">
                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        // Check if user has any custom permissions (saved or being edited)
                                        const hasCustomPermissions = menuItems.some(m => m.source === 'CUSTOM') || editedMenus.size > 0;

                                        // Show confirmation if custom permissions exist
                                        if (hasCustomPermissions) {
                                            const result = await Swal.fire({
                                                icon: 'warning',
                                                title: 'Delete Custom Permissions?',
                                                html: 'This user has <strong>custom permissions</strong>.<br/>All will be deleted and reverted to <strong>role default</strong>.',
                                                showCancelButton: true,
                                                confirmButtonText: 'Yes, Delete Custom',
                                                cancelButtonText: 'Cancel',
                                                confirmButtonColor: '#ef4444',
                                                cancelButtonColor: '#6b7280',
                                            });

                                            if (!result.isConfirmed) {
                                                return;
                                            }
                                        }

                                        try {
                                            setIsSaving(true);
                                            // Delete all user menu permissions to revert to role default
                                            await supabase
                                                .from('user_menu_permissions')
                                                .delete()
                                                .eq('user_id', user.id);

                                            setAccessType('default');
                                            setEditedMenus(new Map());
                                            await fetchMenuAccess();

                                            // Show success if we actually deleted something
                                            if (hasCustomPermissions) {
                                                Swal.fire({
                                                    icon: 'success',
                                                    title: 'Success!',
                                                    text: 'Custom permissions deleted. User now follows role default.',
                                                    confirmButtonColor: '#4c40e6',
                                                });
                                            }
                                        } catch (error: any) {
                                            console.error('Error reverting to role default:', error);
                                            Swal.fire({
                                                icon: 'error',
                                                title: 'Error',
                                                text: 'Error reverting to role default: ' + error.message,
                                                confirmButtonColor: '#4c40e6',
                                            });
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    }}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${accessType === 'default'
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    Use Role Default
                                </button>
                                <button
                                    onClick={() => setAccessType('custom')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${accessType === 'custom'
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    Custom Per User
                                </button>
                            </div>
                            {accessType === 'custom' && editedMenus.size > 0 && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setEditedMenus(new Map());
                                            setAccessType('default');
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                setIsSaving(true);
                                                // Delete existing user permissions
                                                await supabase
                                                    .from('user_menu_permissions')
                                                    .delete()
                                                    .eq('user_id', user.id);

                                                // Fetch role permissions to compare
                                                const { data: rolePermissionsData } = await supabase
                                                    .from('role_menu_permissions')
                                                    .select('*')
                                                    .eq('role_id', user.role_id);

                                                // Only save permissions that DIFFER from role default
                                                const customPerms = menuItems
                                                    .map(menu => {
                                                        const edited = editedMenus.get(menu.id);
                                                        const finalState = edited || menu;

                                                        // Find role permission for this menu
                                                        const rolePerm = rolePermissionsData?.find(
                                                            p => String(p.menu_id) === String(menu.id)
                                                        );

                                                        // Check if permission differs from role
                                                        const isDifferent =
                                                            finalState.view !== (rolePerm?.can_view || false) ||
                                                            finalState.create !== (rolePerm?.can_create || false) ||
                                                            finalState.update !== (rolePerm?.can_update || false) ||
                                                            finalState.delete !== (rolePerm?.can_delete || false);

                                                        // Only return if different from role
                                                        if (isDifferent) {
                                                            return {
                                                                user_id: user.id,
                                                                menu_key: String(menu.id),
                                                                can_view: finalState.view,
                                                                can_create: finalState.create,
                                                                can_update: finalState.update,
                                                                can_delete: finalState.delete,
                                                                source: 'CUSTOM'
                                                            };
                                                        }
                                                        return null;
                                                    })
                                                    .filter(p => p !== null);

                                                console.log('Saving only custom permissions (different from role):', customPerms);

                                                if (customPerms.length > 0) {
                                                    const { error: insertError } = await supabase
                                                        .from('user_menu_permissions')
                                                        .insert(customPerms);

                                                    if (insertError) {
                                                        console.error('Insert error:', insertError);
                                                        throw insertError;
                                                    }
                                                }

                                                // Update local state - compare with role to set correct source
                                                const updatedMenus = menuItems.map(menu => {
                                                    const edited = editedMenus.get(menu.id);
                                                    const finalState = edited || menu;

                                                    // Find role permission
                                                    const rolePerm = rolePermissionsData?.find(
                                                        p => String(p.menu_id) === String(menu.id)
                                                    );

                                                    // Check if different from role
                                                    const isDifferent =
                                                        finalState.view !== (rolePerm?.can_view || false) ||
                                                        finalState.create !== (rolePerm?.can_create || false) ||
                                                        finalState.update !== (rolePerm?.can_update || false) ||
                                                        finalState.delete !== (rolePerm?.can_delete || false);

                                                    return {
                                                        id: finalState.id,
                                                        name: finalState.name,
                                                        view: finalState.view,
                                                        create: finalState.create,
                                                        update: finalState.update,
                                                        delete: finalState.delete,
                                                        source: (isDifferent ? 'CUSTOM' : 'ROLE') as 'ROLE' | 'CUSTOM'
                                                    };
                                                });

                                                setMenuItems(updatedMenus);
                                                setAccessType(customPerms.length > 0 ? 'custom' : 'default');
                                                setEditedMenus(new Map());

                                                Swal.fire({
                                                    icon: 'success',
                                                    title: 'Success',
                                                    text: 'Custom permissions saved successfully',
                                                    confirmButtonColor: '#4c40e6',
                                                });
                                            } catch (error: any) {
                                                console.error('Error saving menu permissions:', error);
                                                Swal.fire({
                                                    icon: 'error',
                                                    title: 'Error',
                                                    text: 'Error saving menu permissions: ' + error.message,
                                                    confirmButtonColor: '#4c40e6',
                                                });
                                            } finally {
                                                setIsSaving(false);
                                            }
                                        }}
                                        disabled={isSaving || editedMenus.size === 0}
                                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900">Menu</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-900">View</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-900">Create</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-900">Update</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-900">Delete</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-900">Source</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loadingMenus ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                            <td className="px-6 py-4 text-center"><div className="h-4 bg-gray-200 rounded w-4 mx-auto"></div></td>
                                            <td className="px-6 py-4 text-center"><div className="h-4 bg-gray-200 rounded w-4 mx-auto"></div></td>
                                            <td className="px-6 py-4 text-center"><div className="h-4 bg-gray-200 rounded w-4 mx-auto"></div></td>
                                            <td className="px-6 py-4 text-center"><div className="h-4 bg-gray-200 rounded w-4 mx-auto"></div></td>
                                            <td className="px-6 py-4 text-center"><div className="h-4 bg-gray-200 rounded w-12 mx-auto"></div></td>
                                        </tr>
                                    ))
                                ) : menuItems.length > 0 ? (
                                    menuItems.map((menu) => {
                                        const displayMenu = editedMenus.get(menu.id) || menu;
                                        const isEdited = editedMenus.has(menu.id);
                                        const isReadOnly = accessType === 'default' || isViewOnly;

                                        return (
                                            <tr key={menu.id} className={`hover:bg-gray-50/50 ${isEdited ? 'bg-blue-50' : ''}`}>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{menu.name}</td>
                                                {['view', 'create', 'update', 'delete'].map((action) => (
                                                    <td key={action} className="px-6 py-4 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={displayMenu[action as 'view' | 'create' | 'update' | 'delete']}
                                                            onChange={(e) => {
                                                                if (!isReadOnly) {
                                                                    const updated = { ...displayMenu, [action]: e.target.checked, source: 'CUSTOM' as const };
                                                                    const newMap = new Map(editedMenus);
                                                                    newMap.set(menu.id, updated);
                                                                    setEditedMenus(newMap);
                                                                }
                                                            }}
                                                            disabled={isReadOnly}
                                                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${displayMenu.source === 'CUSTOM'
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {displayMenu.source}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                                            No menu data available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {activeTab === 'Activity' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                                <Clock size={18} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">User Activity Timeline</h3>
                        </div>

                        {loadingActivities ? (
                            <div className="space-y-8 py-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-4 animate-pulse">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0"></div>
                                        <div className="flex-1 space-y-2 pt-1">
                                            <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                                            <div className="h-3 bg-gray-50 rounded w-1/2"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : userActivities.length > 0 ? (
                            <div className="relative pl-12 space-y-10 before:absolute before:left-[23px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                                {userActivities.map((activity) => (
                                    <div key={activity.id} className="relative flex gap-4">
                                        {/* Icon Node */}
                                        <div className={`absolute -left-[44px] z-10 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center shrink-0 ${
                                            activity.icon === 'plus' ? 'bg-blue-50 text-blue-600' :
                                            activity.icon === 'user' ? 'bg-indigo-50 text-indigo-600' :
                                            activity.icon === 'clock' ? 'bg-amber-50 text-amber-600' :
                                            'bg-gray-50 text-gray-600'
                                        }`}>
                                            {activity.icon === 'plus' && <Plus size={16} />}
                                            {activity.icon === 'user' && <UserIcon size={16} />}
                                            {activity.icon === 'clock' && <Clock size={16} />}
                                            {activity.icon === 'activity' && <Eye size={16} />}
                                        </div>

                                        <div className="flex-1 pt-0.5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{activity.title}</p>
                                                    <p className="text-xs text-gray-500 mt-1">{activity.subtitle}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-medium text-gray-400">
                                                        {(() => {
                                                            const d = new Date(activity.timestamp);
                                                            if (isNaN(d.getTime())) return activity.timestamp;
                                                            return d.toLocaleString('id-ID', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            });
                                                        })()}
                                                    </p>
                                                    {activity.status && (
                                                        <span className="mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 uppercase border border-gray-200">
                                                            {activity.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {hasMoreActivities && (
                                    <div className="flex justify-center pt-6">
                                        <button
                                            onClick={() => setActivitiesLimit(prev => prev + 10)}
                                            disabled={loadingActivities}
                                            className="px-6 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {loadingActivities ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Loading...
                                                </>
                                            ) : (
                                                'Show More Activity'
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <div className="inline-flex p-4 rounded-full bg-gray-50 text-gray-400 mb-4">
                                    <Clock size={32} />
                                </div>
                                <h4 className="text-gray-900 font-medium">No activity found</h4>
                                <p className="text-gray-500 text-sm max-w-xs mx-auto mt-1">
                                    This user hasn't performed any logged actions or created any tickets yet.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const UserManagement: React.FC = () => {
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [groupFilter, setGroupFilter] = useState('All');
    const [mainTab, setMainTab] = useState<'system' | 'external' | 'identity'>('system');

    // Modena Identity States
    const [identityUsers, setIdentityUsers] = useState<any[]>([]);
    const [loadingIdentity, setLoadingIdentity] = useState(false);
    const [identitySearch, setIdentitySearch] = useState('');
    const [identityPage, setIdentityPage] = useState(1);
    const [identityTotal, setIdentityTotal] = useState(0);
    const [isActivatingUser, setIsActivatingUser] = useState<any | null>(null);

    // Fetch users and roles from Supabase
    useEffect(() => {
        fetchData();
    }, []);

    // Fetch data from various tables
    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const profileStr = localStorage.getItem('profile');
            const currentUser = profileStr ? JSON.parse(profileStr) : null;
            const isAdmin = currentUser?.role_id === 1 || currentUser?.role_id === '1';
            const isDeptAdmin = currentUser?.is_department_admin === true;
            const isSuperAdmin = isAdmin && !isDeptAdmin;

            // 1. Define queries
            let rolesQuery = supabase.from('roles').select('*');
            let deptQuery = supabase.from('company').select('*').order('company_id', { ascending: true });
            let groupsQuery = supabase.from('groups').select('*');
            let usersQuery = supabase.from('profiles').select('*').order('last_active_at', { ascending: false, nullsFirst: false });
            let userGroupsQuery = supabase.from('user_groups').select('*');

            // 2. Apply filtering for Department Admins (Restricted access)
            // Super Admins (isSuperAdmin === true) will see everything (no filter)
            if (currentUser?.company_id && !isSuperAdmin) {
                deptQuery = deptQuery.eq('company_id', currentUser.company_id);
                groupsQuery = groupsQuery.eq('company_id', currentUser.company_id);
                usersQuery = usersQuery.eq('company_id', currentUser.company_id);
            }

            const [rolesResponse, deptResponse, groupsResponse, usersResponse, userGroupsResponse] = await Promise.all([
                rolesQuery,
                deptQuery,
                groupsQuery,
                usersQuery,
                userGroupsQuery
            ]);

            const { data: rolesData, error: rolesError } = rolesResponse;
            const { data: deptData, error: deptError } = deptResponse;
            const { data: groupsData, error: groupsFetchError } = groupsResponse;
            const { data: usersData, error: usersError } = usersResponse;
            const { data: userGroupsData, error: userGroupsError } = userGroupsResponse;

            console.log('=== FETCH DATA DEBUG ===');
            console.log('Groups Data:', groupsData);
            console.log('User Groups Data:', userGroupsData);
            console.log('User Groups Error:', userGroupsError);

            if (rolesError) throw new Error(`Failed to fetch roles: ${rolesError.message}`);
            if (deptError) throw new Error(`Failed to fetch departments: ${deptError.message}`);
            if (usersError) throw new Error(`Failed to fetch profiles: ${usersError.message}`);

            if (groupsFetchError) {
                console.warn('Error fetching groups:', groupsFetchError);
            }

            if (userGroupsError) {
                console.error('ERROR fetching user groups:', userGroupsError);
            }

            // Set states with robust mapping
            const transformedRoles: Role[] = (rolesData || []).map((r: any) => ({
                id: r.id || r.role_id,
                role_name: r.role_name || r.name || 'Unknown Role'
            }));
            setRoles(transformedRoles);

            const transformedDepartments: Department[] = (deptData || []).map((dept: any) => ({
                id: dept.company_id,
                name: dept.company_name
            }));
            setDepartments(transformedDepartments);

            const fetchedGroups: Group[] = (groupsData || []).map((g: any) => ({
                id: g.id || g.group_id,
                name: g.name || g.group_name || 'Unknown Group',
                company_id: g.company_id
            }));
            setGroups(fetchedGroups);

            console.log('DEBUG: fetchedGroups:', fetchedGroups);
            console.log('DEBUG: userGroupsData:', userGroupsData);

            // Create a map for faster lookup
            const groupMap = new Map(fetchedGroups.map(g => [String(g.id), g.name]));
            const userGroupMap = new Map<string, string[]>();

            // Build user-to-groups mapping
            (userGroupsData || []).forEach((ug: any) => {
                const userId = String(ug.user_id);
                const groupId = String(ug.group_id);
                const groupName = groupMap.get(groupId);

                if (groupName) {
                    if (!userGroupMap.has(userId)) {
                        userGroupMap.set(userId, []);
                    }
                    userGroupMap.get(userId)!.push(groupName);
                }
            });

            console.log('DEBUG: userGroupMap:', Object.fromEntries(userGroupMap));

            // Manual Join for robustness
            const transformedUsers: User[] = (usersData || []).map((user: any) => {
                const userRole = (rolesData || []).find((r: any) =>
                    String(r.role_id) === String(user.role_id) || String(r.id) === String(user.role_id)
                );

                const userDept = (deptData || []).find((d: any) =>
                    String(d.company_id) === String(user.company_id)
                );

                // Get groups for this user
                const userGroups = userGroupMap.get(String(user.id)) || [];
                const groupNames = userGroups.join(', ') || 'No Group';

                // Format last active time properly
                let lastActiveDisplay = 'Never';
                if (user.last_active_at) {
                    try {
                        // Ensure the timestamp is treated as UTC
                        // Supabase returns timestamps without 'Z', so we need to add it
                        let timestamp = user.last_active_at;
                        if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
                            timestamp = timestamp + 'Z';
                        }

                        const date = new Date(timestamp);

                        console.log(`[${user.full_name}] Raw DB value:`, user.last_active_at);
                        console.log(`[${user.full_name}] Parsed UTC:`, date.toISOString());

                        // Use Intl.DateTimeFormat for reliable timezone conversion
                        const formatter = new Intl.DateTimeFormat('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        });

                        const parts = formatter.formatToParts(date);
                        const getValue = (type: string) => parts.find(p => p.type === type)?.value || '';

                        const day = getValue('day');
                        const month = getValue('month');
                        const year = getValue('year');
                        const hour = getValue('hour');
                        const minute = getValue('minute');
                        const second = getValue('second');

                        lastActiveDisplay = `${day}/${month}/${year}, ${hour}:${minute}:${second} WIB`;

                        console.log(`[${user.full_name}] Formatted WIB:`, lastActiveDisplay);
                    } catch (e) {
                        console.error('Error formatting date:', e);
                        lastActiveDisplay = 'Invalid Date';
                    }
                }

                // Normalize status to only Active/Inactive (employment status)
                const rawStatus = user.status || (user.is_active ? 'Active' : 'Inactive');
                const normalizedStatus = rawStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

                // Determine if user is external
                const email = (user.email || '').toLowerCase();
                const isModenaEmail = email.includes('@modena.com') || email.includes('@modena.co.id');
                const isInternalSpecial = email === 'super.admin@xmail.com' || email.includes('@xmail.com');
                
                const roleName = (userRole?.role_name || userRole?.name || 'N/A').toLowerCase();
                const roleId = String(user.role_id);
                // User is a requester if role_id is 4 OR role name contains 'requester'
                const isRequester = roleId === '4' || roleName.includes('requester');

                // User is external ONLY if they are a Requester AND have an external email
                // If they are Admin (1), Agent (2/3/5), etc., they are always Internal
                const isExternal = isRequester && !isModenaEmail && !isInternalSpecial;

                return {
                    id: user.id,
                    name: user.full_name || '',
                    email: user.email || '',
                    role_id: user.role_id || '',
                    role_name: userRole?.role_name || userRole?.name || 'N/A',
                    department: userDept?.company_name || 'N/A',
                    group: groupNames,
                    groups: userGroups,
                    is_department_admin: user.is_department_admin || false,
                    status: normalizedStatus,
                    last_active: lastActiveDisplay,
                    is_external: isExternal
                };
            });

            setUsers(transformedUsers);
        } catch (error: any) {
            console.error('Error fetching data:', error);
            setError(error.message || 'An error occurred fetching data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch Modena Identity Users
    const fetchIdentityUsers = async (page = 1, search = '') => {
        try {
            setLoadingIdentity(true);
            const perPage = 50;
            let url = `/modena-api/modena/users?page=${page}&perpage=${perPage}`;
            
            if (search) {
                url += `&filter=employe_name:${search}`;
            }
            url += `&filterAnd=employee_status:Active`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Security-Code': '81b637d8fcd2c6da6359e6963113a1170de795e4b725b84d1e0b4cfd9ec58ce9'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch from Modena Identity');
            
            const result = await response.json();
            setIdentityUsers(result.data || []);
            setIdentityTotal(result.total || 0);
            setIdentityPage(page);
        } catch (err: any) {
            console.error('Identity API Error:', err);
        } finally {
            setLoadingIdentity(false);
        }
    };

    useEffect(() => {
        if (mainTab === 'identity') {
            fetchIdentityUsers(1, identitySearch);
        }
    }, [mainTab]);

    const handleIdentitySearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchIdentityUsers(1, identitySearch);
    };

    // Helper to clean cost center (e.g. "CB018-CC028 Digital Infrastructure" -> "Digital Infrastructure")
    const cleanCostCenter = (costCenter: string) => {
        if (!costCenter) return 'N/A';
        const parts = costCenter.split(' ');
        if (parts.length > 1) {
            const firstPart = parts[0];
            if (/[\d-]/.test(firstPart)) {
                return parts.slice(1).join(' ');
            }
        }
        return costCenter;
    };

    const filteredUsers = users.filter(user => {
        // Tab filtering
        if (mainTab === 'system' && user.is_external) return false;
        if (mainTab === 'external' && !user.is_external) return false;

        const matchesSearch =
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.role_name && user.role_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            user.department.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole = roleFilter === 'All' || user.role_name === roleFilter;
        const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
        const matchesDepartment = departmentFilter === 'All' || user.department === departmentFilter;
        const matchesGroup = groupFilter === 'All' || user.group === groupFilter;

        return matchesSearch && matchesRole && matchesStatus && matchesDepartment && matchesGroup;
    });

    if (selectedUser) {
        return (
            <div className="p-8 bg-[#f3f4f6] min-h-screen">
                <UserDetail user={selectedUser} onBack={() => setSelectedUser(null)} onSave={() => {
                    fetchData();
                }} />
            </div>
        );
    }

    return (
        <div className="p-8 bg-[#f3f4f6] min-h-screen">
            {/* Tabs & Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="md:flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage system access and roles</p>
                </div>
                
                <div className="flex gap-1 bg-gray-200/50 p-1 rounded-xl self-stretch md:self-auto">
                    <button
                        onClick={() => setMainTab('system')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'system' 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Staff & Agents
                    </button>
                    <button
                        onClick={() => setMainTab('external')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'external' 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        External Users
                    </button>
                    <button
                        onClick={() => setMainTab('identity')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'identity' 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Modena Directory
                    </button>
                </div>

                <div className="md:flex-1 flex justify-end">
                    {(mainTab === 'system' || mainTab === 'external') ? (
                        <button
                            onClick={() => setIsCreatingUser(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 text-sm font-medium"
                        >
                            <Plus size={18} />
                            Add User
                        </button>
                    ) : (
                        // Placeholder to keep tabs in center when Add User is hidden
                        <div className="hidden md:block w-[120px]" />
                    )}
                </div>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                {/* Search Bar */}
                {error && (
                    <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-sm">
                        <strong>Error:</strong> {error}
                    </div>
                )}
                {mainTab === 'system' || mainTab === 'external' ? (
                    <>
                        {/* Search Bar */}
                        <div className="p-6 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search users by name, email, role or department"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Filters */}
                        <div className={`p-6 border-b border-gray-100 grid ${mainTab === 'external' ? 'grid-cols-2' : 'grid-cols-4'} gap-4`}>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2">Role</label>
                                <div className="relative">
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none bg-white pr-8"
                                    >
                                        <option value="All">All</option>
                                        {roles.map(role => (
                                            <option key={`role-${role.id}`} value={role.role_name}>{role.role_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2">Status</label>
                                <div className="relative">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none bg-white pr-8"
                                    >
                                        <option value="All">All</option>
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            {mainTab !== 'external' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-2">Department</label>
                                        <div className="relative">
                                            <select
                                                value={departmentFilter}
                                                onChange={(e) => {
                                                    setDepartmentFilter(e.target.value);
                                                    setGroupFilter('All');
                                                }}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none bg-white pr-8"
                                            >
                                                <option value="All">All</option>
                                                {departments.map(dept => (
                                                    <option key={`dept-${dept.id}`} value={dept.name}>{dept.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-2">
                                            Group
                                            {departmentFilter === 'All' && <span className="text-orange-600 ml-1 text-[10px] italic">* Select Department first</span>}
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={groupFilter}
                                                onChange={(e) => setGroupFilter(e.target.value)}
                                                disabled={departmentFilter === 'All'}
                                                className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none pr-8 ${departmentFilter === 'All' ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white'
                                                    }`}
                                            >
                                                <option value="All">All</option>
                                                {groups
                                                    .filter(g => {
                                                        if (departmentFilter === 'All') return false;
                                                        const selectedDept = departments.find(d => d.name === departmentFilter);
                                                        return selectedDept && g.company_id === selectedDept.id;
                                                    })
                                                    .map(group => (
                                                        <option key={`group-${group.id}`} value={group.name}>{group.name}</option>
                                                    ))
                                                }
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                        {mainTab !== 'external' && (
                                            <>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Group</th>
                                            </>
                                        )}
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Active</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={8} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{user.role_name}</td>
                                                {mainTab !== 'external' && (
                                                    <>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{user.department}</td>
                                                        <td className="px-6 py-4 text-sm">
                                                            <GroupsDisplay groups={user.groups} maxDisplay={2} userName={user.name} />
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-6 py-4 text-sm">
                                                    <StatusBadge status={user.status} />
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{user.last_active}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setSelectedUser(user)}
                                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500 text-sm">
                                                No users found matching your filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination (System Only) */}
                        {filteredUsers.length > 0 && (
                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                    Showing <span className="font-medium text-gray-700">1</span> to <span className="font-medium text-gray-700">{filteredUsers.length}</span> of <span className="font-medium text-gray-700">{filteredUsers.length}</span> users
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                        Previous
                                    </button>
                                    <button className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg">
                                        1
                                    </button>
                                    <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Directory Search */}
                        <div className="p-6 border-b border-gray-100">
                            <form onSubmit={handleIdentitySearch} className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Search by name in Modena Identity..."
                                        value={identitySearch}
                                        onChange={(e) => setIdentitySearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loadingIdentity}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold flex items-center gap-2"
                                >
                                    {loadingIdentity ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                    Search Identity
                                </button>
                            </form>
                        </div>

                        {/* Identity Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Emp No</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loadingIdentity ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : identityUsers.length > 0 ? (
                                        identityUsers.map((iUser, idx) => {
                                            const isRegistered = users.some(u => u.email.toLowerCase() === iUser.email?.toLowerCase());
                                            
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{iUser.emp_no || 'N/A'}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{iUser.employe_name}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{iUser.email || 'N/A'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-gray-800">{cleanCostCenter(iUser.cost_center)}</span>
                                                            <span className="text-[10px] text-gray-400 font-mono italic">{iUser.cost_center}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        <span className="font-medium text-gray-800">{iUser.employee_position || 'N/A'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
                                                            Active
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {isRegistered ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold border border-gray-200">
                                                                <Check size={14} className="text-green-500" />
                                                                Already Active
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => setIsActivatingUser(iUser)}
                                                                className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-all shadow-sm shadow-indigo-100"
                                                            >
                                                                <Plus size={14} />
                                                                Activate as Staff
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
                                                {identitySearch ? 'No employees found.' : 'Enter a name to search the directory.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Identity Pagination */}
                        {identityUsers.length > 0 && (
                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                    Showing <span className="font-medium text-gray-700">{(identityPage - 1) * 50 + 1}</span> to <span className="font-medium text-gray-700">{Math.min(identityPage * 50, identityTotal)}</span> of <span className="font-medium text-gray-700">{identityTotal}</span> employees
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => fetchIdentityUsers(identityPage - 1, identitySearch)}
                                        disabled={identityPage <= 1 || loadingIdentity}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg">
                                        {identityPage}
                                    </button>
                                    <button 
                                        onClick={() => fetchIdentityUsers(identityPage + 1, identitySearch)}
                                        disabled={identityPage * 50 >= identityTotal || loadingIdentity}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Overlays */}
            {isCreatingUser && (
                <div className="fixed inset-0 z-50 flex justify-end transition-opacity duration-300">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
                        onClick={() => setIsCreatingUser(false)}
                    />
                    <div className="relative w-full max-w-2xl bg-[#f3f4f6] h-full shadow-2xl overflow-y-auto transform transition-transform duration-300 animate-in slide-in-from-right">
                        <div className="p-6 h-full">
                            <CreateUser
                                onCancel={() => setIsCreatingUser(false)}
                                onSuccess={() => {
                                    setIsCreatingUser(false);
                                    fetchData();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isActivatingUser && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setIsActivatingUser(null)} />
                    <div className="relative w-full max-w-2xl bg-[#f3f4f6] h-full shadow-2xl overflow-y-auto transform transition-transform duration-300 animate-in slide-in-from-right">
                        <div className="p-6 h-full">
                            <CreateUser
                                initialData={{
                                    fullName: isActivatingUser.employe_name,
                                    email: isActivatingUser.email,
                                }}
                                onCancel={() => setIsActivatingUser(null)}
                                onSuccess={() => {
                                    setIsActivatingUser(null);
                                    setMainTab('system');
                                    fetchData();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export { UserDetail };
export default UserManagement;
