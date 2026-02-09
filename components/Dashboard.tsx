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
  GitBranch,
  FileText,
  CalendarOff,
  ChevronRight,
  Menu,
  ChevronLeft,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Bell,
  Building2,
  Users,
  Wrench,
  Shield,
  Zap,
  Globe,
  Eye,
  AlertCircle,
  Clock,
  Briefcase,
  CheckCircle,
  RefreshCw,
  X,
  BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
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
import DepartmentManagement from './DepartmentManagement';
import StatusManagement from './StatusManagement';
import WorkflowMapping from './WorkflowMapping';
import WorkflowTemplate from './WorkflowTemplate';
import AccessPolicy from './AccessPolicy';
import SLAManagement from './SLAManagement';
import SLAPolicies from './SLAPolicies';
import EscalationRules from './EscalationRules';
import RequesterKBPortal from './RequesterKBPortal';
import AgentTicketView from './AgentTicketView';
import RequesterTicketManager from './RequesterTicketManager';
import NotificationPanel from './NotificationPanel';
import AutoAssignment from './AutoAssignment';
import AutoCloseRules from './AutoCloseRules';
import NotificationSettings from './NotificationSettings';
import UserNotificationPreferences from './UserNotificationPreferences';
import ReportsView from './ReportsView';
import ServiceRequestFields from './ServiceRequestFields';
import { useNotifications } from '../hooks/useNotifications';
import { useRealtimeToast } from '../hooks/useRealtimeToast';

interface DashboardProps {
  onLogout: () => void;
  onChangeDepartment: () => void;
  initialView?: string;
}

// Data for charts will be fetched from database
// Static data removed - now using dashboardData state

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

// Notification Badge Component
const NotificationBadge: React.FC<{ unreadCount: number }> = ({ unreadCount }) => {
  if (unreadCount === 0) return null;

  return (
    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm ring-2 ring-red-500/20 group-hover:scale-110 transition-transform animate-pulse px-0.5">
      {unreadCount}
    </span>
  );
};

// Notification Panel Wrapper Component
const NotificationPanelWrapper: React.FC<{
  notifications: any[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  onClose: () => void;
  onNavigate?: (referenceType: string, referenceId: string) => void;
}> = ({ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll, onClose, onNavigate }) => {
  return (
    <NotificationPanel
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onDelete={deleteNotification}
      onClearAll={clearAll}
      onClose={onClose}
      onNavigate={onNavigate}
    />
  );
};

const Dashboard: React.FC<DashboardProps> = ({ onLogout, onChangeDepartment, initialView }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSubOpen, setSettingsSubOpen] = useState({
    organization: false,
    usersAccess: false,
    ticketConfig: false,
    slaConfig: false,
    automation: false,
    portal: false,
    notifications: false
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'user-dashboard' | 'my-dashboard' | 'incidents' | 'knowledge' | 'help-center' | 'outofoffice' | 'ticket-detail' | 'my-tickets' | 'my-incidents' | 'service-requests' | 'change-requests' | 'my-service-request' | 'user-incidents' | 'escalated-tickets' | 'user-management' | 'group-management' | 'business-hours' | 'department-management' | 'profile' | 'team-availability' | 'availability' | 'categories' | 'status-management' | 'workflow-mapping' | 'workflow-template' | 'service-request-fields' | 'sla-management' | 'sla-policies' | 'escalation-rules' | 'portal-highlights' | 'auto-assignment' | 'auto-close-rules' | 'notifications' | 'my-notifications' | 'access-policy' | 'create-incident' | 'reports'>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<'incidents' | 'my-tickets' | 'profile' | 'user-dashboard'>('incidents');
  const [accessibleMenus, setAccessibleMenus] = useState<any[]>([]);
  const [navVersion, setNavVersion] = useState(0);
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
  const [editingSlaPolicyId, setEditingSlaPolicyId] = useState<string | null>(null);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'open' | 'unassigned' | 'overdue' | 'satisfaction' | 'resolved' | 'pending';
    data: any[];
  }>({
    isOpen: false,
    title: '',
    type: 'open',
    data: []
  });

  // Dashboard data states
  const [dashboardData, setDashboardData] = useState<{
    newTickets: any[];
    overdueTickets: any[];
    openTicketsList: any[];
    unassignedTicketsList: any[];
    resolvedTicketsList: any[];
    pendingTicketsList: any[];
    satisfactionDetails: any[];
    topIncidents: { name: string; count: number; fill: string }[];
    topServiceRequests: { name: string; count: number; fill: string }[];
    stats: { current: number; closed: number; overdue: number; unassigned: number; pending: number; satisfaction: string; trend: string; };
    weeklyTrend: { name: string; incidents: number; requests: number }[];
    teamPulse: { name: string; active: number; resolved: number; status: string; score: number }[];
  }>({
    newTickets: [],
    overdueTickets: [],
    openTicketsList: [],
    unassignedTicketsList: [],
    resolvedTicketsList: [],
    pendingTicketsList: [],
    satisfactionDetails: [],
    topIncidents: [],
    topServiceRequests: [],
    stats: { current: 0, closed: 0, overdue: 0, unassigned: 0, pending: 0, satisfaction: "0.0", trend: "0%" },
    weeklyTrend: [],
    teamPulse: []
  });

  // Shared notification state - single source of truth
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications(userProfile?.id);

  // Handle initial view prop changes (Deep Linking)
  useEffect(() => {
    if (initialView) {
      setCurrentView(initialView as any);
    }
  }, [initialView]);

  // Enable realtime toast notifications
  useRealtimeToast(userProfile?.id, (ticketId) => {
    setSelectedTicketId(ticketId);
    setCurrentView('incidents');
  });

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationPanel(false);
      }
    };

    if (showNotificationPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationPanel]);

  // AUTO-CLOSE TICKETS: Resolved -> Closed after 24h
  useEffect(() => {
    const handleAutoClose = async () => {
      try {
        const { supabase } = await import('../lib/supabase');

        // 1. Get Resolved and Closed Status IDs
        const { data: statuses } = await supabase
          .from('ticket_statuses')
          .select('status_id, status_name')
          .in('status_name', ['Resolved', 'Closed']);

        if (!statuses) return;

        const resolvedStatus = statuses.find(s => s.status_name === 'Resolved');
        const closedStatus = statuses.find(s => s.status_name === 'Closed');

        if (!resolvedStatus || !closedStatus) return;

        // 2. Find tickets that have been Resolved for more than 24 hours
        // We use updated_at as the reference for when it was resolved
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const { data: ticketsToClose } = await supabase
          .from('tickets')
          .select('id, ticket_number')
          .eq('status_id', resolvedStatus.status_id)
          .lt('updated_at', twentyFourHoursAgo.toISOString());

        if (!ticketsToClose || ticketsToClose.length === 0) return;

        console.log(`Auto-closing ${ticketsToClose.length} resolved tickets...`);

        // 3. Update them to Closed
        const ticketIds = ticketsToClose.map(t => t.id);
        const { error: updateError } = await supabase
          .from('tickets')
          .update({
            status_id: closedStatus.status_id,
            updated_at: new Date().toISOString()
          })
          .in('id', ticketIds);

        if (updateError) throw updateError;

        // 4. Log Activity for each
        const activityLogs = ticketsToClose.map(t => ({
          ticket_id: t.id,
          action: 'System auto-closed ticket after 24 hours in Resolved status.',
          actor_id: null // System action, do not attribute to specific user
        }));

        await supabase.from('ticket_activity_log').insert(activityLogs);

      } catch (err) {
        console.error('Error in handleAutoClose:', err);
      }
    };

    // Run once on load after userProfile is available
    if (userProfile?.id) {
      handleAutoClose();
    }
  }, [userProfile?.id]);

  // SLA PERCENTAGE ESCALATION CHECK: Run periodically to trigger escalation rules
  useEffect(() => {
    const checkSLAEscalations = async () => {
      try {
        const { supabase } = await import('../lib/supabase');

        // Call the RPC function to check and trigger SLA escalations
        const { data, error } = await supabase.rpc('check_sla_percentage_escalations');

        if (error) {
          // Function may not exist yet - just log and continue
          if (error.code === '42883') { // function does not exist
            console.log('SLA escalation function not yet installed. Run sla_percentage_escalation.sql in Supabase.');
          } else {
            console.error('SLA escalation check error:', error);
          }
          return;
        }

        if (data?.notifications_sent > 0) {
          console.log(`SLA Escalation: ${data.notifications_sent} notifications sent for ${data.processed_tickets} tickets.`);
        }
      } catch (err) {
        console.error('Error checking SLA escalations:', err);
      }
    };

    // Only run for supervisors/admins (role_id 1 or 2)
    const isSupervisorOrAdmin = userProfile?.role_id === 1 || userProfile?.role_id === 2 ||
      userProfile?.role_id === '1' || userProfile?.role_id === '2';

    if (userProfile?.id && isSupervisorOrAdmin) {
      // Run immediately on load
      checkSLAEscalations();

      // Then run every 5 minutes
      const intervalId = setInterval(checkSLAEscalations, 5 * 60 * 1000);

      return () => clearInterval(intervalId);
    }
  }, [userProfile?.id, userProfile?.role_id]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userProfile?.id) return;

      try {
        const { supabase } = await import('../lib/supabase');
        const isAgent = userProfile?.role_id === 3 || userProfile?.role_id === '3';
        const isSupervisor = userProfile?.role_id === 2 || userProfile?.role_id === '2';
        const isAdmin = userProfile?.role_id === 1 || userProfile?.role_id === '1';

        let myGroupIds: string[] = [];
        // Fetch groups for Supervisors and Agents to filter dashboard
        if (!isAdmin) {
          const { data: groups } = await supabase.from('user_groups').select('group_id').eq('user_id', userProfile.id);
          if (groups) myGroupIds = groups.map(g => g.group_id);
        }
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // 1. Get Status IDs for "Open" definition (Open + In Progress only)
        const { data: openStatusesResult } = await supabase
          .from('ticket_statuses')
          .select('status_id')
          .in('status_name', ['Open', 'In Progress']);
        const openStatusIds = openStatusesResult?.map(s => s.status_id) || [];

        // 1.5 Get Pending/Waiting Status IDs
        const { data: pendingStatusesResult } = await supabase
          .from('ticket_statuses')
          .select('status_id')
          .or('status_name.ilike.%pending%,status_name.ilike.%waiting%');
        const pendingStatusIds = pendingStatusesResult?.map(s => s.status_id) || [];

        // 2. Get All Active Status IDs (Excluding Resolved, Closed, Canceled)
        const { data: activeStatusesResult } = await supabase
          .from('ticket_statuses')
          .select('status_id')
          .not('status_name', 'in', '("Resolved", "Closed", "Canceled")');
        const activeStatusIds = activeStatusesResult?.map(s => s.status_id) || [];

        // 2. NEW TICKETS (Last 7 days)
        let newTicketsQuery = supabase
          .from('tickets')
          .select(`
            id, ticket_number, subject, priority, created_at,
            requester:profiles!fk_tickets_requester(full_name),
            assigned_agent:profiles!fk_tickets_assigned_agent(full_name),
            ticket_statuses!fk_tickets_status(status_name)
          `)
          .in('status_id', activeStatusIds)
          .order('created_at', { ascending: false })
          .limit(5);

        if (isAgent) {
          newTicketsQuery = newTicketsQuery.eq('assigned_to', userProfile.id);
        } else {
          newTicketsQuery = newTicketsQuery.gte('created_at', sevenDaysAgo.toISOString());
          if (isSupervisor && myGroupIds.length > 0) {
            newTicketsQuery = newTicketsQuery.in('assignment_group_id', myGroupIds);
          }
        }
        const { data: newTickets } = await newTicketsQuery;

        // 3. TEAM/MY OPEN TICKETS (Specifically Open & In Progress)
        let openTicketsQuery = supabase
          .from('tickets')
          .select(`
            id, ticket_number, subject, priority, created_at,
            requester:profiles!fk_tickets_requester(full_name),
            assigned_agent:profiles!fk_tickets_assigned_agent(full_name)
          `)
          .in('status_id', openStatusIds)
          .order('created_at', { ascending: false });

        if (isAgent) openTicketsQuery = openTicketsQuery.eq('assigned_to', userProfile.id);
        else if (isSupervisor && myGroupIds.length > 0) openTicketsQuery = openTicketsQuery.in('assignment_group_id', myGroupIds);
        const { data: openTicketsFullList } = await openTicketsQuery;

        // 4. OVERDUE TICKETS (Enhanced Logic with Priority-based SLA & Paused Time)
        // We fetch active tickets created > 4 hours ago (minimum SLA is 4h for Urgent)
        const fourHoursAgo = new Date();
        fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

        let overdueQuery = supabase
          .from('tickets')
          .select(`
            id, ticket_number, subject, priority, created_at, updated_at, total_paused_minutes,
            requester:profiles!fk_tickets_requester(full_name),
            assigned_agent:profiles!fk_tickets_assigned_agent(full_name)
          `)
          // Exclude Pending/Waiting tickets from Overdue
          .in('status_id', activeStatusIds.filter(id => !pendingStatusIds.includes(id)))
          .lt('created_at', fourHoursAgo.toISOString())
          .order('created_at', { ascending: true });

        if (isAgent) overdueQuery = overdueQuery.eq('assigned_to', userProfile.id);
        else if (isSupervisor && myGroupIds.length > 0) overdueQuery = overdueQuery.in('assignment_group_id', myGroupIds);
        const { data: potentialOverdue } = await overdueQuery;

        // Filter based on Priority SLA
        const overdueTicketsFullList = (potentialOverdue || []).filter((t: any) => {
          const created = new Date(t.created_at);
          const now = new Date();

          // Calculate active time (Elapsed - Paused)
          const elapsedMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
          const pausedMinutes = t.total_paused_minutes || 0;
          const activeMinutes = Math.max(0, elapsedMinutes - pausedMinutes);
          const activeHours = activeMinutes / 60;

          // SLA Map (Hours)
          // Urgent: 4h, High: 8h, Medium: 48h (2 days), Low: 120h (5 days)
          let limit = 24; // Default Fallback
          const p = (t.priority || '').toLowerCase();

          if (p.includes('urgent') || p.includes('critical')) limit = 4;
          else if (p.includes('high')) limit = 8;
          else if (p.includes('medium')) limit = 48; // 2 Days
          else if (p.includes('low')) limit = 120; // 5 Days

          return activeHours > limit;
        });

        // 5. UNASSIGNED TICKETS
        let unassignedQuery = supabase
          .from('tickets')
          .select(`
            id, ticket_number, subject, priority, created_at,
            requester:profiles!fk_tickets_requester(full_name)
          `)
          .is('assigned_to', null)
          .in('status_id', activeStatusIds)
          .order('created_at', { ascending: false });

        // Filter Unassigned by Group for Supervisor/Agent
        if (!isAdmin && myGroupIds.length > 0) {
          unassignedQuery = unassignedQuery.in('assignment_group_id', myGroupIds);
        }
        const { data: unassignedTicketsFullList } = await unassignedQuery;

        // 5.5 PENDING TICKETS (Full List for Modal)
        let pendingQuery = supabase
          .from('tickets')
          .select(`
            id, ticket_number, subject, priority, created_at,
            requester:profiles!fk_tickets_requester(full_name),
            assigned_agent:profiles!fk_tickets_assigned_agent(full_name)
          `)
          .in('status_id', pendingStatusIds);
        if (isAgent) pendingQuery = pendingQuery.eq('assigned_to', userProfile.id);
        else if (isSupervisor && myGroupIds.length > 0) pendingQuery = pendingQuery.in('assignment_group_id', myGroupIds);
        const { data: pendingTicketsFullList } = await pendingQuery;
        const pendingCount = pendingTicketsFullList?.length || 0;

        // 6. RESOLVED TODAY (Full List)
        const midNight = new Date(); midNight.setHours(0, 0, 0, 0);
        let resolvedQuery = supabase
          .from('tickets')
          .select(`
            id, ticket_number, subject, priority, created_at, updated_at,
            requester:profiles!fk_tickets_requester(full_name),
            assigned_agent:profiles!fk_tickets_assigned_agent(full_name)
          `)
          .in('status_id', (
            await supabase.from('ticket_statuses').select('status_id').in('status_name', ['Resolved', 'Closed'])
          ).data?.map(s => s.status_id) || [])
          .gte('updated_at', midNight.toISOString())
          .order('updated_at', { ascending: false });

        if (isAgent) resolvedQuery = resolvedQuery.eq('assigned_to', userProfile.id);
        else if (isSupervisor && myGroupIds.length > 0) resolvedQuery = resolvedQuery.in('assignment_group_id', myGroupIds);
        const { data: resolvedTicketsFullList } = await resolvedQuery;

        // 7. SATISFACTION REVIEWS
        let satisfactionQuery = supabase
          .from('tickets')
          .select(`
            id, ticket_number, satisfaction_rating, user_feedback, updated_at,
            requester:profiles!fk_tickets_requester(full_name)
          `)
          .not('satisfaction_rating', 'is', null)
          .order('updated_at', { ascending: false });

        if (isAgent) satisfactionQuery = satisfactionQuery.eq('assigned_to', userProfile.id);
        else if (isSupervisor && myGroupIds.length > 0) satisfactionQuery = satisfactionQuery.in('assignment_group_id', myGroupIds);

        const { data: satisfactionData } = await satisfactionQuery;

        const satisfactionReviewsList = satisfactionData || [];
        const avgSatisfaction = satisfactionReviewsList.length
          ? (satisfactionReviewsList.reduce((acc, curr) => acc + (curr.satisfaction_rating || 0), 0) / satisfactionReviewsList.length).toFixed(1)
          : "0.0";

        // 8. TOP CATEGORIES
        let incidentQuery = supabase
          .from('tickets')
          .select('category_id, ticket_categories(name)')
          .eq('ticket_type', 'Incident');

        if (isAgent) incidentQuery = incidentQuery.eq('assigned_to', userProfile.id);
        else if (isSupervisor && myGroupIds.length > 0) incidentQuery = incidentQuery.in('assignment_group_id', myGroupIds);

        const { data: incidentCategories } = await incidentQuery;

        const categoryCount: Record<string, number> = {};
        incidentCategories?.forEach(t => {
          const catName = (t.ticket_categories as any)?.name || 'Uncategorized';
          categoryCount[catName] = (categoryCount[catName] || 0) + 1;
        });

        const colors = ['#ef4444', '#f97316', '#eab308', '#06b6d4', '#6366f1'];
        const topIncidents = Object.entries(categoryCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count], i) => ({ name, count, fill: colors[i] || '#9ca3af' }));

        let srQuery = supabase
          .from('tickets')
          .select('category_id, ticket_categories(name)')
          .eq('ticket_type', 'Service Request');

        if (isAgent) srQuery = srQuery.eq('assigned_to', userProfile.id);
        else if (isSupervisor && myGroupIds.length > 0) srQuery = srQuery.in('assignment_group_id', myGroupIds);

        const { data: srCategories } = await srQuery;

        const srCategoryCount: Record<string, number> = {};
        srCategories?.forEach(t => {
          const catName = (t.ticket_categories as any)?.name || 'Uncategorized';
          srCategoryCount[catName] = (srCategoryCount[catName] || 0) + 1;
        });

        const srColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
        const topSR = Object.entries(srCategoryCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count], i) => ({ name, count, fill: srColors[i] || '#9ca3af' }));

        // 9. WEEKLY TREND
        const sevenDaysAgoDate = new Date();
        sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
        let trendQuery = supabase
          .from('tickets')
          .select('created_at, ticket_type')
          .gte('created_at', sevenDaysAgoDate.toISOString().split('T')[0]);

        if (isAgent) trendQuery = trendQuery.eq('assigned_to', userProfile.id);
        else if (isSupervisor && myGroupIds.length > 0) trendQuery = trendQuery.in('assignment_group_id', myGroupIds);

        const { data: trendTickets } = await trendQuery;

        const weeklyTrendMap: Record<string, { incidents: number; requests: number }> = {};
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayName = days[d.getDay()];
          weeklyTrendMap[dayName] = { incidents: 0, requests: 0 };
        }
        trendTickets?.forEach(t => {
          const d = new Date(t.created_at);
          const dayName = days[d.getDay()];
          if (weeklyTrendMap[dayName]) {
            if (t.ticket_type === 'Incident') weeklyTrendMap[dayName].incidents++;
            else weeklyTrendMap[dayName].requests++;
          }
        });
        const weeklyTrend = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayName = days[d.getDay()];
          weeklyTrend.push({
            name: dayName,
            incidents: weeklyTrendMap[dayName]?.incidents || 0,
            requests: weeklyTrendMap[dayName]?.requests || 0
          });
        }

        // 10. TEAM PULSE
        let teamPulse = [];
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_team_pulse');
          if (rpcError) throw rpcError;
          if (rpcData) {
            teamPulse = rpcData.map((agent: any) => {
              const active = Number(agent.active_count);
              const resolved = Number(agent.resolved_today_count);
              const isSPV = agent.role_id === 2;
              let score = 100 - (active * 5) + (resolved * 2);
              score = Math.min(100, Math.max(0, score));
              return {
                name: agent.full_name || agent.email || 'Unknown Agent',
                active: active,
                overdue: Number(agent.overdue_count || 0),
                resolved: resolved,
                status: active > 8 ? 'Overload' : active > 3 ? 'Busy' : 'Free',
                score: score,
                isSPV: isSPV
              };
            });
          }
        } catch (err) { console.error("Team Pulse RPC failed", err); }

        if (teamPulse.length === 0) {
          teamPulse = [{ name: 'Data Belum Tersedia', active: 0, resolved: 0, status: 'Free', score: 100, isSPV: false }];
        }

        setDashboardData({
          newTickets: newTickets || [],
          overdueTickets: overdueTicketsFullList?.slice(0, 4) || [],
          openTicketsList: openTicketsFullList || [],
          unassignedTicketsList: unassignedTicketsFullList || [],
          resolvedTicketsList: resolvedTicketsFullList || [],
          pendingTicketsList: pendingTicketsFullList || [],
          satisfactionDetails: satisfactionReviewsList || [],
          topIncidents,
          topServiceRequests: topSR,
          stats: {
            current: openTicketsFullList?.length || 0,
            closed: resolvedTicketsFullList?.length || 0,
            overdue: overdueTicketsFullList?.length || 0,
            unassigned: unassignedTicketsFullList?.length || 0,
            pending: pendingCount || 0,
            satisfaction: avgSatisfaction,
            trend: await (async () => {
              const now = new Date();
              const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

              let queryA = supabase
                .from('tickets')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', twentyFourHoursAgo.toISOString());

              if (isAgent) queryA = queryA.eq('assigned_to', userProfile.id);
              else if (isSupervisor && myGroupIds.length > 0) queryA = queryA.in('assignment_group_id', myGroupIds);

              const { count: countA } = await queryA;

              let queryB = supabase
                .from('tickets')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', fortyEightHoursAgo.toISOString())
                .lt('created_at', twentyFourHoursAgo.toISOString());

              if (isAgent) queryB = queryB.eq('assigned_to', userProfile.id);
              else if (isSupervisor && myGroupIds.length > 0) queryB = queryB.in('assignment_group_id', myGroupIds);

              const { count: countB } = await queryB;

              const valA = countA || 0;
              const valB = countB || 0;
              if (valB === 0) return valA > 0 ? `+${valA * 100}%` : "0%";
              const diff = ((valA - valB) / valB) * 100;
              return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
            })()
          },
          weeklyTrend,
          teamPulse
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, [userProfile?.id, currentView]);

  const toggleSettingsSub = (key: keyof typeof settingsSubOpen) => {
    setSettingsSubOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
        console.log('Dashboard: Loaded Accessible Menus:', sortedMenus);

        // Set default view logic: Priority to Dashboard
        const hasDashboard = parsedMenus.some((m: any) => m.name === 'Dashboard');
        if (hasDashboard) {
          setCurrentView('dashboard');
        } else if (parsedMenus.length > 0) {
          // Fallback to first menu if Dashboard not available
          // Aggressive Normalization Map (Lowercase + Alphanumeric only)
          const menuViewMap: { [key: string]: any } = {
            'dashboard': 'dashboard',

            'usertickets': 'my-dashboard',
            'mydashboard': 'my-dashboard',
            'mydashbord': 'my-dashboard', // Typo support

            'allincidents': 'incidents',

            'userincidents': 'my-incidents',
            'myincidents': 'my-incidents',
            'mytickets': 'my-incidents',

            'outofoffice': 'outofoffice',

            'knowledgebase': 'knowledge',

            'helpcenter': 'help-center',

            'servicerequests': 'my-service-request',
            'myservicerequest': 'my-service-request', // Specific
            'myrequests': 'my-service-request',
            'allservicerequests': 'service-requests', // "All" view

            'escalatedtickets': 'escalated-tickets',
            'changerequest': 'change-requests',
            'reports': 'reports',
            'reportsanalytics': 'reports',
            'settings': 'settings'
          };

          const firstMenuName = (parsedMenus[0]?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const defaultView = menuViewMap[firstMenuName];
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

  const handleViewTicket = (id: string, fromView: 'incidents' | 'my-tickets' | 'user-dashboard' = 'incidents') => {
    setSelectedTicketId(id);
    setPreviousView(fromView);
    // Always navigate to 'incidents' view to show the full ticket workspace (AgentTicketView or RequesterTicketManager)
    setCurrentView('incidents');
  };

  // Detail Modal Component
  const renderDetailModal = () => {
    if (!detailModal.isOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 shadow-indigo-100/50">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${detailModal.type === 'overdue' ? 'bg-red-50 text-red-600' :
                detailModal.type === 'unassigned' ? 'bg-amber-50 text-amber-600' :
                  detailModal.type === 'satisfaction' ? 'bg-purple-50 text-purple-600' :
                    'bg-indigo-50 text-indigo-600'
                }`}>
                {detailModal.type === 'overdue' ? <AlertCircle size={24} /> :
                  detailModal.type === 'unassigned' ? <Users size={24} /> :
                    detailModal.type === 'satisfaction' ? <Star size={24} /> :
                      <Ticket size={24} />}
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">{detailModal.title}</h2>
                <p className="text-sm text-gray-500 font-medium tracking-tight">System analysis for {detailModal.title.toLowerCase()}</p>
              </div>
            </div>
            <button
              onClick={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
              className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            {detailModal.type === 'satisfaction' ? (
              <div className="p-0">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-gray-400 font-medium border-b border-gray-50 bg-gray-50/30">
                    <tr>
                      <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Reviewer</th>
                      <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Ticket</th>
                      <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider">Feedback</th>
                      <th className="px-6 py-4 font-normal text-xs uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {detailModal.data.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm italic">No reviews found</td>
                      </tr>
                    ) : detailModal.data.map((ticket, i) => (
                      <tr key={ticket.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-indigo-100">
                              {ticket.requester?.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-gray-700">{ticket.requester?.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} className={s <= (ticket.satisfaction_rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-black text-indigo-600 tracking-wider">#{ticket.ticket_number}</td>
                        <td className="px-6 py-4 min-w-[250px]">
                          <p className="text-xs text-gray-600 italic whitespace-normal line-clamp-2 leading-relaxed">
                            {ticket.user_feedback ? `"${ticket.user_feedback}"` : '- No feedback provided -'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => { handleViewTicket(ticket.id); setDetailModal(p => ({ ...p, isOpen: false })); }}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-widest"
                          >
                            Open Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-0">
                {renderCommonTable(detailModal.data)}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center sticky bottom-0">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Showing {detailModal.data.length} Results
            </span>
            <button
              onClick={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
              className="px-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-700 hover:bg-gray-100 transition-all shadow-sm uppercase tracking-wider"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Helper render common table to avoid duplication
  const renderCommonTable = (tickets: any[]) => (
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
        {tickets.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">No tickets found</td>
          </tr>
        ) : tickets.map((ticket, i) => (
          <tr key={ticket.id} className="hover:bg-gray-50/50 transition-colors group">
            <td className="px-6 py-4 text-gray-500 font-medium text-xs">{ticket.ticket_number}</td>
            <td className="px-6 py-4 text-gray-700 font-medium max-w-xs truncate text-xs">{ticket.subject}</td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                  {(ticket.requester?.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-gray-600">{ticket.requester?.full_name?.split(' ')[0] || 'Unknown'}</span>
              </div>
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${ticket.assigned_agent ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  {ticket.assigned_agent ? ticket.assigned_agent.full_name.charAt(0).toUpperCase() : '?'}
                </div>
                <span className="text-gray-500 text-xs">{ticket.assigned_agent?.full_name?.split(' ')[0] || 'Unassigned'}</span>
              </div>
            </td>
            <td className="px-6 py-4">
              {(() => {
                const p = (ticket.priority || 'Low').toLowerCase();
                let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
                let icon = null;

                if (p.includes('urgent') || p.includes('critical')) {
                  badgeClass = 'bg-red-50 text-red-600 border-red-100 animate-pulse';
                  icon = <AlertCircle size={10} className="fill-red-600 text-white" />;
                } else if (p.includes('high')) {
                  badgeClass = 'bg-orange-50 text-orange-600 border-orange-100';
                  icon = <TrendingUp size={10} />;
                } else if (p.includes('medium')) {
                  badgeClass = 'bg-amber-50 text-amber-600 border-amber-100';
                } else {
                  badgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                }

                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${badgeClass}`}>
                    {icon}
                    {ticket.priority || 'Low'}
                  </span>
                );
              })()}
            </td>
            <td className="px-6 py-4">
              <button
                onClick={() => { handleViewTicket(ticket.id); setDetailModal(prev => ({ ...prev, isOpen: false })); }}
                className="group flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                OPEN <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderContent = () => {
    if (currentView === 'user-dashboard' || currentView === 'my-dashboard') {
      return (
        <UserDashboard
          onNavigate={(view: any) => setCurrentView(view)}
          userName={userProfile?.full_name}
          onViewTicket={(id) => handleViewTicket(id, 'user-dashboard')}
        />
      );
    }

    if (currentView === 'create-incident') {
      return <RequesterTicketManager userProfile={userProfile} initialView="create_incident" />;
    }

    if (currentView === 'incidents' || currentView === 'service-requests' || currentView === 'change-requests') {
      // Check if user is Requester (role_id = 4)
      const isRequester = userProfile?.role_id === 4 || userProfile?.role_id === '4';

      let typeFilter: 'incident' | 'service_request' | 'change_request' = 'incident';
      if (currentView === 'service-requests') typeFilter = 'service_request';
      if (currentView === 'change-requests') typeFilter = 'change_request';

      if (isRequester) {
        // Requester uses the dedicated RequesterTicketManager
        return <RequesterTicketManager userProfile={userProfile} initialTicketId={selectedTicketId} ticketTypeFilter={typeFilter} />;
      } else {
        // Agent/SPV uses the new Agent Workspace View with tabs
        return <AgentTicketView userProfile={userProfile} initialTicketId={selectedTicketId} ticketTypeFilter={typeFilter} />;
      }
    }

    if (currentView === 'knowledge') {
      // Check if user is Requester (role_id = 4)
      const isRequester = userProfile?.role_id === 4 || userProfile?.role_id === '4';
      return isRequester ? <RequesterKBPortal /> : <KnowledgeBase />;
    }

    if (currentView === 'help-center') {
      return <HelpCenter />;
    }

    if (currentView === 'outofoffice' || currentView === 'availability' || currentView === 'team-availability') {
      return <OutOfOffice viewMode={currentView === 'team-availability' ? 'supervisor' : 'agent'} />;
    }

    // My Incidents / My Tickets - Different view based on role
    if (currentView === 'my-tickets' || currentView === 'my-incidents') {
      // Check if user is Requester (role_id = 4)
      const isRequester = userProfile?.role_id === 4 || userProfile?.role_id === '4';

      if (isRequester) {
        // Requester uses the dedicated RequesterTicketManager
        return <RequesterTicketManager userProfile={userProfile} initialTicketId={selectedTicketId} />;
      } else {
        // Agent/SPV uses the unified AgentTicketView with 'submitted' filter
        return <AgentTicketView userProfile={userProfile} initialQueueFilter="submitted" />;
      }
    }

    // NEW: Empty Placeholder for Service Requests
    // NEW: Empty Placeholder for Service Requests
    // NEW: Service Requests - Linked to RequesterTicketManager
    // NEW: My Service Requests
    if (currentView === 'my-service-request') {
      return <RequesterTicketManager userProfile={userProfile} initialTicketId={selectedTicketId} ticketTypeFilter="service_request" />;
    }

    // NEW: Change Requests (Escalated Tickets) - Linked to RequesterTicketManager
    if (currentView === 'escalated-tickets') {
      return <RequesterTicketManager userProfile={userProfile} initialTicketId={selectedTicketId} ticketTypeFilter="change_request" />;
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

    if (currentView === 'department-management') {
      return <DepartmentManagement />;
    }

    if (currentView === 'categories') {
      return <CategoryManagement />;
    }

    if (currentView === 'status-management') {
      return <StatusManagement />;
    }

    if (currentView === 'workflow-mapping') {
      return <WorkflowMapping />;
    }

    if (currentView === 'workflow-template') {
      return <WorkflowTemplate />;
    }

    if (currentView === 'access-policy') {
      return <AccessPolicy />;
    }

    if (currentView === 'sla-management') {
      return (
        <SLAManagement
          onEditPolicy={(id: string) => {
            setEditingSlaPolicyId(id);
            setCurrentView('sla-policies');
          }}
        />
      );
    }

    if (currentView === 'sla-policies') {
      return (
        <SLAPolicies
          initialPolicyId={editingSlaPolicyId}
          onClearInitial={() => setEditingSlaPolicyId(null)}
        />
      );
    }

    if (currentView === 'escalation-rules') {
      return <EscalationRules />;
    }

    if (currentView === 'auto-assignment') {
      return <AutoAssignment />;
    }

    if (currentView === 'auto-close-rules') {
      return <AutoCloseRules />;
    }

    if (currentView === 'notifications') {
      return <NotificationSettings />;
    }

    if (currentView === 'my-notifications') {
      return <UserNotificationPreferences />;
    }

    if (currentView === 'service-request-fields') {
      return <ServiceRequestFields />;
    }

    if (currentView === 'portal-highlights') {
      return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Globe size={32} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Portal Highlights</h3>
          <p className="text-gray-500 max-w-md">This settings module is currently under development.</p>
        </div>
      );
    }

    if (currentView === 'reports') {
      return <ReportsView />;
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
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good Morning';
      if (hour < 15) return 'Good Afternoon';
      if (hour < 18) return 'Good Afternoon';
      return 'Good Evening';
    };

    const isAgent = userProfile?.role_id === 3 || userProfile?.role_id === '3';
    const isSPV = userProfile?.role_id === 2 || userProfile?.role_id === '2' || userProfile?.role_id === 1 || userProfile?.role_id === '1'; // SPV & Admin

    // AGENT VIEW: Focus on "My Work"
    if (isAgent) {
      return (
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">{getGreeting()}, {userProfile?.full_name?.split(' ')[0] || 'Agent'}! 👋</h1>
            <p className="text-gray-500">Here's what's on your plate today.</p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Agent Stats - Personal Focus */}
            <div className="col-span-12 grid grid-cols-4 gap-6 mb-2">
              <div
                onClick={() => setDetailModal({ isOpen: true, title: 'My Open Tickets', type: 'open', data: dashboardData.openTicketsList })}
                className="bg-white p-5 rounded-2xl border border-indigo-50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">My Open Tickets</p>
                  <h3 className="text-3xl font-black text-gray-800 mt-1">{dashboardData.stats.current}</h3>
                </div>
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <Briefcase size={24} />
                </div>
              </div>

              {/* Added Pending Card for Agent */}
              <div
                onClick={() => setDetailModal({ isOpen: true, title: 'My Pending Tickets', type: 'pending', data: dashboardData.pendingTicketsList })}
                className="bg-white p-5 rounded-2xl border border-orange-50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Waiting</p>
                  <h3 className="text-3xl font-black text-orange-600 mt-1">{dashboardData.stats.pending}</h3>
                </div>
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                  <Clock size={24} />
                </div>
              </div>

              <div
                onClick={() => setDetailModal({ isOpen: true, title: 'Resolved Today', type: 'resolved', data: dashboardData.resolvedTicketsList })}
                className="bg-white p-5 rounded-2xl border border-emerald-50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resolved Today</p>
                  <h3 className="text-3xl font-black text-gray-800 mt-1">{dashboardData.stats.closed}</h3>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                  <CheckCircle size={24} />
                </div>
              </div>
              <div
                onClick={() => setDetailModal({ isOpen: true, title: 'My Overdue Tickets', type: 'overdue', data: dashboardData.overdueTickets })}
                className="bg-white p-5 rounded-2xl border border-red-50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Overdue</p>
                  <h3 className="text-3xl font-black text-red-600 mt-1">{dashboardData.stats.overdue}</h3>
                </div>
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                  <AlertCircle size={24} />
                </div>
              </div>
            </div>

            {/* Agent Work List */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100/50 overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <Users size={18} className="text-indigo-600" /> My Assigned Queue
                </h2>
                <button onClick={() => setCurrentView('my-tickets')} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">View Full Queue</button>
              </div>
              {/* Reusing existing table logic but can filter specifically for agent later */}
              <div className="p-0 overflow-x-auto">
                {/* ... (Table content - same as below but simplified) ... */}
                {/* For now rendering same table for demo consistency */}
                {renderCommonTable(dashboardData.newTickets)}
              </div>
            </div>

            {/* Agent Quick Actions / Knowledge */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-indigo-600 text-white rounded-2xl p-6 shadow-lg shadow-indigo-200 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="font-bold text-lg mb-2">Knowledge Base</h3>
                  <p className="text-indigo-100 text-sm mb-4">Quickly find solutions for common issues.</p>
                  <button onClick={() => setCurrentView('knowledge')} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    Search Articles
                  </button>
                </div>
                <BookOpen className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 rotate-12" />
              </div>

              {/* SLA Timer Mockup */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-orange-500" /> Overdue
                </h3>
                <div className="space-y-4">
                  {dashboardData.overdueTickets.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-xs italic">No urgent SLA warnings</div>
                  ) : (
                    dashboardData.overdueTickets.slice(0, 2).map((ticket, i) => (
                      <div key={i} className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-orange-700">{ticket.ticket_number}</span>
                          <span className="text-orange-600">Overdue</span>
                        </div>
                        <div className="text-xs text-gray-600 truncate">{ticket.subject}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // SPV / ADMIN VIEW
    return (
      <div className="p-8">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Command Center</h1>
            <p className="text-gray-500">System Overview & Team Performance</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 shadow-sm">Last 7 Days</button>
            <button className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-600 shadow-sm">Live</button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* 1. KEY METRICS GRID (4 Cards) */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Open */}
            <div
              onClick={() => setDetailModal({ isOpen: true, title: isSPV ? 'Team Open Tickets' : 'My Open Tickets', type: 'open', data: dashboardData.openTicketsList })}
              className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
            >
              <div className="relative z-10">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {isSPV ? 'Team Open Tickets' : 'My Open Tickets'}
                </p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-black text-gray-800 tracking-tight">{dashboardData.stats.current}</h3>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded mb-1 flex items-center gap-0.5 ${dashboardData.stats.trend.startsWith('+') ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                    {dashboardData.stats.trend.startsWith('+') ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {dashboardData.stats.trend}
                  </span>
                </div>
              </div>
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-blue-500/0 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <Ticket className="absolute right-4 bottom-4 text-gray-100 mb-1 ml-1" size={48} />
            </div>

            {/* Total Pending Card */}
            <div
              onClick={() => setDetailModal({ isOpen: true, title: 'Team Pending Tickets', type: 'pending', data: dashboardData.pendingTicketsList })}
              className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
            >
              <div className="relative z-10">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Waiting
                </p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-black text-gray-800 tracking-tight">{dashboardData.stats.pending}</h3>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded mb-1 flex items-center gap-0.5">
                    <Clock size={10} /> Pending
                  </span>
                </div>
              </div>
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-amber-500/0 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <Clock className="absolute right-4 bottom-4 text-gray-100 mb-1 ml-1" size={48} />
            </div>

            {/* Unassigned (Critical) */}
            <div
              onClick={() => setDetailModal({ isOpen: true, title: 'Unassigned Queue', type: 'unassigned', data: dashboardData.unassignedTicketsList })}
              className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
            >
              <div className="relative z-10">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Unassigned Queue</p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-black text-gray-800 tracking-tight">{dashboardData.stats.unassigned}</h3>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mb-1">Action Req.</span>
                </div>
              </div>
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/0 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <Users className="absolute right-4 bottom-4 text-amber-50" size={48} />
            </div>

            {/* Overdue (Danger) */}
            <div
              onClick={() => setDetailModal({ isOpen: true, title: 'Overdue Tickets', type: 'overdue', data: dashboardData.overdueTickets })}
              className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
            >
              <div className="relative z-10">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Overdue</p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-black text-gray-800 tracking-tight">{dashboardData.stats.overdue}</h3>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded mb-1">Critical</span>
                </div>
              </div>
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-rose-500/0 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <AlertCircle className="absolute right-4 bottom-4 text-red-50" size={48} />
            </div>

            {/* CSAT / Satisfaction */}
            <div
              onClick={() => setDetailModal({ isOpen: true, title: 'Satisfaction Reviews', type: 'satisfaction', data: dashboardData.satisfactionDetails })}
              className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-lg shadow-indigo-200 flex flex-col justify-between text-white relative overflow-hidden cursor-pointer"
            >
              <div className="relative z-10">
                <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-2">Avg. Satisfaction</p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-black tracking-tight">{dashboardData.stats.satisfaction}</h3>
                  <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded mb-1">/ 5.0</span>
                </div>
                <div className="flex gap-1 mt-3">
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} className="fill-yellow-400 text-yellow-400" />)}
                </div>
              </div>
              <Globe className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 rotate-12" />
            </div>
          </div>

          {/* 2. MAIN CONTENT GRID */}
          <div className="col-span-12 grid grid-cols-12 gap-6">

            {/* Team Workload (Agent Performance) - NEW WIDGET */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100/50 p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Users size={18} className="text-indigo-500" /> Team Pulse
                </h2>
                <button className="text-xs text-gray-400 hover:text-indigo-600 font-bold">View Details</button>
              </div>

              <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {dashboardData.teamPulse.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">No active agents found</div>
                ) : dashboardData.teamPulse.map((agent: any, i) => (
                  <div key={i} className={`flex items-center gap-3 ${agent.isSPV ? 'bg-gradient-to-r from-purple-50 to-transparent p-2 -mx-2 rounded-lg' : ''}`}>
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${agent.isSPV
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-500'
                        }`}>
                        {agent.name.charAt(0)}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${agent.status === 'Overload' ? 'bg-red-500' :
                        agent.status === 'Busy' ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-bold text-gray-700 truncate flex items-center gap-1.5">
                          {agent.name}
                          {agent.isSPV && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 rounded">SPV</span>}
                        </span>
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-2">
                          {agent.overdue > 0 && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded animate-pulse">
                              {agent.overdue} Overdue
                            </span>
                          )}
                          <span>{agent.active} Active</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${agent.status === 'Overload' ? 'bg-red-500' :
                            agent.status === 'Busy' ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}
                          style={{ width: `${(agent.active / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity Table (Simplified) */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100/50 p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Briefcase size={18} className="text-indigo-500" /> Recent Incoming
                </h2>
                <button onClick={() => setCurrentView('incidents')} className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100">
                  View All Queue
                </button>
              </div>
              {/* Table area */}

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
                    {dashboardData.newTickets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">No new tickets</td>
                      </tr>
                    ) : dashboardData.newTickets.map((ticket, i) => (
                      <tr key={ticket.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 text-gray-500 font-medium text-xs">{ticket.ticket_number}</td>
                        <td className="px-6 py-4 text-gray-700 font-medium max-w-xs truncate text-xs">{ticket.subject}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                              {(ticket.requester?.full_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-gray-600">{ticket.requester?.full_name?.split(' ')[0] || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${ticket.assigned_agent ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                              {ticket.assigned_agent ? ticket.assigned_agent.full_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="text-gray-500 text-xs">{ticket.assigned_agent?.full_name?.split(' ')[0] || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const p = (ticket.priority || 'Low').toLowerCase();
                            let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
                            let icon = null;

                            if (p.includes('urgent') || p.includes('critical')) {
                              badgeClass = 'bg-red-50 text-red-600 border-red-100 animate-pulse';
                              icon = <AlertCircle size={10} className="fill-red-600 text-white" />;
                            } else if (p.includes('high')) {
                              badgeClass = 'bg-orange-50 text-orange-600 border-orange-100';
                              icon = <TrendingUp size={10} />;
                            } else if (p.includes('medium')) {
                              badgeClass = 'bg-amber-50 text-amber-600 border-amber-100';
                            } else {
                              badgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                            }

                            return (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${badgeClass}`}>
                                {icon}
                                {ticket.priority || 'Low'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleViewTicket(ticket.id)}
                            className="group flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            OPEN <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overdue Tickets Removed */}





            {/* Weekly Trend Analytics (Replaced Top 5 Incident) */}
          </div>
        </div>
      </div>

    );
  };

  return (
    <div className="flex bg-[#f3f4f6] font-sans h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <div
        className={`${isSidebarOpen ? 'w-72 border-r' : 'w-0 border-none'} bg-white border-gray-200 flex flex-col hidden lg:flex transition-all duration-300 overflow-hidden z-50 flex-shrink-0 relative h-full shadow-sm`}
      >
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
              // Map menu names to views - Complete mapping for all menus
              const menuViewMap: { [key: string]: any } = {
                'dashboard': 'dashboard',
                'usertickets': 'user-dashboard',
                'incidents': 'incidents',
                'allincidents': 'incidents',
                'mydashboard': 'my-dashboard',
                'mydashbord': 'my-dashboard',
                'myincidents': 'my-incidents',
                'userincidents': 'my-incidents',
                'mytickets': 'my-incidents',
                'servicerequests': 'service-requests',
                'allservicerequests': 'service-requests',
                'myservicerequest': 'my-service-request',
                'myservicerequests': 'my-service-request',
                'outofoffice': 'outofoffice',
                'knowledgebase': 'knowledge',
                'helpcenter': 'help-center',
                'escalatedtickets': 'escalated-tickets',
                'changerequest': 'change-requests',
                'reports': 'reports',
                'reportsanalytics': 'reports',
                'settings': 'settings',
              };

              // Normalize Name for Lookup
              const normalizedName = menu.name.toLowerCase().replace(/[^a-z0-9]/g, '');

              if (normalizedName === 'settings') return null;

              let view = menuViewMap[normalizedName];
              if (!view) return null;

              let displayLabel = menu.name;
              if (normalizedName === 'mydashboard' || normalizedName === 'mydashbord') displayLabel = 'My Dashboard';
              if (normalizedName === 'myincidents' || normalizedName === 'userincidents') displayLabel = 'My Incidents';
              if (normalizedName === 'myservicerequest' || normalizedName === 'myservicerequests') displayLabel = 'My Service Request';
              if (normalizedName === 'allincidents' || normalizedName === 'incidents') displayLabel = 'Incidents';
              if (normalizedName === 'knowledgebase') displayLabel = 'Knowledge Base';
              if (normalizedName === 'helpcenter') displayLabel = 'Help Center';
              if (normalizedName === 'outofoffice') displayLabel = 'Out of Office';
              if (normalizedName === 'escalatedtickets') displayLabel = 'Escalated Tickets';
              if (normalizedName === 'changerequest') displayLabel = 'Change Requests';
              if (normalizedName === 'allservicerequests' || normalizedName === 'servicerequests') displayLabel = 'Service Requests';

              const getMenuIcon = () => {
                if (normalizedName === 'dashboard') return LayoutDashboard;
                if (normalizedName === 'mydashboard' || normalizedName === 'mydashbord' || normalizedName === 'usertickets') return User;
                if (normalizedName === 'allincidents') return Ticket;
                if (normalizedName.includes('incidents') || normalizedName.includes('mytickets')) return FileText;
                if (normalizedName.includes('office')) return CalendarOff;
                if (normalizedName.includes('knowledge')) return Book;
                if (normalizedName.includes('help')) return BookOpen;
                if (normalizedName.includes('request') && !normalizedName.includes('change')) return Package;
                if (normalizedName.includes('escalated') || normalizedName.includes('changerequest')) return GitBranch;
                if (normalizedName.includes('reports')) return BarChart3;
                return undefined;
              };

              return (
                <SidebarItem
                  key={menu.id}
                  icon={getMenuIcon()}
                  label={displayLabel}
                  active={currentView === view}
                  onClick={() => {
                    setNavVersion(v => v + 1);
                    setSelectedTicketId(null);
                    setCurrentView(view);
                  }}
                />
              );
            })
          ) : (
            <div className="px-6 py-4 text-xs text-gray-400 italic">No accessible menus found for your role.</div>
          )}

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
                    onClick={() => toggleSettingsSub('organization')}
                    className="flex items-center justify-between pl-10 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100/50 text-gray-600 hover:text-indigo-600 font-medium mt-1"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 size={16} />
                      <span>Organization</span>
                    </div>
                    <ChevronRight size={14} className={`transition-transform duration-200 ${settingsSubOpen.organization ? 'rotate-90' : ''}`} />
                  </div>
                  {settingsSubOpen.organization && (
                    <div className="bg-gray-100/30 pb-1">
                      <div onClick={() => setCurrentView('department-management')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'department-management' ? 'text-indigo-600' : 'text-gray-500'}`}>Departments</div>
                      <div onClick={() => setCurrentView('business-hours')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'business-hours' ? 'text-indigo-600' : 'text-gray-500'}`}>Business Hours</div>
                    </div>
                  )}

                  <div
                    onClick={() => toggleSettingsSub('usersAccess')}
                    className="flex items-center justify-between pl-10 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100/50 text-gray-600 hover:text-indigo-600 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      <span>Users & Access</span>
                    </div>
                    <ChevronRight size={14} className={`transition-transform duration-200 ${settingsSubOpen.usersAccess ? 'rotate-90' : ''}`} />
                  </div>
                  {settingsSubOpen.usersAccess && (
                    <div className="bg-gray-100/30 pb-1">
                      <div onClick={() => setCurrentView('user-management')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'user-management' ? 'text-indigo-600' : 'text-gray-500'}`}>User Management</div>
                      <div onClick={() => setCurrentView('group-management')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'group-management' ? 'text-indigo-600' : 'text-gray-500'}`}>Group Management</div>
                      <div onClick={() => setCurrentView('access-policy')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'access-policy' ? 'text-indigo-600' : 'text-gray-500'}`}>Access Policy</div>
                    </div>
                  )}

                  <div
                    onClick={() => toggleSettingsSub('ticketConfig')}
                    className="flex items-center justify-between pl-10 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100/50 text-gray-600 hover:text-indigo-600 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Wrench size={16} />
                      <span>Ticket Configuration</span>
                    </div>
                    <ChevronRight size={14} className={`transition-transform duration-200 ${settingsSubOpen.ticketConfig ? 'rotate-90' : ''}`} />
                  </div>
                  {settingsSubOpen.ticketConfig && (
                    <div className="bg-gray-100/30 pb-1">
                      <div onClick={() => setCurrentView('categories')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'categories' ? 'text-indigo-600' : 'text-gray-500'}`}>Categories</div>
                      <div onClick={() => setCurrentView('service-request-fields')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'service-request-fields' ? 'text-indigo-600' : 'text-gray-500'}`}>Service Request Fields</div>
                      <div onClick={() => setCurrentView('status-management')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'status-management' ? 'text-indigo-600' : 'text-gray-500'}`}>Status Management</div>
                      <div onClick={() => setCurrentView('workflow-mapping')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'workflow-mapping' ? 'text-indigo-600' : 'text-gray-500'}`}>Workflow Mapping</div>
                      <div onClick={() => setCurrentView('workflow-template')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'workflow-template' ? 'text-indigo-600' : 'text-gray-500'}`}>Workflow Template</div>
                    </div>
                  )}

                  <div
                    onClick={() => toggleSettingsSub('slaConfig')}
                    className="flex items-center justify-between pl-10 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100/50 text-gray-600 hover:text-indigo-600 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      <span>SLA Configuration</span>
                    </div>
                    <ChevronRight size={14} className={`transition-transform duration-200 ${settingsSubOpen.slaConfig ? 'rotate-90' : ''}`} />
                  </div>
                  {settingsSubOpen.slaConfig && (
                    <div className="bg-gray-100/30 pb-1">
                      <div onClick={() => setCurrentView('sla-management')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'sla-management' ? 'text-indigo-600' : 'text-gray-500'}`}>SLA Management</div>
                      <div onClick={() => setCurrentView('sla-policies')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'sla-policies' ? 'text-indigo-600' : 'text-gray-500'}`}>SLA Policies</div>
                      <div onClick={() => setCurrentView('escalation-rules')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'escalation-rules' ? 'text-indigo-600' : 'text-gray-500'}`}>Escalation Rules</div>
                    </div>
                  )}

                  <div
                    onClick={() => toggleSettingsSub('automation')}
                    className="flex items-center justify-between pl-10 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100/50 text-gray-600 hover:text-indigo-600 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={16} />
                      <span>Automation</span>
                    </div>
                    <ChevronRight size={14} className={`transition-transform duration-200 ${settingsSubOpen.automation ? 'rotate-90' : ''}`} />
                  </div>
                  {settingsSubOpen.automation && (
                    <div className="bg-gray-100/30 pb-1">
                      <div onClick={() => setCurrentView('auto-assignment')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'auto-assignment' ? 'text-indigo-600' : 'text-gray-500'}`}>Auto Assignment</div>
                      <div onClick={() => setCurrentView('auto-close-rules')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'auto-close-rules' ? 'text-indigo-600' : 'text-gray-500'}`}>Auto Close Rules</div>
                    </div>
                  )}

                  <div
                    onClick={() => toggleSettingsSub('portal')}
                    className="flex items-center justify-between pl-10 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100/50 text-gray-600 hover:text-indigo-600 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Globe size={16} />
                      <span>Self Service Portal</span>
                    </div>
                    <ChevronRight size={14} className={`transition-transform duration-200 ${settingsSubOpen.portal ? 'rotate-90' : ''}`} />
                  </div>
                  {settingsSubOpen.portal && (
                    <div className="bg-gray-100/30 pb-1">
                      <div onClick={() => setCurrentView('portal-highlights')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'portal-highlights' ? 'text-indigo-600' : 'text-gray-500'}`}>Portal Highlights</div>
                    </div>
                  )}

                  <div
                    onClick={() => toggleSettingsSub('notifications')}
                    className="flex items-center justify-between pl-10 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100/50 text-gray-600 hover:text-indigo-600 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Bell size={16} />
                      <span>Notification Settings</span>
                    </div>
                    <ChevronRight size={14} className={`transition-transform duration-200 ${settingsSubOpen.notifications ? 'rotate-90' : ''}`} />
                  </div>
                  {settingsSubOpen.notifications && (
                    <div className="bg-gray-100/30 pb-1">
                      <div onClick={() => setCurrentView('notifications')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'notifications' ? 'text-indigo-600' : 'text-gray-500'}`}>Global Settings</div>
                      <div onClick={() => setCurrentView('my-notifications')} className={`pl-16 pr-6 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors ${currentView === 'my-notifications' ? 'text-indigo-600' : 'text-gray-500'}`}>My Preferences</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="p-6 border-t border-gray-100 flex items-center gap-3 relative flex-shrink-0" ref={menuRef}>
          <img src={`https://ui-avatars.com/api/?name=${userProfile?.full_name || 'User'}&background=random`} alt="User" className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-700 truncate">{userProfile?.full_name || 'User'}</p>
          </div>
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><MoreVertical size={16} className="text-gray-400" /></button>
          {showUserMenu && (
            <div className="absolute bottom-16 left-4 right-4 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
              <button onClick={() => { setCurrentView('profile'); setShowUserMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><User size={16} /> Profile</button>
              <button onClick={() => { setCurrentView('my-notifications'); setShowUserMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Bell size={16} /> Notifications</button>
              <div className="h-px bg-gray-100 my-1 mx-4"></div>
              <button onClick={onLogout} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><LogOut size={16} /> Logout</button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative transition-all duration-300">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-4 left-4 z-[99998] p-2 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-500 hover:text-indigo-600 transition-colors hidden lg:block"
          >
            <Menu size={20} />
          </button>
        )}

        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-4 flex justify-end items-center gap-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="relative" ref={notificationRef}>
              <button onClick={() => setShowNotificationPanel(!showNotificationPanel)} className={`relative p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all ${showNotificationPanel ? 'text-indigo-600 bg-indigo-50' : ''}`}><Bell size={22} /><NotificationBadge unreadCount={unreadCount} /></button>
              {showNotificationPanel && <NotificationPanelWrapper notifications={notifications} unreadCount={unreadCount} markAsRead={markAsRead} markAllAsRead={markAllAsRead} deleteNotification={deleteNotification} clearAll={clearAll} onClose={() => setShowNotificationPanel(false)} onNavigate={(refType, refId) => { if (refType === 'ticket') { setSelectedTicketId(refId); setCurrentView('incidents'); } }} />}
            </div>
            <button onClick={() => setCurrentView('profile')} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"><User size={22} /></button>
          </div>
        </header>

        <main className="flex-1 overflow-auto z-0 relative">
          <div key={`${currentView}-${navVersion}`} className="h-full">
            {renderContent()}
          </div>
          {renderDetailModal()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;