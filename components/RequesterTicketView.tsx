import React, { useState } from 'react';
import {
    ChevronLeft, Send, Paperclip, MessageSquare, ChevronDown, ChevronUp,
    CheckCircle2, Circle, HelpCircle, FileText, Info
} from 'lucide-react';

const RequesterTicketView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [isInfoExpanded, setIsInfoExpanded] = useState(true);
    const [replyText, setReplyText] = useState('');

    // Mock Data based on wireframe
    const ticket = {
        id: 'INC-10231',
        subject: 'Login Failed – Finance System',
        status: 'In Progress',
        priority: 'High',
        created_at: '19 Jan 2026, 09:10',
        category: 'Access Issue',
        service: 'Finance System',
        // Mapping workflow steps
        progress_steps: [
            { label: 'Ticket Submitted', status: 'completed' },
            { label: 'Being Reviewed', status: 'completed' },
            { label: 'In Progress', status: 'current' },
            { label: 'Waiting for Confirmation', status: 'pending' },
            { label: 'Resolved', status: 'pending' }
        ]
    };

    const timeline = [
        {
            id: 1,
            author: 'You',
            role: 'requester',
            time: '09:10',
            content: 'Saya tidak bisa login ke Finance System. Muncul error "Access Denied" padahal kemarin bisa.',
            avatar_bg: 'bg-indigo-100',
            avatar_text: 'text-indigo-600'
        },
        {
            id: 2,
            type: 'system',
            content: 'Ticket assigned to Finance Support Team'
        },
        {
            id: 3,
            author: 'Support Team',
            role: 'agent',
            time: '09:15',
            content: 'Kami sedang melakukan pengecekan akses akun Anda. Mohon konfirmasi apakah error muncul di semua menu atau hanya laporan?',
            avatar_bg: 'bg-orange-100',
            avatar_text: 'text-orange-600'
        }
    ];

    const aiSuggestion = "Error muncul di semua menu sejak jam 9 pagi";

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans max-w-5xl mx-auto shadow-sm min-h-screen">
            {/* Top Navigation */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 font-medium transition-colors">
                    <ChevronLeft size={20} />
                    Back to My Tickets
                </button>
                <button className="text-gray-500 hover:text-indigo-600 flex items-center gap-1.5 text-sm font-medium">
                    <HelpCircle size={18} />
                    Help Center
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">

                {/* Ticket Header & Status */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                            <div>
                                <h1 className="text-sm font-bold text-gray-400 mb-1">{ticket.id}</h1>
                                <h2 className="text-2xl font-bold text-gray-900">{ticket.subject}</h2>
                            </div>
                            <div className="flex gap-3">
                                <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold border border-blue-100 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    Status: {ticket.status}
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-sm font-semibold border flex items-center gap-2 ${ticket.priority === 'High' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-700 border-gray-100'
                                    }`}>
                                    Priority: {ticket.priority}
                                </div>
                            </div>
                        </div>

                        {/* Visual Progress Steps */}
                        <div className="relative pt-2 pb-4">
                            {/* Connecting Line */}
                            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-100 hidden md:block" style={{ left: '30px', right: '30px' }}></div>

                            <div className="flex flex-col md:flex-row justify-between gap-4 relative z-10">
                                {ticket.progress_steps.map((step, index) => (
                                    <div key={index} className={`flex md:flex-col items-center gap-3 md:gap-2 flex-1 ${step.status === 'pending' ? 'opacity-50' : ''
                                        }`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${step.status === 'completed' || step.status === 'current' ? 'bg-green-100 border-green-500 text-green-600' : 'bg-white border-gray-300 text-gray-300'
                                            } ${step.status === 'current' ? 'ring-4 ring-green-50' : ''}`}>
                                            {step.status === 'completed' ? <CheckCircle2 size={14} /> :
                                                step.status === 'current' ? <div className="w-2.5 h-2.5 bg-green-500 rounded-full" /> :
                                                    <div className="w-2.5 h-2.5 bg-gray-200 rounded-full" />
                                            }
                                        </div>
                                        <span className={`text-sm font-medium ${step.status === 'current' ? 'text-green-700 font-bold' : 'text-gray-600'
                                            }`}>{step.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Collapsible Ticket Info */}
                    <div className="bg-gray-50/50">
                        <button
                            onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                            className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Info size={16} /> Ticket Information
                            </span>
                            {isInfoExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isInfoExpanded && (
                            <div className="px-6 pb-6 pt-2 border-t border-gray-100 grid md:grid-cols-2 gap-4">
                                <InfoItem label="Ticket ID" value={ticket.id} />
                                <InfoItem label="Created At" value={ticket.created_at} />
                                <InfoItem label="Category" value={ticket.category} />
                                <InfoItem label="Service" value={ticket.service} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Conversation Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-[400px]">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <MessageSquare size={16} className="text-indigo-500" />
                            Conversation
                        </h3>
                    </div>

                    <div className="flex-1 p-6 space-y-6">
                        {timeline.map((msg) => (
                            msg.type === 'system' ? (
                                <div key={msg.id} className="flex items-center justify-center gap-2 text-xs text-gray-400">
                                    <div className="h-px bg-gray-100 w-12"></div>
                                    <span className="bg-gray-50 px-3 py-1 rounded-full border border-gray-100">{msg.content}</span>
                                    <div className="h-px bg-gray-100 w-12"></div>
                                </div>
                            ) : (
                                <div key={msg.id} className={`flex gap-4 ${msg.role === 'requester' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${msg.avatar_bg} ${msg.avatar_text}`}>
                                        {msg.role === 'requester' ? <span className="text-lg">🧑</span> : <span className="text-lg">🧑‍💼</span>}
                                    </div>
                                    <div className={`max-w-[80%] space-y-1 ${msg.role === 'requester' ? 'items-end flex flex-col' : ''}`}>
                                        <div className="flex items-baseline gap-2 text-xs text-gray-500">
                                            <span className="font-bold text-gray-900">{msg.author}</span>
                                            <span>{msg.time}</span>
                                        </div>
                                        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'requester' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'
                                            }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>

                    {/* Inline AI Helper (Optional) */}
                    <div className="px-6 py-2">
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                            <div className="text-xl">🤖</div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-indigo-800 mb-0.5">Need help responding?</p>
                                <p className="text-xs text-indigo-600">Suggested: "{aiSuggestion}"</p>
                            </div>
                            <button
                                onClick={() => setReplyText(aiSuggestion)}
                                className="px-3 py-1.5 bg-white text-indigo-600 text-xs font-bold rounded shadow-sm border border-indigo-200 hover:bg-indigo-50 transition-colors"
                            >
                                Use Suggestion
                            </button>
                        </div>
                    </div>

                    {/* Reply Composer */}
                    <div className="p-4 bg-white border-t border-gray-100 rounded-b-xl">
                        <div className="relative">
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full h-32 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none text-sm placeholder-gray-400"
                                placeholder="Type your message here..."
                            ></textarea>
                            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs font-medium">
                                    <Paperclip size={16} />
                                    <span className="hidden sm:inline">Attach File</span>
                                </button>
                                <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors flex items-center gap-2 shadow-sm">
                                    <Send size={16} />
                                    Send Reply
                                </button>
                            </div>
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-3">
                            Internal notes are hidden. You are replying as the ticket requester.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

// --- Sub Components ---

const InfoItem: React.FC<{ label: string, value: string }> = ({ label, value }) => (
    <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-200/50 last:border-0">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-sm font-semibold text-gray-700">{value}</span>
    </div>
);

export default RequesterTicketView;
