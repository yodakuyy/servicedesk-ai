import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, Send, Paperclip, MessageSquare, ChevronDown, ChevronUp,
    CheckCircle2, Circle, HelpCircle, FileText, Info, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import RichTextEditor from './RichTextEditor';

interface RequesterTicketViewProps {
    ticketId?: string | null;
    onBack?: () => void;
}

const RequesterTicketView: React.FC<RequesterTicketViewProps> = ({ ticketId, onBack }) => {
    const [isInfoExpanded, setIsInfoExpanded] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [isSending, setIsSending] = useState(false);

    const fetchMessages = async () => {
        if (!ticketId) return;
        const { data, error } = await supabase
            .from('ticket_messages')
            .select('*, sender:profiles!sender_id(full_name)')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(data);
        } else if (error) {
            console.error("Error fetching messages:", error);
        }
    };

    useEffect(() => {
        const fetchTicketDetails = async () => {
            if (!ticketId) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('tickets')
                    .select(`
                        *,
                        ticket_statuses!fk_tickets_status (status_name),
                        agent:profiles!fk_tickets_assigned_agent (full_name)
                    `)
                    .eq('id', ticketId)
                    .single();

                if (error) throw error;
                if (data) {
                    setTicket(data);
                }

                // Fetch messages
                await fetchMessages();
            } catch (err) {
                console.error("Error fetching ticket details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTicketDetails();
    }, [ticketId]);

    const handleSendReply = async () => {
        if (!replyText.trim() || !ticketId || isSending) return;

        try {
            setIsSending(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert("You must be logged in to reply.");
                return;
            }

            const { error } = await supabase
                .from('ticket_messages')
                .insert({
                    ticket_id: ticketId,
                    sender_id: user.id,
                    sender_type: 'requester',
                    message_content: replyText
                });

            if (error) throw error;

            setReplyText('');
            await fetchMessages(); // Refresh conversation
        } catch (err: any) {
            console.error("Error sending reply:", err);
            alert("Failed to send reply: " + err.message);
        } finally {
            setIsSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading ticket details...</p>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
                <p className="text-red-500 font-medium mb-4">Ticket not found.</p>
                <button onClick={onBack} className="text-indigo-600 font-bold hover:underline flex items-center gap-2">
                    <ChevronLeft size={20} /> Back to My Tickets
                </button>
            </div>
        );
    }

    // Map DB status to visual progress
    const statusName = ticket.ticket_statuses?.status_name || 'Open';
    const progressSteps = [
        { label: 'Ticket Submitted', status: 'completed' },
        { label: 'Being Reviewed', status: statusName !== 'Open' ? 'completed' : 'current' },
        { label: 'In Progress', status: ['In Progress', 'WIP', 'Assigned'].includes(statusName) ? 'current' : (['Resolved', 'Closed'].includes(statusName) ? 'completed' : 'pending') },
        { label: 'Waiting for Confirmation', status: statusName === 'Pending' ? 'current' : (['Resolved', 'Closed'].includes(statusName) ? 'completed' : 'pending') },
        { label: 'Resolved', status: ['Resolved', 'Closed'].includes(statusName) ? 'completed' : 'pending' }
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans max-w-5xl mx-auto shadow-sm min-h-screen">
            {/* Top Navigation */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 font-medium transition-colors">
                    <ChevronLeft size={20} />
                    Back to My Tickets
                </button>
                <div className="flex items-center gap-4">
                    <button className="text-gray-500 hover:text-indigo-600 flex items-center gap-1.5 text-sm font-medium">
                        <HelpCircle size={18} />
                        Help Center
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">

                {/* Ticket Header & Status */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                            <div>
                                <h1 className="text-sm font-bold text-gray-400 mb-1">{ticket.ticket_number}</h1>
                                <h2 className="text-2xl font-bold text-gray-900">{ticket.subject}</h2>
                            </div>
                            <div className="flex gap-3">
                                <span className={`px-3 py-1 rounded-lg text-sm font-semibold border flex items-center gap-2 ${statusName === 'Open' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                    statusName === 'Resolved' ? 'bg-green-50 text-green-700 border-green-100' :
                                        'bg-orange-50 text-orange-700 border-orange-100'
                                    }`}>
                                    <div className={`w-2 h-2 rounded-full ${statusName === 'Resolved' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></div>
                                    Status: {statusName}
                                </span>
                                <span className={`px-3 py-1 rounded-lg text-sm font-semibold border flex items-center gap-2 ${ticket.priority?.toLowerCase() === 'high' || ticket.priority?.toLowerCase() === 'urgent'
                                    ? 'bg-red-50 text-red-700 border-red-100'
                                    : 'bg-gray-50 text-gray-700 border-gray-100'
                                    }`}>
                                    Priority: {ticket.priority || 'Medium'}
                                </span>
                            </div>
                        </div>

                        {/* Visual Progress Steps */}
                        <div className="relative pt-2 pb-4">
                            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-100 hidden md:block" style={{ left: '30px', right: '30px' }}></div>
                            <div className="flex flex-col md:flex-row justify-between gap-4 relative z-10">
                                {progressSteps.map((step, index) => (
                                    <div key={index} className={`flex md:flex-col items-center gap-3 md:gap-2 flex-1 ${step.status === 'pending' ? 'opacity-50' : ''}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${step.status === 'completed' || step.status === 'current' ? 'bg-green-100 border-green-500 text-green-600' : 'bg-white border-gray-300 text-gray-300'
                                            } ${step.status === 'current' ? 'ring-4 ring-green-50' : ''}`}>
                                            {step.status === 'completed' ? <CheckCircle2 size={14} /> :
                                                step.status === 'current' ? <div className="w-2.5 h-2.5 bg-green-500 rounded-full" /> :
                                                    <div className="w-2.5 h-2.5 bg-gray-200 rounded-full" />
                                            }
                                        </div>
                                        <span className={`text-sm font-medium ${step.status === 'current' ? 'text-green-700 font-bold' : 'text-gray-600'}`}>{step.label}</span>
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
                                <InfoItem label="Ticket Number" value={ticket.ticket_number} />
                                <InfoItem label="Created At" value={new Date(ticket.created_at).toLocaleString()} />
                                <InfoItem label="Type" value={ticket.ticket_type} />
                                <InfoItem label="Assignment Group" value={ticket.assignment_group_id ? (ticket.group?.name || 'Assigned') : 'Queueing'} />
                                <InfoItem label="PIC / Handled By" value={ticket.agent?.full_name || 'Waiting for Agent...'} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Description View */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" />
                        Issue Description
                    </h3>
                    <div
                        className="prose prose-sm max-w-none text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-100"
                        dangerouslySetInnerHTML={{ __html: ticket.description }}
                    />
                </div>

                {/* Conversation Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-[400px]">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <MessageSquare size={16} className="text-indigo-500" />
                            Conversation
                        </h3>
                    </div>

                    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[500px]">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                                <MessageSquare size={48} className="opacity-20 mb-2" />
                                <p className="text-sm">No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className={`flex gap-4 ${msg.sender_type === 'requester' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${msg.sender_type === 'requester' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                        {(msg.sender?.full_name || msg.sender_type).charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`max-w-[80%] ${msg.sender_type === 'requester' ? 'text-right' : 'text-left'}`}>
                                        <div className={`flex items-center gap-2 mb-1 ${msg.sender_type === 'requester' ? 'justify-end' : ''}`}>
                                            <span className="font-bold text-xs text-gray-900">{msg.sender?.full_name || 'Agent'}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(msg.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm prose prose-sm max-w-none ${msg.sender_type === 'requester' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`} dangerouslySetInnerHTML={{ __html: msg.message_content }} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Reply Composer */}
                    <div className="p-4 bg-white border-t border-gray-100 rounded-b-xl px-4 pb-6 pt-4">
                        <RichTextEditor
                            content={replyText}
                            onChange={setReplyText}
                            placeholder="Type your message here... (Paste images allowed)"
                            minHeight="120px"
                        />
                        <button
                            onClick={handleSendReply}
                            disabled={!replyText.trim() || isSending}
                            className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-all flex items-center gap-2 shadow-md shadow-indigo-100"
                        >
                            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Send
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

const InfoItem: React.FC<{ label: string, value: string }> = ({ label, value }) => (
    <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-200/50 last:border-0">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-sm font-semibold text-gray-700">{value}</span>
    </div>
);

export default RequesterTicketView;
