import React, { useState } from 'react';
import { Plus, FileText, Book, HelpCircle, Eye, Info, X, AlertCircle, Package, Bot, Send, MessageSquare } from 'lucide-react';

interface Ticket {
    id: string;
    subject: string;
    status: 'Open' | 'Pending' | 'Resolved' | 'Closed';
    action: string;
}

const recentTickets: Ticket[] = [
    { id: 'INC4568', subject: 'Email not syncing', status: 'Pending', action: 'View' },
    { id: 'RITM4321', subject: 'Request new mouse', status: 'Resolved', action: 'View' },
    { id: 'INC4219', subject: 'App crash on login', status: 'Open', action: 'View' },
    { id: 'RITM3992', subject: 'VPN access issue', status: 'Closed', action: 'View' },
];

interface UserDashboardProps {
    onNavigate?: (view: string) => void;
    userName?: string;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ onNavigate, userName }) => {
    const [selectionType, setSelectionType] = useState<'create' | 'view' | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Welcome Card */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
                <div className="space-y-2 z-10">
                    <h1 className="text-3xl font-bold text-gray-800">👋 Hi, {userName || 'User'}!</h1>
                    <p className="text-gray-500 text-lg">
                        How can we help you today?
                        <br />
                        Track your tickets or submit a new request.
                    </p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
                    <HelpCircle size={300} className="text-indigo-900" />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { icon: Plus, label: 'Create Ticket', sub: 'Submit a new request', action: () => setSelectionType('create') },
                    { icon: AlertCircle, label: 'Incident List', sub: 'View your history', action: () => onNavigate?.('my-tickets') },
                    { icon: Package, label: 'Service Request List', sub: 'Browse articles', action: () => onNavigate?.('service-requests') },
                    { icon: HelpCircle, label: 'Help Center', sub: 'FAQ & Support', action: () => onNavigate?.('help-center') },
                ].map((action, index) => (
                    <button
                        key={index}
                        onClick={action.action}
                        className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group cursor-pointer text-center h-40"
                    >
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                            <action.icon size={28} />
                        </div>
                        <h3 className="font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">
                            {action.label}
                        </h3>
                    </button>
                ))}
            </div>

            {/* Selection Modal */}
            {selectionType && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectionType === 'create' ? 'Create New Ticket' : 'View Tickets'}
                            </h3>
                            <button
                                onClick={() => setSelectionType(null)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <button className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <AlertCircle size={24} />
                                </div>
                                <span className="font-bold text-gray-700 group-hover:text-indigo-700">Incident</span>
                            </button>
                            <button className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
                                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <Package size={24} />
                                </div>
                                <span className="font-bold text-gray-700 group-hover:text-purple-700">Service Request</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Announcement Card */}
                <div className="lg:col-span-1 bg-blue-50/50 border border-blue-100 p-6 rounded-xl relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Info size={120} className="text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-start gap-4 mb-3">
                            <div className="p-3 bg-blue-100/50 text-blue-600 rounded-lg">
                                <Info size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Scheduled Maintenance Tonight</h3>
                                <p className="text-blue-600 font-medium text-sm">(10PM – 12AM)</p>
                            </div>
                        </div>
                        <p className="text-gray-600 pl-[60px]">
                            Save your work before 10PM to avoid data loss during the update.
                        </p>
                    </div>
                </div>

                {/* Top Knowledge Articles */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex justify-between items-end mb-2">
                        <h2 className="text-lg font-bold text-gray-800">Top Knowledge Articles</h2>
                        <button className="text-indigo-600 text-sm font-medium hover:underline">Browse All</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            'Reset Your Password in 2 Minutes',
                            'Install Office 365 on Your Laptop',
                            'Troubleshoot Slow Internet'
                        ].map((article, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group h-full flex flex-col">
                                <div className="mb-3 p-2 bg-indigo-50 text-indigo-600 rounded-lg w-fit group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <Book size={18} />
                                </div>
                                <h4 className="font-semibold text-gray-700 text-sm group-hover:text-indigo-700 transition-colors line-clamp-2">
                                    {article}
                                </h4>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Tickets Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                    <h2 className="text-xl font-bold text-gray-800">New / Recent Tickets</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Ticket</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Subject</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-sm">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {recentTickets.map((ticket, index) => (
                                <tr key={ticket.id} className="hover:bg-gray-50/50 transition-colors h-[52px]">
                                    <td className="px-6 py-4 font-medium text-gray-700">{ticket.id}</td>
                                    <td className="px-6 py-4 text-gray-600">{ticket.subject}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${ticket.status === 'Open'
                                                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                : ticket.status === 'Pending'
                                                    ? 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                                                    : ticket.status === 'Resolved'
                                                        ? 'bg-green-50 text-green-600 border border-green-100'
                                                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                                                }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${ticket.status === 'Open' ? 'bg-blue-500' :
                                                ticket.status === 'Pending' ? 'bg-yellow-500' :
                                                    ticket.status === 'Resolved' ? 'bg-green-500' : 'bg-gray-500'
                                                }`}></span>
                                            {ticket.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-gray-400 hover:text-indigo-600 font-medium transition-colors flex items-center gap-2 text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:border-indigo-200 hover:bg-indigo-50">
                                            <Eye size={14} />
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Support Assistant Chatbot */}
            <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end space-y-4">
                {/* Chat Window */}
                {isChatOpen && (
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 md:w-96 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 flex flex-col mb-2">
                        {/* Header */}
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500 rounded-full">
                                    <Bot size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">Support Assistant</h3>
                                    <p className="text-[10px] text-indigo-200 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsChatOpen(false)}
                                className="text-indigo-200 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="h-80 bg-gray-50 p-4 overflow-y-auto space-y-4">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 text-indigo-600">
                                    <Bot size={16} />
                                </div>
                                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-sm text-gray-700 max-w-[85%]">
                                    <p>Hi Yogi! 👋</p>
                                    <p className="mt-1">I'm your AI assistant. Before creating a ticket, how can I help you regarding your issue?</p>
                                </div>
                            </div>

                            {/* Example User Message (Static for now, but shows layout) */}
                            {/* 
                            <div className="flex gap-3 flex-row-reverse">
                                <div className="bg-indigo-600 p-3 rounded-2xl rounded-tr-none shadow-sm text-sm text-white max-w-[85%]">
                                    <p>My printer is not working.</p>
                                </div>
                            </div>
                            */}
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                            <input
                                type="text"
                                placeholder="Type your issue..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                            />
                            <button className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Floating Button */}
                <button
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`p-4 rounded-full shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${isChatOpen ? 'bg-gray-800 text-white rotate-90' : 'bg-indigo-600 text-white'
                        }`}
                >
                    {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
                </button>
            </div>
        </div >
    );
};

export default UserDashboard;
