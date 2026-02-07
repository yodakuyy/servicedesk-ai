import React, { useState, useEffect } from 'react';
import {
    BarChart3, FileSpreadsheet, Clock, AlertTriangle,
    Download, Filter, Calendar, TrendingUp, Users,
    ArrowUpRight, ArrowDownRight, Search, ChevronLeft, ChevronRight,
    TrendingDown, CheckCircle2, Package, FileText, GitBranch, X
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
    LineChart, Line
} from 'recharts';
import { supabase } from '../lib/supabase';

// Helper for Business Hours Calculation
const calculateBusinessElapsed = (startDate: Date, endDate: Date, schedule: any[]) => {
    if (!schedule || schedule.length === 0) return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));

    let elapsedMinutes = 0;
    let currentDate = new Date(startDate);

    while (currentDate < endDate) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[currentDate.getDay()];
        const dayConfig = schedule.find((d: any) => d.day === dayName);

        if (!dayConfig || !dayConfig.isActive) {
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
            continue;
        }

        const [startH, startM] = dayConfig.startTime.split(':').map(Number);
        const [endH, endM] = dayConfig.endTime.split(':').map(Number);

        const workStart = new Date(currentDate);
        workStart.setHours(startH, startM, 0, 0);
        const workEnd = new Date(currentDate);
        workEnd.setHours(endH, endM, 0, 0);

        let segmentStart = currentDate < workStart ? workStart : currentDate;
        let segmentEnd = endDate < workEnd ? endDate : workEnd;

        if (segmentStart < segmentEnd) {
            if (dayConfig.breakActive) {
                const [bStartH, bStartM] = dayConfig.breakStartTime.split(':').map(Number);
                const [bEndH, bEndM] = dayConfig.breakEndTime.split(':').map(Number);
                const bStart = new Date(segmentStart); bStart.setHours(bStartH, bStartM, 0, 0);
                const bEnd = new Date(segmentStart); bEnd.setHours(bEndH, bEndM, 0, 0);

                if (segmentStart < bStart && segmentEnd > bEnd) {
                    elapsedMinutes += (bStart.getTime() - segmentStart.getTime()) / 60000;
                    elapsedMinutes += (segmentEnd.getTime() - bEnd.getTime()) / 60000;
                } else if (segmentEnd <= bStart || segmentStart >= bEnd) {
                    elapsedMinutes += (segmentEnd.getTime() - segmentStart.getTime()) / 60000;
                } else if (segmentStart < bStart) {
                    elapsedMinutes += (bStart.getTime() - segmentStart.getTime()) / 60000;
                } else if (segmentEnd > bEnd) {
                    elapsedMinutes += (segmentEnd.getTime() - bEnd.getTime()) / 60000;
                }
            } else {
                elapsedMinutes += (segmentEnd.getTime() - segmentStart.getTime()) / 60000;
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
    }
    return Math.floor(elapsedMinutes);
};

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
    const [exportStatus, setExportStatus] = useState('All');
    const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
    const [slaTargets, setSlaTargets] = useState<any[]>([]);
    const [allCategories, setAllCategories] = useState<any[]>([]);
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);
    const [drillDown, setDrillDown] = useState<{ title: string, tickets: any[] } | null>(null);
    const [exportTicketType, setExportTicketType] = useState<'all' | 'incident' | 'service' | 'change'>('all');
    const [slaTicketType, setSlaTicketType] = useState<'all' | 'incident' | 'service' | 'change'>('all');

    // Pagination States
    const [exportPage, setExportPage] = useState(1);
    const [slaPage, setSlaPage] = useState(1);
    const [drillDownPage, setDrillDownPage] = useState(1);
    const [breachPage, setBreachPage] = useState(1);
    const itemsPerPage = 10;

    // Reset pages on state changes
    useEffect(() => { setExportPage(1); }, [exportSearch, exportStatus, dateRange, exportTicketType]);
    useEffect(() => { setSlaPage(1); }, [dateRange, slaTicketType]);
    useEffect(() => { setDrillDownPage(1); }, [drillDown]);
    useEffect(() => { setBreachPage(1); }, [isBreachModalOpen]);
    useEffect(() => { setExportPage(1); setSlaPage(1); }, [activeTab]);

    const checkTicketSla = (t: any, policies: any[] = [], targets: any[] = []) => {
        const sName = (t.ticket_statuses?.status_name || (Array.isArray(t.ticket_statuses) ? t.ticket_statuses[0]?.status_name : null))?.toLowerCase();
        const isCanceled = sName === 'canceled' || sName === 'cancelled';
        const isTerminal = ['resolved', 'closed', 'canceled', 'cancelled'].includes(sName);

        // 1. Find Matching Policy
        const matchingPolicy = policies.find(policy => {
            if (!policy.conditions || !Array.isArray(policy.conditions)) return false;
            return policy.conditions.every((cond: any) => {
                let ticketVal: any;
                switch (cond.field) {
                    case 'ticket_type': ticketVal = t.ticket_type; break;
                    case 'priority': ticketVal = t.priority; break;
                    default: return true;
                }
                if (!ticketVal) return false;
                const valLower = String(cond.value).toLowerCase();
                const ticketValLower = String(ticketVal).toLowerCase();
                if (cond.operator === 'equals' || !cond.operator) return ticketValLower === valLower;
                return true;
            });
        });

        const resTargetObj = targets.find(tgt => tgt.sla_policy_id === matchingPolicy?.id && tgt.sla_type === 'resolution' && tgt.priority?.toLowerCase() === (t.priority || 'Medium').toLowerCase());
        const respTargetObj = targets.find(tgt => tgt.sla_policy_id === matchingPolicy?.id && tgt.sla_type === 'response' && tgt.priority?.toLowerCase() === (t.priority || 'Medium').toLowerCase());

        const baseTarget = resTargetObj?.target_minutes || 480;
        const respTarget = respTargetObj?.target_minutes || baseTarget / 4;

        const startTime = new Date(t.created_at);
        const schedule = t.group?.business_hours?.weekly_schedule || [];

        // 2. Response SLA
        const hasResponded = !!t.first_response_at;
        let respElapsed = 0;
        if (hasResponded) {
            respElapsed = calculateBusinessElapsed(startTime, new Date(t.first_response_at), schedule);
        } else {
            respElapsed = calculateBusinessElapsed(startTime, new Date(), schedule);
        }
        respElapsed = Math.max(0, respElapsed - (t.total_paused_minutes || 0));

        const isResponseOverdue = !isCanceled && respElapsed > respTarget;

        // 3. Resolution SLA
        const stopLog = (t.activity_logs || []).find((l: any) => {
            const actionLower = (l.action || '').toLowerCase();
            return actionLower.includes('resolved') ||
                actionLower.includes('closed') ||
                actionLower.includes('canceled') ||
                actionLower.includes('cancelled');
        });

        // Terminal stop time fallback: prefer stopLog, then updated_at
        const effectiveStopTime = stopLog?.created_at || (isTerminal ? t.updated_at : null);
        const resolutionTime = effectiveStopTime ? new Date(effectiveStopTime) : new Date();

        let resolveElapsed = calculateBusinessElapsed(startTime, resolutionTime, schedule);
        const netResolve = Math.max(0, resolveElapsed - (t.total_paused_minutes || 0));

        const isResolveOverdue = !isCanceled && netResolve > baseTarget;

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
                    total_paused_minutes, status_id, category_id, assignment_group_id,
                    ticket_statuses!fk_tickets_status (status_name),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name, role_id),
                    group:groups!assignment_group_id (
                        id, 
                        business_hours (weekly_schedule)
                    )
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

                // 1.6 Fetch Messages to find first real agent response
                const { data: msgData } = await supabase
                    .from('ticket_messages')
                    .select('id, ticket_id, sender_id, sender_role, created_at')
                    .in('ticket_id', tIds)
                    .eq('is_internal', false)
                    .order('created_at', { ascending: true });

                const firstRespMap = new Map();
                if (msgData) {
                    msgData.forEach(m => {
                        if (!firstRespMap.has(m.ticket_id) && m.sender_role !== 'requester') {
                            firstRespMap.set(m.ticket_id, m.created_at);
                        }
                    });
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
                    activity_logs: logsWithActor.filter((l: any) => l.ticket_id === t.id),
                    first_response_at: firstRespMap.get(t.id)
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
                    const sla = checkTicketSla(t, pRes.data || [], tRes.data || []);
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

                // E. Recent Tickets (For export table preview) - Use validTickets to match stats (exclude canceled)
                setRecentTickets(validTickets);
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

    const filteredExportTickets = recentTickets.filter(t => {
        const sName = ((t as any).ticket_statuses?.status_name || (t as any).ticket_statuses?.[0]?.status_name) || 'Open';
        const ticketType = (t.ticket_type || '').toLowerCase();

        const matchesSearch = t.ticket_number?.toLowerCase().includes(exportSearch.toLowerCase()) ||
            t.subject?.toLowerCase().includes(exportSearch.toLowerCase()) ||
            t.assigned_agent?.full_name?.toLowerCase().includes(exportSearch.toLowerCase());

        const matchesStatus = exportStatus === 'All' || sName.toLowerCase() === exportStatus.toLowerCase();

        const matchesTicketType = exportTicketType === 'all' ||
            (exportTicketType === 'incident' && ticketType === 'incident') ||
            (exportTicketType === 'service' && (ticketType === 'service request' || ticketType === 'request')) ||
            (exportTicketType === 'change' && (ticketType === 'change request' || ticketType === 'change'));

        return matchesSearch && matchesStatus && matchesTicketType;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // SLA Tab Analytics
    const slaDetailsData = React.useMemo(() => {
        if (!recentTickets.length) return null;

        const validTickets = recentTickets.filter((t: any) => {
            const sName = ((t as any).ticket_statuses?.status_name || (t as any).ticket_statuses?.[0]?.status_name)?.toLowerCase();
            return sName !== 'canceled';
        });

        // 1. SLA by Priority
        const priorities = ['Critical', 'High', 'Medium', 'Low'];
        const priorityStats: Record<string, { withinSla: number, overdue: number }> = {};
        priorities.forEach(p => priorityStats[p] = { withinSla: 0, overdue: 0 });

        validTickets.forEach(t => {
            const sla = checkTicketSla(t, slaPolicies, slaTargets);
            const prio = (t.priority || 'Medium').toLowerCase();

            let key = 'Medium';
            if (prio.includes('critical')) key = 'Critical';
            else if (prio.includes('high')) key = 'High';
            else if (prio.includes('low')) key = 'Low';

            if (sla.isResolveOverdue) priorityStats[key].overdue++;
            else priorityStats[key].withinSla++;
        });

        const priorityChart = priorities.map(name => ({
            name,
            withinSla: priorityStats[name].withinSla,
            overdue: priorityStats[name].overdue
        }));

        // 2. Average Times
        let totalResp = 0;
        let totalReso = 0;
        let respCount = 0;
        let resoCount = 0;

        validTickets.forEach(t => {
            const sla = checkTicketSla(t, slaPolicies, slaTargets);
            const sName = ((t as any).ticket_statuses?.status_name || (t as any).ticket_statuses?.[0]?.status_name)?.toLowerCase();

            // Response time
            const hasResponded = !['open', 'new'].includes(sName);
            if (hasResponded) {
                totalResp += sla.respElapsed;
                respCount++;
            }

            // Resolution time
            if (['resolved', 'closed'].includes(sName)) {
                totalReso += sla.netResolve;
                resoCount++;
            }
        });

        const avgResp = respCount > 0 ? (totalResp / respCount).toFixed(0) : '0';
        const avgReso = resoCount > 0 ? (totalReso / resoCount / 60).toFixed(1) : '0';

        // 3. Category Breaches
        const catBreaches: Record<string, number> = {};
        validTickets.forEach(t => {
            const sla = checkTicketSla(t, slaPolicies, slaTargets);
            if (sla.isResolveOverdue) {
                const catName = t.category_id ? getBreadcrumb(t.category_id, allCategories).split(' › ').pop() : 'Uncategorized';
                catBreaches[catName || 'Other'] = (catBreaches[catName || 'Other'] || 0) + 1;
            }
        });

        const categoryChart = Object.entries(catBreaches)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const breachedTicketsCount = validTickets.filter(t => checkTicketSla(t, slaPolicies, slaTargets).isResolveOverdue).length;
        const metCount = validTickets.length - breachedTicketsCount;
        const complianceRate = validTickets.length > 0 ? ((metCount / validTickets.length) * 100).toFixed(1) : '100';

        // 4. Daily Trend
        const trendMap: Record<string, { date: string, withinSla: number, overdue: number }> = {};
        validTickets.forEach(t => {
            const date = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!trendMap[date]) trendMap[date] = { date, withinSla: 0, overdue: 0 };

            const sla = checkTicketSla(t, slaPolicies, slaTargets);
            if (sla.isResolveOverdue) trendMap[date].overdue++;
            else trendMap[date].withinSla++;
        });

        const trendChart = Object.values(trendMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            metCount,
            overdueCount: breachedTicketsCount,
            avgResp,
            avgReso,
            totalTickets: validTickets.length,
            complianceRate,
            priorityChart,
            categoryChart,
            trendChart
        };
    }, [recentTickets, slaPolicies, slaTargets, allCategories]);

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

            // Apply UI Filters to the export data
            const filteredTickets = (tickets || []).filter(t => {
                const sName = ((t as any).ticket_statuses?.status_name || (t as any).ticket_statuses?.[0]?.status_name) || 'Open';
                const agentName = (Array.isArray(t.assigned_agent) ? t.assigned_agent[0] : t.assigned_agent)?.full_name || '';

                const matchesSearch = t.ticket_number?.toLowerCase().includes(exportSearch.toLowerCase()) ||
                    t.subject?.toLowerCase().includes(exportSearch.toLowerCase()) ||
                    agentName.toLowerCase().includes(exportSearch.toLowerCase());

                const matchesStatus = exportStatus === 'All' || sName.toLowerCase() === exportStatus.toLowerCase();

                return matchesSearch && matchesStatus;
            });

            if (filteredTickets.length === 0) {
                const Swal = (await import('sweetalert2')).default;
                Swal.fire({
                    icon: 'info',
                    title: 'No Results',
                    text: 'No tickets match your current search and status filters.',
                    confirmButtonColor: '#4f46e5'
                });
                return;
            }

            // Fetch activity logs for L1/L2 logic and precise timing
            const tIds = filteredTickets.map((t: any) => t.id);
            const { data: logData, error: logError } = await supabase
                .from('ticket_activity_log')
                .select('id, ticket_id, actor_id, action, created_at')
                .in('ticket_id', tIds)
                .order('created_at', { ascending: true });

            // Fetch actor profiles separately for L1/L2 agent names
            const logActorIds = (logData || []).map((l: any) => l.actor_id);
            const assignedIds = (filteredTickets || []).map((t: any) => (Array.isArray(t.assigned_agent) ? t.assigned_agent[0] : t.assigned_agent)?.id).filter(Boolean);
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

            const excelRows = filteredTickets.map(t => {
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

                const l1LogFound = [...logs].reverse().find((l: any) => {
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

                // L2 Calculation: find LATEST log by L2 roles (excluding creation, must be real human)
                const l2LogFound = [...logs].reverse().find((l: any) => {
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

                const sla = checkTicketSla(ticket, slaPolicies, slaTargets);
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
                            onClick={() => {
                                const list = recentTickets.filter((t: any) => t.ticket_type?.toLowerCase() === 'incident');
                                setDrillDown({ title: 'Incident Tickets', tickets: list });
                            }}
                        />
                        <KPICard
                            title="Service Requests"
                            value={stats.serviceRequests.toString()}
                            trend="+0%"
                            trendUp={true}
                            icon={<FileText className="text-emerald-600" />}
                            bg="bg-emerald-50"
                            onClick={() => {
                                const list = recentTickets.filter((t: any) => t.ticket_type?.toLowerCase()?.includes('request'));
                                setDrillDown({ title: 'Service Request Tickets', tickets: list });
                            }}
                        />
                        <KPICard
                            title="Change Requests"
                            value={stats.changeRequests.toString()}
                            trend="+0%"
                            trendUp={true}
                            icon={<GitBranch className="text-blue-600" />}
                            bg="bg-blue-50"
                            onClick={() => {
                                const list = recentTickets.filter((t: any) => t.ticket_type?.toLowerCase()?.includes('change'));
                                setDrillDown({ title: 'Change Request Tickets', tickets: list });
                            }}
                        />
                        <KPICard
                            title="Total Tickets"
                            value={stats.total.toString()}
                            trend="+0"
                            trendUp={true}
                            icon={<BarChart3 className="text-rose-600" />}
                            bg="bg-rose-50"
                            onClick={() => setDrillDown({ title: 'All Tickets In Period', tickets: recentTickets })}
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
                                    message={stats.overdue > 0 ? `There are ${stats.overdue} tickets exceeding SLA Resolution targets.` : 'All tickets are currently within resolution limits.'}
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
                        <select
                            value={exportStatus}
                            onChange={(e) => setExportStatus(e.target.value)}
                            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none transition-all cursor-pointer hover:border-indigo-400"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="Pending">Pending</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                            <option value="Canceled">Canceled</option>
                        </select>
                        <select
                            value={exportTicketType}
                            onChange={(e: any) => setExportTicketType(e.target.value)}
                            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none transition-all cursor-pointer hover:border-indigo-400"
                        >
                            <option value="all">All Types</option>
                            <option value="incident">Incidents</option>
                            <option value="service">Service Requests</option>
                            <option value="change">Change Requests</option>
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
                                    filteredExportTickets
                                        .slice((exportPage - 1) * itemsPerPage, exportPage * itemsPerPage)
                                        .map((t) => {
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

                                            const escalationLog = [...logs].reverse().find((l: any) => {
                                                const actionLower = (l.action || '').toLowerCase();
                                                if (actionLower.includes('notify') || actionLower.includes('triggered') || actionLower.includes('sla')) return false;
                                                return (actionLower.includes('escalated') && actionLower.includes('l2')) ||
                                                    actionLower.includes('ticket escalated') ||
                                                    actionLower.includes('escalation');
                                            });

                                            const currAgent = Array.isArray((t as any).assigned_agent) ? (t as any).assigned_agent[0] : (t as any).assigned_agent;
                                            let l1Name = '-';
                                            const escalatorProfile = escalationLog ? (escalationLog.actor || escalationLog.actor?.[0]) : null;
                                            const l1LogFound = [...logs].reverse().find((l: any) => l1Roles.includes(l.actor?.role_id) && isRealHuman(l.actor));
                                            if (escalatorProfile && isRealHuman(escalatorProfile)) {
                                                l1Name = escalatorProfile.full_name;
                                            } else if (l1LogFound) {
                                                l1Name = (l1LogFound.actor as any)?.full_name || 'L1 Agent';
                                            } else {
                                                if (l1Roles.includes(currAgent?.role_id) && isRealHuman(currAgent)) {
                                                    l1Name = currAgent?.full_name || 'L1 Agent';
                                                }
                                            }

                                            const l2LogFound = [...logs].reverse().find((l: any) =>
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

                                            const resolvedLog = logs.find((l: any) =>
                                                (l.action || '').toLowerCase().includes('to resolved') ||
                                                ((l.action || '').toLowerCase().includes('status') && (l.action || '').toLowerCase().includes('resolved'))
                                            );
                                            const terminalTime = resolvedLog ? new Date(resolvedLog.created_at).getTime() :
                                                (isResolved ? new Date(t.updated_at).getTime() : new Date().getTime());
                                            const sortedLogs = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                            const firstReplyLog = sortedLogs.find((l: any) => (l.action || '').toLowerCase().includes('agent replied'));
                                            const firstReplyTime = firstReplyLog ? new Date(firstReplyLog.created_at).getTime() : null;
                                            const responseTimeMs = firstReplyTime ? (firstReplyTime - creationTime) : 0;
                                            const responseTimeMins = Math.floor(responseTimeMs / 60000);
                                            const responseTimeH = responseTimeMins / 60;
                                            const totalPausedMins = (t as any).total_paused_minutes || 0;
                                            const escalationTime = escalationLog ? new Date(escalationLog.created_at).getTime() : null;
                                            let finalL1H = 0;
                                            let finalL2H = 0;
                                            if (escalationTime && escalationTime > creationTime) {
                                                const rawL1Mins = Math.floor((escalationTime - creationTime) / 60000);
                                                const rawL2Mins = Math.floor((terminalTime - escalationTime) / 60000);
                                                finalL1H = rawL1Mins / 60;
                                                finalL2H = Math.max(0, rawL2Mins - totalPausedMins) / 60;
                                            } else {
                                                const rawTotalMins = Math.floor((terminalTime - creationTime) / 60000);
                                                finalL1H = Math.max(0, rawTotalMins - totalPausedMins) / 60;
                                            }
                                            const sla = checkTicketSla(t, slaPolicies, slaTargets);

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
                    <Pagination
                        currentPage={exportPage}
                        totalItems={filteredExportTickets.length}
                        onPageChange={setExportPage}
                        itemsPerPage={itemsPerPage}
                    />
                </div>
            )}


            {
                activeTab === 'sla' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* SLA Scorecard */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance Rate</p>
                                        <h4 className="text-2xl font-black text-slate-900">{slaDetailsData?.complianceRate}%</h4>
                                    </div>
                                </div>
                                <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-1000"
                                        style={{ width: `${slaDetailsData?.complianceRate}%` }}
                                    />
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
                                        <AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SLA Overdue</p>
                                        <h4 className="text-2xl font-black text-rose-600">{slaDetailsData?.overdueCount} <span className="text-xs text-slate-400 font-bold">Tickets</span></h4>
                                    </div>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Requires immediate attention</p>
                            </div>

                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Clock size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Response</p>
                                        <h4 className="text-2xl font-black text-slate-900">{slaDetailsData?.avgResp} <span className="text-xs text-slate-400 font-bold">Mins</span></h4>
                                    </div>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">From creation to first action</p>
                            </div>

                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Resolution</p>
                                        <h4 className="text-2xl font-black text-slate-900">{slaDetailsData?.avgReso} <span className="text-xs text-slate-400 font-bold">Hours</span></h4>
                                    </div>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Active work time per ticket</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-8">
                            {/* Priority Fulfillment Chart */}
                            <div className="col-span-12 lg:col-span-7 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Priority Fulfillment</h3>
                                        <p className="text-sm font-medium text-slate-500 mt-1">Within SLA vs Overdue per Priority level</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Within SLA</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-rose-500" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overdue</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={slaDetailsData?.priorityChart} barGap={8}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                labelStyle={{ fontWeight: 900, marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}
                                            />
                                            <Bar dataKey="withinSla" name="Within SLA" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                            <Bar dataKey="overdue" name="Overdue" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Category Overdue List */}
                            <div className="col-span-12 lg:col-span-5 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col">
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-8">Top Category Overdue</h3>
                                <div className="flex-1 space-y-6">
                                    {slaDetailsData?.categoryChart.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                                            <CheckCircle2 size={48} className="text-emerald-500 opacity-20" />
                                            <p className="text-xs font-black uppercase tracking-widest">No overdue detected!</p>
                                        </div>
                                    ) : (
                                        slaDetailsData?.categoryChart.map((cat, idx) => (
                                            <div key={idx} className="space-y-2">
                                                <div className="flex justify-between items-center text-xs font-black text-slate-700">
                                                    <span className="uppercase tracking-tight">{cat.name}</span>
                                                    <span className="text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">{cat.count} Overdue</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-rose-500 transition-all duration-1000"
                                                        style={{ width: `${(cat.count / (slaDetailsData?.categoryChart[0].count || 1)) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="mt-8 pt-6 border-t border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed uppercase tracking-widest">
                                        Focus on these categories to improve overall service quality and SLA compliance.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Daily Trend Chart */}
                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm mt-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Daily Resolution Trend</h3>
                                    <p className="text-sm font-medium text-slate-500 mt-1">SLA performance stability over the selected period</p>
                                </div>
                                <div className="flex gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-lg shadow-indigo-100" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Within SLA</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-100" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overdue</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={slaDetailsData?.trendChart}>
                                        <defs>
                                            <linearGradient id="colorMet" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                            labelStyle={{ fontWeight: 900, marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="withinSla"
                                            name="Within SLA"
                                            stroke="#6366f1"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorMet)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="overdue"
                                            name="Overdue"
                                            stroke="#f43f5e"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorOverdue)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* SLA Performance Details Table */}
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden mt-8">
                            <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">SLA Performance Details</h3>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Detailed SLA metrics for all tickets in the selected period</p>
                                </div>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    {['all', 'incident', 'service', 'change'].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setSlaTicketType(type as any)}
                                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${slaTicketType === type
                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {type === 'all' ? 'All' : type === 'service' ? 'Service Req' : type === 'change' ? 'Change Req' : 'Incidents'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left whitespace-nowrap">
                                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-widest border-y border-slate-100">
                                        <tr>
                                            <th className="px-8 py-4">Ticket</th>
                                            <th className="px-8 py-4">Priority</th>
                                            <th className="px-8 py-4 text-center">Response SLA</th>
                                            <th className="px-8 py-4 text-center">L1 Resolution</th>
                                            <th className="px-8 py-4 text-center">L2 Resolution</th>
                                            <th className="px-8 py-4 text-right">Net Resolution</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {recentTickets.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-8 py-20 text-center text-slate-400 italic text-sm font-medium">
                                                    No tickets found for SLA tracking.
                                                </td>
                                            </tr>
                                        ) : (
                                            recentTickets
                                                .filter((t: any) => {
                                                    const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name)?.toLowerCase();
                                                    const ticketType = (t.ticket_type || '').toLowerCase();

                                                    const matchesType = slaTicketType === 'all' ||
                                                        (slaTicketType === 'incident' && ticketType === 'incident') ||
                                                        (slaTicketType === 'service' && (ticketType === 'service request' || ticketType === 'request')) ||
                                                        (slaTicketType === 'change' && (ticketType === 'change request' || ticketType === 'change'));

                                                    return sName !== 'canceled' && matchesType;
                                                })
                                                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                .slice((slaPage - 1) * itemsPerPage, slaPage * itemsPerPage)
                                                .map((t: any) => {
                                                    const sla = checkTicketSla(t, slaPolicies, slaTargets);

                                                    // Check if ticket was escalated to L2 (strict detection)
                                                    const logs = t.activity_logs || [];
                                                    const escalationLog = logs.find((l: any) => {
                                                        const actionLower = (l.action || '').toLowerCase();
                                                        // Must explicitly mention L2 escalation
                                                        const hasEscalatedToL2 = (actionLower.includes('escalated') && (actionLower.includes('l2') || actionLower.includes('level 2')));
                                                        const hasAssignedToL2 = actionLower.includes('assigned to l2');
                                                        const hasTransferToL2 = actionLower.includes('transfer') && actionLower.includes('l2');
                                                        // Exclude notifications and SLA triggers
                                                        const isNotification = actionLower.includes('notify') || actionLower.includes('triggered') || actionLower.includes('sla');

                                                        return (hasEscalatedToL2 || hasAssignedToL2 || hasTransferToL2) && !isNotification;
                                                    });
                                                    const isEscalated = !!escalationLog;

                                                    // Calculate L2 resolution time if escalated
                                                    let l2Status = 'n/a';
                                                    if (isEscalated) {
                                                        const escalationTime = new Date(escalationLog.created_at).getTime();
                                                        const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name)?.toLowerCase();
                                                        const isTerminal = ['resolved', 'closed'].includes(sName);

                                                        const terminalLog = logs.find((l: any) => {
                                                            const actionLower = (l.action || '').toLowerCase();
                                                            return actionLower.includes('resolved') || actionLower.includes('closed');
                                                        });

                                                        const endTime = terminalLog ? new Date(terminalLog.created_at).getTime() :
                                                            (isTerminal ? new Date(t.updated_at).getTime() : Date.now());

                                                        const l2ElapsedMins = Math.max(0, (endTime - escalationTime) / 60000 - (t.total_paused_minutes || 0));
                                                        const l2TargetMins = sla.baseTarget || 480;

                                                        l2Status = l2ElapsedMins > l2TargetMins ? 'overdue' : 'within';
                                                    }

                                                    return (
                                                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-8 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-black text-slate-900 uppercase">{t.ticket_number}</span>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{t.subject}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-4">
                                                                <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border 
                                                                    ${t.priority === 'Critical' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                                        t.priority?.includes('High') ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                            'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                                    {t.priority}
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-4 text-center">
                                                                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${sla.isResponseOverdue ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                    {sla.isResponseOverdue ? 'Overdue' : 'Within SLA'}
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-4 text-center">
                                                                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${sla.isResolveOverdue ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                    {sla.isResolveOverdue ? 'Overdue' : 'Within SLA'}
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-4 text-center">
                                                                {isEscalated ? (
                                                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${l2Status === 'overdue' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                        {l2Status === 'overdue' ? 'Overdue' : 'Within SLA'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-lg">L1 Only</span>
                                                                )}
                                                            </td>
                                                            <td className="px-8 py-4 text-right">
                                                                <span className="text-xs font-black text-slate-700">
                                                                    {formatHandleTime(sla.netResolve / 60)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                currentPage={slaPage}
                                totalItems={slaDetailsData?.totalTickets || 0}
                                onPageChange={setSlaPage}
                                itemsPerPage={itemsPerPage}
                            />
                        </div>
                    </div>
                )
            }

            {/* SLA Breach Modal */}
            {
                isBreachModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] border border-slate-100">
                            {/* Header */}
                            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white">
                                <div>
                                    <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">SLA Overdue Tickets</h3>
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
                                        {breachedTickets
                                            .slice((breachPage - 1) * itemsPerPage, breachPage * itemsPerPage)
                                            .map((t) => {
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

                            <Pagination
                                currentPage={breachPage}
                                totalItems={breachedTickets.length}
                                onPageChange={setBreachPage}
                                itemsPerPage={itemsPerPage}
                            />

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
                )
            }

            {/* Drill Down Modal */}
            {
                drillDown && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] border border-slate-100">
                            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">{drillDown.title}</h3>
                                    <p className="text-sm font-bold text-slate-400 mt-1">Showing {drillDown.tickets.length} tickets for the selected period</p>
                                </div>
                                <button
                                    onClick={() => setDrillDown(null)}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-0">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10">
                                        <tr>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ticket</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Agent</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Category</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Priority</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drillDown.tickets
                                            .slice((drillDownPage - 1) * itemsPerPage, drillDownPage * itemsPerPage)
                                            .map((t: any) => {
                                                const aName = t.assigned_agent?.full_name || t.assigned_agent?.[0]?.full_name || 'Unassigned';
                                                const sName = (t.ticket_statuses?.status_name || t.ticket_statuses?.[0]?.status_name) || 'Open';
                                                return (
                                                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-50">
                                                        <td className="px-8 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-slate-900 uppercase">{t.ticket_number}</span>
                                                                <span className="text-xs font-bold text-slate-400 truncate max-w-[250px]">{t.subject}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-4 text-xs font-bold text-slate-600">{aName}</td>
                                                        <td className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">{getBreadcrumb(t.category_id, allCategories)}</td>
                                                        <td className="px-8 py-4">
                                                            <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border 
                                                        ${t.priority === 'Critical' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                                    t.priority?.includes('High') ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                        'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                                {t.priority}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-4 text-right">
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
                            <Pagination
                                currentPage={drillDownPage}
                                totalItems={drillDown.tickets.length}
                                onPageChange={setDrillDownPage}
                                itemsPerPage={itemsPerPage}
                            />
                            <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span>End of list</span>
                                <button
                                    onClick={() => setDrillDown(null)}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all active:scale-95"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// Sub-components for cleaner UI
const KPICard = ({ title, value, trend, trendUp, icon, bg, onClick }: { title: string, value: string, trend: string, trendUp: boolean, icon: React.ReactElement<any>, bg: string, onClick?: () => void }) => (
    <div
        onClick={onClick}
        className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all border-b-4 hover:border-b-indigo-500 ${onClick ? 'cursor-pointer' : ''}`}
    >
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

const Pagination = ({ currentPage, totalItems, onPageChange, itemsPerPage = 10 }: any) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
        <div className="px-8 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
                <button
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-50 transition-all font-black uppercase tracking-widest text-[9px] flex items-center gap-1"
                >
                    <ChevronLeft size={14} /> Prev
                </button>
                <div className="flex items-center gap-1">
                    {/* Only show up to 5 pages around current page if too many */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, i, arr) => (
                            <React.Fragment key={p}>
                                {i > 0 && arr[i - 1] !== p - 1 && <span className="text-slate-300">...</span>}
                                <button
                                    onClick={() => onPageChange(p)}
                                    className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-200'}`}
                                >
                                    {p}
                                </button>
                            </React.Fragment>
                        ))}
                </div>
                <button
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 disabled:opacity-50 transition-all font-black uppercase tracking-widest text-[9px] flex items-center gap-1"
                >
                    Next <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};

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
