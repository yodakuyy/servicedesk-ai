import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, Send, Paperclip, MessageSquare, ChevronDown, ChevronUp,
    CheckCircle2, Circle, HelpCircle, FileText, Info, Loader2, X, Lock, ExternalLink, CheckCircle
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
            .eq('is_internal', false)
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
                        agent:profiles!fk_tickets_assigned_agent (full_name),
                        ticket_attachments (*)
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
                    sender_role: 'requester',
                    content: replyText,
                    is_internal: false
                });

            if (error) throw error;

            setReplyText('');
            await fetchMessages(); // Refresh conversation

            // Auto-revert to In Progress if Resolved or Pending
            const currentStatus = ticket.ticket_statuses?.status_name;
            const updates: any = { updated_at: new Date().toISOString() };
            let shouldLogActivity = false;

            if (['Resolved', 'Pending'].includes(currentStatus)) {
                // Fetch In Progress ID
                const { data: statusData } = await supabase
                    .from('ticket_statuses')
                    .select('status_id')
                    .eq('status_name', 'In Progress')
                    .single();

                if (statusData) {
                    updates.status_id = statusData.status_id;
                    shouldLogActivity = true;
                }
            }

            // Always update ticket (at least updated_at)
            await supabase
                .from('tickets')
                .update(updates)
                .eq('id', ticketId);

            if (shouldLogActivity) {
                // Log activity
                await supabase.from('ticket_activity_log').insert({
                    ticket_id: ticketId,
                    actor_id: user.id,
                    action: 'Customer replied - Ticket Reopened'
                });
            }

            // Refresh ticket details locally
            const { data: updatedTicket } = await supabase
                .from('tickets')
                .select(`
                    *,
                    ticket_statuses!fk_tickets_status (status_name),
                    agent:profiles!fk_tickets_assigned_agent (full_name)
                `)
                .eq('id', ticketId)
                .single();
            if (updatedTicket) setTicket(updatedTicket);
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
        { label: 'In Progress', status: ['In Progress', 'WIP', 'Assigned'].includes(statusName) ? 'current' : (['Pending', 'Resolved', 'Closed'].includes(statusName) ? 'completed' : 'pending') },
        { label: 'Pending', status: statusName === 'Pending' ? 'current' : (['Resolved', 'Closed'].includes(statusName) ? 'completed' : 'pending') },
        { label: 'Resolved', status: statusName === 'Resolved' ? 'current' : (statusName === 'Closed' ? 'completed' : 'pending') }
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
                    {['Open', 'In Progress'].includes(ticket.ticket_statuses?.status_name) && (
                        <button
                            onClick={async () => {
                                // @ts-ignore
                                const Swal = (await import('sweetalert2')).default;
                                const { value: reason } = await Swal.fire({
                                    title: 'Cancel Ticket',
                                    input: 'textarea',
                                    inputLabel: 'Reason for cancellation',
                                    inputPlaceholder: 'Why are you cancelling this ticket?',
                                    showCancelButton: true,
                                    confirmButtonColor: '#ef4444',
                                    confirmButtonText: 'Yes, cancel it',
                                    inputValidator: (value) => {
                                        if (!value) {
                                            return 'You need to write a reason!'
                                        }
                                    }
                                });

                                if (reason) {
                                    try {
                                        setLoading(true);
                                        // Fetch 'Canceled' status ID
                                        const { data: statusData } = await supabase
                                            .from('ticket_statuses')
                                            .select('status_id')
                                            .eq('status_name', 'Canceled')
                                            .single();

                                        if (statusData) {
                                            // Update ticket
                                            const { error } = await supabase
                                                .from('tickets')
                                                .update({ status_id: statusData.status_id })
                                                .eq('id', ticketId);

                                            if (error) throw error;

                                            // Get user info for log
                                            const { data: { user } } = await supabase.auth.getUser();

                                            // Log activity
                                            await supabase.from('ticket_activity_log').insert({
                                                ticket_id: ticketId,
                                                actor_id: user?.id,
                                                action: `Ticket canceled by user. Reason: ${reason}`
                                            });

                                            // Refresh UI without reload
                                            setTicket((prev: any) => ({
                                                ...prev,
                                                status_id: statusData.status_id,
                                                ticket_statuses: { status_name: 'Canceled' }
                                            }));

                                            Swal.fire('Canceled', 'Ticket has been canceled.', 'success');
                                        }
                                    } catch (err: any) {
                                        console.error('Error canceling ticket:', err);
                                        Swal.fire('Error', 'Failed to cancel ticket', 'error');
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5"
                        >
                            <X size={16} />
                            Cancel Ticket
                        </button>
                    )}

                    {/* NEW: Mark as Resolved Button */}
                    {['Open', 'In Progress', 'Pending'].includes(ticket.ticket_statuses?.status_name) && (
                        <button
                            onClick={async () => {
                                // @ts-ignore
                                const Swal = (await import('sweetalert2')).default;
                                const { value: result } = await Swal.fire({
                                    title: 'Mark as Resolved?',
                                    text: "Are you sure this issue is resolved?",
                                    icon: 'question',
                                    showCancelButton: true,
                                    confirmButtonColor: '#10b981',
                                    cancelButtonColor: '#d33',
                                    confirmButtonText: 'Yes, it is resolved!',
                                    html: `
                                        <p class="mb-4 text-sm text-gray-600">You can optionally provide feedback:</p>
                                        <div class="flex justify-center gap-2 mb-4 text-2xl">
                                            <input type="radio" name="swal-rating" value="5" id="r5" class="hidden peer/5"/><label for="r5" class="cursor-pointer text-gray-300 peer-checked/5:text-yellow-400 hover:text-yellow-400 transition-colors">★</label>
                                            <input type="radio" name="swal-rating" value="4" id="r4" class="hidden peer/4"/><label for="r4" class="cursor-pointer text-gray-300 peer-checked/4:text-yellow-400 hover:text-yellow-400 transition-colors">★</label>
                                            <input type="radio" name="swal-rating" value="3" id="r3" class="hidden peer/3"/><label for="r3" class="cursor-pointer text-gray-300 peer-checked/3:text-yellow-400 hover:text-yellow-400 transition-colors">★</label>
                                            <input type="radio" name="swal-rating" value="2" id="r2" class="hidden peer/2"/><label for="r2" class="cursor-pointer text-gray-300 peer-checked/2:text-yellow-400 hover:text-yellow-400 transition-colors">★</label>
                                            <input type="radio" name="swal-rating" value="1" id="r1" class="hidden peer/1"/><label for="r1" class="cursor-pointer text-gray-300 peer-checked/1:text-yellow-400 hover:text-yellow-400 transition-colors">★</label>
                                        </div>
                                        <textarea id="swal-feedback" class="swal2-textarea" placeholder="Optional feedback..." style="margin: 0; width: 100%; font-size: 0.9em;"></textarea>
                                    `,
                                    preConfirm: () => {
                                        const ratingEl = document.querySelector('input[name="swal-rating"]:checked') as HTMLInputElement;
                                        const feedbackEl = document.getElementById('swal-feedback') as HTMLTextAreaElement;
                                        return {
                                            rating: ratingEl ? parseInt(ratingEl.value) : null,
                                            feedback: feedbackEl ? feedbackEl.value : null
                                        };
                                    }
                                });

                                if (result) {
                                    try {
                                        setLoading(true);
                                        const { data: { user } } = await supabase.auth.getUser();
                                        if (!user) throw new Error('Not authenticated');

                                        // Call the RPC function
                                        const { data: rpcData, error: rpcError } = await supabase.rpc('user_close_ticket', {
                                            p_ticket_id: ticketId,
                                            p_user_id: user.id,
                                            p_satisfaction_rating: result.rating,
                                            p_feedback: result.feedback
                                        });

                                        if (rpcError) throw rpcError;

                                        if (rpcData && rpcData.success) {
                                            // Refresh UI
                                            setTicket((prev: any) => ({
                                                ...prev,
                                                ticket_statuses: { status_name: 'Resolved' }
                                            }));
                                            Swal.fire('Resolved!', 'Ticket has been closed successfully.', 'success');
                                        } else {
                                            throw new Error(rpcData?.error || 'Failed to close ticket');
                                        }

                                    } catch (err: any) {
                                        console.error('Error resolving ticket:', err);
                                        Swal.fire('Error', err.message || 'Failed to resolve ticket', 'error');
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 flex items-center gap-2"
                        >
                            <CheckCircle size={16} /> Mark as Resolved
                        </button>
                    )}
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
                            <div className="flex-1 min-w-0">
                                <h1 className="text-sm font-bold text-gray-400 mb-1">{ticket.ticket_number}</h1>
                                <h2 className="text-2xl font-bold text-gray-900 break-words">{ticket.subject}</h2>
                            </div>
                            <div className="flex gap-3 shrink-0 flex-wrap">
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
                                <InfoItem label="Type" value={ticket.ticket_type ? ticket.ticket_type.charAt(0).toUpperCase() + ticket.ticket_type.slice(1) : '-'} />
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

                {/* Attachments Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Paperclip size={16} className="text-indigo-500" />
                        Attachments
                    </h3>
                    {(!ticket.ticket_attachments || ticket.ticket_attachments.length === 0) ? (
                        <div className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg border border-gray-100 flex items-center gap-2">
                            <Info size={14} />
                            No files attached to this ticket.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ticket.ticket_attachments?.map((file: any, index: number) => {
                                const fileUrl = supabase.storage.from('ticket-attachments').getPublicUrl(file.file_path).data.publicUrl;
                                return (
                                    <a
                                        key={file.id || index}
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-indigo-200 transition-all group"
                                    >
                                        <div className="p-2 bg-white rounded-md border border-gray-200 text-indigo-600 group-hover:text-indigo-700">
                                            <FileText size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700 truncate group-hover:text-indigo-700">{file.file_name}</p>
                                            <p className="text-xs text-gray-400">{file.mime_type || 'Unknown Type'}</p>
                                        </div>
                                        <ExternalLink size={14} className="text-gray-400 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                );
                            })}
                        </div>
                    )}
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
                                <div key={msg.id} className={`flex gap-3 mb-6 ${msg.sender_role === 'requester' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${msg.sender_role === 'requester' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                                        {(msg.sender?.full_name || msg.sender_role).charAt(0).toUpperCase()}
                                    </div>

                                    <div className={`max-w-[85%] flex flex-col ${msg.sender_role === 'requester' ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-slate-700">{msg.sender?.full_name || 'Support Agent'}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {msg.sender_role === 'requester' ? (
                                                <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                                                    Requester
                                                </span>
                                            ) : (
                                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                                                    Agent
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className={`py-3 px-4 shadow-sm text-sm leading-relaxed prose prose-sm max-w-none 
                                            ${msg.sender_role === 'requester'
                                                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-[2px]'
                                                    : 'bg-[#f0f2f5] text-slate-800 rounded-2xl rounded-tl-[2px] border border-slate-100'
                                                }`}
                                            dangerouslySetInnerHTML={{ __html: msg.content || '' }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Reply Composer */}
                    {['Closed', 'Canceled'].includes(statusName) ? (
                        <div className="p-8 bg-gray-50 border-t border-gray-100 rounded-b-xl flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center mb-3">
                                <Lock size={24} />
                            </div>
                            <h3 className="text-gray-800 font-bold mb-1">
                                This ticket is {statusName}
                            </h3>
                            <p className="text-gray-500 text-sm max-w-md">
                                Replies are disabled for this ticket. If you have further updates or issues, please create a new ticket.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 bg-white border-t border-gray-100 rounded-b-xl px-4 pb-6 pt-4">
                            <RichTextEditor
                                content={replyText}
                                onChange={setReplyText}
                                placeholder="Type your message here... (Paste images allowed)"
                                minHeight="120px"
                            />
                            <div className="mt-4 flex justify-end">
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
                    )}
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
