import React, { useState, useEffect, useRef } from 'react';
import { Plus, CheckCircle, Clock, Package, AlertCircle, Activity, Search, Filter, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Ticket {
    id: string; // UUID from DB
    ticket_number: string; // INC...
    subject: string;
    status: string; // from status_name
    created_at: string;
    description: string;
    // agent: string; // Optional, add later if needed
}

interface UserTicketListProps {
    onNavigate?: (view: string) => void;
    onViewTicket?: (ticketId: string) => void;
    onCreateTicket?: () => void;
    userName?: string;
    userId?: string; // NEEDED for filtering
}

const UserTicketList: React.FC<UserTicketListProps> = ({ onNavigate, onViewTicket, onCreateTicket, userName, userId }) => {
    // State
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Stats State
    const [stats, setStats] = useState({
        open: 0,
        pending: 0,
        resolved: 0,
        closed: 0,
        inProgress: 0,
        canceled: 0
    });

    const itemsPerPage = 5;
    const filterRef = useRef<HTMLDivElement>(null);

    // Fetch Tickets from Supabase
    useEffect(() => {
        const fetchUserTickets = async () => {
            setIsLoading(true);
            try {
                // Determine user ID to filter by. 
                // If userId prop is missing, we might need to get it from auth session.
                let targetUserId = userId;
                if (!targetUserId) {
                    const { data: { user } } = await supabase.auth.getUser();
                    targetUserId = user?.id;
                }

                if (!targetUserId) {
                    console.warn("No user ID found for fetching tickets.");
                    setIsLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('tickets')
                    .select(`
                        id, ticket_number, subject, description, created_at, status_id,
                        ticket_statuses!fk_tickets_status (status_name)
                    `)
                    .or(`requester_id.eq.${targetUserId},created_by.eq.${targetUserId}`)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (data) {
                    const formattedTickets: Ticket[] = data.map((t: any) => ({
                        id: t.id,
                        ticket_number: t.ticket_number,
                        subject: t.subject,
                        description: t.description,
                        created_at: new Date(t.created_at).toLocaleDateString() + ' ' + new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        status: t.ticket_statuses?.status_name || 'Unknown'
                    }));
                    setTickets(formattedTickets);

                    // Calculate Stats
                    const newStats = {
                        open: formattedTickets.filter(t => t.status.toLowerCase() === 'open' || t.status.toLowerCase() === 'new').length,
                        pending: formattedTickets.filter(t => t.status.toLowerCase().includes('pending')).length,
                        resolved: formattedTickets.filter(t => t.status.toLowerCase() === 'resolved').length,
                        closed: formattedTickets.filter(t => t.status.toLowerCase() === 'closed').length,
                        inProgress: formattedTickets.filter(t => t.status.toLowerCase() === 'in progress' || t.status.toLowerCase() === 'wip' || t.status.toLowerCase() === 'assigned').length,
                        canceled: formattedTickets.filter(t => t.status.toLowerCase() === 'canceled').length
                    };
                    setStats(newStats);
                }
            } catch (err) {
                console.error("Error fetching user tickets:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserTickets();
    }, [userId]);

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

    // Filter Logic
    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch = (ticket.subject.toLowerCase().includes(filter.toLowerCase()) ||
            ticket.ticket_number.toLowerCase().includes(filter.toLowerCase()) ||
            ticket.status.toLowerCase().includes(filter.toLowerCase()));

        const matchesStatus = statusFilter === '' || ticket.status === statusFilter;

        return matchesSearch && matchesStatus;
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
            <div className="grid grid-cols-6 gap-4">
                {[
                    { label: 'OPEN', value: stats.open, sub: 'Active tickets', color: 'text-blue-600', bg: 'bg-blue-50', iconBg: 'bg-blue-100', icon: AlertCircle },
                    { label: 'IN PROGRESS', value: stats.inProgress, sub: 'Being worked on', color: 'text-purple-600', bg: 'bg-white', iconBg: 'bg-purple-100', icon: Activity },
                    { label: 'PENDING', value: stats.pending, sub: 'Waiting action', color: 'text-orange-500', bg: 'bg-white', iconBg: 'bg-orange-100', icon: Clock },
                    { label: 'RESOLVED', value: stats.resolved, sub: 'Completed', color: 'text-green-600', bg: 'bg-white', iconBg: 'bg-green-100', icon: CheckCircle },
                    { label: 'CLOSED', value: stats.closed, sub: 'Archived', color: 'text-gray-700', bg: 'bg-white', iconBg: 'bg-gray-100', icon: Package },
                    { label: 'CANCELED', value: stats.canceled, sub: 'Withdrawn', color: 'text-rose-600', bg: 'bg-white', iconBg: 'bg-rose-100', icon: AlertCircle },
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
                                placeholder="Search by ticket number or subject..."
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
                                                <option value="In Progress">In Progress</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Resolved">Resolved</option>
                                                <option value="Closed">Closed</option>
                                                <option value="Canceled">Canceled</option>
                                            </select>
                                        </div>
                                    </div>
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
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Created</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 className="animate-spin text-indigo-600" size={20} />
                                            <span>Loading tickets...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedTickets.length > 0 ? (
                                paginatedTickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-gray-50/50 transition-colors h-[52px]">
                                        <td className="px-6 py-4 font-medium text-gray-700 text-sm">{ticket.ticket_number}</td>
                                        <td className="px-6 py-4 text-gray-600 text-sm max-w-xs truncate">{ticket.subject}</td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 
                                                    ${ticket.status === 'Open' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                        ticket.status === 'In Progress' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                            ticket.status.toLowerCase().includes('pending') ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                                ticket.status === 'Resolved' ? 'bg-green-50 text-green-600 border border-green-100' :
                                                                    ticket.status === 'Canceled' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                                                        'bg-slate-50 text-slate-600 border border-slate-100'
                                                    } transition-all duration-200`}
                                            >
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 text-sm">{ticket.created_at}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => onViewTicket && onViewTicket(ticket.id)}
                                                className="text-gray-500 hover:text-gray-700 font-medium transition-colors text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                            >
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                                        No tickets found. Create your first incident!
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
