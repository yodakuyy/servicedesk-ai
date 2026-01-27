import React, { useState, useEffect } from 'react';
import {
    Search, Filter, Clock, AlertCircle, CheckCircle2, MoreHorizontal,
    MessageSquare, FileText, GitBranch, Shield, Send, Sparkles,
    ChevronRight, ChevronLeft, Paperclip, Mic, User, Copy, ExternalLink,
    ThumbsUp, RefreshCw, AlertTriangle, Loader2, Zap, X, Info, BookOpen,
    ArrowUpRight, BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import RichTextEditor from './RichTextEditor';

interface AgentTicketViewProps {
    userProfile?: any;
}

const AgentTicketView: React.FC<AgentTicketViewProps> = ({ userProfile }) => {
    // State
    const [tickets, setTickets] = useState<any[]>([]);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<'conversation' | 'details' | 'workflow' | 'sla'>('conversation');
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [aiInsight, setAiInsight] = useState<any>(null);
    const [agentGroups, setAgentGroups] = useState<string[]>([]);

    useEffect(() => {
        const fetchAgentGroups = async () => {
            if (!userProfile?.id) return;
            const { data } = await supabase.from('user_groups').select('group_id').eq('user_id', userProfile.id);
            if (data) setAgentGroups(data.map(g => g.group_id));
        };
        fetchAgentGroups();
    }, [userProfile]);

    useEffect(() => {
        const fetchTickets = async () => {
            if (agentGroups.length === 0) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            const { data } = await supabase
                .from('tickets')
                .select(`
                    id, ticket_number, subject, priority, created_at, assignment_group_id,
                    ticket_statuses!fk_tickets_status (status_name),
                    requester:profiles!fk_tickets_requester (full_name)
                `)
                .in('assignment_group_id', agentGroups)
                .order('created_at', { ascending: false });

            if (data) {
                setTickets(data);
                if (data.length > 0 && !selectedTicketId) setSelectedTicketId(data[0].id);
            }
            setIsLoading(false);
        };
        if (agentGroups.length > 0) fetchTickets();
    }, [agentGroups]);

    useEffect(() => {
        if (!selectedTicketId) return;
        const fetchDetails = async () => {
            const { data: ticket } = await supabase
                .from('tickets')
                .select(`
                    *,
                    ticket_statuses!fk_tickets_status (status_name),
                    ticket_categories (name),
                    services (name),
                    requester:profiles!fk_tickets_requester (full_name, email),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name),
                    group:groups!assignment_group_id (name)
                `)
                .eq('id', selectedTicketId)
                .single();
            setSelectedTicket(ticket);

            const { data: aiData } = await supabase.from('ticket_ai_insights').select('*').eq('ticket_id', selectedTicketId).single();
            setAiInsight(aiData);

            const { data: msgs } = await supabase
                .from('ticket_messages')
                .select('*, sender:profiles!sender_id(full_name)')
                .eq('ticket_id', selectedTicketId)
                .order('created_at', { ascending: true });

            if (msgs) {
                setMessages(msgs.map(m => ({
                    ...m,
                    content: m.message_content,
                    sender_name: m.sender?.full_name || (m.sender_type === 'requester' ? 'User' : 'Agent')
                })));
            }
        };
        fetchDetails();
    }, [selectedTicketId]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedTicketId) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('ticket_messages').insert({
                ticket_id: selectedTicketId,
                sender_id: user.id,
                sender_type: 'agent',
                message_content: newMessage
            });
            setNewMessage('');
            const { data: msgs } = await supabase
                .from('ticket_messages')
                .select('*, sender:profiles!sender_id(full_name)')
                .eq('ticket_id', selectedTicketId)
                .order('created_at', { ascending: true });
            if (msgs) {
                setMessages(msgs.map(m => ({
                    ...m,
                    content: m.message_content,
                    sender_name: m.sender?.full_name || 'Agent'
                })));
            }
        } catch (err) { console.error(err); }
    };

    return (
        <div className="flex h-full bg-[#f8f9fa] font-sans overflow-hidden text-[#333]">

            {/* 1. LEFT PANEL - Ticket List */}
            <div className="w-[320px] flex flex-col border-r border-gray-200 bg-white">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                        <input type="text" placeholder="Search Incidents..." className="w-full bg-gray-50 border border-gray-100 rounded-md py-1.5 pl-8 pr-3 text-xs focus:ring-1 focus:ring-blue-500/20" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {tickets.map(ticket => (
                        <div
                            key={ticket.id}
                            onClick={() => setSelectedTicketId(ticket.id)}
                            className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${selectedTicketId === ticket.id ? 'bg-blue-50/50' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${ticket.priority === 'High' ? 'bg-red-500' : 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]'}`} />
                                    <span className="font-bold text-xs text-blue-600">{ticket.ticket_number}</span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">4m ago</span>
                            </div>
                            <h4 className="text-[13px] font-semibold text-gray-700 line-clamp-1 mb-1 leading-snug">
                                {ticket.subject}
                            </h4>
                            <div className="flex justify-between items-center text-[11px] font-medium">
                                <span className="text-gray-400 truncate max-w-[120px]">{ticket.requester?.full_name || 'Anonymous'}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-red-500 font-bold tracking-tighter text-[10px]">00:14:21</span>
                                </div>
                            </div>
                            <div className="mt-1 text-[10px] text-gray-400 italic">{ticket.ticket_statuses?.status_name}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. CENTER PANEL - Incident Detail */}
            {selectedTicket ? (
                <div className="flex-1 flex flex-col min-w-0 bg-white">
                    {/* Header Section */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                                <h1 className="text-xl font-black text-gray-800 mb-2">
                                    {selectedTicket.ticket_number} &nbsp; {selectedTicket.subject}
                                </h1>
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-1 bg-red-100 text-red-600 rounded text-[10px] font-black tracking-widest uppercase border border-red-200">
                                        P1 - Critical
                                    </span>
                                    <span className="px-2.5 py-1 bg-amber-100 text-amber-600 rounded text-[10px] font-black tracking-widest uppercase border border-amber-200">
                                        {selectedTicket.ticket_statuses?.status_name}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all">Assign to me</button>
                                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg border border-gray-200"><MoreHorizontal size={16} /></button>
                            </div>
                        </div>

                        {/* Real SLA Bar */}
                        <div className="mt-6 flex flex-col gap-1.5">
                            <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-gray-400 font-black uppercase tracking-widest">Response SLA</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-red-500">75% Used</span>
                                    <span className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                                        <Clock size={10} /> 00:01:23
                                    </span>
                                </div>
                            </div>
                            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                                <div className="h-full bg-green-500 border-r border-white/20" style={{ width: '45%' }} />
                                <div className="h-full bg-amber-500 border-r border-white/20" style={{ width: '30%' }} />
                                <div className="h-full bg-gray-200" style={{ width: '25%' }} />
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-gray-100 px-6">
                        <TabItem active={activeTab === 'conversation'} onClick={() => setActiveTab('conversation')} icon={MessageSquare} label="Conversation" />
                        <TabItem active={activeTab === 'details'} onClick={() => setActiveTab('details')} icon={FileText} label="Details" />
                        <TabItem active={activeTab === 'workflow'} onClick={() => setActiveTab('workflow')} icon={GitBranch} label="Work Flow" />
                        <TabItem active={activeTab === 'sla'} onClick={() => setActiveTab('sla')} icon={Clock} label="SLA" />
                    </div>

                    {/* Panel Content Area */}
                    <div className="flex-1 overflow-y-auto bg-white p-6 relative custom-scrollbar">
                        {activeTab === 'conversation' && (
                            <div className="space-y-8 max-w-4xl mx-auto pb-10">
                                {selectedTicket.description && (
                                    <div className="flex gap-4 group">
                                        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-black flex-shrink-0 text-white shadow-lg shadow-indigo-100">
                                            {selectedTicket.requester?.full_name?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[13px] font-black text-gray-900">{selectedTicket.requester?.full_name}</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(selectedTicket.created_at).toLocaleString()}</span>
                                                <span className="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 py-0.5 font-black uppercase rounded-md border border-indigo-100 flex items-center gap-1">
                                                    <FileText size={10} /> Initial Issue
                                                </span>
                                            </div>
                                            <div className="bg-white p-5 rounded-2xl border-2 border-indigo-50 shadow-sm text-[14px] text-gray-700 leading-relaxed font-medium transition-all hover:border-indigo-100">
                                                <div className="prose prose-indigo prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedTicket.description }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {messages.map((msg) => (
                                    <div key={msg.id} className="flex gap-4">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${msg.sender_type === 'agent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {msg.sender_name?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[13px] font-bold text-gray-800">{msg.sender_name}</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {msg.sender_type === 'agent' && <span className="bg-amber-100 text-amber-700 text-[9px] px-1 font-black uppercase rounded ml-2">Internal Note</span>}
                                            </div>
                                            <div className={`text-[13.5px] text-gray-600 leading-relaxed font-medium prose prose-sm max-w-none ${msg.sender_type === 'agent' ? 'bg-amber-50/30 p-4 rounded-xl border border-amber-100/50' : ''}`} dangerouslySetInnerHTML={{ __html: msg.content }} />
                                        </div>
                                    </div>
                                ))}

                                {/* System Divider */}
                                <div className="flex items-center gap-4 py-6 opacity-40">
                                    <div className="h-px bg-gray-200 flex-1" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Ticket Status changed to Waiting Agent by Yogi Danis</span>
                                    <div className="h-px bg-gray-200 flex-1" />
                                </div>
                            </div>
                        )}

                        {activeTab === 'details' && (
                            <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
                                <div className="space-y-4">
                                    <DetailRow label="Category" value={selectedTicket.ticket_categories?.name || '-'} />
                                    <DetailRow label="Impact" value="Enterprise" />
                                    <DetailRow label="Urgency" value="High" />
                                    <DetailRow label="Affected Service" value={selectedTicket.services?.name || '-'} />
                                </div>
                                <div className="space-y-4">
                                    <DetailRow label="Requester" value={selectedTicket.requester?.full_name} />
                                    <DetailRow label="Email" value={selectedTicket.requester?.email} />
                                    <DetailRow label="Assignee" value={selectedTicket.assigned_agent?.full_name || 'Unassigned'} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'workflow' && (
                            <div className="max-w-3xl mx-auto py-4">
                                <div className="space-y-8">
                                    {[
                                        { step: 'Identification', date: selectedTicket.created_at, status: 'completed', desc: 'Incident logged via Portal' },
                                        { step: 'Classification', date: selectedTicket.created_at, status: 'completed', desc: 'Priority set to P1 - Critical' },
                                        { step: 'Investigation', date: null, status: 'current', desc: 'Currently being handled by ' + (selectedTicket?.assigned_agent?.full_name || 'Service Desk') },
                                        { step: 'Resolution', date: null, status: 'pending', desc: 'Awaiting solution confirmation' },
                                        { step: 'Closure', date: null, status: 'pending', desc: 'Final review and documentation' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex gap-6 relative">
                                            {idx !== 4 && <div className="absolute left-[13px] top-6 bottom-[-32px] w-0.5 bg-gray-100" />}
                                            <div className={`w-7 h-7 rounded-sm flex items-center justify-center z-10 ${item.status === 'completed' ? 'bg-green-100 text-green-600' :
                                                item.status === 'current' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' :
                                                    'bg-gray-50 text-gray-300 border border-gray-100'
                                                }`}>
                                                {item.status === 'completed' ? <CheckCircle2 size={14} /> : <div className="text-[10px] font-black">{idx + 1}</div>}
                                            </div>
                                            <div className="flex-1 pb-4">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h4 className={`text-sm font-black uppercase tracking-widest ${item.status === 'pending' ? 'text-gray-300' : 'text-gray-800'}`}>{item.step}</h4>
                                                    {item.date && <span className="text-[10px] font-bold text-gray-400">{new Date(item.date).toLocaleString()}</span>}
                                                </div>
                                                <p className={`text-xs ${item.status === 'pending' ? 'text-gray-300' : 'text-gray-500 font-medium'}`}>{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'sla' && (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Applied SLA Policy</h4>
                                        <div className="text-lg font-black text-slate-800">Standard Enterprise - P1 Priority</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</div>
                                        <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black border border-red-100">AT RISK</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <SLACard
                                        label="First Response"
                                        target="15 Minutes"
                                        actual="12m 45s"
                                        status="met"
                                    />
                                    <SLACard
                                        label="Resolution"
                                        target="4 Hours"
                                        actual="3h 14m 21s (Elapsed)"
                                        status="running"
                                    />
                                </div>

                                <div className="pt-6 border-t border-gray-100">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Milestones History</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-bold py-2 border-b border-gray-50">
                                            <span className="text-gray-500">Ticket Created</span>
                                            <span className="text-gray-800">{new Date(selectedTicket.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold py-2 border-b border-gray-50">
                                            <span className="text-gray-500">SLA Response Counter Started</span>
                                            <span className="text-gray-800">{new Date(selectedTicket.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold py-2">
                                            <span className="text-gray-500">First Response Met</span>
                                            <span className="text-green-600">SUCCESS</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Composer */}
                    {activeTab === 'conversation' && (
                        <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
                            <div className="flex gap-5 mb-4 border-b border-gray-50">
                                <button className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-600 pb-3">Reply</button>
                                <button className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-500 pb-3 transition-colors">Internal Note</button>
                            </div>
                            <RichTextEditor
                                content={newMessage}
                                onChange={setNewMessage}
                                placeholder="Type your response..."
                                minHeight="80px"
                            />
                            <div className="flex justify-between items-center mt-4">
                                <button className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 transition-all">
                                    <Sparkles size={14} fill="currentColor" /> Insert AI Suggestion
                                </button>
                                <button
                                    onClick={handleSendMessage}
                                    className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                                >
                                    <Send size={14} /> Send Reply
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400 font-bold italic">Loading incident workspace...</div>
            )}

            {/* 3. RIGHT PANEL - AI COPILOT */}
            <div className={`transition-all duration-300 border-l border-gray-200 bg-white flex flex-col ${isRightPanelOpen ? 'w-[360px]' : 'w-12 overflow-hidden'}`}>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    {isRightPanelOpen && (
                        <div className="flex items-center gap-2 text-indigo-600">
                            <Sparkles size={18} fill="currentColor" />
                            <h2 className="font-black text-xs uppercase tracking-widest">AI Copilot</h2>
                            <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100 font-black">Active</span>
                        </div>
                    )}
                    <button onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} className="p-2 text-gray-300 hover:text-indigo-600 transition-colors">
                        {isRightPanelOpen ? <ChevronRight size={18} /> : <Sparkles size={18} />}
                    </button>
                </div>

                {isRightPanelOpen && (
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                        <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                            <span>Diagnostic Engine</span>
                            <span className="text-blue-500">Confidence: High</span>
                        </div>

                        {/* Summary Card */}
                        <AICard title="Ticket Summary" icon={FileText}>
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 font-medium leading-relaxed">
                                    <li>User cannot login to Finance System since 09:10.</li>
                                    <li>Error indicates "permission denied" error.</li>
                                    <li>Incident affects Finance department specifically.</li>
                                </ul>
                                <button className="mt-4 w-full text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Apply To Description</button>
                            </div>
                        </AICard>

                        {/* Classification Card */}
                        <AICard title="Suggested Classification" icon={Shield}>
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-tighter">Category</span>
                                    <span className="text-gray-800 font-black">Access → Perms Denied</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-tighter">Priority</span>
                                    <span className="text-red-500 font-black">P1 - Critical</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <button className="py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm">Apply</button>
                                    <button className="py-2.5 bg-white text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100">Edit</button>
                                </div>
                            </div>
                        </AICard>

                        {/* Suggested Reply Card */}
                        <AICard title="Suggested Reply" icon={Zap}>
                            <div className="bg-green-50/30 p-4 rounded-xl border border-green-100 space-y-3">
                                <p className="text-[12px] text-gray-700 italic font-medium leading-relaxed">
                                    "Halo Pak Budi, kami sedang cek akses akun Anda. Mohon konfirmasi apakah error muncul di semua menu atau hanya laporan?"
                                </p>
                                <div className="flex gap-2">
                                    <button className="flex-1 py-2 bg-white text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-green-200 flex items-center justify-center gap-2 shadow-sm">
                                        <Copy size={12} /> Insert
                                    </button>
                                    <button className="flex-1 py-2 bg-white text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100 flex items-center justify-center gap-2">
                                        <RefreshCw size={12} /> Rewrite
                                    </button>
                                </div>
                            </div>
                        </AICard>

                        {/* Knowledge Card */}
                        <AICard title="Knowledge & KB" icon={BookOpen}>
                            <div className="space-y-3">
                                <button className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 text-indigo-600 transition-all flex items-center justify-between group">
                                    <span className="text-xs font-black truncate pr-4">System How-To: Reset Finance Role</span>
                                    <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                </button>
                                <button className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 text-indigo-600 transition-all flex items-center justify-between group">
                                    <span className="text-xs font-black truncate pr-4">User Guide: Login Finance System</span>
                                    <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                </button>
                            </div>
                        </AICard>

                        {/* SLA Risk Card */}
                        <AICard title="SLA Risk Analysis" icon={BarChart3}>
                            <div className="bg-red-50/30 p-4 rounded-xl border border-red-100 space-y-4">
                                <div className="flex justify-between items-center font-black">
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">Breach Risk</span>
                                    <span className="text-red-500 text-xs tracking-tighter">87% - CRITICAL</span>
                                </div>
                                <div className="h-2 w-full bg-white rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-red-500" style={{ width: '87%' }} />
                                </div>
                                <ul className="text-[10px] text-gray-500 font-bold space-y-1 mt-2">
                                    <li>• Time elapsed: 14m (75% SLA)</li>
                                    <li>• No agent response yet</li>
                                </ul>
                            </div>
                        </AICard>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ced4da; }
            `}} />
        </div>
    );
};

// --- SUB COMPONENTS ---

const TabItem: React.FC<{ active: boolean, onClick: () => void, icon: any, label: string }> = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={`py-3.5 px-6 flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] transition-all relative ${active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
    >
        <Icon size={14} fill={active ? "currentColor" : "none"} className={active ? "opacity-20 absolute left-4 blur-[2px]" : ""} />
        <span className="relative z-10">{label}</span>
        {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]" />}
    </button>
);

const DetailRow: React.FC<{ label: string, value: string }> = ({ label, value }) => (
    <div className="flex flex-col gap-1 py-1.5 border-b border-gray-50 last:border-0">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
        <span className="text-[13px] font-bold text-gray-800">{value || '-'}</span>
    </div>
);

const SLACard: React.FC<{ label: string, target: string, actual: string, status: 'met' | 'breached' | 'running' }> = ({ label, target, actual, status }) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">{label}</div>
        <div className="space-y-4">
            <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-400">Target</span>
                <span className="text-gray-800">{target}</span>
            </div>
            <div className="flex justify-between text-xs font-black">
                <span className="text-gray-400 font-bold">{status === 'running' ? 'Elapsed' : 'Actual'}</span>
                <span className={status === 'met' ? 'text-green-600' : status === 'breached' ? 'text-red-600' : 'text-amber-600'}>{actual}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden mt-2">
                <div className={`h-full ${status === 'met' ? 'bg-green-500' : status === 'breached' ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: status === 'met' ? '100%' : '75%' }} />
            </div>
        </div>
    </div>
);

const AICard: React.FC<{ title: string, icon: any, children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="space-y-3 group">
        <div className="flex items-center gap-2 pl-1">
            <Icon size={14} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{title}</h4>
        </div>
        {children}
    </div>
);

export default AgentTicketView;
