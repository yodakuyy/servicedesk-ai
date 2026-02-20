import React, { useState, useEffect } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    LayoutDashboard,
    Ticket,
    BookOpen,
    Zap,
    Clock,
    BarChart3,
    ShieldCheck,
    Code2,
    Users,
    Bell,
    CheckCircle2,
    X,
    Play,
    Type,
    List,
    Paperclip,
    FileText,
    Search,
    ArrowDown,
    MessageSquare,
    Printer,
    RefreshCw,
    GitBranch
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981'];

interface SlideProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    isActive: boolean;
}

const Slide: React.FC<SlideProps> = ({ title, subtitle, children, isActive }) => (
    <div className={`absolute inset-0 transition-all duration-700 flex flex-col p-8 lg:p-16 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20 pointer-events-none'}`}>
        <div className="mb-12">
            <h2 className="text-4xl lg:text-6xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                {title}
            </h2>
            {subtitle && <p className="text-xl lg:text-2xl text-indigo-200/80 max-w-2xl">{subtitle}</p>}
        </div>
        <div className="flex-1 relative overflow-hidden">
            {children}
        </div>
    </div>
);

const PresentationView: React.FC<{ onExit: () => void }> = ({ onExit }) => {


    const slides = [
        {
            id: 'title',
            title: 'ServiceDesk',
            subtitle: 'The ultimate enterprise-grade ticketing and automation platform designed for modern IT teams.',
            content: (
                <div className="h-full flex flex-col justify-center items-center text-center">
                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full animate-pulse"></div>
                        <div className="relative bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 shadow-2xl">
                            <Ticket size={120} className="text-indigo-400" />
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-white font-medium flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-green-400" /> Scalable
                        </div>
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-white font-medium flex items-center gap-2">
                            <Zap size={18} className="text-yellow-400" /> Automated
                        </div>
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-white font-medium flex items-center gap-2">
                            <ShieldCheck size={18} className="text-blue-400" /> Enterprise-ready
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'overview',
            title: 'Built for Efficiency',
            subtitle: 'Streamlining communication between requesters and agents through a unified portal.',
            content: (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full items-center">
                    <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all group">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Users className="text-indigo-400" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Centralized Hub</h3>
                        <p className="text-indigo-100/60 leading-relaxed">Unified dashboard for requesters to log incidents and service requests effortlessly.</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all group">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Zap className="text-purple-400" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Smart Routing</h3>
                        <p className="text-indigo-100/60 leading-relaxed">Automatic assignment using round-robin and skill-based matching to the right teams.</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all group">
                        <div className="w-16 h-16 bg-pink-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Bell className="text-pink-400" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Real-time Echo</h3>
                        <p className="text-indigo-100/60 leading-relaxed">Instant notifications across web and mobile via Supabase Realtime synchronization.</p>
                    </div>
                </div>
            )
        },
        {
            id: 'ticketing',
            title: 'Advanced Ticketing',
            subtitle: 'Feature-rich workbench for agents to manage, resolve, and escalate complex issues.',
            content: (
                <div className="flex flex-col lg:flex-row gap-8 h-full">
                    <div className="flex-1 bg-white/10 rounded-3xl border border-white/20 p-8 overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-10 bg-white/10 flex items-center px-4 gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <div className="mt-8 space-y-4">
                            <div className="h-8 bg-indigo-500/20 rounded-lg w-3/4"></div>
                            <div className="flex gap-4">
                                <div className="h-20 bg-white/5 rounded-xl flex-1"></div>
                                <div className="h-20 bg-white/5 rounded-xl flex-1"></div>
                            </div>
                            <div className="h-40 bg-white/5 rounded-xl w-full"></div>
                            <div className="flex justify-between">
                                <div className="h-10 bg-indigo-600 rounded-lg w-32"></div>
                                <div className="h-10 bg-white/10 rounded-lg w-32"></div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:w-1/3 flex flex-col justify-center gap-6">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 bg-green-400/20 p-2 rounded-lg text-green-400"><CheckCircle2 size={20} /></div>
                            <div>
                                <h4 className="text-white font-bold text-lg">Multi-status Lifecycle</h4>
                                <p className="text-indigo-200/60">From Open to Resolved with detailed activity logging.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="mt-1 bg-blue-400/20 p-2 rounded-lg text-blue-400"><Layers size={20} /></div>
                            <div>
                                <h4 className="text-white font-bold text-lg">Structured KB</h4>
                                <p className="text-indigo-200/60">Searchable Knowledge Base for faster first-call resolution.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="mt-1 bg-purple-400/20 p-2 rounded-lg text-purple-400"><MessageSquare size={20} /></div>
                            <div>
                                <h4 className="text-white font-bold text-lg">Rich Communication</h4>
                                <p className="text-indigo-200/60">TipTap integration for screenshots and formatted responses.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'sla',
            title: 'SLA & Automation',
            subtitle: 'Never miss a deadline with precision-calculated SLA targets and automated escalations.',
            content: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    <div className="bg-gradient-to-br from-indigo-900/40 to-black/40 p-8 rounded-3xl border border-white/10 flex flex-col justify-between">
                        <div>
                            <Clock className="text-indigo-400 mb-6" size={48} />
                            <h3 className="text-3xl font-bold text-white mb-4">Precision SLA</h3>
                            <p className="text-indigo-200/70 mb-8 leading-relaxed">
                                Calculates targets based on ticket priority and dynamic business hours.
                                Includes "Pause Logic" for pending user confirmations.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="text-red-400">Urgent SLA: 4 Hours</span>
                                <span className="text-indigo-400">High SLA: 8 Hours</span>
                            </div>
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-green-400 to-indigo-500" style={{ width: '85%' }}></div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex gap-4">
                            <div className="bg-yellow-400/20 p-3 rounded-xl h-fit text-yellow-400"><Zap size={24} /></div>
                            <div>
                                <h4 className="text-white font-bold text-xl">Auto-Escalation</h4>
                                <p className="text-indigo-200/60">Tickets automatically escalate to L2/L3 agents if 75% SLA threshold is reached.</p>
                            </div>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex gap-4">
                            <div className="bg-green-400/20 p-3 rounded-xl h-fit text-green-400"><Calendar size={24} /></div>
                            <div>
                                <h4 className="text-white font-bold text-xl">Global Business Hours</h4>
                                <p className="text-indigo-200/60">Define holidays and timezone-aware shifts for accurate timing across global teams.</p>
                            </div>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex gap-4">
                            <div className="bg-pink-400/20 p-3 rounded-xl h-fit text-pink-400"><RefreshCw size={24} /></div>
                            <div>
                                <h4 className="text-white font-bold text-xl">Auto-Close Logic</h4>
                                <p className="text-indigo-200/60">Systen auto-closes resolved tickets after 24 hours of inactivity to keep queues clean.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'analytics',
            title: 'Actionable Insights',
            subtitle: 'Monitor performance and trends with beautiful, real-time data visualizations.',
            content: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    <div className="bg-white/5 p-8 rounded-3xl border border-white/10 flex flex-col">
                        <h4 className="text-white font-bold mb-6 flex items-center gap-2"><BarChart3 size={20} /> Weekly Trend</h4>
                        <div className="flex-1 min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[
                                    { name: 'Mon', incidents: 12, requests: 20 },
                                    { name: 'Tue', incidents: 18, requests: 35 },
                                    { name: 'Wed', incidents: 15, requests: 28 },
                                    { name: 'Thu', incidents: 25, requests: 42 },
                                    { name: 'Fri', incidents: 22, requests: 38 },
                                    { name: 'Sat', incidents: 8, requests: 12 },
                                    { name: 'Sun', incidents: 5, requests: 10 },
                                ]}>
                                    <defs>
                                        <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                                    <Area type="monotone" dataKey="incidents" stroke="#ef4444" fillOpacity={1} fill="url(#colorInc)" />
                                    <Area type="monotone" dataKey="requests" stroke="#6366f1" fillOpacity={1} fill="url(#colorReq)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="flex flex-col gap-8">
                        <div className="flex-1 bg-white/5 p-8 rounded-3xl border border-white/10 flex flex-col">
                            <h4 className="text-white font-bold mb-6 flex items-center gap-2"><PieChartIcon size={20} /> Satisfaction Score</h4>
                            <div className="flex-1 flex items-center justify-center relative">
                                <div className="text-center absolute">
                                    <span className="text-5xl font-bold text-white">4.8</span>
                                    <p className="text-indigo-400 text-sm">Out of 5.0</p>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[{ value: 4.8 }, { value: 0.2 }]}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            <Cell fill="#6366f1" />
                                            <Cell fill="rgba(255,255,255,0.05)" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-indigo-600/20 p-4 rounded-2xl border border-indigo-500/20 text-center">
                                <span className="block text-2xl font-bold text-white">1.2k</span>
                                <span className="text-xs text-indigo-300/60 font-medium">Tickets / Mo</span>
                            </div>
                            <div className="bg-green-600/20 p-4 rounded-2xl border border-green-500/20 text-center">
                                <span className="block text-2xl font-bold text-white">92%</span>
                                <span className="text-xs text-green-300/60 font-medium">SLA Met</span>
                            </div>
                            <div className="bg-purple-600/20 p-4 rounded-2xl border border-purple-500/20 text-center">
                                <span className="block text-2xl font-bold text-white">15m</span>
                                <span className="text-xs text-purple-300/60 font-medium">Avg Response</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'enterprise',
            title: 'Enterprise Control',
            subtitle: 'Complete governance with multi-tenant architecture and granular permissions.',
            content: (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 h-full items-center">
                    <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all group h-full flex flex-col">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Users className="text-blue-400" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Multi-Department</h3>
                        <p className="text-indigo-100/60 leading-relaxed mb-4">One platform for IT, HR, GA, and Finance. Each with isolated tickets, SLAs, and workflows.</p>
                        <div className="mt-auto flex gap-2">
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-500/20">IT Support</span>
                            <span className="text-xs bg-pink-500/20 text-pink-300 px-3 py-1 rounded-full border border-pink-500/20">HR Operations</span>
                        </div>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all group h-full flex flex-col">
                        <div className="w-16 h-16 bg-orange-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <GitBranch className="text-orange-400" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Visual Workflows</h3>
                        <p className="text-indigo-100/60 leading-relaxed mb-4">Drag-and-drop workflow builder for automating approvals, task assignments, and notifications.</p>
                        <div className="mt-auto w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-400 to-red-500 w-2/3 animate-pulse"></div>
                        </div>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all group h-full flex flex-col">
                        <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <ShieldCheck className="text-green-400" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">RBAC Security</h3>
                        <p className="text-indigo-100/60 leading-relaxed mb-4">Granular Role-Based Access Control. Define exactly who can view, edit, or delete data.</p>
                        <div className="mt-auto flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-xs text-green-300/80"><CheckCircle2 size={12} /> Admin</div>
                            <div className="flex items-center gap-2 text-xs text-green-300/80"><CheckCircle2 size={12} /> Manager</div>
                            <div className="flex items-center gap-2 text-xs text-green-300/80"><CheckCircle2 size={12} /> Agent</div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'ai-features',
            title: 'ServiceDesk AI',
            subtitle: 'Built-in intelligence that categorizes, prioritizes, and assists in real-time.',
            content: (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full items-center">
                    <div className="bg-gradient-to-b from-indigo-500/10 to-purple-500/10 backdrop-blur-sm p-1 rounded-2xl border border-indigo-500/30 h-full flex flex-col group hover:scale-[1.02] transition-transform duration-500">
                        <div className="bg-[#030712]/80 p-7 rounded-xl h-full flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                                <Zap size={80} className="text-indigo-500" />
                            </div>
                            <div className="w-14 h-14 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-6 border border-indigo-500/20">
                                <Zap size={28} className="text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Smart Triage</h3>
                            <p className="text-indigo-200/60 leading-relaxed text-sm mb-6">
                                Automatically detects ticket topics (e.g., "Printer", "VPN") and urgency from user descriptions to route them instantly.
                            </p>
                            <div className="mt-auto space-y-2">
                                <div className="flex items-center justify-between text-xs bg-white/5 p-2 rounded">
                                    <span className="text-gray-400">Input:</span>
                                    <span className="text-gray-200">"Wifi is broken"</span>
                                </div>
                                <div className="flex items-center justify-center text-indigo-400">
                                    <ArrowDown size={12} />
                                </div>
                                <div className="flex items-center justify-between text-xs bg-indigo-500/20 p-2 rounded border border-indigo-500/30">
                                    <span className="text-indigo-300">Category:</span>
                                    <span className="text-white font-bold">Network / Outage</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-b from-fuchsia-500/10 to-pink-500/10 backdrop-blur-sm p-1 rounded-2xl border border-fuchsia-500/30 h-full flex flex-col group hover:scale-[1.02] transition-transform duration-500">
                        <div className="bg-[#030712]/80 p-7 rounded-xl h-full flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                                <MessageSquare size={80} className="text-fuchsia-500" />
                            </div>
                            <div className="w-14 h-14 bg-fuchsia-500/20 rounded-lg flex items-center justify-center mb-6 border border-fuchsia-500/20">
                                <MessageSquare size={28} className="text-fuchsia-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Agent Copilot</h3>
                            <p className="text-indigo-200/60 leading-relaxed text-sm mb-6">
                                AI drafts responses and summarizes long ticket threads so agents can resolve issues 2x faster.
                            </p>
                            <div className="mt-auto bg-white/5 p-3 rounded-lg border border-white/5">
                                <div className="flex gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 animate-pulse"></div>
                                    <span className="text-xs text-indigo-200 italic">"Based on the error, suggest checking the firewall logs..."</span>
                                </div>
                                <button className="w-full py-1.5 bg-fuchsia-600/20 text-fuchsia-300 text-xs rounded border border-fuchsia-600/30 hover:bg-fuchsia-600/30 transition-colors">
                                    Insert Response
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-b from-cyan-500/10 to-blue-500/10 backdrop-blur-sm p-1 rounded-2xl border border-cyan-500/30 h-full flex flex-col group hover:scale-[1.02] transition-transform duration-500">
                        <div className="bg-[#030712]/80 p-7 rounded-xl h-full flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                                <BarChart3 size={80} className="text-cyan-500" />
                            </div>
                            <div className="w-14 h-14 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-6 border border-cyan-500/20">
                                <BarChart3 size={28} className="text-cyan-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Sentiment Analysis</h3>
                            <p className="text-indigo-200/60 leading-relaxed text-sm mb-6">
                                Real-time monitoring of user frustration levels. Flags "At Risk" tickets for immediate manager attention.
                            </p>
                            <div className="mt-auto">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs text-gray-400">Frustration Level</span>
                                    <span className="text-xs font-bold text-red-400">High (85%)</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 w-[85%]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'user-experience',
            title: 'User-First Design',
            subtitle: 'Empowering end-users with a seamless, self-service experience.',
            content: (
                <div className="grid grid-rows-12 gap-6 h-full">
                    <div className="row-span-7 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 p-8 rounded-3xl border border-white/10 flex items-center justify-between relative overflow-hidden group">
                        <div className="relative z-10 max-w-xl">
                            <h3 className="text-3xl font-bold text-white mb-4">Dynamic Service Catalog</h3>
                            <p className="text-indigo-200/80 text-lg leading-relaxed mb-6">
                                Forget generic forms. Our engine renders custom fields based on the specific request type—from "Onboarding" checklists to "VPN Access" specifics.
                            </p>
                            <div className="flex gap-3">
                                <div className="bg-white/10 px-4 py-2 rounded-lg text-sm border border-white/10 flex items-center gap-2">
                                    <Type size={16} /> Text
                                </div>
                                <div className="bg-white/10 px-4 py-2 rounded-lg text-sm border border-white/10 flex items-center gap-2">
                                    <List size={16} /> Dropdowns
                                </div>
                                <div className="bg-white/10 px-4 py-2 rounded-lg text-sm border border-white/10 flex items-center gap-2">
                                    <Paperclip size={16} /> Attachments
                                </div>
                            </div>
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/20 to-transparent"></div>
                        <FileText size={180} className="absolute -right-10 -bottom-10 text-white/5 group-hover:scale-110 transition-transform duration-700" />
                    </div>

                    <div className="row-span-5 grid grid-cols-2 gap-6">
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col justify-center group hover:bg-white/10 transition-colors">
                            <div className="mb-3 bg-yellow-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-yellow-500">
                                <BookOpen size={24} />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-1">Knowledge Integration</h4>
                            <p className="text-indigo-200/60 text-sm">Relevant articles appear instantly as users type their issue.</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col justify-center group hover:bg-white/10 transition-colors">
                            <div className="mb-3 bg-green-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-green-500">
                                <Search size={24} />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-1">Transparent Tracking</h4>
                            <p className="text-indigo-200/60 text-sm">Real-time status updates and agent communication portal.</p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'tech',

            title: 'Modern Architecture',
            subtitle: 'Powered by a cutting-edge stack for performance, reliability, and security.',
            content: (
                <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full mb-16">
                        <div className="flex flex-col items-center gap-4 text-center group">
                            <div className="w-24 h-24 bg-[#61dafb]/10 rounded-3xl flex items-center justify-center border border-[#61dafb]/20 group-hover:bg-[#61dafb]/20 group-hover:scale-110 transition-all duration-300 shadow-[0_0_20px_rgba(97,218,251,0.1)]">
                                <Code2 size={48} className="text-[#61dafb]" />
                            </div>
                            <div>
                                <span className="text-white font-bold block">React 19</span>
                                <span className="text-xs text-indigo-400">Frontend Core</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-4 text-center group">
                            <div className="w-24 h-24 bg-[#3ecf8e]/10 rounded-3xl flex items-center justify-center border border-[#3ecf8e]/20 group-hover:bg-[#3ecf8e]/20 group-hover:scale-110 transition-all duration-300 shadow-[0_0_20px_rgba(62,207,142,0.1)]">
                                <Zap size={48} className="text-[#3ecf8e]" />
                            </div>
                            <div>
                                <span className="text-white font-bold block">Supabase</span>
                                <span className="text-xs text-indigo-400">Backend & Realtime</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-4 text-center group">
                            <div className="w-24 h-24 bg-[#38bdf8]/10 rounded-3xl flex items-center justify-center border border-[#38bdf8]/20 group-hover:bg-[#38bdf8]/20 group-hover:scale-110 transition-all duration-300 shadow-[0_0_20px_rgba(56,189,248,0.1)]">
                                <Palette size={48} className="text-[#38bdf8]" />
                            </div>
                            <div>
                                <span className="text-white font-bold block">Tailwind CSS</span>
                                <span className="text-xs text-indigo-400">Styling Engine</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-4 text-center group">
                            <div className="w-24 h-24 bg-[#f87171]/10 rounded-3xl flex items-center justify-center border border-[#f87171]/20 group-hover:bg-[#f87171]/20 group-hover:scale-110 transition-all duration-300 shadow-[0_0_20px_rgba(248,113,113,0.1)]">
                                <GitBranch size={48} className="text-[#f87171]" />
                            </div>
                            <div>
                                <span className="text-white font-bold block">Vite</span>
                                <span className="text-xs text-indigo-400">Build Tool</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8">
                        <div className="flex items-center gap-6">
                            <div className="hidden md:flex flex-col gap-2">
                                {[1, 2, 3].map(i => <div key={i} className="w-12 h-2 bg-indigo-500/20 rounded-full"></div>)}
                            </div>
                            <p className="text-indigo-100/70 italic text-lg leading-relaxed">
                                "We've combined the power of PostgreSQL with a modern reactive UI to deliver a seamless experience that feels native, fast, and reliable."
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'end',
            title: 'Ready to Transform?',
            subtitle: 'Join the hundreds of teams already scaling with ServiceDesk.',
            content: (
                <div className="h-full flex flex-col justify-center items-center text-center">
                    <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-[2px] rounded-3xl mb-8 group">
                        <div className="bg-black/90 p-12 rounded-[22px] backdrop-blur-xl group-hover:bg-black/80 transition-all">
                            <Ticket size={80} className="text-white mb-6 mx-auto animate-bounce" />
                            <h3 className="text-4xl font-bold text-white mb-4">Experience ServiceDesk Today</h3>
                            <p className="text-indigo-200/60 mb-8 max-w-sm">The most comprehensive service desk solution for the modern era.</p>
                            <button
                                onClick={onExit}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-12 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-500/25 flex items-center gap-3 mx-auto"
                            >
                                <Play size={20} fill="currentColor" /> Return to Workspace
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-8 text-indigo-400/40 font-bold uppercase tracking-widest text-sm">
                        <span>Innovation</span>
                        <span>•</span>
                        <span>Efficiency</span>
                        <span>•</span>
                        <span>Excellence</span>
                    </div>
                </div>
            )
        }
    ];

    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPrinting, setIsPrinting] = useState(false);

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) setCurrentSlide(prev => prev + 1);
    };

    const prevSlide = () => {
        if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
    };

    const handlePrint = () => {
        setIsPrinting(true);
        // Add a small delay to ensure React renders the print view before browser print dialog opens
        setTimeout(() => {
            window.print();
            // Reset after print dialog closes (or a delay)
            setTimeout(() => setIsPrinting(false), 500);
        }, 500);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (isPrinting) return;
        if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'Escape') onExit();
    };

    // ... (rest of slides definition remains the same) ...

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSlide, isPrinting]);

    return (
        <div className={`fixed inset-0 z-[9999] bg-[#030712] text-white flex flex-col font-sans overflow-hidden ${isPrinting ? 'print:relative print:overflow-visible print:h-auto print:block' : ''}`}>
            {/* Print Styles */}
            <style>{`
                @media print {
                    @page { size: landscape; margin: 0; }
                    html, body { margin: 0 !important; padding: 0 !important; min-height: 100vh !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #030712 !important; }
                    .print-break-after { 
                        break-after: page; 
                        page-break-after: always; 
                        height: 100vh !important; 
                        width: 100vw !important;
                        position: relative !important;
                        top: 0 !important;
                        left: 0 !important;
                        margin: 0 !important;
                        display: flex !important;
                        overflow: hidden !important;
                    }
                    .no-print { display: none !important; }
                    * { -webkit-print-color-adjust: exact !important;   print-color-adjust: exact !important; }
                }
            `}</style>

            {/* Background Gradients */}
            <div className={`absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 ${isPrinting ? 'hidden' : ''}`}></div>
            <div className={`absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2 ${isPrinting ? 'hidden' : ''}`}></div>

            {/* Toolbar */}
            <div className="no-print relative z-10 flex justify-between items-center px-8 h-20 border-b border-white/5 bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <Ticket size={18} className="text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">SERVICE<span className="text-indigo-400">DESK</span></span>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors border border-white/10"
                        title="Download as PDF"
                    >
                        <Printer size={16} />
                        <span>Export PDF</span>
                    </button>
                    <span className="text-white/40 text-sm font-medium">Slide {currentSlide + 1} of {slides.length}</span>
                    <button
                        onClick={onExit}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Slide Content container */}
            <div className="relative flex-1">
                {isPrinting ? (
                    // Print Mode: Render ALL slides
                    <div className="flex flex-col">
                        {slides.map((slide) => (
                            <div key={slide.id} className="print-break-after relative w-full h-[100vh] bg-[#030712] p-12 flex flex-col justify-center border-b border-white/10">
                                <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
                                    <div className="mb-8">
                                        <h2 className="text-4xl font-bold text-white mb-2">{slide.title}</h2>
                                        {slide.subtitle && <p className="text-xl text-indigo-200/80">{slide.subtitle}</p>}
                                    </div>
                                    <div className="flex-1 overflow-hidden relative">
                                        {slide.content}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // Presentation Mode: Render Active Slide
                    slides.map((slide, index) => (
                        <Slide
                            key={slide.id}
                            title={slide.title}
                            subtitle={slide.subtitle}
                            isActive={index === currentSlide}
                        >
                            {slide.content}
                        </Slide>
                    ))
                )}
            </div>

            {/* Navigation Controls */}
            <div className="no-print relative z-10 px-8 py-6 bg-black/20 backdrop-blur-sm border-t border-white/5 flex justify-between items-center">
                <div className="flex gap-4">
                    {slides.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-indigo-500' : 'w-2 bg-white/10'}`}
                        />
                    ))}
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={prevSlide}
                        disabled={currentSlide === 0}
                        className="group flex items-center justify-center w-14 h-14 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <ChevronLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
                    </button>

                    <button
                        onClick={nextSlide}
                        disabled={currentSlide === slides.length - 1}
                        className="group flex items-center justify-center w-14 h-14 rounded-2xl border border-white/10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-all outline-none focus:ring-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/20"
                    >
                        <ChevronRight size={28} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper components that were missing
const Layers: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => <BookOpen size={size} className={className} />;
const Calendar: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => <BarChart3 size={size} className={className} />;
const PieChartIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => <BarChart3 size={size} className={className} />;
const Palette: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => <Code2 size={size} className={className} />;

export default PresentationView;
