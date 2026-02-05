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
                const { data: logData } = await supabase
                    .from('ticket_activity_log')
                    .select('*, actor:profiles!actor_id(id, full_name, role_id)')
                    .in('ticket_id', tIds)
                    .order('created_at', { ascending: true });

                const enrichedTickets = tickets.map((t: any) => ({
                    ...t,
                    activity_logs: logData?.filter((l: any) => l.ticket_id === t.id) || []
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
                        <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all active:scale-95">
                            <Download size={16} /> Export to Excel
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
                                    <th className="px-8 py-5 text-center">L1 Handle (Hrs)</th>
                                    <th className="px-8 py-5 text-center">L2 Handle (Hrs)</th>
                                    <th className="px-8 py-5">Closed Time</th>
                                    <th className="px-8 py-5 text-right w-10">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-600">
                                {filteredExportTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-8 py-20 text-center text-slate-400 italic text-sm font-medium">
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

                                        const l1Roles = [2, 3];
                                        const l2Roles = [5];
                                        const escalationLog = logs.find((l: any) => l.action.toLowerCase().includes('escalated to l2'));

                                        // 1. Identify L1: Supervisor (2) or Agent (3) OR Escalator
                                        const l1Log = logs.find((l: any) => l1Roles.includes(l.actor?.role_id)) || escalationLog;
                                        const currAgent = (t as any).assigned_agent;
                                        const l1Name = l1Log
                                            ? (l1Log.actor?.full_name || 'L1 Agent')
                                            : (l1Roles.includes(currAgent?.role_id) ? currAgent.full_name : 'L1 System');


                                        // 2. Identify L2: First work log (skipping creation) OR escalation log
                                        const l2FirstAction = logs.find((l: any) =>
                                            l2Roles.includes(l.actor?.role_id) && !l.action.toLowerCase().includes('created')
                                        );
                                        const l2TriggerLog = l2FirstAction || escalationLog;

                                        let l2Name = '-';
                                        if (l2FirstAction) {
                                            l2Name = l2FirstAction.actor?.full_name;
                                        } else if (escalationLog) {
                                            const parts = escalationLog.action.split(':');
                                            l2Name = parts.length > 1 ? parts[1].trim() : 'L2 Agent';
                                        } else if (l2Roles.includes(currAgent?.role_id)) {
                                            l2Name = currAgent.full_name;
                                        }

                                        const escalationTime = l2TriggerLog ? new Date(l2TriggerLog.created_at).getTime() : null;
                                        const terminalTime = isResolved ? new Date(t.updated_at).getTime() : new Date().getTime();

                                        let l1H = 0;
                                        let l2H = 0;
                                        if (escalationTime) {
                                            l1H = Math.max(0, (escalationTime - creationTime) / 3600000);
                                            l2H = Math.max(0, (terminalTime - escalationTime) / 3600000);
                                        } else {
                                            l1H = Math.max(0, (terminalTime - creationTime) / 3600000);
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
                                                <td className="px-8 py-5 font-black text-xs text-slate-700 text-center">
                                                    {l1H.toFixed(1)}
                                                </td>
                                                <td className={`px-8 py-5 font-black text-xs text-center ${l2H > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {l2H > 0 ? l2H.toFixed(1) : '-'}
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
