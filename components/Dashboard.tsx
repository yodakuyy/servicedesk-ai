import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Ticket,
  Package,
  Book,
  Settings,
  Plus,
  Search,
  MoreVertical,
  ChevronDown,
  Star,
  LogOut,
  User,
  ArrowLeftRight,
  FileText,
  CalendarOff,
  ChevronRight,
  Menu,
  ChevronLeft,
  BookOpen,
  TrendingUp,
  Bell
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import IncidentList from './IncidentList';
import KnowledgeBase from './KnowledgeBase';
import OutOfOffice from './OutOfOffice';
import TicketDetail from './TicketDetail';
import UserDashboard from './UserDashboard';
import HelpCenter from './HelpCenter';
import UserTicketList from './UserTicketList';
import UserManagement from './UserManagement';
import { UserDetail } from './UserManagement';
import GroupManagement from './GroupManagement';
import BusinessHours from './BusinessHours';
import CategoryManagement from './CategoryManagement';

interface DashboardProps {
  onLogout: () => void;
  onChangeDepartment: () => void;
}

// Data for charts/tables
const ticketData = [
  { id: 'INC4568', date: '04/12/23', time: '08:24AM', subject: 'Error when starting Microsoft Word', user: 'Marso.27', status: 'WIP', lastUpdate: '23min', updateColor: 'bg-green-100 text-green-700', urgency: 'High' },
  { id: 'RITM4321', date: '04/11/23', time: '10:07AM', subject: 'Assistance moving desktop computer', user: 'Deppert.5', status: 'Assigned', lastUpdate: '1hr', updateColor: 'bg-green-100 text-green-700', urgency: 'Low' },
  { id: 'RITM4268', date: '04/10/23', time: '02:34PM', subject: "I'd like to order a new webcam", user: 'Miller.409', status: 'Pending', lastUpdate: '2 days', updateColor: 'bg-red-100 text-red-700', urgency: 'Medium' },
  { id: 'RITM4599', date: '04/10/23', time: '09:15AM', subject: 'Need access to shared drive', user: 'Smith.839', status: 'WIP', lastUpdate: '4min', updateColor: 'bg-green-100 text-green-700', urgency: 'Urgent' },
  { id: 'INC4567', date: '04/08/23', time: '08:24AM', subject: "Can't sign into app", user: 'Shulz.45', status: 'Pending', lastUpdate: '1 day', updateColor: 'bg-yellow-100 text-yellow-700', urgency: 'Medium' },
];

const overdueData = [
  { id: 'RITM4579', date: '04/12/23', time: '10:40PM', subject: 'Need assistance with powerpoint', user: 'Lynn.2', urgency: 'Medium', eta: '-2h', assignedTo: 'Unassigned' },
  { id: 'RITM4344', date: '04/12/23', time: '10:17AM', subject: 'Requesting info about new app', user: 'Mackay.43', urgency: 'High', eta: '-4h', assignedTo: 'John.D' },
  { id: 'INC4298', date: '04/12/23', time: '08:34PM', subject: 'Keyboard not responding', user: 'Wilson.25', assignedTo: 'Levinson.2', urgency: 'Low', eta: '-1d' },
  { id: 'RITM4601', date: '04/11/23', time: '07:37AM', subject: 'Financial app access needed', user: 'Fry.36', urgency: 'Urgent', eta: '-30m', assignedTo: 'Sarah.K' },
];

const topServiceRequestsData = [
  { name: 'New Account', count: 65, fill: '#3b82f6' },
  { name: 'Password', count: 48, fill: '#8b5cf6' },
  { name: 'Software', count: 32, fill: '#ec4899' },
  { name: 'Hardware', count: 24, fill: '#10b981' },
  { name: 'Access', count: 18, fill: '#f59e0b' },
];

const topIncidentsData = [
  { name: 'Network', count: 42, fill: '#ef4444' },
  { name: 'Software', count: 35, fill: '#f97316' },
  { name: 'Hardware', count: 28, fill: '#eab308' },
  { name: 'Printer', count: 15, fill: '#06b6d4' },
  { name: 'Email', count: 12, fill: '#6366f1' },
];

// Reusable Sidebar Item
interface SidebarItemProps {
  icon?: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
  expanded?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active = false, badge = '', onClick, expanded }) => (
  <div
    onClick={onClick}
    className={`flex items-center justify-between px-6 py-3 cursor-pointer border-l-4 transition-colors whitespace-nowrap ${active ? 'bg-indigo-50 border-indigo-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
  >
    <div className="flex items-center gap-3">
      {Icon && <Icon size={20} className={active ? 'text-indigo-600' : 'text-gray-400'} />}
      <span className={`font-medium text-sm ${active ? 'text-indigo-900' : ''}`}>{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {badge && (
        <span className="bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
          {badge}
        </span>
      )}
      {expanded !== undefined && (
        <ChevronRight size={16} className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      )}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ onLogout, onChangeDepartment }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'user-dashboard' | 'incidents' | 'knowledge' | 'help-center' | 'outofoffice' | 'ticket-detail' | 'my-tickets' | 'service-requests' | 'user-incidents' | 'escalated-tickets' | 'user-management' | 'group-management' | 'business-hours' | 'profile' | 'team-availability' | 'availability' | 'categories'>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<'incidents' | 'my-tickets' | 'profile'>('incidents');
  const [accessibleMenus, setAccessibleMenus] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    full_name: '',
    email: '',
    status: 'Active'
  });
  const [profileUser, setProfileUser] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [previousViewBeforeProfile, setPreviousViewBeforeProfile] = useState<'user-dashboard' | 'profile'>('user-dashboard');
  const menuRef = useRef<HTMLDivElement>(null);

  // Load user profile and accessible menus from localStorage
  useEffect(() => {
    const profile = localStorage.getItem('profile');
    if (profile) {
      try {
        const parsedProfile = JSON.parse(profile);
        setUserProfile(parsedProfile);
        setProfileFormData({
          full_name: parsedProfile.full_name || '',
          email: parsedProfile.email || '',
          status: parsedProfile.status || 'Active'
        });
      } catch (error) {
        console.error('Error parsing profile:', error);
      }
    }

    const menus = localStorage.getItem('accessibleMenus');
    if (menus) {
      try {
        const parsedMenus = JSON.parse(menus);
        // Sort menus by sort_order (lower values first)
        const sortedMenus = parsedMenus.sort((a: any, b: any) => {
          const orderA = a.sort_order || 0;
          const orderB = b.sort_order || 0;
          return orderA - orderB;
        });
        setAccessibleMenus(sortedMenus);

        // Set default view logic: Priority to Dashboard
        const hasDashboard = parsedMenus.some((m: any) => m.name === 'Dashboard');
        if (hasDashboard) {
          setCurrentView('dashboard');
        } else if (parsedMenus.length > 0) {
          // Fallback to first menu if Dashboard not available
          const firstMenu = parsedMenus[0];
          const menuViewMap: { [key: string]: any } = {
            'Dashboard': 'dashboard',
            'User Tickets': 'user-dashboard',
            'All Incidents': 'incidents',
            'User Incidents': 'my-tickets', // Maps to UserTicketList (User Incidents data)
            'Out of Office': 'outofoffice',
            'Knowledge Base': 'knowledge',
            'Help Center': 'help-center',
            'My Tickets': 'user-incidents', // Empty placeholder
            'Service Requests': 'service-requests', // Empty placeholder
          };
          const defaultView = menuViewMap[firstMenu.name];
          if (defaultView) {
            setCurrentView(defaultView);
          }
        }
      } catch (error) {
        console.error('Error parsing accessible menus:', error);
      }
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch profile data when currentView is 'profile'
  useEffect(() => {
    if (currentView !== 'profile') return;

    const fetchProfileData = async () => {
      try {
        setLoadingProfile(true);
        const { supabase } = await import('../lib/supabase');

        // Fetch profile dengan role dan department info
        const { data: profileData } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            email,
            role_id,
            company_id,
            status,
            is_department_admin,
            last_active_at
          `)
          .eq('id', userProfile?.id)
          .single();

        if (!profileData) return;

        // Fetch role name by matching in memory to avoid query errors with different column names
        const { data: allRolesData } = await supabase
          .from('roles')
          .select('*');

        const roleData = allRolesData?.find(r =>
          String(r.id) === String(profileData.role_id) ||
          String(r.role_id) === String(profileData.role_id)
        );

        const roleName = roleData?.role_name || roleData?.name || 'Unknown Role';

        // Fetch department name
        const { data: deptData } = await supabase
          .from('company')
          .select('company_name')
          .eq('company_id', profileData.company_id)
          .single();

        // Fetch user groups
        const { data: userGroupsData } = await supabase
          .from('user_groups')
          .select('group_id')
          .eq('user_id', profileData.id);

        const { data: groupsData } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', userGroupsData?.map(ug => ug.group_id) || []);

        const convertedUser: any = {
          id: profileData.id,
          name: profileData.full_name,
          email: profileData.email,
          role_id: profileData.role_id,
          role_name: roleName,
          department: deptData?.company_name || 'Unknown',
          group: groupsData?.map(g => g.name).join(', ') || 'No Group',
          groups: groupsData?.map(g => g.name) || [],
          status: profileData.status as 'Active' | 'Inactive',
          is_department_admin: profileData.is_department_admin || false,
          last_active: profileData.last_active_at ? new Date(profileData.last_active_at).toLocaleString() : 'Never'
        };

        setProfileUser(convertedUser);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfileData();
  }, [currentView, userProfile?.id]);

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      const { supabase } = await import('../lib/supabase');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileFormData.full_name,
          email: profileFormData.email,
          status: profileFormData.status
        })
        .eq('id', userProfile?.id);

      if (error) throw error;

      // Update localStorage dan state
      const updatedProfile = { ...userProfile, ...profileFormData };
      localStorage.setItem('profile', JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile);

      setIsEditingProfile(false);
      alert('Profile updated successfully');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert('Error saving profile: ' + error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleViewTicket = (id: string, fromView: 'incidents' | 'my-tickets' = 'incidents') => {
    setSelectedTicketId(id);
    setPreviousView(fromView);
    setCurrentView('ticket-detail');
  };

  const renderContent = () => {
    if (currentView === 'user-dashboard') {
      return <UserDashboard onNavigate={(view: any) => setCurrentView(view)} userName={userProfile?.full_name} />;
    }

    if (currentView === 'incidents') {
      return <IncidentList onViewTicket={(id) => handleViewTicket(id, 'incidents')} />;
    }

    if (currentView === 'knowledge') {
      return <KnowledgeBase />;
    }

    if (currentView === 'help-center') {
      return <HelpCenter />;
    }

    if (currentView === 'outofoffice' || currentView === 'availability' || currentView === 'team-availability') {
      return <OutOfOffice viewMode={currentView === 'team-availability' ? 'supervisor' : 'agent'} />;
    }

    // User Incidents Data (yang ada di screenshot)
    if (currentView === 'my-tickets') {
      return <UserTicketList onNavigate={(view: any) => setCurrentView(view)} onViewTicket={(id) => handleViewTicket(id, 'my-tickets')} userName={userProfile?.full_name} />;
    }

    // NEW: Empty Placeholder for Service Requests
    if (currentView === 'service-requests') {
      return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Package size={32} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Service Requests</h3>
          <p className="text-gray-500 max-w-md">This module is currently under development. You will be able to manage service requests here soon.</p>
        </div>
      );
    }

    // NEW: Empty Placeholder for My Tickets (different from User Incidents)
    if (currentView === 'user-incidents') {
      return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <FileText size={32} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">My Tickets</h3>
          <p className="text-gray-500 max-w-md">This module is currently under development. It will display tickets created by the current user.</p>
        </div>
      );
    }

    // NEW: Empty Placeholder for Escalated Tickets
    if (currentView === 'escalated-tickets') {
      return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <TrendingUp size={32} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Escalated Tickets</h3>
          <p className="text-gray-500 max-w-md">This module is currently under development. It will display tickets that have been escalated for higher-level support.</p>
        </div>
      );
    }

    if (currentView === 'ticket-detail') {
      return <TicketDetail ticketId={selectedTicketId} onBack={() => setCurrentView(previousView)} />;
    }

    if (currentView === 'user-management') {
      return <UserManagement />;
    }

    if (currentView === 'group-management') {
      return <GroupManagement />;
    }

    if (currentView === 'business-hours') {
      return <BusinessHours />;
    }

    if (currentView === 'categories') {
      return <CategoryManagement />;
    }

    if (currentView === 'profile') {
      if (loadingProfile) {
        return (
          <div className="p-8 bg-[#f3f4f6] min-h-screen flex items-center justify-center">
            <div className="text-gray-500">Loading profile...</div>
          </div>
        );
      }

      if (!profileUser) {
        return (
          <div className="p-8 bg-[#f3f4f6] min-h-screen flex items-center justify-center">
            <div className="text-gray-500">Profile not found</div>
          </div>
        );
      }

      // Check if user is admin (role_id 1)
      const isAdmin = userProfile?.role_id === 1 || userProfile?.role_id === '1';

      return (
        <div className="p-8 bg-[#f3f4f6] min-h-screen">
          <UserDetail
            user={profileUser}
            onBack={() => setCurrentView('dashboard')}
            onSave={() => {
              // Refresh profile dari localStorage
              const profile = localStorage.getItem('profile');
              if (profile) {
                try {
                  const parsedProfile = JSON.parse(profile);
                  setUserProfile(parsedProfile);
                  setProfileFormData({
                    full_name: parsedProfile.full_name || '',
                    email: parsedProfile.email || '',
                    status: parsedProfile.status || 'Active'
                  });
                } catch (error) {
                  console.error('Error parsing profile:', error);
                }
              }
            }}
            isViewOnly={!isAdmin}
          />
        </div>
      );
    }

    return (
      <div className="p-8">
        <div className="grid grid-cols-12 gap-6">

          {/* My Tickets */}
          <div className="col-span-12 lg:col-span-7 bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100/50">
            <div className="bg-[#e0e7ff]/40 p-6 border-b border-indigo-50 flex justify-between items-end">
              <div>
                <h2 className="text-lg font-bold text-gray-800">New Tickets</h2>
              </div>
              <div className="flex gap-6 items-center">
                <div className="text-center">
                  <span className="block text-xl font-bold text-gray-800 leading-none">8</span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Current</span>
                </div>
                <div className="text-center">
                  <span className="block text-xl font-bold text-gray-800 leading-none">5</span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Closed</span>
                </div>
                <button className="bg-white border border-gray-200 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm hover:bg-gray-50 ml-2">
                  View All Tickets <ChevronDown size={14} />
                </button>
              </div>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="text-gray-400 font-medium border-b border-gray-50 bg-gray-50/30">
                  <tr>
                    <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Ticket Number</th>
                    <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Request For</th>
                    <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Agent</th>
                    <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Urgency</th>
                    <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ticketData.map((ticket, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 text-gray-500 font-medium text-xs">{ticket.id}</td>
                      <td className="px-6 py-4 text-gray-700 font-medium max-w-xs truncate text-xs">{ticket.subject}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{ticket.user}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">-</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${ticket.urgency === 'High' ? 'bg-red-100 text-red-700' :
                          ticket.urgency === 'Medium' ? 'bg-orange-100 text-orange-700' :
                            ticket.urgency === 'Low' ? 'bg-green-100 text-green-700' :
                              ticket.urgency === 'Urgent' ? 'bg-red-200 text-red-900' :
                                'bg-gray-100 text-gray-700'
                          }`}>
                          {ticket.urgency || 'Low'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewTicket(ticket.id)}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue Tickets */}
          <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-100/50 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800">Overdue Tickets</h2>
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md shadow-red-200">4</span>
              </div>
              <button className="text-gray-400 hover:text-gray-600 text-xs flex items-center gap-1 font-medium">
                View All <ChevronDown size={14} />
              </button>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="text-gray-400 font-medium border-b border-gray-50 bg-gray-50/30">
                  <tr>
                    <th className="px-4 py-3 font-normal text-[10px] uppercase tracking-wider">Number</th>
                    <th className="px-4 py-3 font-normal text-[10px] uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 font-normal text-[10px] uppercase tracking-wider">Request For</th>
                    <th className="px-4 py-3 font-normal text-[10px] uppercase tracking-wider">Agent</th>
                    <th className="px-4 py-3 font-normal text-[10px] uppercase tracking-wider">Urgency</th>
                    <th className="px-4 py-3 font-normal text-[10px] uppercase tracking-wider">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {overdueData.map((ticket, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium text-[10px]">{ticket.id}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium max-w-[100px] truncate text-[10px]">{ticket.subject}</td>
                      <td className="px-4 py-3 text-gray-500 text-[10px]">{ticket.user}</td>
                      <td className="px-4 py-3 text-gray-500 text-[10px]">{ticket.assignedTo || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${ticket.urgency === 'High' ? 'bg-red-100 text-red-700' :
                          ticket.urgency === 'Medium' ? 'bg-orange-100 text-orange-700' :
                            ticket.urgency === 'Low' ? 'bg-green-100 text-green-700' : 'bg-red-200 text-red-900'
                          }`}>
                          {ticket.urgency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-red-500 font-bold text-[10px]">{ticket.eta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 5 Incident */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100/50 p-6 flex flex-col">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Top 5 Incident</h2>
            <p className="text-xs text-gray-400 mb-4 font-medium uppercase tracking-wide">By Category</p>

            <div className="flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topIncidentsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 500 }}
                    dy={10}
                    interval={0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Today's Appointments */}
          <div className="col-span-12 lg:col-span-4 bg-[#eef2ff] rounded-2xl shadow-sm border border-indigo-50 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800">Today's Appointments</h2>
              <button className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">
                <Plus size={18} />
              </button>
            </div>
            <div className="relative space-y-2">
              <div className="absolute top-3 bottom-3 left-[17px] w-0.5 bg-indigo-200/50"></div>

              {/* Time Blocks */}
              {[
                { time: 8, label: '8:30 - 9:30 AM - Team Meeting' },
                { time: 9, label: null },
                { time: 10, label: '10 - 10:30 AM - INC4567 Call' },
                { time: 11, label: null },
                { time: 12, label: '12 - 1PM - Lunch Break' },
                { time: 1, label: null },
                { time: 2, label: null },
                { time: 3, label: null },
              ].map((slot, index) => (
                <div key={index} className="flex gap-4 relative min-h-[32px]">
                  <div className="w-8 text-xs text-gray-400 pt-2 text-right font-medium">{slot.time}</div>
                  {slot.label ? (
                    <div className="flex-1 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm z-10">
                      <p className="text-xs font-bold text-gray-700">{slot.label}</p>
                    </div>
                  ) : <div className="flex-1 py-3"></div>}
                </div>
              ))}
            </div>
          </div>

          {/* Inventory Management */}
          {/* Top 5 Service Request */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100/50 p-6 flex flex-col">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Top 5 Service Request</h2>
            <p className="text-xs text-gray-400 mb-4 font-medium uppercase tracking-wide">Most Popular</p>

            <div className="flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topServiceRequestsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 500 }}
                    dy={10}
                    interval={0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#f3f4f6] font-sans">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64 border-r' : 'w-0 border-none'} bg-white border-gray-200 flex flex-col hidden lg:flex sticky top-0 h-screen transition-all duration-300 overflow-hidden`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
              <div className="w-4 h-4 bg-white rounded-full opacity-40" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-gray-800 text-lg leading-tight tracking-tight whitespace-nowrap">DIT</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold whitespace-nowrap">service desk</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <nav className="flex-1 mt-6 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Render menu berdasarkan accessible menus */}
          {accessibleMenus.length > 0 ? (
            accessibleMenus.map((menu) => {
              // Map menu names to views
              const menuViewMap: { [key: string]: any } = {
                'Dashboard': 'dashboard',
                'User Tickets': 'user-dashboard',
                'All Incidents': 'incidents',
                'User Incidents': 'my-tickets', // INI UNTUK DATA INCIDENT LIST (User Dashboard)
                'Out of Office': 'outofoffice',
                'Knowledge Base': 'knowledge',
                'Help Center': 'help-center',
                'My Tickets': 'user-incidents', // Empty state
                'Service Requests': 'service-requests', // Empty state
                'Escalated Tickets': 'escalated-tickets', // NEW
              };

              const view = menuViewMap[menu.name];
              if (!view) return null;

              // Determine badge count
              let badgeCount = '';
              if (menu.name === 'My Tickets') badgeCount = '5';
              if (menu.name === 'User Incidents') badgeCount = '2';
              if (menu.name === 'Service Requests') badgeCount = '3';
              if (menu.name === 'Escalated Tickets') badgeCount = '1';

              return (
                <SidebarItem
                  key={menu.id}
                  icon={
                    menu.name === 'Dashboard' ? LayoutDashboard :
                      menu.name === 'User Tickets' ? User :
                        menu.name === 'All Incidents' ? Ticket :
                          menu.name === 'User Incidents' ? FileText :
                            menu.name === 'Out of Office' ? CalendarOff :
                              menu.name === 'Knowledge Base' ? Book :
                                menu.name === 'Help Center' ? BookOpen :
                                  menu.name === 'My Tickets' ? FileText :
                                    menu.name === 'Service Requests' ? Package :
                                      menu.name === 'Escalated Tickets' ? TrendingUp :
                                        undefined
                  }
                  label={menu.name}
                  badge={badgeCount}
                  active={currentView === view}
                  onClick={() => setCurrentView(view)}
                />
              );
            })
          ) : (
            // Fallback jika tidak ada accessible menus
            <>
              <SidebarItem
                icon={LayoutDashboard}
                label="Dashboard"
                active={currentView === 'dashboard'}
                onClick={() => setCurrentView('dashboard')}
              />
              <SidebarItem
                icon={User}
                label="User Tickets"
                active={currentView === 'user-dashboard'}
                onClick={() => setCurrentView('user-dashboard')}
              />
            </>
          )}

          {/* Settings - hanya tampilkan jika user adalah admin atau punya akses settings */}
          {accessibleMenus.some(m => m.name === 'Settings') && (
            <>
              <SidebarItem
                icon={Settings}
                label="Settings"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                expanded={isSettingsOpen}
              />

              {isSettingsOpen && (
                <div className="bg-gray-50/50 pb-2 transition-all duration-300 ease-in-out">
                  <div
                    onClick={() => {
                      setCurrentView('user-management');
                      setIsSettingsOpen(false);
                    }}
                    className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors font-medium whitespace-nowrap ${currentView === 'user-management' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                      }`}
                  >
                    User Management
                  </div>
                  <div
                    onClick={() => {
                      setCurrentView('group-management');
                      setIsSettingsOpen(false);
                    }}
                    className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors font-medium whitespace-nowrap ${currentView === 'group-management' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                      }`}
                  >
                    Group Management
                  </div>
                  <div
                    onClick={() => {
                      setCurrentView('business-hours');
                      setIsSettingsOpen(false);
                    }}
                    className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors font-medium whitespace-nowrap ${currentView === 'business-hours' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                      }`}
                  >
                    Business Hours
                  </div>
                  <div
                    onClick={() => {
                      setCurrentView('categories');
                      setIsSettingsOpen(false);
                    }}
                    className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors font-medium whitespace-nowrap ${currentView === 'categories' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                      }`}
                  >
                    Categories
                  </div>
                  {[
                    'SLA Management',
                    'Service Request Fields',
                    'Portal Highlights'
                  ].map((item) => (
                    <div key={item} className="pl-16 pr-6 py-2 text-sm text-gray-500 hover:text-indigo-600 cursor-pointer hover:bg-gray-100 transition-colors font-medium whitespace-nowrap">
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-6 border-t border-gray-100 flex items-center gap-3 relative flex-shrink-0" ref={menuRef}>
          <img src={`https://ui-avatars.com/api/?name=${userProfile?.full_name || 'User'}&background=random`} alt="User" className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-700 truncate">{userProfile?.full_name || 'User'}</p>
          </div>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
          >
            <MoreVertical size={16} className="text-gray-400 cursor-pointer" />
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute bottom-16 left-4 right-4 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setPreviousViewBeforeProfile('user-dashboard');
                  setCurrentView('profile');
                  setShowUserMenu(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <User size={16} className="text-gray-400" />
                Profile
              </button>
              {!(userProfile?.role_id === 4 || userProfile?.role_id === '4') && (
                <button
                  onClick={() => {
                    setCurrentView('availability');
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <CalendarOff size={16} className="text-gray-400" />
                  Availability / OOO
                </button>
              )}
              <button
                onClick={onChangeDepartment}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <ArrowLeftRight size={16} className="text-gray-400" />
                Change Department
              </button>
              <div className="h-px bg-gray-100 my-1 mx-4"></div>
              <button
                onClick={onLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut size={16} className="text-red-400" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Toggle Button (Visible when closed) */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-50 p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 text-gray-500 hover:bg-white hover:text-indigo-600 transition-colors hidden lg:block"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Global Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-4 flex justify-end items-center gap-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <button className="relative p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all group">
              <Bell size={22} />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm ring-2 ring-red-500/20 group-hover:scale-110 transition-transform">
                3
              </span>
            </button>

            {/* User Icon */}
            <button
              onClick={() => {
                setPreviousViewBeforeProfile('user-dashboard');
                setCurrentView('profile');
              }}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
            >
              <User size={22} />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;