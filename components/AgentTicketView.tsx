import React, { useState } from 'react';
import {
    Search, Filter, Clock, AlertCircle, CheckCircle2, MoreHorizontal,
    MessageSquare, FileText, GitBranch, Shield, Send, Sparkles,
    ChevronRight, ChevronLeft, Paperclip, Mic, User, Copy, ExternalLink,
    ThumbsUp, RefreshCw, AlertTriangle
} from 'lucide-react';

const AgentTicketView: React.FC = () => {
    const [selectedTicketId, setSelectedTicketId] = useState<string>('INC-10231');
    const [activeTab, setActiveTab] = useState<'conversation' | 'details' | 'workflow' | 'sla'>('conversation');
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

    // Mock Data
    const tickets = [
        {
            id: 'INC-10231',
            subject: 'Login Failed – Finance System',
            priority: 'P1',
            status: 'Waiting Agent',
            sla_status: 'critical', // critical, warning, safe
            sla_time: '00:14:21',
            requester: 'Budi Santoso',
            updated: '10m ago'
        },
        {
            id: 'INC-10230',
            subject: 'Printer 5th Floor Jammed',
            priority: 'P3',
            status: 'In Progress',
            sla_status: 'warning',
            sla_time: '02:45:00',
            requester: 'Sarah Lee',
            updated: '1h ago'
        },
        {
            id: 'INC-10229',
            subject: 'WiFi Slow in Meeting Room B',
            priority: 'P2',
            status: 'Assigned',
            sla_status: 'safe',
            sla_time: '04:20:00',
            requester: 'Mike Chen',
            updated: '3h ago'
        }
    ];

    const timeline = [
        {
            id: 1,
            type: 'requester',
            author: 'Budi Santoso',
            time: '09:10',
            content: 'Saya tidak bisa login ke Finance System. Muncul error "Access Denied" padahal kemarin bisa.'
        },
        {
            id: 2,
            type: 'internal',
            author: 'Agent (You)',
            time: '09:12',
            content: 'Kemungkinan role belum ter-assign setelah update sistem semalam.'
        },
        {
            id: 3,
            type: 'system',
            content: 'SLA Status changed to Warning (75% time used)'
        }
    ];

    return (
        <div className="h-full w-full flex bg-white font-sans overflow-hidden border-t border-gray-200">
            {/* LEFT PANEL - Ticket List */}
            <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col bg-slate-50">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search ticket..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <button className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            My Tickets
                            <ChevronHeader />
                        </button>
                        <button className="text-gray-500 hover:text-gray-700 p-1">
                            <Filter size={16} />
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {tickets.map(ticket => (
                        <div
                            key={ticket.id}
                            onClick={() => setSelectedTicketId(ticket.id)}
                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition-colors ${selectedTicketId === ticket.id ? 'bg-white border-l-4 border-l-indigo-600 shadow-sm' : 'border-l-4 border-l-transparent'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <SLAIndicator status={ticket.sla_status} />
                                    <span className="font-bold text-xs text-indigo-600">{ticket.id}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">{ticket.updated}</span>
                            </div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2 line-clamp-2 leading-tight">
                                {ticket.subject}
                            </h4>
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ticket.priority === 'P1' ? 'bg-red-50 text-red-700 border-red-100' :
                                        ticket.priority === 'P2' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                            'bg-blue-50 text-blue-700 border-blue-100'
                                        }`}>
                                        {ticket.priority}
                                    </span>
                                    <span className="text-[10px] text-gray-500">{ticket.status}</span>
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-mono font-medium ${ticket.sla_status === 'critical' ? 'text-red-600' :
                                    ticket.sla_status === 'warning' ? 'text-orange-500' : 'text-green-600'
                                    }`}>
                                    <Clock size={10} />
                                    {ticket.sla_time}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CENTER PANEL - Ticket Detail */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* 1. Ticket Header */}
                <div className="p-5 border-b border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-xl font-bold text-gray-900">INC-10231</h1>
                                <span className="text-gray-300">|</span>
                                <h1 className="text-xl font-bold text-gray-900">Login Failed – Finance System</h1>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-700 border border-pink-200">
                                    <AlertCircle size={12} />
                                    P1 - Critical
                                </span>
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                    Waiting Agent
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                                Assign to me
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                    </div>

                    {/* SLA Progress Bar */}
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex items-center gap-4">
                        <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-gray-600">Response SLA</span>
                                <span className="font-bold text-red-600">75% Used</span>
                            </div>
                            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 w-[75%] rounded-full"></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-red-600 font-bold font-mono text-sm bg-white px-3 py-1 rounded border border-red-100 shadow-sm">
                            <Clock size={14} />
                            00:14:21
                        </div>
                    </div>
                </div>

                {/* 2. Tabs Navigation */}
                <div className="flex border-b border-gray-200 px-4">
                    <TabItem active={activeTab === 'conversation'} onClick={() => setActiveTab('conversation')} icon={MessageSquare} label="Conversation" />
                    <TabItem active={activeTab === 'details'} onClick={() => setActiveTab('details')} icon={FileText} label="Details" />
                    <TabItem active={activeTab === 'workflow'} onClick={() => setActiveTab('workflow')} icon={GitBranch} label="Workflow" />
                    <TabItem active={activeTab === 'sla'} onClick={() => setActiveTab('sla')} icon={Shield} label="SLA" />
                </div>

                {/* 3. Panel Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 relative">
                    {/* Conversation View */}
                    {activeTab === 'conversation' && (
                        <div className="max-w-3xl mx-auto pb-40">
                            <div className="space-y-6">
                                {timeline.map((msg) => (
                                    <div key={msg.id} className={`flex gap-4 ${msg.type === 'internal' ? 'bg-yellow-50/50 p-4 rounded-xl border border-yellow-100' : ''}`}>
                                        {msg.type !== 'system' && (
                                            <div className="flex-shrink-0">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${msg.type === 'internal' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                                                    {msg.author?.charAt(0)}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex-1">
                                            {msg.type === 'system' ? (
                                                <div className="flex items-center justify-center gap-2 text-xs text-gray-400 my-2">
                                                    <div className="h-px bg-gray-200 w-12"></div>
                                                    <span>{msg.content}</span>
                                                    <div className="h-px bg-gray-200 w-12"></div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-sm text-gray-900">{msg.author}</span>
                                                        <span className="text-xs text-gray-500">{msg.time}</span>
                                                        {msg.type === 'internal' && (
                                                            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">INTERNAL NOTE</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-800 leading-relaxed">{msg.content}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Details View */}
                    {activeTab === 'details' && (
                        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="space-y-4">
                                <DetailRow label="Category" value="Access Issue > Permission Denied" editable />
                                <DetailRow label="Impact" value="High" badge="red" />
                                <DetailRow label="Urgency" value="High" badge="red" />
                                <DetailRow label="Department" value="Finance" />
                                <DetailRow label="Service" value="Finance System" />
                                <DetailRow label="Requester" value="Budi Santoso" />
                            </div>
                        </div>
                    )}

                    {/* Workflow View */}
                    {activeTab === 'workflow' && (
                        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                            <div className="space-y-0 relative">
                                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-100"></div>
                                <WorkflowStep status="completed" title="Ticket Created" date="Today, 09:10" />
                                <WorkflowStep status="completed" title="Assigned to Group DIT" date="Today, 09:11" />
                                <WorkflowStep status="active" title="Verify Access" date="In Progress" />
                                <WorkflowStep status="pending" title="Apply Fix" />
                                <WorkflowStep status="pending" title="User Confirmation" />
                                <WorkflowStep status="pending" title="Resolved" />
                            </div>
                            <div className="mt-8 pt-6 border-t border-gray-100 flex gap-3">
                                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Move Next</button>
                                <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Request Approval</button>
                            </div>
                        </div>
                    )}

                    {/* SLA Tab */}
                    {activeTab === 'sla' && (
                        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="font-bold text-gray-800 mb-4">Applied Policy: Finance P1 SLA</h3>
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-green-50 border border-green-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="text-green-600" />
                                        <div>
                                            <p className="font-semibold text-gray-800">First Response</p>
                                            <p className="text-xs text-gray-500">Target: 15 mins</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-green-700">Met (00:10:00)</span>
                                </div>
                                <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <Clock className="text-amber-600 animate-pulse" />
                                        <div>
                                            <p className="font-semibold text-gray-800">Resolution</p>
                                            <p className="text-xs text-gray-500">Target: 4 hours</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-amber-700">Running (14 mins left)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>


                {activeTab === 'conversation' && (
                    <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                        <div className="flex gap-2 mb-2">
                            <button className="text-sm font-bold text-gray-800 border-b-2 border-indigo-600 px-2 py-1">Reply</button>
                            <button className="text-sm font-medium text-gray-500 hover:text-gray-700 px-2 py-1">Internal Note</button>
                        </div>
                        <div className="relative">
                            <textarea
                                className="w-full h-24 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none text-sm"
                                placeholder="Type your response..."
                            ></textarea>
                            <div className="absolute bottom-3 right-3 flex gap-2">
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"><Paperclip size={16} /></button>
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"><Mic size={16} /></button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-3">
                            <button className="flex items-center gap-2 text-indigo-600 text-xs font-bold hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-dashed border-indigo-200">
                                <Sparkles size={14} />
                                Insert AI Suggestion
                            </button>
                            <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors">
                                <Send size={16} />
                                Send Reply
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT PANEL - AI Copilot */}
            <div className={`transition-all duration-300 ease-in-out border-l border-gray-200 bg-white flex flex-col ${isRightPanelOpen ? 'w-80' : 'w-12 overflow-hidden'}`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 bg-indigo-50/30 flex justify-between items-center">
                    {isRightPanelOpen ? (
                        <div className="flex items-center gap-2">
                            <Sparkles className="text-indigo-600" size={18} />
                            <h2 className="font-bold text-gray-800">AI Copilot</h2>
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold border border-green-200">
                                High Conf.
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 w-full pt-2">
                            <button onClick={() => setIsRightPanelOpen(true)}><Sparkles className="text-indigo-600" size={20} /></button>
                        </div>
                    )}
                    <button onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} className="text-gray-400 hover:text-gray-600">
                        {isRightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                {isRightPanelOpen && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {/* 1. Summary */}
                        <AICard title="Ticket Summary" icon={FileText} className="bg-slate-50 border-slate-100">
                            <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-gray-700">
                                <li>User cannot login to Finance System.</li>
                                <li>Error indicates <strong>permission issue</strong>.</li>
                                <li>Incident affects Finance department.</li>
                            </ul>
                            <button className="mt-3 w-full text-xs font-medium text-indigo-600 border border-indigo-200 rounded py-1.5 hover:bg-indigo-50">
                                Apply to Description
                            </button>
                        </AICard>

                        {/* 2. Suggestion */}
                        <AICard title="Suggested Classification" icon={Shield} className="bg-blue-50/50 border-blue-100">
                            <div className="space-y-2 mb-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Category</span>
                                    <span className="font-medium">Access &gt; Perm. Denied</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Priority</span>
                                    <span className="font-bold text-red-600">P1 (Critical)</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="flex-1 bg-indigo-600 text-white text-xs py-1.5 rounded hover:bg-indigo-700">Apply</button>
                                <button className="flex-1 bg-white border border-gray-200 text-gray-600 text-xs py-1.5 rounded hover:bg-gray-50">Edit</button>
                            </div>
                        </AICard>

                        {/* 3. Suggested Reply */}
                        <AICard title="Suggested Reply" icon={MessageSquare} className="bg-purple-50/50 border-purple-100">
                            <p className="text-xs text-gray-700 italic border-l-2 border-purple-300 pl-2 mb-3">
                                "Halo Pak Budi, kami sedang melakukan pengecekan akses akun Anda. Mohon konfirmasi apakah error muncul di semua menu?"
                            </p>
                            <div className="flex gap-2">
                                <button className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs py-1.5 rounded hover:bg-gray-50">
                                    <ThumbsUp size={12} /> Insert
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs py-1.5 rounded hover:bg-gray-50">
                                    <RefreshCw size={12} /> Rewrite
                                </button>
                            </div>
                        </AICard>

                        {/* 4. Knowledge */}
                        <AICard title="Knowledge Base" icon={ExternalLink} className="bg-green-50/50 border-green-100">
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <ExternalLink size={12} className="mt-1 text-indigo-500" />
                                    <a href="#" className="text-xs text-indigo-600 hover:underline">System How-To: Reset Finance Role</a>
                                </div>
                                <div className="flex items-start gap-2">
                                    <ExternalLink size={12} className="mt-1 text-indigo-500" />
                                    <a href="#" className="text-xs text-indigo-600 hover:underline">User Guide: Login Finance System</a>
                                </div>
                            </div>
                        </AICard>

                        {/* 5. SLA Risk */}
                        <AICard title="SLA Risk Analysis" icon={AlertTriangle} className="bg-red-50/50 border-red-100">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-red-700">Risk: High (87%)</span>
                                <div className="h-1.5 w-16 bg-gray-200 rounded-full">
                                    <div className="h-full bg-red-500 w-[87%] rounded-full"></div>
                                </div>
                            </div>
                            <ul className="list-disc ml-4 text-[10px] text-gray-600">
                                <li>Waiting requester response</li>
                                <li>Resolution SLA &lt; 15 minutes left</li>
                            </ul>
                        </AICard>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub Components ---

const ChevronHeader = () => <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

const SLAIndicator: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'critical') return <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm animate-pulse"></div>;
    if (status === 'warning') return <div className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-sm"></div>;
    return <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div>;
};

const TabItem: React.FC<{ active: boolean, onClick: () => void, icon: any, label: string }> = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${active ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
    >
        <Icon size={16} />
        {label}
    </button>
);

const DetailRow: React.FC<{ label: string, value: string, editable?: boolean, badge?: string }> = ({ label, value, editable, badge }) => (
    <div className="flex border-b border-gray-50 pb-2 last:border-0 last:pb-0">
        <span className="w-32 text-sm text-gray-500 font-medium">{label}</span>
        <div className="flex-1 flex justify-between items-center group">
            {badge ? (
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${badge === 'red' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{value}</span>
            ) : (
                <span className="text-sm text-gray-900 font-medium">{value}</span>
            )}
            {editable && (
                <button className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-6 h-6 flex items-center justify-center rounded hover:bg-indigo-50">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </div>
                </button>
            )}
        </div>
    </div>
);

const WorkflowStep: React.FC<{ status: 'completed' | 'active' | 'pending', title: string, date?: string }> = ({ status, title, date }) => (
    <div className="flex gap-4 relative mb-6 last:mb-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 ${status === 'completed' ? 'bg-indigo-600 border-indigo-600 text-white' :
            status === 'active' ? 'bg-white border-indigo-600 text-indigo-600 animate-pulse' :
                'bg-white border-gray-200 text-gray-300'
            }`}>
            {status === 'completed' ? <CheckCircle2 size={16} /> :
                status === 'active' ? <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div> :
                    <div className="w-2.5 h-2.5 bg-gray-200 rounded-full"></div>
            }
        </div>
        <div>
            <h4 className={`text-sm font-bold ${status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>{title}</h4>
            {date && <p className="text-xs text-gray-500 mt-0.5">{date}</p>}
        </div>
    </div>
);

const AICard: React.FC<{ title: string, icon: any, children: React.ReactNode, className?: string }> = ({ title, icon: Icon, children, className }) => (
    <div className={`p-4 rounded-xl border ${className}`}>
        <div className="flex items-center gap-2 mb-3">
            <Icon size={14} className="text-gray-500" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{title}</h3>
        </div>
        {children}
    </div>
);

export default AgentTicketView;
