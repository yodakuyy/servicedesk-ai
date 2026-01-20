import React, { useState, useEffect, useRef } from 'react';
import { Plus, FileText, Book, HelpCircle, Eye, Info, X, AlertCircle, Package, Bot, Send, MessageSquare, ArrowRight, CheckCircle, Clock, Search, Filter, Calendar, User, Activity } from 'lucide-react';

interface Ticket {
    id: string;
    subject: string;
    status: 'Open' | 'Pending' | 'Resolved' | 'Closed';
    slaStatus: 'Safe' | 'Warning' | 'Breached';
    action: string;
    lastUpdate: string;
    created: string;
    agent: string;
}

const recentTickets: Ticket[] = [
    { id: 'INC4568', subject: 'Email not syncing', status: 'Open', slaStatus: 'Warning', action: 'View', lastUpdate: '2h ago', created: '10/12/23', agent: 'Wesley.47' },
    { id: 'RITM4321', subject: 'Request new mouse', status: 'Resolved', slaStatus: 'Safe', action: 'View', lastUpdate: '1d ago', created: '10/11/23', agent: 'Levinson.2' },
    { id: 'INC4219', subject: 'App crash on login', status: 'Pending', slaStatus: 'Breached', action: 'View', lastUpdate: '3h ago', created: '10/10/23', agent: 'Adair.8' },
    { id: 'RITM3992', subject: 'VPN access issue', status: 'Closed', slaStatus: 'Safe', action: 'View', lastUpdate: '2d ago', created: '10/09/23', agent: 'West.56' },
];

interface UserTicketListProps {
    onNavigate?: (view: string) => void;
    onViewTicket?: (ticketId: string) => void;
    onCreateTicket?: () => void;
    userName?: string;
}

const UserTicketList: React.FC<UserTicketListProps> = ({ onNavigate, onViewTicket, onCreateTicket, userName }) => {
    const [selectionType, setSelectionType] = useState<'create' | 'view' | null>(null);
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [slaStatusFilter, setSlaStatusFilter] = useState<string>('');
    const [agentFilter, setAgentFilter] = useState<string[]>([]);
    const [dateFilter, setDateFilter] = useState<{ start: string; end: string } | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const filterRef = useRef<HTMLDivElement>(null);

    // Get unique agents
    const agents = Array.from(new Set(recentTickets.map(t => t.agent)));

    // Close filter when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const filteredTickets = recentTickets.filter(ticket => {
        const matchesSearch = (ticket.subject.toLowerCase().includes(filter.toLowerCase()) ||
            ticket.id.toLowerCase().includes(filter.toLowerCase()) ||
            ticket.agent.toLowerCase().includes(filter.toLowerCase()) ||
            ticket.status.toLowerCase().includes(filter.toLowerCase()));

        const matchesStatus = statusFilter === '' || ticket.status === statusFilter;
        const matchesSla = slaStatusFilter === '' || ticket.slaStatus === slaStatusFilter;
        const matchesAgent = agentFilter.length === 0 || agentFilter.includes(ticket.agent);

        let matchesDate = true;
        if (dateFilter) {
            const ticketDate = new Date(ticket.created);
            const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
            const endDate = dateFilter.end ? new Date(dateFilter.end) : null;

            if (startDate && endDate) {
                matchesDate = ticketDate >= startDate && ticketDate <= endDate;
            }
        }

        return matchesSearch && matchesStatus && matchesSla && matchesAgent && matchesDate;
    });

    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    const paginatedTickets = filteredTickets.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="p-8 w-full mx-auto space-y-8">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-3xl font-bold text-gray-900">Hi, {userName || 'User'}!</h1>
                <p className="text-gray-500">Here are your recent tickets and updates.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-5 gap-4">
                {[
                    { label: 'OPEN', value: '53', sub: '+19 from yesterday', color: 'text-blue-600', bg: 'bg-blue-50', iconBg: 'bg-blue-100', icon: AlertCircle },
                    { label: 'IN PROGRESS', value: '41', sub: '+12 from yesterday', color: 'text-purple-600', bg: 'bg-white', iconBg: 'bg-purple-100', icon: Activity },
                    { label: 'PENDING', value: '32', sub: '+19 from yesterday', color: 'text-orange-500', bg: 'bg-white', iconBg: 'bg-orange-100', icon: Clock },
                    { label: 'RESOLVED', value: '12', sub: '+19 from yesterday', color: 'text-green-600', bg: 'bg-white', iconBg: 'bg-green-100', icon: CheckCircle },
                    { label: 'CLOSED', value: '76', sub: '+23 from yesterday', color: 'text-gray-700', bg: 'bg-white', iconBg: 'bg-gray-100', icon: Package },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-xs font-bold text-gray-400 tracking-wider font-sans">{stat.label}</span>
                            <div className={`p-2 rounded-full ${stat.iconBg} ${stat.color} opacity-80`}>
                                <stat.icon size={16} />
                            </div>
                        </div>
                        <div>
                            <span className={`text-4xl font-extrabold ${stat.color} block mb-1`}>{stat.value}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{stat.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions Row */}
            <div className="flex justify-end">
                <button
                    onClick={() => onCreateTicket && onCreateTicket()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 text-sm font-medium"
                >
                    <Plus size={18} />
                    Create Incident
                </button>
            </div>




            {/* Incidents List Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Incidents List</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by ticket number, subject, or agent..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50"
                            />
                        </div>
                        <div className="relative" ref={filterRef}>
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all font-medium text-sm ${isFilterOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'}`}
                            >
                                <Filter size={16} />
                                <span>Filter</span>
                            </button>

                            {isFilterOpen && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-0 z-20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                    <div className="max-h-[70vh] overflow-y-auto p-4 custom-scrollbar">
                                        {/* Status Filter */}
                                        <div className="mb-6">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Status</div>
                                            <select
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-gray-50/30"
                                            >
                                                <option value="">All Statuses</option>
                                                <option value="Open">Open</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Resolved">Resolved</option>
                                                <option value="Closed">Closed</option>
                                            </select>
                                        </div>
                                        {/* Date Range Filter */}
                                        <div>
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Date Range</div>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-gray-500 block mb-1.5 ml-1">Start Date</label>
                                                    <div className="relative">
                                                        <input
                                                            type="date"
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-gray-50/30"
                                                            value={dateFilter?.start || ''}
                                                            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value, end: prev?.end || '' }))}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block mb-1.5 ml-1">End Date</label>
                                                    <div className="relative">
                                                        <input
                                                            type="date"
                                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-gray-50/30"
                                                            value={dateFilter?.end || ''}
                                                            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value, start: prev?.start || '' }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {(statusFilter || slaStatusFilter || agentFilter.length > 0 || dateFilter) && (
                                        <div className="border-t border-gray-100 p-3 bg-gray-50/50">
                                            <button
                                                onClick={() => {
                                                    setStatusFilter('');
                                                    setSlaStatusFilter('');
                                                    setAgentFilter([]);
                                                    setDateFilter(null);
                                                }}
                                                className="text-xs text-red-600 hover:text-red-700 font-bold w-full text-center py-2 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            >
                                                Reset Filters
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/30">
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Ticket</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Subject</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Last Update</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Created</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Agent</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedTickets.length > 0 ? (
                                paginatedTickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-gray-50/50 transition-colors h-[52px]">
                                        <td className="px-6 py-4 font-medium text-gray-700 text-sm">{ticket.id}</td>
                                        <td className="px-6 py-4 text-gray-600 text-sm">{ticket.subject}</td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-md text-xs font-bold inline-flex items-center gap-1.5 ${ticket.status === 'Open'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : ticket.status === 'Pending'
                                                        ? 'bg-orange-100 text-orange-700'
                                                        : ticket.status === 'Resolved'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 text-sm">{ticket.lastUpdate}</td>
                                        <td className="px-6 py-4 text-gray-600 text-sm">{ticket.created}</td>
                                        <td className="px-6 py-4 text-gray-600 text-sm">{ticket.agent}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => onViewTicket && onViewTicket(ticket.id)}
                                                className="text-gray-500 hover:text-gray-700 font-medium transition-colors text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 text-sm">
                                        No tickets found matching your filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="border-t border-gray-100 p-4 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredTickets.length)}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredTickets.length)}</span> of <span className="font-medium">{filteredTickets.length}</span> results
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default UserTicketList;
