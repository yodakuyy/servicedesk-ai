import React, { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CreateGroup from './CreateGroup';
import GroupDetail from './GroupDetail';
import MembersModal from './MembersModal';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface Group {
  id: string;
  name: string;
  company_id: number;
  company_name: string;
  member_count: number;
  status: 'Active' | 'Inactive';
}

interface Department {
  company_id: number;
  company_name: string;
}

const GroupManagement: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupDetail, setShowGroupDetail] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Members Modal state
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<{ id: string, name: string } | null>(null);

  // Fetch groups and departments
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from('company')
        .select('*')
        .order('company_id', { ascending: true });

      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select(`
          id,
          name,
          company_id,
          is_active
        `)
        .order('company_id', { ascending: true });

      if (groupsError) throw groupsError;

      // Fetch all user_groups and profiles in one go for efficiency
      const { data: allUserGroupsData } = await supabase
        .from('user_groups')
        .select('group_id, user_id');

      const { data: allProfilesData } = await supabase
        .from('profiles')
        .select('id, role_id');

      // Create lookup maps
      const userGroupsMap = new Map<string, string[]>();
      (allUserGroupsData || []).forEach((ug: any) => {
        if (!userGroupsMap.has(ug.group_id)) {
          userGroupsMap.set(ug.group_id, []);
        }
        userGroupsMap.get(ug.group_id)!.push(ug.user_id);
      });

      const profilesMap = new Map<string, number>();
      (allProfilesData || []).forEach((p: any) => {
        profilesMap.set(p.id, p.role_id);
      });

      // Process groups with member counts
      const groupsWithMembers = (groupsData || []).map((group: any) => {
        const userIds = userGroupsMap.get(group.id) || [];
        // Count only non-Requester members (role_id !== 4)
        const memberCount = userIds.filter(userId => {
          const roleId = profilesMap.get(userId);
          return roleId !== 4;
        }).length;

        const dept = deptData?.find((d: any) => d.company_id === group.company_id);

        return {
          id: group.id,
          name: group.name,
          company_id: group.company_id,
          company_name: dept?.company_name || 'Unknown',
          member_count: memberCount,
          status: group.is_active ? 'Active' : 'Inactive'
        };
      });

      setGroups(groupsWithMembers);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groups.filter((group: Group) => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === 'All' || group.company_name === departmentFilter;
    const matchesStatus = statusFilter === 'All' || group.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const handleCreateGroup = () => {
    setShowCreateGroup(true);
  };

  const handleViewGroup = (group: Group) => {
    setSelectedGroupId(group.id);
    setShowGroupDetail(true);
  };

  const handleViewMembers = (group: Group) => {
    setSelectedGroupForMembers({ id: group.id, name: group.name });
    setShowMembersModal(true);
  };

  if (loading) {
    return (
      <div className="p-8 bg-[#f3f4f6] min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#f3f4f6] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Group Management</h1>
        <button
          onClick={handleCreateGroup}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 text-sm font-medium"
        >
          <Plus size={18} />
          Create Group
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Search Bar */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        <div className="p-6 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search groups by name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-100 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Department</label>
            <div className="relative">
              <select
                value={departmentFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none bg-white pr-8"
              >
                <option value="All">All</option>
                {departments.map((dept: Department) => (
                  <option key={`dept-${dept.company_id}`} value={dept.company_name}>{dept.company_name}</option>
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
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none bg-white pr-8"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div></div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900">DEPARTMENT</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900">GROUP NAME</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900">MEMBERS</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900">STATUS</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-900">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredGroups.length > 0 ? (
                filteredGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">{group.company_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">{group.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <button
                        onClick={() => handleViewMembers(group)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer hover:underline"
                        title="Click to view members details"
                      >
                        {group.member_count}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${group.status === 'Active'
                        ? 'bg-green-50 text-green-700 border border-green-100'
                        : 'bg-gray-100 text-gray-600'
                        }`}>
                        {group.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewGroup(group)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                        title="View group details"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
                    No groups found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-700">{filteredGroups.length}</span> of <span className="font-medium text-gray-700">{groups.length}</span> groups
          </div>
        </div>
      </div>

      {/* Group Detail Drawer */}
      <GroupDetail
        isOpen={showGroupDetail}
        groupId={selectedGroupId}
        onClose={() => {
          setShowGroupDetail(false);
          setSelectedGroupId(null);
        }}
        onUpdate={() => {
          fetchData();
        }}
      />

      {/* Members Modal */}
      <MembersModal
        isOpen={showMembersModal}
        groupId={selectedGroupForMembers?.id || null}
        groupName={selectedGroupForMembers?.name || ''}
        onClose={() => {
          setShowMembersModal(false);
          setSelectedGroupForMembers(null);
        }}
      />

      {/* Create Group Drawer */}
      <CreateGroup
        isOpen={showCreateGroup}
        onCancel={() => setShowCreateGroup(false)}
        onSuccess={() => {
          setShowCreateGroup(false);
          fetchData();
        }}
      />
    </div>
  );
};

export default GroupManagement;
