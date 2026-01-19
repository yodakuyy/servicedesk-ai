import React, { useEffect, useState } from 'react';
import { X, Loader2, Search, ChevronDown, ChevronRight, User as UserIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MembersModalProps {
    isOpen: boolean;
    groupId: string | null;
    groupName: string;
    onClose: () => void;
}

interface Member {
    id: string;
    full_name: string;
    email: string;
    role_name: string;
    role_id: number;
}

const MembersModal: React.FC<MembersModalProps> = ({ isOpen, groupId, groupName, onClose }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen && groupId) {
            fetchMembers();
            setSearchQuery('');
        } else {
            setMembers([]);
        }
    }, [isOpen, groupId]);

    const fetchMembers = async () => {
        try {
            setLoading(true);

            // 1. Get user IDs from user_groups
            const { data: userGroups } = await supabase
                .from('user_groups')
                .select('user_id')
                .eq('group_id', groupId);

            const userIds = (userGroups || []).map((ug: any) => ug.user_id);

            if (userIds.length === 0) {
                setMembers([]);
                setLoading(false);
                return;
            }

            // 2. Get profile details
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email, role_id')
                .in('id', userIds)
                .neq('role_id', 4); // Exclude Requester if needed

            // 3. Get roles
            const { data: roles } = await supabase
                .from('roles')
                .select('role_id, role_name');

            // 4. Combine data
            const combinedMembers = (profiles || []).map((profile: any) => {
                const role = roles?.find((r: any) => r.role_id === profile.role_id);
                return {
                    id: profile.id,
                    full_name: profile.full_name || 'Unknown',
                    email: profile.email || 'N/A',
                    role_id: profile.role_id,
                    role_name: role?.role_name || 'Unknown Role'
                };
            });

            setMembers(combinedMembers);

            // Set default expanded roles (e.g., Administrator and Agent Supervisor initially expanded)
            const initialExpandedState: Record<string, boolean> = {};
            combinedMembers.forEach((m: Member) => {
                if (['Administrator', 'Agent Supervisor', 'Agent L1', 'Agent L2'].includes(m.role_name)) {
                    initialExpandedState[m.role_name] = true;
                }
            });
            setExpandedRoles(initialExpandedState);

        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleRole = (roleName: string) => {
        setExpandedRoles(prev => ({
            ...prev,
            [roleName]: !prev[roleName]
        }));
    };

    // Filter members based on search
    const filteredMembers = members.filter(member =>
        member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.role_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group members by role
    const membersByRole = filteredMembers.reduce((acc: Record<string, Member[]>, member) => {
        if (!acc[member.role_name]) {
            acc[member.role_name] = [];
        }
        acc[member.role_name].push(member);
        return acc;
    }, {});

    // Role priority order
    const roleOrder = ['Administrator', 'Agent Supervisor', 'Agent L1', 'Agent L2', 'Agent'];
    const sortedRoles = roleOrder.filter(role => membersByRole[role]);
    Object.keys(membersByRole).forEach(role => {
        if (!roleOrder.includes(role)) {
            sortedRoles.push(role);
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl transform transition-all flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex flex-col border-b border-gray-100 bg-white z-10 sticky top-0">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                Members
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                                    {filteredMembers.length}
                                </span>
                            </h3>
                            <p className="text-sm text-indigo-600 font-medium truncate max-w-[200px]">{groupName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="px-6 pb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search members by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <Loader2 className="w-8 h-8 mb-2 animate-spin text-indigo-500" />
                            <p className="text-sm">Loading members...</p>
                        </div>
                    ) : filteredMembers.length > 0 ? (
                        <div className="space-y-3">
                            {sortedRoles.map(roleName => {
                                const isExpanded = expandedRoles[roleName] || searchQuery.length > 0; // Always expand when searching
                                return (
                                    <div key={roleName} className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                                        {/* Role Header (Accordion) */}
                                        <button
                                            onClick={() => toggleRole(roleName)}
                                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                                <span className="text-sm font-semibold text-gray-700">{roleName}</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500 text-xs font-semibold shadow-sm">
                                                {membersByRole[roleName].length}
                                            </span>
                                        </button>

                                        {/* Members List */}
                                        {isExpanded && (
                                            <div className="divide-y divide-gray-50 animate-in slide-in-from-top-2 duration-200">
                                                {membersByRole[roleName].map(member => (
                                                    <div key={member.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group">
                                                        {/* Avatar Placeholder */}
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-xs ring-2 ring-white shadow-sm group-hover:scale-105 transition-transform">
                                                            {member.full_name.charAt(0).toUpperCase()}
                                                        </div>

                                                        {/* User Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-sm font-semibold text-gray-800 truncate">
                                                                    {member.full_name}
                                                                </p>
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {/* Future actions like 'Remove' could go here */}
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <Search size={24} className="text-gray-300" />
                            </div>
                            <h3 className="text-gray-900 font-medium">No members found</h3>
                            <p className="text-gray-500 text-sm mt-1 max-w-[200px]">
                                {searchQuery ? `No results for "${searchQuery}"` : "This group doesn't have any members yet."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MembersModal;
