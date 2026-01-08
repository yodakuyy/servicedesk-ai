import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, Loader2, Eye, EyeOff, Check, ChevronsUpDown } from 'lucide-react';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface CreateUserProps {
    onCancel: () => void;
    onSuccess: () => void;
}

interface Role {
    id: string;
    role_name: string;
}

interface Department {
    company_id: number;
    company_name: string;
}

interface Group {
    id: string;
    name: string;
    company_id: number;
}

const CreateUser: React.FC<CreateUserProps> = ({ onCancel, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [fetchingOptions, setFetchingOptions] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
    const groupDropdownRef = useRef<HTMLDivElement>(null);

    // Data Options
    const [roles, setRoles] = useState<Role[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        roleId: '',
        departmentId: '',
        groupIds: [] as string[],
        status: 'Active'
    });

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchOptions();

        // Click outside listener for dropdown
        const handleClickOutside = (event: MouseEvent) => {
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
                setIsGroupDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchOptions = async () => {
        try {
            setFetchingOptions(true);

            // Fetch Roles
            const { data: rolesData } = await supabase.from('roles').select('*');
            if (rolesData) {
                const transformedRoles = rolesData.map((r: any) => ({
                    id: r.id || r.role_id,
                    role_name: r.role_name || r.name || 'Unknown Role'
                }));
                setRoles(transformedRoles);
            }

            // Fetch Departments
            const { data: deptData } = await supabase.from('company').select('*').order('company_id');
            if (deptData) setDepartments(deptData);

            // Fetch Groups
            const { data: groupsData } = await supabase.from('groups').select('*').eq('is_active', true);
            if (groupsData) setGroups(groupsData);

        } catch (err: any) {
            console.error('Error fetching options:', err);
            setError('Failed to load form options');
        } finally {
            setFetchingOptions(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updates = { ...prev, [name]: value };
            // Reset groups when department changes
            if (name === 'departmentId') {
                updates.groupIds = [];
            }
            return updates;
        });
    };

    const toggleGroup = (groupId: string) => {
        setFormData(prev => {
            const currentGroups = prev.groupIds;
            if (currentGroups.includes(groupId)) {
                return { ...prev, groupIds: currentGroups.filter(id => id !== groupId) };
            } else {
                return { ...prev, groupIds: [...currentGroups, groupId] };
            }
        });
    };

    // Filter groups based on selected department
    const filteredGroups = groups.filter(group =>
        !formData.departmentId || group.company_id.toString() === formData.departmentId.toString()
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // STEP 1: Create Auth User (WAJIB PERTAMA)
            console.log('STEP 1: Creating auth user...');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                    }
                }
            });

            if (authError) throw new Error(`Auth error: ${authError.message}`);
            if (!authData.user) throw new Error('Failed to create auth user');

            const userId = authData.user.id;
            console.log('✅ Auth user created:', userId);

            // STEP 2: Create Profile (WAJIB)
            console.log('STEP 2: Creating profile...');
            console.log('Role ID being sent:', formData.roleId, 'Type:', typeof formData.roleId);
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    full_name: formData.fullName,
                    email: formData.email,
                    role_id: parseInt(formData.roleId),
                    company_id: parseInt(formData.departmentId),
                    status: formData.status
                });

            if (profileError) throw new Error(`Profile error: ${profileError.message}`);
            console.log('✅ Profile created');

            // STEP 3: Create User Groups (KONDISIONAL - hanya jika role ≠ Requester)
            console.log('STEP 3: Creating user groups...');

            // Check if role is Requester (role_id 4)
            const isRequester = formData.roleId === '4';

            if (!isRequester && formData.groupIds.length > 0) {
                const userGroupsData = formData.groupIds.map(groupId => ({
                    user_id: userId,
                    group_id: groupId
                }));

                const { error: groupsError } = await supabase
                    .from('user_groups')
                    .insert(userGroupsData);

                if (groupsError) throw new Error(`Groups error: ${groupsError.message}`);
                console.log('✅ User groups created:', userGroupsData.length);
            } else if (isRequester) {
                console.log('ℹ️ Requester role - skipping group assignment');
            } else {
                console.log('ℹ️ No groups selected');
            }

            console.log('✅ User created successfully');
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'User created successfully',
                confirmButtonColor: '#4c40e6',
            });

            onSuccess();

        } catch (err: any) {
            console.error('❌ Error creating user:', err);
            setError(err.message || 'Failed to create user');
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.message || 'Failed to create user',
                confirmButtonColor: '#4c40e6',
            });
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto my-8">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                <h2 className="text-xl font-bold text-gray-800">Create New User</h2>
                <button
                    onClick={onCancel}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6" autoComplete="off">
                {error && (
                    <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Full Name</label>
                        <input
                            type="text"
                            name="fullName"
                            required
                            value={formData.fullName}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                            placeholder="Enter full name"
                            autoComplete="off"
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Email Address</label>
                        <input
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                            placeholder="Enter email address"
                            autoComplete="new-password"
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                required
                                minLength={6}
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm pr-10"
                                placeholder="••••••••"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Status</label>
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white"
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    {/* Role */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Role</label>
                        <select
                            name="roleId"
                            required
                            value={formData.roleId}
                            onChange={handleChange}
                            disabled={fetchingOptions}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
                        >
                            <option value="">{fetchingOptions ? "Loading roles..." : "Select Role"}</option>
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>{role.role_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Department */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Department</label>
                        <select
                            name="departmentId"
                            required
                            value={formData.departmentId}
                            onChange={handleChange}
                            disabled={fetchingOptions}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
                        >
                            <option value="">{fetchingOptions ? "Loading departments..." : "Select Department"}</option>
                            {departments.map(dept => (
                                <option key={dept.company_id} value={dept.company_id}>{dept.company_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Group Multi-Select */}
                    <div className="space-y-1.5" ref={groupDropdownRef}>
                        <label className="text-sm font-semibold text-gray-700">Group</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => formData.departmentId && !fetchingOptions && setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                                disabled={fetchingOptions || !formData.departmentId}
                                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white text-left disabled:bg-gray-50 disabled:cursor-not-allowed"
                            >
                                <span className={formData.groupIds.length === 0 ? "text-gray-500" : "text-gray-900"}>
                                    {fetchingOptions
                                        ? "Loading groups..."
                                        : formData.groupIds.length === 0
                                            ? "Select Groups"
                                            : filteredGroups
                                                .filter(g => formData.groupIds.includes(g.id))
                                                .map(g => g.name)
                                                .join(", ")
                                    }
                                </span>
                                {fetchingOptions ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <ChevronsUpDown size={16} className="text-gray-400" />}
                            </button>

                            {isGroupDropdownOpen && (
                                <div className="absolute z-10 w-full bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                    {filteredGroups.length === 0 ? (
                                        <div className="p-3 text-sm text-gray-500 text-center">
                                            No groups available for this department
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                                            {filteredGroups.map(group => {
                                                const isSelected = formData.groupIds.includes(group.id);
                                                return (
                                                    <div
                                                        key={group.id}
                                                        onClick={() => toggleGroup(group.id)}
                                                        className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer transition-colors rounded"
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"
                                                            }`}>
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <span className={`text-sm ${isSelected ? "text-gray-900 font-medium" : "text-gray-700"}`}>
                                                            {group.name}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {formData.departmentId === '' && (
                            <p className="text-xs text-orange-500 mt-1">Please select a department first.</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
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
                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Create User
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateUser;
