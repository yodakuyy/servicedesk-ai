import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
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

    useEffect(() => {
        if (isOpen && groupId) {
            fetchMembers();
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
                .neq('role_id', 4); // Exclude Requester if needed, based on previous logic

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

        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Group members by role
    const membersByRole = members.reduce((acc: Record<string, Member[]>, member) => {
        if (!acc[member.role_name]) {
            acc[member.role_name] = [];
        }
        acc[member.role_name].push(member);
        return acc;
    }, {});

    // Define role priority order for display
    const roleOrder = ['Administrator', 'Agent Supervisor', 'Agent'];
    const sortedRoles = roleOrder.filter(role => membersByRole[role]);
    // Add any other roles that might exist but aren't in the priority list
    Object.keys(membersByRole).forEach(role => {
        if (!roleOrder.includes(role)) {
            sortedRoles.push(role);
        }
    });

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl transform transition-all flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            Members
                            <span className="text-gray-500 font-normal ml-2 text-sm">
                                ({members.length} selected)
                            </span>
                        </h3>
                        <p className="text-xs text-indigo-600 font-medium mt-0.5">{groupName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                            <Loader2 className="w-8 h-8 mb-2 animate-spin text-indigo-500" />
                            <p className="text-sm">Loading members...</p>
                        </div>
                    ) : members.length > 0 ? (
                        <div className="space-y-6">
                            {sortedRoles.map(roleName => (
                                <div key={roleName} className="space-y-3">
                                    <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold inline-block">
                                        {roleName}
                                    </div>
                                    <div className="space-y-3 pl-1">
                                        {membersByRole[roleName].map(member => (
                                            <div key={member.id} className="group flex items-start justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                                <div>
                                                    <div className="font-medium text-gray-900">{member.full_name}</div>
                                                    <div className="text-xs text-gray-500">{member.email}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            No members found in this group
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MembersModal;
