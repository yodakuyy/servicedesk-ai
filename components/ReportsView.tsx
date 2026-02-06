import React, { useState, useEffect } from 'react';
import {
    BarChart3, FileSpreadsheet, Clock, AlertTriangle,
    Download, Filter, Calendar, TrendingUp, Users,
    ArrowUpRight, ArrowDownRight, Search, ChevronRight,
    TrendingDown, CheckCircle2, Package, FileText, GitBranch, X
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
    LineChart, Line
} from 'recharts';
import { supabase } from '../lib/supabase';

const ReportsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'export' | 'sla'>('overview');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Real Data States
    const [stats, setStats] = useState({
        total: 0,
        incidents: 0,
        serviceRequests: 0,
        changeRequests: 0,
        avgResolveTime: '0h',
        slaMet: '0%',
        overdue: 0,
        unassigned: 0,
        critical: 0,
        stale: 0
    });
    const [agentPerformance, setAgentPerformance] = useState<any[]>([]);
    const [slaStatusData, setSlaStatusData] = useState<any[]>([]);
    const [categoryTrends, setCategoryTrends] = useState<any[]>([]);
    const [recentTickets, setRecentTickets] = useState<any[]>([]);
    const [breachedTickets, setBreachedTickets] = useState<any[]>([]);
    const [isBreachModalOpen, setIsBreachModalOpen] = useState(false);
    const [exportSearch, setExportSearch] = useState('');
    const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
    const [slaTargets, setSlaTargets] = useState<any[]>([]);
    const [allCategories, setAllCategories] = useState<any[]>([]);
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);

    const checkTicketSla = (t: any, statusMap: Record<string, string> = {}) => {
        const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name)?.toLowerCase();
        const isCanceled = sName === 'canceled';
        const isTerminal = ['resolved', 'closed'].includes(sName);

        const priorityTgt: Record<string, number> = {
            'Critical': 60,
            'High': 240,
            'P2 - High': 240,
            'Medium': 480,
            'Low': 960
        };

        const baseTarget = priorityTgt[t.priority as string] || 480;
        const respTarget = baseTarget / 4;

        const startTime = new Date(t.created_at).getTime();

        // 1. Response SLA
        const hasResponded = !['open', 'new'].includes(sName);
        const respTime = (hasResponded && t.updated_at) ? new Date(t.updated_at).getTime() : new Date().getTime();
        const respElapsed = (respTime - startTime) / 60000;

        const isResponseOverdue = !isCanceled && (hasResponded
            ? respElapsed > respTarget
            : (new Date().getTime() - startTime) / 60000 > respTarget);

        // 2. Resolution SLA
        const resolutionTime = (isTerminal && t.updated_at) ? new Date(t.updated_at).getTime() : new Date().getTime();
        const resolveElapsed = (resolutionTime - startTime) / 60000;
        const netResolve = Math.max(0, resolveElapsed - (t.total_paused_minutes || 0));

        const isResolveOverdue = !isCanceled && (netResolve > baseTarget);

        return {
            isResponseOverdue,
            isResolveOverdue,
            netResolve,
            respElapsed,
            baseTarget,
            respTarget
        };
    };

    const getBreadcrumb = (catId: string, categories: any[]): string => {
        const cat = categories.find(c => c.id === catId);
        if (!cat) return 'Uncategorized';
        if (!cat.parent_id) return cat.name;
        return getBreadcrumb(cat.parent_id, categories) + ' › ' + cat.name;
    };

    useEffect(() => {
        fetchReportsData();
    }, [dateRange]);

    const formatHandleTime = (hours: number) => {
        if (!hours || hours <= 0) return '-';
        const totalMinutes = Math.round(hours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const fetchReportsData = async () => {
        setIsLoading(true);
        try {
            // 0. Fetch Policies, Targets & All Categories for Breadcrumbs
            const [pRes, tRes, cRes, sRes] = await Promise.all([
                supabase.from('sla_policies').select('*').eq('is_active', true),
                supabase.from('sla_targets').select('*'),
                supabase.from('ticket_categories').select('id, name, parent_id'),
                supabase.from('ticket_statuses').select('status_id, status_name')
            ]);
            if (pRes.data) setSlaPolicies(pRes.data);
            if (tRes.data) setSlaTargets(tRes.data);
            const categories = cRes.data || [];
            setAllCategories(categories);
            const statusMap: Record<string, string> = {};
            if (sRes.data) {
                sRes.data.forEach((s: any) => statusMap[s.status_id] = s.status_name);
                setStatusMap(statusMap);
            }

            // 1. Fetch All Tickets in Range
            let query = supabase
                .from('tickets')
                .select(`
                    id, ticket_number, subject, priority, created_at, updated_at, ticket_type, 
                    total_paused_minutes, status_id, category_id,
                    ticket_statuses!fk_tickets_status (status_name),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name, role_id)
                `)
                .gte('created_at', dateRange.start + 'T00:00:00')
                .lte('created_at', dateRange.end + 'T23:59:59');

            const { data: tickets, error } = await query;
            if (error) throw error;

            if (tickets && tickets.length > 0) {
                // 1.5 Fetch Logs for these tickets to detect L1/L2 splits
                const tIds = tickets.map((t: any) => t.id);
                const { data: logData, error: logError } = await supabase
                    .from('ticket_activity_log')
                    .select('id, ticket_id, actor_id, action, created_at')
                    .in('ticket_id', tIds)
                    .order('created_at', { ascending: true });

                let actorMap = new Map();
                if (logData && logData.length > 0) {
                    const uniqueActorIds = [...new Set(logData.map(l => l.actor_id).filter(Boolean))];
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, role_id')
                        .in('id', uniqueActorIds);
                    if (profiles) {
                        profiles.forEach(p => actorMap.set(p.id, p));
                    }
                }

                if (logError) {
                    console.error('Log fetch error:', logError);
                } else {
                    console.log('Total logs fetched:', logData?.length);
                }

                // Attach actor info to logs
                const logsWithActor = (logData || []).map(l => ({
                    ...l,
                    actor: actorMap.get(l.actor_id)
                }));

                const enrichedTickets = tickets.map((t: any) => ({
                    ...t,
                    activity_logs: logsWithActor.filter((l: any) => l.ticket_id === t.id)
                }));

                const ticketsToUse = enrichedTickets;
                const validTickets = enrichedTickets.filter((t: any) => {
                    const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name)?.toLowerCase();
                    return sName !== 'canceled';
                });

                const incidents = validTickets.filter((t: any) => t.ticket_type?.toLowerCase() === 'incident');
                const serviceRequests = validTickets.filter((t: any) => t.ticket_type?.toLowerCase() === 'service request' || t.ticket_type?.toLowerCase() === 'request');
                const changeRequests = validTickets.filter((t: any) => t.ticket_type?.toLowerCase() === 'change request' || t.ticket_type?.toLowerCase() === 'change');
                const resolvedTickets = validTickets.filter((t: any) => ['resolved', 'closed'].includes((t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name)?.toLowerCase()));

                // Calculate Avg Resolve Time
                let totalHandlingMins = 0;
                resolvedTickets.forEach((t: any) => {
                    const durationMins = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 60000;
                    totalHandlingMins += Math.max(0, durationMins - (t.total_paused_minutes || 0));
                });
                const avgMins = resolvedTickets.length > 0 ? totalHandlingMins / resolvedTickets.length : 0;
                const avgH = (avgMins / 60).toFixed(1);

                // B. Real SLA Logic
                const overdueList: any[] = [];
                const overdueCount = validTickets.filter((t: any) => {
                    const sla = checkTicketSla(t, statusMap);
                    if (sla.isResolveOverdue) {
                        overdueList.push({
                            ...t,
                            actualMins: sla.netResolve,
                            targetMins: sla.baseTarget
                        });
                    }
                    return sla.isResolveOverdue;
                }).length;
                setBreachedTickets(overdueList);

                const slaMetPct = validTickets.length > 0 ? (((validTickets.length - overdueCount) / validTickets.length) * 100).toFixed(1) : '100';

                // Calculate Additional Anomalies
                const unassignedCount = validTickets.filter((t: any) => {
                    const aName = t.assigned_agent?.full_name || t.assigned_agent?.[0]?.full_name;
                    const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name)?.toLowerCase();
                    return !aName && !['resolved', 'closed', 'canceled'].includes(sName);
                }).length;

                const criticalCount = validTickets.filter((t: any) => {
                    const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name)?.toLowerCase();
                    const prio = (t.priority || '').toLowerCase();
                    return prio.includes('critical') && !['resolved', 'closed', 'canceled'].includes(sName);
                }).length;

                const staleCount = validTickets.filter((t: any) => {
                    const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name)?.toLowerCase();
                    const lastUpdate = new Date(t.updated_at || t.created_at).getTime();
                    const diffHrs = (new Date().getTime() - lastUpdate) / 3600000;
                    return diffHrs > 12 && !['resolved', 'closed', 'canceled'].includes(sName);
                }).length;

                setStats({
                    total: validTickets.length,
                    incidents: incidents.length,
                    serviceRequests: serviceRequests.length,
                    changeRequests: changeRequests.length,
                    avgResolveTime: `${avgH === '0.0' ? '0' : avgH}h`,
                    slaMet: `${slaMetPct}%`,
                    overdue: overdueCount,
                    unassigned: unassignedCount,
                    critical: criticalCount,
                    stale: staleCount
                });

                // B. Agent Performance (Group by Agent)
                const agentMap: Record<string, { incident: number, request: number, change: number, total: number }> = {};
                validTickets.forEach((t: any) => {
                    // @ts-ignore
                    const name = t.assigned_agent?.full_name || t.assigned_agent?.[0]?.full_name || 'Unassigned';
                    if (!agentMap[name]) agentMap[name] = { incident: 0, request: 0, change: 0, total: 0 };

                    const type = t.ticket_type?.toLowerCase();
                    if (type === 'incident') agentMap[name].incident++;
                    else if (type === 'service request' || type === 'request') agentMap[name].request++;
                    else if (type === 'change request' || type === 'change') agentMap[name].change++;

                    agentMap[name].total++;
                });

                const agentChartData = Object.entries(agentMap).map(([name, data]) => ({
                    name,
                    incident: data.incident,
                    request: data.request,
                    change: data.change,
                    total: data.total
                })).sort((a, b) => b.total - a.total).slice(0, 5);
                setAgentPerformance(agentChartData);

                // C. SLA Distribution
                setSlaStatusData([
                    { name: 'Within SLA', value: validTickets.length - overdueCount, fill: '#10b981' },
                    { name: 'Overdue', value: overdueCount, fill: '#ef4444' },
                ]);

                // D. Category Trends
                const catMap: Record<string, number> = {};
                validTickets.forEach(t => {
                    const breadcrumb = t.category_id ? getBreadcrumb(t.category_id, categories) : 'Uncategorized';
                    catMap[breadcrumb] = (catMap[breadcrumb] || 0) + 1;
                });
                const catChartData = Object.entries(catMap).map(([name, count]) => ({
                    name,
                    count
                })).sort((a, b) => b.count - a.count).slice(0, 5);
                setCategoryTrends(catChartData);

                // E. Recent Tickets (For export table preview)
                setRecentTickets(enrichedTickets);
            }
        } catch (err) {
            console.error('Error fetching reports data:', err);
        } finally {
            setIsLoading(false);
            setIsInitialLoading(false);
        }
    };

    const formatHandlingTime = (ticket: any) => {
        const start = new Date(ticket.created_at).getTime();
        const end = ticket.updated_at ? new Date(ticket.updated_at).getTime() : new Date().getTime();
        const diffMins = Math.max(0, (end - start) / 60000 - (ticket.total_paused_minutes || 0));
        const h = Math.floor(diffMins / 60);
        const m = Math.floor(diffMins % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const filteredExportTickets = recentTickets.filter(t =>
        t.ticket_number?.toLowerCase().includes(exportSearch.toLowerCase()) ||
        t.subject?.toLowerCase().includes(exportSearch.toLowerCase()) ||
        t.assigned_agent?.full_name?.toLowerCase().includes(exportSearch.toLowerCase())
    );

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            // Fetch comprehensive data for export
            const { data: tickets, error } = await supabase
                .from('tickets')
                .select(`
                    id, ticket_number, subject, description, priority, created_at, updated_at, ticket_type, 
                    total_paused_minutes, status_id, category_id, is_category_verified, tags, requester_id,
                    ticket_statuses!fk_tickets_status (status_name),
                    requester:profiles!fk_tickets_requester (full_name, email),
                    reporter:profiles!fk_tickets_created_by (full_name),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name, role_id),
                    services (name),
                    group:groups!assignment_group_id (name)
                `)
                .gte('created_at', dateRange.start + 'T00:00:00')
                .lte('created_at', dateRange.end + 'T23:59:59');

            if (error) throw error;
            if (!tickets || tickets.length === 0) {
                const Swal = (await import('sweetalert2')).default;
                Swal.fire({
                    icon: 'info',
                    title: 'No Data',
                    text: 'No tickets found for the selected date range.',
                    confirmButtonColor: '#4f46e5'
                });
                return;
            }

            // Fetch activity logs for L1/L2 logic and precise timing
            const tIds = tickets.map((t: any) => t.id);
            const { data: logData, error: logError } = await supabase
                .from('ticket_activity_log')
                .select('id, ticket_id, actor_id, action, created_at')
                .in('ticket_id', tIds)
                .order('created_at', { ascending: true });

            // Fetch actor profiles separately for L1/L2 agent names
            const logActorIds = (logData || []).map((l: any) => l.actor_id);
            const assignedIds = (tickets || []).map((t: any) => (Array.isArray(t.assigned_agent) ? t.assigned_agent[0] : t.assigned_agent)?.id).filter(Boolean);
            const uniqueActorIds = [...new Set([...logActorIds, ...assignedIds].filter(Boolean))];
            const { data: actorProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, role_id')
                .in('id', uniqueActorIds.length > 0 ? uniqueActorIds : ['none']);

            // Create a map for quick lookup
            const actorMap = new Map((actorProfiles || []).map((p: any) => [p.id, p]));

            // Fetch ticket messages to find first agent response (matching UI calculation)
            const { data: messageData } = await supabase
                .from('ticket_messages')
                .select('id, ticket_id, sender_id, sender_role, is_internal, created_at')
                .in('ticket_id', tIds)
                .eq('is_internal', false)
                .order('created_at', { ascending: true });

            const excelHeaders = [
                'Ticket No', 'Subject', 'Type', 'Priority', 'Status', 'Category Path', 'Verified?',
                'Service', 'Assignment Group', 'Requester Name', 'Requester Email',
                'Reporter Name', 'Assigned Agent', 'L1 Agent', 'L2 Agent',
                'Created At', 'Updated At', 'Resolved At', 'Closed At',
                'Response Time (Mins)', 'Response SLA',
                'L1 Handle (Hrs)', 'L2 Handle (Hrs)', 'Total Resolution (Hrs)',
                'Total Paused (Mins)', 'Resolution SLA', 'Tags', 'Description'
            ];

            const excelRows = tickets.map(t => {
                const ticket = t as any;
                const sName = (ticket.ticket_statuses?.status_name || ticket.ticket_statuses?.[0]?.status_name) || 'Open';
                const isResolved = ['Resolved', 'Closed'].includes(sName);
                const isClosed = sName === 'Closed';
                const categoryPath = ticket.category_id ? getBreadcrumb(ticket.category_id, allCategories) : 'Uncategorized';

                // Filter logs for this ticket - use string comparison to avoid UUID mismatch
                const logs = logData?.filter((l: any) => String(l.ticket_id) === String(ticket.id)) || [];
                const creationTime = new Date(ticket.created_at).getTime();

                // Find escalation log - action contains "escalated" and "l2" (more robust matching)
                // Exclude SLA/Resolution notifications
                // Find LATEST escalation log - matches AgentTicketView (Latest log)
                const escalationLog = [...logs].reverse().find((l: any) => {
                    const actionLower = (l.action || '').toLowerCase();
                    if (actionLower.includes('notify') || actionLower.includes('triggered') || actionLower.includes('sla')) return false;
                    return (actionLower.includes('escalated') && actionLower.includes('l2')) ||
                        actionLower.includes('ticket escalated') ||
                        actionLower.includes('escalation');
                });

                const terminalTime = isResolved ? new Date(ticket.updated_at).getTime() : new Date().getTime();

                // Find resolved/closed logs - action is "Status changed from X to Resolved"
                const resolvedLog = logs.find((l: any) => {
                    const actionLower = l.action.toLowerCase();
                    return actionLower.includes('to resolved') ||
                        (actionLower.includes('status') && actionLower.includes('resolved'));
                });
                const closedLog = logs.find((l: any) => {
                    const actionLower = l.action.toLowerCase();
                    return actionLower.includes('to closed') ||
                        (actionLower.includes('status') && actionLower.includes('closed'));
                });

                const resolvedAt = resolvedLog ? new Date(resolvedLog.created_at).toLocaleString() : (isResolved ? new Date(ticket.updated_at).toLocaleString() : '-');
                const closedAt = closedLog ? new Date(closedLog.created_at).toLocaleString() : (isClosed ? new Date(ticket.updated_at).toLocaleString() : '-');

                const totalPausedMins = ticket.total_paused_minutes || 0;

                const agent = Array.isArray(ticket.assigned_agent) ? ticket.assigned_agent[0] : ticket.assigned_agent;

                // Get L1/L2 agent names (matching AgentTicketView logic but with better filtering)
                const l1Roles = [1, 2, 3]; // Include Admin (1)
                const l2Roles = [5];

                // Helper to check if actor is a real person (not system/bot/notification)
                const isRealHuman = (profile: any) => {
                    if (!profile) return false;
                    const name = (profile.full_name || '').toLowerCase();
                    return name &&
                        !name.includes('system') &&
                        !name.includes('notify') &&
                        !name.includes('bot') &&
                        !name.includes('service desk') &&
                        !name.includes('triggered') &&
                        !name.includes('sla');
                };

                // 1. Identify L1
                let l1Name = '-';
                const escalatorProfile = escalationLog ? actorMap.get(escalationLog.actor_id) : null;

                const l1LogFound = logs.find((l: any) => {
                    const actor = actorMap.get(l.actor_id);
                    return l1Roles.includes(actor?.role_id) && isRealHuman(actor);
                });

                if (escalatorProfile && isRealHuman(escalatorProfile)) {
                    l1Name = escalatorProfile.full_name;
                } else if (l1LogFound) {
                    l1Name = actorMap.get(l1LogFound.actor_id)?.full_name || 'L1 Agent';
                } else {
                    if (l1Roles.includes(agent?.role_id) && isRealHuman(agent)) {
                        l1Name = agent.full_name || 'L1 Agent';
                    }
                }

                // L2 Calculation: find first log by L2 roles (excluding creation, must be real human)
                const l2LogFound = logs.find((l: any) => {
                    const actor = actorMap.get(l.actor_id);
                    return l2Roles.includes(actor?.role_id) &&
                        isRealHuman(actor) &&
                        !(l.action || '').toLowerCase().includes('created');
                });

                let l2Name = '-';
                if (l2LogFound) {
                    l2Name = actorMap.get(l2LogFound.actor_id)?.full_name || 'L2 Agent';
                } else if (escalationLog) {
                    const action = escalationLog.action || '';
                    const l2Match = action.match(/L2 Agent:\s*(.+)/i);
                    if (l2Match) {
                        const matchedName = l2Match[1].trim();
                        if (matchedName.length < 50 && !matchedName.toLowerCase().includes('notify')) {
                            l2Name = matchedName;
                        }
                    } else if (action.toLowerCase().includes('escalated to')) {
                        const parts = action.split(':');
                        if (parts.length > 1) {
                            const possibleName = parts[1].trim();
                            if (possibleName.length < 50 && !possibleName.toLowerCase().includes('notify')) {
                                l2Name = possibleName;
                            }
                        }
                    }
                }

                if (l2Name === '-' && l2Roles.includes(agent?.role_id) && isRealHuman(agent)) {
                    l2Name = agent.full_name || 'L2 Agent';
                }

                // Helper function for HH:MM format
                const formatToHHMM = (mins: number) => {
                    const totalMins = Math.round(mins);
                    const h = Math.floor(Math.abs(totalMins) / 60);
                    const m = Math.floor(Math.abs(totalMins) % 60);
                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                };

                // Find first agent reply from MESSAGES (matching UI - not from activity log)
                const ticketMessages = messageData?.filter((m: any) => String(m.ticket_id) === String(ticket.id)) || [];
                const requesterObj = Array.isArray(ticket.requester) ? ticket.requester[0] : ticket.requester;
                const requesterId = ticket.requester_id;

                // First response = first non-internal message NOT from requester (i.e., agent reply)
                const firstAgentMessage = ticketMessages.find((m: any) =>
                    m.sender_id !== requesterId && m.sender_role === 'agent'
                );
                const firstResponseTime = firstAgentMessage ? new Date(firstAgentMessage.created_at).getTime() : null;
                // Use Math.floor to match UI behavior (truncate, not round)
                const responseMins = firstResponseTime ? Math.floor((firstResponseTime - creationTime) / 60000) : 0;

                // Find escalation time and terminal time
                const escalationTime = escalationLog ? new Date(escalationLog.created_at).getTime() : null;

                // Find resolved log for accurate terminal time (stopTime)
                const resolvedLogTime = resolvedLog ? new Date(resolvedLog.created_at).getTime() : null;
                const actualTerminalTime = resolvedLogTime || (isResolved ? new Date(ticket.updated_at).getTime() : new Date().getTime());

                // Calculate L1/L2 times in minutes (matching UI calculation - use floor, not round)
                let l1Mins = 0;
                let l2Mins = 0;
                let totalResMins = 0;

                // Total resolution = terminal - creation - paused (calculate directly, not from L1+L2)
                totalResMins = Math.max(0, Math.floor((actualTerminalTime - creationTime) / 60000) - totalPausedMins);

                if (escalationTime && escalationTime > creationTime) {
                    const rawL1 = Math.floor((escalationTime - creationTime) / 60000);
                    const rawL2 = Math.floor((actualTerminalTime - escalationTime) / 60000);

                    // Match SLA Widget: L1 is clock time, L2 absorbs total pause
                    l1Mins = rawL1;
                    l2Mins = Math.max(0, rawL2 - totalPausedMins);
                } else {
                    l1Mins = totalResMins;
                    l2Mins = 0;
                }

                const sla = checkTicketSla(ticket, statusMap);
                const cleanDesc = (ticket.description || '').replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
                const tagsStr = (ticket.tags || []).join(', ');

                const requester = Array.isArray(ticket.requester) ? ticket.requester[0] : ticket.requester;
                const reporter = Array.isArray(ticket.reporter) ? ticket.reporter[0] : ticket.reporter;

                return [
                    ticket.ticket_number,
                    ticket.subject || '',
                    ticket.ticket_type,
                    ticket.priority,
                    sName,
                    categoryPath,
                    ticket.is_category_verified ? 'YES' : 'NO',
                    (ticket.services?.name || ticket.services?.[0]?.name) || '-',
                    (ticket.group?.name || ticket.group?.[0]?.name) || '-',
                    (requester?.full_name) || 'Guest',
                    (requester?.email) || '-',
                    (reporter?.full_name) || '-',
                    (agent?.full_name) || 'Unassigned',
                    l1Name,
                    l2Name,
                    new Date(ticket.created_at).toLocaleString(),
                    new Date(ticket.updated_at).toLocaleString(),
                    resolvedAt,
                    closedAt,
                    formatToHHMM(responseMins),
                    sla.isResponseOverdue ? 'OVERDUE' : 'WITHIN SLA',
                    formatToHHMM(l1Mins),
                    formatToHHMM(l2Mins),
                    formatToHHMM(totalResMins),
                    formatToHHMM(totalPausedMins),
                    sla.isResolveOverdue ? 'OVERDUE' : 'WITHIN SLA',
                    tagsStr,
                    cleanDesc
                ];
            });

            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.aoa_to_sheet([excelHeaders, ...excelRows]);

            // Auto-size columns for better readability
            const maxWidths = excelHeaders.map((h, i) => {
                let maxLen = h.length;
                excelRows.forEach(row => {
                    const val = String(row[i] || '');
                    if (val.length > maxLen) maxLen = val.length;
                });
                return { wch: Math.min(maxLen + 2, 50) };
            });
            worksheet['!cols'] = maxWidths;

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');
            XLSX.writeFile(workbook, `ServiceDesk_Export_${dateRange.start}_to_${dateRange.end}.xlsx`);

        } catch (err: any) {
            console.error('Export failed:', err);
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({
                icon: 'error',
                title: 'Export Failed',
                text: err.message || 'An unexpected error occurred during export. Check console for details.',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-8 bg-[#f8f9fa] min-h-full font-sans text-slate-700 overflow-y-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <BarChart3 size={24} />
                        </div>
                        Reports & Analytics
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Data-driven insights and operational performance tracking</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-r border-slate-100">
                        <Calendar size={16} className="text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="text-xs font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-600 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 font-bold text-slate-300">to</div>
                    <div className="flex items-center gap-2 px-3 py-1.5">
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="text-xs font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-600 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 mb-8 max-w-fit">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2
                        ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                >
                    <TrendingUp size={16} /> Overview
                </button>
                <button
                    onClick={() => setActiveTab('export')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2
                        ${activeTab === 'export' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                >
                    <FileSpreadsheet size={16} /> Ticket Export
                </button>
                <button
                    onClick={() => setActiveTab('sla')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2
                        ${activeTab === 'sla' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                >
                    <Clock size={16} /> SLA Reports
                </button>
            </div>

            {/* Main Content Area */}
            {activeTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KPICard
                            title="Incidents"
                            value={stats.incidents.toString()}
                            trend="+0%"
                            trendUp={true}
                            icon={<Package className="text-indigo-600" />}
                            bg="bg-indigo-50"
                        />
                        <KPICard
                            title="Service Requests"
                            value={stats.serviceRequests.toString()}
                            trend="+0%"
                            trendUp={true}
                            icon={<FileText className="text-emerald-600" />}
                            bg="bg-emerald-50"
                        />
                        <KPICard
                            title="Change Requests"
                            value={stats.changeRequests.toString()}
                            trend="+0%"
                            trendUp={true}
                            icon={<GitBranch className="text-blue-600" />}
                            bg="bg-blue-50"
                        />
                        <KPICard
                            title="Total Tickets"
                            value={stats.total.toString()}
                            trend="+0"
                            trendUp={true}
                            icon={<BarChart3 className="text-rose-600" />}
                            bg="bg-rose-50"
                        />
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* 1. Agent Performance (Bar Chart) */}
                        <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center justify-between">
                                Ticket Distribution by Agent
                                <TrendingUp size={16} className="text-emerald-500" />
                            </h3>
                            <div className="h-[350px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={agentPerformance} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{
                                                borderRadius: '16px',
                                                border: 'none',
                                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                        <Bar
                                            dataKey="incident"
                                            name="Incident"
                                            stackId="a"
                                            fill="#4f46e5"
                                            radius={[0, 0, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="request"
                                            name="Service Request"
                                            stackId="a"
                                            fill="#10b981"
                                            radius={[0, 0, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="change"
                                            name="Change Request"
                                            stackId="a"
                                            fill="#3b82f6"
                                            radius={[8, 8, 0, 0]}
                                            barSize={40}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 2. SLA Breakdown (Pie Chart) */}
                        <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">SLA Status Distribution</h3>
                            <div className="h-[250px] w-full flex items-center justify-center relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={slaStatusData}
                                            innerRadius={70}
                                            outerRadius={90}
                                            paddingAngle={8}
                                            dataKey="value"
                                        >
                                            {slaStatusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-black text-slate-900 leading-tight">{stats.slaMet}</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${parseFloat(stats.slaMet) >= 90 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {parseFloat(stats.slaMet) >= 90 ? 'Healthy' : 'Needs Attention'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-6 space-y-3">
                                {slaStatusData.map((item, i) => {
                                    const percentage = stats.total > 0 ? ((item.value / stats.total) * 100).toFixed(0) : 0;
                                    return (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                                <span className="text-xs font-bold text-slate-600">{item.name}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-black text-slate-900">{percentage}%</span>
                                                <span className="text-[10px] font-bold text-slate-400">{item.value} Tickets</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Top Sub-Categories (Horizontal Bars) */}
                        <div className="col-span-12 lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center justify-between">
                                Frequent Problem Categories
                                <TrendingDown size={16} className="text-rose-500" />
                            </h3>
                            <div className="space-y-4">
                                {categoryTrends.map((cat, i) => {
                                    const parts = cat.name.split(' › ');
                                    const mainName = parts.pop();
                                    const path = parts.join(' › ');

                                    return (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex flex-col gap-0.5">
                                                {path && (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                        {path} ›
                                                    </span>
                                                )}
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-black text-slate-700">{mainName}</span>
                                                    <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">{cat.count} Tickets</span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                                <div
                                                    className="h-full bg-indigo-500 transition-all duration-1000"
                                                    style={{ width: `${(cat.count / (categoryTrends[0]?.count || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Recent Alerts */}
                        <div className="col-span-12 lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Anomalies Detected</h3>
                            <div className="space-y-4">
                                <AlertRow
                                    type="SLA Status"
                                    status={stats.overdue > 0 ? 'error' : 'success'}
                                    message={stats.overdue > 0 ? `There are ${stats.overdue} tickets breaching SLA targets.` : 'All tickets are currently within SLA limits.'}
                                    time="Real-time"
                                    onClick={stats.overdue > 0 ? () => setIsBreachModalOpen(true) : undefined}
                                />
                                <AlertRow
                                    type="Critical Priority"
                                    status={stats.critical > 0 ? 'error' : 'success'}
                                    message={stats.critical > 0 ? `${stats.critical} Critical tickets need immediate response.` : 'No active critical priority tickets found.'}
                                    time="Urgent"
                                />
                                <AlertRow
                                    type="Assignment Status"
                                    status={stats.unassigned > 0 ? 'error' : 'success'}
                                    message={stats.unassigned > 0 ? `${stats.unassigned} tickets are waiting for assignment.` : 'All active tickets have been assigned to agents.'}
                                    time="Attention"
                                />
                                <AlertRow
                                    type="Stale Updates"
                                    status={stats.stale > 0 ? 'error' : 'success'}
                                    message={stats.stale > 0 ? `${stats.stale} tickets haven't been touched for 12h+.` : 'All active tickets have recent activity.'}
                                    time="Delayed"
                                />
                                <AlertRow
                                    type="Agent Workload"
                                    status={agentPerformance.some(a => a.total > 10) ? 'error' : 'success'}
                                    message={agentPerformance.some(a => a.total > 10) ? 'High volume detected on some agents (>10 tickets).' : 'Agent workload is currently within healthy limits.'}
                                    time="Active"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'export' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                    <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Advanced Data Export</h2>
                            <p className="text-sm font-medium text-slate-500 mt-1">Configure filters and export raw incident data to Excel/CSV</p>
                        </div>
                        <button
                            onClick={handleExportExcel}
                            disabled={isExporting}
                            className={`flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all active:scale-95 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isExporting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Download size={16} />
                            )}
                            {isExporting ? 'Exporting...' : 'Export to Excel'}
                        </button>
                    </div>

                    <div className="p-8 bg-slate-50/50 flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={exportSearch}
                                onChange={(e) => setExportSearch(e.target.value)}
                                placeholder="Search ticket number, subject, agent..."
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                            />
                        </div>
                        <select className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none transition-all">
                            <option>All Statuses</option>
                            <option>Open</option>
                            <option>Resolved</option>
                            <option>Closed</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto min-h-[400px] relative">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Loading Report Data...</span>
                                </div>
                            </div>
                        )}
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-[0.15em] border-y border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Ticket #</th>
                                    <th className="px-8 py-5">L1 Agent</th>
                                    <th className="px-8 py-5">L2 Agent</th>
                                    <th className="px-8 py-5 text-center">Response Time</th>
                                    <th className="px-8 py-5 text-center">L1 Handle</th>
                                    <th className="px-8 py-5 text-center">L2 Handle</th>
                                    <th className="px-8 py-5">Closed Time</th>
                                    <th className="px-8 py-5 text-right w-10">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-600">
                                {filteredExportTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-8 py-20 text-center text-slate-400 italic text-sm font-medium">
                                            {isLoading ? 'Fetching data...' : 'No tickets found for this period.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredExportTickets.map((t) => {
                                        // @ts-ignore
                                        const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name) || 'Open';
                                        const isResolved = ['Resolved', 'Closed'].includes(sName);
                                        const breadcrumb = t.category_id ? getBreadcrumb(t.category_id, allCategories) : 'Service Support';

                                        // L1/L2 Smart Processing (L1: 2, 3 | L2: 5)
                                        const logs = (t as any).activity_logs || [];
                                        const creationTime = new Date(t.created_at).getTime();

                                        const l1Roles = [1, 2, 3]; // Include Admin (1)
                                        const l2Roles = [5];

                                        const isRealHuman = (profile: any) => {
                                            if (!profile) return false;
                                            const name = (profile.full_name || '').toLowerCase();
                                            return name &&
                                                !name.includes('system') &&
                                                !name.includes('notify') &&
                                                !name.includes('bot') &&
                                                !name.includes('service desk') &&
                                                !name.includes('triggered') &&
                                                !name.includes('sla');
                                        };

                                        // Better Escalation Log Detection (Find LATEST escalation log to match SLA widget logic)
                                        const escalationLog = [...logs].reverse().find((l: any) => {
                                            const actionLower = (l.action || '').toLowerCase();
                                            if (actionLower.includes('notify') || actionLower.includes('triggered') || actionLower.includes('sla')) return false;
                                            return (actionLower.includes('escalated') && actionLower.includes('l2')) ||
                                                actionLower.includes('ticket escalated') ||
                                                actionLower.includes('escalation');
                                        });

                                        const currAgent = Array.isArray((t as any).assigned_agent) ? (t as any).assigned_agent[0] : (t as any).assigned_agent;

                                        // 1. Identify L1
                                        let l1Name = '-';
                                        const escalatorProfile = escalationLog ? (escalationLog.actor || escalationLog.actor?.[0]) : null;

                                        const l1LogFound = logs.find((l: any) => l1Roles.includes(l.actor?.role_id) && isRealHuman(l.actor));

                                        if (escalatorProfile && isRealHuman(escalatorProfile)) {
                                            l1Name = escalatorProfile.full_name;
                                        } else if (l1LogFound) {
                                            l1Name = (l1LogFound.actor as any)?.full_name || 'L1 Agent';
                                        } else {
                                            if (l1Roles.includes(currAgent?.role_id) && isRealHuman(currAgent)) {
                                                l1Name = currAgent?.full_name || 'L1 Agent';
                                            }
                                        }


                                        // 2. Identify L2: First work log (skipping creation) OR escalation log (must be real human)
                                        const l2LogFound = logs.find((l: any) =>
                                            l2Roles.includes(l.actor?.role_id) &&
                                            isRealHuman(l.actor) &&
                                            !(l.action || '').toLowerCase().includes('created')
                                        );

                                        let l2Name = '-';
                                        if (l2LogFound) {
                                            l2Name = (l2LogFound.actor as any)?.full_name || 'L2 Agent';
                                        } else if (escalationLog) {
                                            const action = escalationLog.action || '';
                                            const l2Match = action.match(/L2 Agent:\s*(.+)/i);
                                            if (l2Match) {
                                                const matchedName = l2Match[1].trim();
                                                if (matchedName.length < 50 && !matchedName.toLowerCase().includes('notify')) {
                                                    l2Name = matchedName;
                                                }
                                            } else if (action.toLowerCase().includes('escalated to')) {
                                                const parts = action.split(':');
                                                if (parts.length > 1) {
                                                    const possibleName = parts[1].trim();
                                                    if (possibleName.length < 50 && !possibleName.toLowerCase().includes('notify')) {
                                                        l2Name = possibleName;
                                                    }
                                                }
                                            }
                                        }

                                        if (l2Name === '-' && l2Roles.includes(currAgent?.role_id) && isRealHuman(currAgent)) {
                                            l2Name = currAgent.full_name || 'L2 Agent';
                                        }

                                        // Find Resolved Log to get accurate terminal time
                                        const resolvedLog = logs.find((l: any) =>
                                            (l.action || '').toLowerCase().includes('to resolved') ||
                                            ((l.action || '').toLowerCase().includes('status') && (l.action || '').toLowerCase().includes('resolved'))
                                        );

                                        const terminalTime = resolvedLog ? new Date(resolvedLog.created_at).getTime() :
                                            (isResolved ? new Date(t.updated_at).getTime() : new Date().getTime());

                                        // === TIMING LOGIC (v5 - Split Pause Correcty) ===
                                        const sortedLogs = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                                        // 1. First Response Time (from logs)
                                        const firstReplyLog = sortedLogs.find((l: any) =>
                                            (l.action || '').toLowerCase().includes('agent replied')
                                        );
                                        const firstReplyTime = firstReplyLog ? new Date(firstReplyLog.created_at).getTime() : null;

                                        const responseTimeMs = firstReplyTime ? (firstReplyTime - creationTime) : 0;
                                        const responseTimeMins = Math.floor(responseTimeMs / 60000);
                                        const responseTimeH = responseTimeMins / 60;

                                        // 2. L1/L2 Handle Time with Pause Splitting
                                        const totalPausedMins = (t as any).total_paused_minutes || 0;
                                        const escalationTime = escalationLog ? new Date(escalationLog.created_at).getTime() : null;

                                        let finalL1H = 0;
                                        let finalL2H = 0;

                                        if (escalationTime && escalationTime > creationTime) {
                                            const rawL1Mins = Math.floor((escalationTime - creationTime) / 60000);
                                            const rawL2Mins = Math.floor((terminalTime - escalationTime) / 60000);

                                            // Match SLA Widget: L1 resolution is clock time, L2 resolution absorbs the pause
                                            const l1Mins = rawL1Mins;
                                            const l2Mins = Math.max(0, rawL2Mins - totalPausedMins);

                                            finalL1H = l1Mins / 60;
                                            finalL2H = l2Mins / 60;
                                        } else {
                                            const rawTotalMins = Math.floor((terminalTime - creationTime) / 60000);
                                            const activeMins = Math.max(0, rawTotalMins - totalPausedMins);
                                            finalL1H = activeMins / 60;
                                        }



                                        const sla = checkTicketSla(t, statusMap);

                                        return (
                                            <tr key={t.id} className="hover:bg-indigo-50/10 transition-colors group">
                                                <td className="px-8 py-5 border-l-4 border-transparent group-hover:border-indigo-500">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 text-xs font-black group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors uppercase">
                                                            {t.ticket_type?.toLowerCase().includes('incident') ? 'INC' :
                                                                t.ticket_type?.toLowerCase().includes('change') ? 'CHR' : 'REQ'}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black text-slate-900 tracking-tight uppercase">{t.ticket_number}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{breadcrumb}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 font-bold text-xs">{l1Name}</td>
                                                <td className="px-8 py-5 font-bold text-xs">{l2Name}</td>
                                                <td className="px-8 py-5 font-black text-xs text-blue-600 text-center">
                                                    {formatHandleTime(responseTimeH)}
                                                </td>
                                                <td className="px-8 py-5 font-black text-xs text-slate-700 text-center">
                                                    {formatHandleTime(finalL1H)}
                                                </td>
                                                <td className={`px-8 py-5 font-black text-xs text-center ${finalL2H > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {formatHandleTime(finalL2H)}
                                                </td>
                                                <td className="px-8 py-5 text-xs font-bold text-slate-400 italic">
                                                    {isResolved ? new Date(t.updated_at).toLocaleString() : '-'}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all 
                                                        ${isResolved
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                            : sName === 'Canceled' ? 'bg-slate-100 text-slate-400 border-slate-200'
                                                                : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                        {sName}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SLA Breach Modal */}
            {isBreachModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] border border-slate-100">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">SLA Breached Tickets</h3>
                                <p className="text-sm font-bold text-slate-400 mt-1">Found {breachedTickets.length} tickets exceeding target resolution time</p>
                            </div>
                            <button
                                onClick={() => setIsBreachModalOpen(false)}
                                className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-0 bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10">
                                    <tr>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ticket</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Agent</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Priority</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Target</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actual</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breachedTickets.map((t) => {
                                        const targetH = (t.targetMins / 60).toFixed(1);
                                        const actualH = (t.actualMins / 60).toFixed(1);
                                        // @ts-ignore
                                        const aName = t.assigned_agent?.full_name || t.assigned_agent?.[0]?.full_name || 'Unassigned';
                                        // @ts-ignore
                                        const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name) || 'Open';

                                        return (
                                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-4 border-b border-slate-50">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase">{t.ticket_number}</span>
                                                        <span className="text-xs font-bold text-slate-400 truncate max-w-[200px]">{t.subject}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4 border-b border-slate-50 text-xs font-bold text-slate-600">{aName}</td>
                                                <td className="px-8 py-4 border-b border-slate-50 text-center">
                                                    <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border 
                                                        ${t.priority === 'Critical' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                            t.priority?.includes('High') ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                        {t.priority}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-4 border-b border-slate-50 text-right text-xs font-bold text-slate-400">{targetH}h</td>
                                                <td className="px-8 py-4 border-b border-slate-50 text-right text-xs font-black text-rose-600">{actualH}h</td>
                                                <td className="px-8 py-4 border-b border-slate-50 text-right">
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-lg">
                                                        {sName}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setIsBreachModalOpen(false)}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-components for cleaner UI
const KPICard = ({ title, value, trend, trendUp, icon, bg }: { title: string, value: string, trend: string, trendUp: boolean, icon: React.ReactElement<any>, bg: string }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all border-b-4 hover:border-b-indigo-500">
        <div className="flex justify-between items-start">
            <div className={`p-3 rounded-2xl ${bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                {React.cloneElement(icon, { size: 20 })}
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {trend}
            </div>
        </div>
        <div className="mt-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{title}</h3>
            <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
        </div>
    </div>
);

const AlertRow = ({ type, message, time, onClick, status = 'error' }: any) => (
    <div
        onClick={onClick}
        className={`flex items-start gap-4 p-4 rounded-2xl border transition-all 
            ${status === 'error' ? 'border-rose-50 bg-rose-50/20' : 'border-emerald-50 bg-emerald-50/20'} 
            ${onClick ? 'cursor-pointer hover:bg-white hover:shadow-md active:scale-[0.98]' : ''}`}
    >
        <div className={`p-2 rounded-xl shadow-sm border ${status === 'error' ? 'bg-white text-rose-500 border-rose-100' : 'bg-white text-emerald-500 border-emerald-100'}`}>
            {status === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        </div>
        <div className="flex-1">
            <div className="flex justify-between mb-1">
                <span className={`text-[10px] font-black uppercase tracking-widest ${status === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>{type}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{time}</span>
            </div>
            <p className={`text-xs font-bold leading-relaxed ${status === 'error' ? 'text-slate-700' : 'text-emerald-700'}`}>{message}</p>
        </div>
        {onClick && <ChevronRight size={16} className="text-slate-300 mt-4 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />}
    </div>
);

export default ReportsView;
