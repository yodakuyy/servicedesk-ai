import React, { useState } from 'react';
import { Search, Plus, Filter, Clock, FileText } from 'lucide-react';

interface RequesterTicketListProps {
    onTicketClick: (ticketId: string) => void;
    onCreateClick: () => void;
}

const RequesterTicketList: React.FC<RequesterTicketListProps> = ({ onTicketClick, onCreateClick }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Mock Data
    const tickets = [
        {
            id: 'INC-10231',
            subject: 'Login Failed – Finance System',
            status: 'In Progress',
            statusColor: 'text-yellow-600 bg-yellow-50 border-yellow-100', // Visual cue 🟡
            lastUpdate: '10 mins ago',
            service: 'Finance System',
            isWaitingForYou: false
        },
        {
            id: 'INC-10230',
            subject: 'Printer Paper Jam 4th Floor',
            status: 'Waiting for You',
            statusColor: 'text-blue-600 bg-blue-50 border-blue-100', // Visual cue 🔵
            lastUpdate: '2 hours ago',
            service: 'Facilities',
            isWaitingForYou: true
        },
        {
            id: 'INC-10222',
            subject: 'Request for New Monitor',
            status: 'Resolved',
            statusColor: 'text-green-600 bg-green-50 border-green-100', // Visual cue 🟢
            lastUpdate: '1 day ago',
            service: 'Hardware',
            isWaitingForYou: false
        }
    ];

    const filteredTickets = tickets.filter(t => t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || t.id.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans max-w-5xl mx-auto shadow-sm min-h-screen">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
                    <button
                        onClick={onCreateClick}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Create Incident</span>
                        <span className="sm:hidden">Create</span>
                    </button>
                </div>

                {/* Filter & Search */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search ticket..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                            <Filter size={16} />
                            All Status
                        </button>
                        <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                            <Clock size={16} />
                            Last Updated
                        </button>
                    </div>
                </div>
            </div>

            {/* Ticket List */}
            <div className="flex-1 p-4 md:p-6 space-y-3 overflow-y-auto">
                {filteredTickets.length > 0 ? (
                    filteredTickets.map(ticket => (
                        <div
                            key={ticket.id}
                            onClick={() => onTicketClick(ticket.id)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-gray-400 font-mono tracking-wide">{ticket.id}</span>
                                <span className="text-xs text-gray-400">{ticket.lastUpdate}</span>
                            </div>
                            <h3 className="font-medium text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors text-lg">{ticket.subject}</h3>
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${ticket.statusColor}`}>
                                    {ticket.isWaitingForYou && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                                    {ticket.status}
                                </span>
                                <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
                                    {ticket.service}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <FileText size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">No tickets found</h3>
                        <p className="text-gray-500 max-w-xs mx-auto mb-6">Try adjusting your search terms.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequesterTicketList;
