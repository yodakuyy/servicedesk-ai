import React, { useState } from 'react';
import { Plus, FileText, Book, BookOpen, HelpCircle, Eye, Info, X, AlertCircle, Package, Bot, Send, MessageSquare, Sparkles, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

import { supabase } from '../lib/supabase';

interface Ticket {
    id: string;
    ticket_number: string;
    subject: string;
    status: string;
}

interface Article {
    id: string;
    title: string;
    category?: string;
    views?: number;
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'alert';
    created_at: string;
}

interface UserDashboardProps {
    onNavigate?: (view: string) => void;
    onViewTicket?: (ticketId: string) => void;
    userName?: string;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ onNavigate, onViewTicket, userName }) => {
    const [selectionType, setSelectionType] = useState<'create' | 'view' | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    // KB & Articles
    const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<any>(null);
    const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
    const [loadingArticle, setLoadingArticle] = useState(false);
    const [stats, setStats] = useState({
        open: 0,
        openBreakdown: '',
        pending: 0,
        resolved: 0,
        resolvedBreakdown: '',
        total: 0
    });

    // Chatbot States
    const [chatMessages, setChatMessages] = useState<{ sender: 'bot' | 'user', text: string, type?: 'text' | 'article' | 'option', articles?: any[] }[]>([
        { sender: 'bot', text: `Hi ${userName?.split(' ')[0] || 'User'}! 👋 I'm your AI assistant. How can I help you today?`, type: 'text' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isBotTyping, setIsBotTyping] = useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    React.useEffect(() => {
        scrollToBottom();
    }, [chatMessages, isBotTyping]);

    React.useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch recent tickets (Either I am the requester OR I am the one who created it)
            const { data: ticketsData } = await supabase
                .from('tickets')
                .select(`
                    id, ticket_number, subject, status_id, created_at,
                    ticket_statuses!status_id (status_name)
                `)
                .or(`requester_id.eq.${user.id},created_by.eq.${user.id}`)
                .order('created_at', { ascending: false })
                .limit(5);

            if (ticketsData) {
                setRecentTickets(ticketsData.map((t: any) => ({
                    id: t.id,
                    ticket_number: t.ticket_number,
                    subject: t.subject,
                    status: t.ticket_statuses?.status_name || 'Unknown'
                })));
            }

            // Fetch all tickets for stats (Either I am the requester OR I am the one who created it)
            const { data: allUserTickets } = await supabase
                .from('tickets')
                .select('status_id, ticket_statuses!status_id(status_name), requester_id, created_by')
                .or(`requester_id.eq.${user.id},created_by.eq.${user.id}`);

            if (allUserTickets) {
                console.log('UserDashboard: Raw items fetched:', allUserTickets.length);

                const statsMap: Record<string, number> = {};
                allUserTickets.forEach((t: any) => {
                    const sName = (t.ticket_statuses?.status_name || 'Unknown').trim();
                    statsMap[sName] = (statsMap[sName] || 0) + 1;
                });

                console.log('UserDashboard: Status Breakdown:', statsMap);

                const getCount = (names: string[], partial: boolean = false) => {
                    return allUserTickets.filter((t: any) => {
                        const name = (t.ticket_statuses?.status_name || '').trim().toLowerCase();
                        if (partial) {
                            return names.some(n => name.includes(n.toLowerCase()));
                        }
                        return names.map(n => n.toLowerCase()).includes(name);
                    }).length;
                };

                const openOnly = getCount(['Open']);
                const inProgress = getCount(['In Progress', 'Processing', 'In-Progress']);
                const resolved = getCount(['Resolved']);
                const closed = getCount(['Closed']);
                const canceled = getCount(['Canceled', 'Cancelled']);
                const pending = getCount(['Pending', 'Waiting'], true); // Use partial match for Pending states

                setStats({
                    open: openOnly + inProgress,
                    openBreakdown: `${openOnly} Open, ${inProgress} In Progress`,
                    pending: pending,
                    resolved: resolved + closed + canceled,
                    resolvedBreakdown: `${resolved + closed} Met, ${canceled} Canceled`,
                    total: allUserTickets.length
                });
            }

            // Fetch Knowledge Base Articles
            const { data: articlesData } = await supabase
                .from('kb_articles')
                .select('id, title, summary, kb_categories(name)')
                .eq('status', 'published')
                .eq('visibility', 'public')
                .order('updated_at', { ascending: false })
                .limit(3);

            if (articlesData) {
                setArticles(articlesData.map((a: any) => ({
                    id: a.id,
                    title: a.title,
                    summary: a.summary,
                    category: a.kb_categories?.name || 'Support'
                })));
            } else {
                setArticles([
                    { id: '1', title: 'Reset Your Password in 2 Minutes', category: 'Security' },
                    { id: '2', title: 'Install Office 365 on Your Laptop', category: 'Software' },
                    { id: '3', title: 'Troubleshoot Slow Internet', category: 'Network' }
                ]);
            }

            // Fetch Announcements
            const { data: announceData } = await supabase
                .from('announcements')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (announceData && announceData.length > 0) {
                setAnnouncements(announceData);
            } else {
                setAnnouncements([
                    {
                        id: '1',
                        title: 'Scheduled Maintenance Tonight',
                        content: 'Save your work before 10PM to avoid data loss during the update.',
                        type: 'info',
                        created_at: new Date().toISOString()
                    }
                ]);
            }
        };
        fetchData();
    }, []);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim() || isBotTyping) return;

        const userText = chatInput;
        setChatInput('');
        setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
        setIsBotTyping(true);

        // Simulation logic
        setTimeout(async () => {
            const rawQuery = userText.toLowerCase().trim();
            // Split words and filter out common short words
            const keywords = rawQuery.split(/\s+/).filter(w => w.length > 2);

            // 1. Try DB Search with smarter matching
            let matches: any[] = [];
            try {
                // If we have keywords, search for any of them in the title
                if (keywords.length > 0) {
                    const orQuery = keywords.map(w => `title.ilike.%${w}%`).join(',');
                    const { data } = await supabase
                        .from('kb_articles')
                        .select('id, title, summary, kb_categories(name)')
                        .eq('status', 'published')
                        .eq('visibility', 'public')
                        .or(orQuery)
                        .limit(3);
                    if (data) {
                        matches = data.map((a: any) => ({
                            id: a.id,
                            title: a.title,
                            excerpt: a.summary, // Use summary for display
                            category: a.kb_categories?.name || 'Support'
                        }));
                    }
                } else {
                    // Fallback to strict match if keywords are too short
                    const { data } = await supabase
                        .from('kb_articles')
                        .select('id, title, summary, kb_categories(name)')
                        .eq('status', 'published')
                        .eq('visibility', 'public')
                        .ilike('title', `%${rawQuery}%`)
                        .limit(2);
                    if (data) {
                        matches = data.map((a: any) => ({
                            id: a.id,
                            title: a.title,
                            excerpt: a.summary,
                            category: a.kb_categories?.name || 'Support'
                        }));
                    }
                }
            } catch (err) {
                console.log("DB search error/skipped:", err);
            }

            // 2. Fallback to Local Search (if DB no match)
            if (matches.length === 0) {
                matches = articles.filter(a => {
                    const title = a.title.toLowerCase();
                    // Check if any keyword is in the title, or if the raw query is in the title
                    return keywords.some(w => title.includes(w)) || title.includes(rawQuery);
                });
            }

            if (matches.length > 0) {
                setChatMessages(prev => [...prev, {
                    sender: 'bot',
                    text: 'Saya menemukan panduan yang mungkin membantu Anda:',
                    type: 'article',
                    articles: matches
                }]);

                setTimeout(() => {
                    setChatMessages(prev => [...prev, {
                        sender: 'bot',
                        text: 'Apakah solusi di atas sudah membantu?',
                        type: 'option'
                    }]);
                    setIsBotTyping(false);
                }, 800);
            } else {
                // Generative-style response
                let responseText = `Maaf, saya belum menemukan panduan spesifik untuk "${userText}".`;

                if (rawQuery.includes('halo') || rawQuery.includes('hi')) {
                    responseText = `Halo! Bagaimana saya bisa membantu Anda hari ini? Ada kendala IT yang bisa saya cari solusinya?`;
                }

                setChatMessages(prev => [...prev, {
                    sender: 'bot',
                    text: responseText,
                    type: 'option'
                }]);
                setIsBotTyping(false);
            }
        }, 1000);
    };

    const handleViewFullArticle = async (articleId: string) => {
        setIsArticleModalOpen(true);
        setLoadingArticle(true);
        setSelectedArticle(null); // Reset

        console.log("Viewing Article ID:", articleId);

        // Handle Mock Articles
        if (['1', '2', '3'].includes(articleId)) {
            const mock = [
                { id: '1', title: 'Reset Your Password in 2 Minutes', category: 'Security', summary: 'Quick guide to reset your forgotten password using the self-service portal.', content: { problem: 'User forgot password.', solution: 'Go to portal and click reset.' }, updated_at: new Date().toISOString() },
                { id: '2', title: 'Install Office 365 on Your Laptop', category: 'Software', summary: 'How to download and license Office 365 for employees.', content: { solution: 'Visit portal.office.com' }, updated_at: new Date().toISOString() },
                { id: '3', title: 'Troubleshoot Slow Internet', category: 'Network', summary: 'Common fixes for VPN and Wi-Fi connectivity issues.', content: { solution: 'Restart router.' }, updated_at: new Date().toISOString() }
            ].find(m => m.id === articleId);

            if (mock) {
                const c = (mock.content || {}) as any;
                const combinedBody = `<h3>Solution</h3><div>${c.solution || 'No content'}</div>`;
                setSelectedArticle({ ...mock, body_html: combinedBody });
                setLoadingArticle(false);
                return;
            }
        }

        try {
            // First try with join - Fetch 'content' JSONB instead of body_html
            const { data, error } = await supabase
                .from('kb_articles')
                .select('id, title, summary, content, updated_at, kb_categories(name)')
                .eq('id', articleId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                // Combine JSONB content into displayable HTML
                const c = (data.content || {}) as any;
                const combinedBody = `
                    ${c.problem ? `<div class="mb-6"><h3 class="text-lg font-extrabold text-gray-900 border-l-4 border-amber-400 pl-3 mb-2">Problem</h3><div class="text-gray-600 leading-relaxed">${c.problem}</div></div>` : ''}
                    ${c.solution ? `<div class="mb-6"><h3 class="text-lg font-extrabold text-gray-900 border-l-4 border-indigo-600 pl-3 mb-2">Solution</h3><div class="text-gray-600 leading-relaxed">${c.solution}</div></div>` : ''}
                    ${c.verification ? `<div class="mb-6"><h3 class="text-lg font-extrabold text-gray-900 border-l-4 border-emerald-500 pl-3 mb-2">Verification</h3><div class="text-gray-600 leading-relaxed">${c.verification}</div></div>` : ''}
                    ${c.notes ? `<div class="mt-8 pt-6 border-t border-gray-100 italic text-gray-400 text-sm">Note: ${c.notes}</div>` : ''}
                `;
                setSelectedArticle({
                    ...data,
                    body_html: combinedBody,
                    category: data.kb_categories && !Array.isArray(data.kb_categories) ? (data.kb_categories as any).name : 'Support'
                });
            } else {
                console.warn("Article data returned null for ID:", articleId);
            }
        } catch (err) {
            console.error("Error fetching full article, trying fallback without join:", err);
            // Fallback without join
            try {
                const { data } = await supabase
                    .from('kb_articles')
                    .select('id, title, summary, content, updated_at')
                    .eq('id', articleId)
                    .single();
                if (data) {
                    const c = data.content || {};
                    const combinedBody = `<div>${c.problem || ''}</div><div>${c.solution || ''}</div>`;
                    setSelectedArticle({ ...data, body_html: combinedBody, category: 'Support' });
                }
            } catch (innerErr) {
                console.error("Deep failure fetching article:", innerErr);
            }
        } finally {
            setLoadingArticle(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Welcome & Stats Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-2xl shadow-lg border border-indigo-500/20 relative overflow-hidden flex flex-col justify-center">
                    <div className="relative z-10 space-y-2">
                        <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-[10px] font-black uppercase tracking-widest mb-2">Welcome Back</span>
                        <h1 className="text-4xl font-black text-white">Hi, {userName?.split(' ')[0] || 'User'}!</h1>
                        <p className="text-indigo-100 text-lg font-medium max-w-md">
                            Everything is running smoothly. How can we assist you today?
                        </p>
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-10 -translate-y-10">
                        <Sparkles size={240} className="text-white" />
                    </div>
                </div>

                {/* Status Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <FileText size={20} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active</span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-gray-800">{stats.open}</div>
                            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{stats.openBreakdown}</div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-amber-200 transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition-all">
                                <Clock size={20} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Waiting</span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-gray-800">{stats.pending}</div>
                            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Awaiting response</div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-green-200 transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-all">
                                <CheckCircle2 size={20} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Done</span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-gray-800">{stats.resolved}</div>
                            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{stats.resolvedBreakdown}</div>
                        </div>
                    </div>
                    <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between group hover:bg-indigo-100 transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-indigo-600 text-white rounded-lg">
                                <Package size={20} />
                            </div>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Total</span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-indigo-900">{stats.total}</div>
                            <div className="text-xs font-bold text-indigo-400 mt-1">History</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { icon: Plus, label: 'Create Ticket', sub: 'Submit a new request', color: 'indigo', action: () => setSelectionType('create') },
                    { icon: AlertCircle, label: 'Incident List', sub: 'My ticket history', color: 'rose', action: () => onNavigate?.('my-tickets') },
                    { icon: Package, label: 'Service Request', sub: 'Browse IT services', color: 'amber', action: () => onNavigate?.('service-requests') },
                    { icon: HelpCircle, label: 'Help Center', sub: 'Guides & Support', color: 'teal', action: () => onNavigate?.('help-center') },
                ].map((action, index) => (
                    <button
                        key={index}
                        onClick={action.action}
                        className="flex items-center p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group cursor-pointer text-left overflow-hidden relative"
                    >
                        <div className={`w-12 h-12 bg-${action.color}-50 text-${action.color}-600 rounded-xl flex items-center justify-center mr-4 group-hover:bg-${action.color}-600 group-hover:text-white transition-all shadow-sm flex-shrink-0`}>
                            <action.icon size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 text-sm group-hover:text-indigo-600 transition-colors">
                                {action.label}
                            </h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{action.sub}</p>
                        </div>
                        <div className="absolute right-0 bottom-0 p-1 opacity-0 group-hover:opacity-10 transition-opacity">
                            <action.icon size={64} />
                        </div>
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
                            <button
                                onClick={() => {
                                    setSelectionType(null);
                                    onNavigate?.('create-incident');
                                }}
                                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                            >
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <AlertCircle size={24} />
                                </div>
                                <span className="font-bold text-gray-700 group-hover:text-indigo-700">Incident</span>
                            </button>
                            <button
                                onClick={() => {
                                    setSelectionType(null);
                                    onNavigate?.('service-requests');
                                }}
                                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                            >
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
                {announcements.length > 0 && (
                    <div className={`lg:col-span-1 border p-6 rounded-2xl relative overflow-hidden flex flex-col justify-center min-h-[160px] ${announcements[0].type === 'warning' ? 'bg-amber-50 border-amber-100' :
                        announcements[0].type === 'alert' ? 'bg-rose-50 border-rose-100' :
                            'bg-blue-50/50 border-blue-100'
                        }`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Info size={120} className={announcements[0].type === 'warning' ? 'text-amber-600' : announcements[0].type === 'alert' ? 'text-rose-600' : 'text-blue-600'} />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-start gap-4 mb-3">
                                <div className={`p-3 rounded-xl ${announcements[0].type === 'warning' ? 'bg-amber-100/50 text-amber-600' :
                                    announcements[0].type === 'alert' ? 'bg-rose-100/50 text-rose-600' :
                                        'bg-blue-100/50 text-blue-600'
                                    }`}>
                                    <Info size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-800 text-lg leading-tight">{announcements[0].title}</h3>
                                    {announcements[0].type === 'info' && <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mt-1">Notification</p>}
                                </div>
                            </div>
                            <p className="text-gray-600 pl-[60px] text-sm font-medium leading-relaxed">
                                {announcements[0].content}
                            </p>
                        </div>
                    </div>
                )}

                {/* Top Knowledge Articles */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex justify-between items-end mb-1">
                        <div>
                            <h2 className="text-xl font-black text-gray-800">Knowledge Base</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Self-service solutions for common issues</p>
                        </div>
                        <button className="text-indigo-600 text-xs font-black uppercase tracking-widest hover:underline px-3 py-1.5 bg-indigo-50 rounded-lg transition-all">Browse All</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {articles.map((article) => (
                            <div key={article.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group h-full flex flex-col justify-between">
                                <div>
                                    <div className="mb-4 p-2 bg-indigo-50 text-indigo-600 rounded-lg w-fit group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                        <Book size={18} />
                                    </div>
                                    <h4 className="font-black text-gray-700 text-sm group-hover:text-indigo-700 transition-colors line-clamp-2 leading-snug">
                                        {article.title}
                                    </h4>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{article.category || 'Support'}</span>
                                    <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                                </div>
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
                                    <td className="px-6 py-4 font-medium text-gray-700">{ticket.ticket_number}</td>
                                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{ticket.subject}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${ticket.status === 'Open'
                                                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                : ticket.status.toLowerCase().includes('pending')
                                                    ? 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                                                    : ticket.status === 'Resolved'
                                                        ? 'bg-green-50 text-green-600 border border-green-100'
                                                        : ticket.status === 'Canceled'
                                                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                                                }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${ticket.status === 'Open' ? 'bg-blue-500' :
                                                ticket.status === 'Pending' ? 'bg-yellow-500' :
                                                    ticket.status === 'Resolved' ? 'bg-green-500' :
                                                        ticket.status === 'Canceled' ? 'bg-rose-500' : 'bg-gray-500'
                                                }`}></span>
                                            {ticket.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => onViewTicket && onViewTicket(ticket.id)}
                                            className="text-gray-400 hover:text-indigo-600 font-medium transition-colors flex items-center gap-2 text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:border-indigo-200 hover:bg-indigo-50"
                                        >
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
                        <div className="h-96 bg-gray-50 p-4 overflow-y-auto space-y-4 flex flex-col">
                            {chatMessages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                                    {msg.sender === 'bot' && (
                                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 text-indigo-600 shadow-sm border border-indigo-200">
                                            <Bot size={16} />
                                        </div>
                                    )}
                                    <div className="max-w-[85%] space-y-2">
                                        {msg.text && (
                                            <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.sender === 'bot'
                                                ? 'bg-white rounded-tl-none border border-gray-100 text-gray-700'
                                                : 'bg-indigo-600 rounded-tr-none text-white'}`}>
                                                {msg.text}
                                            </div>
                                        )}
                                        {msg.type === 'article' && msg.articles && (
                                            <div className="space-y-2 mt-2">
                                                {msg.articles.map((art: any) => (
                                                    <div
                                                        key={art.id}
                                                        onClick={() => handleViewFullArticle(art.id)}
                                                        className="bg-white border border-indigo-100 p-3 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group active:scale-95"
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <Book size={14} className="text-indigo-600 mt-0.5" />
                                                            <div className="font-bold text-xs text-indigo-900 group-hover:text-indigo-600">{art.title}</div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{art.excerpt || art.summary || 'Read this guide to solve your issue quickly.'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {msg.type === 'option' && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <button
                                                    onClick={() => setSelectionType('create')}
                                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                                                >
                                                    Create Ticket
                                                </button>
                                                <button
                                                    onClick={() => setChatMessages(prev => [...prev, { sender: 'bot', text: "Great! Glad I could help. Have a nice day! 😊" }])}
                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                                                >
                                                    Yes, Thanks!
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isBotTyping && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 text-indigo-600">
                                        <Bot size={16} />
                                    </div>
                                    <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Type your issue..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!chatInput.trim() || isBotTyping}
                                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400 transition-colors shadow-sm"
                            >
                                <Send size={18} />
                            </button>
                        </form>
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

            {/* Article Reader Modal */}
            {isArticleModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsArticleModalOpen(false)}></div>
                    <div className="bg-white w-full max-w-4xl h-full max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                                    <BookOpen size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 leading-none">Article Reader</h2>
                                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Knowledge Base Portal</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsArticleModalOpen(false)}
                                className="p-3 hover:bg-white rounded-2xl text-gray-400 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100 hover:shadow-sm"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-white">
                            {loadingArticle ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <p className="font-bold text-gray-400 text-sm animate-pulse">Fetching Article Content...</p>
                                </div>
                            ) : selectedArticle ? (
                                <div className="max-w-3xl mx-auto space-y-8">
                                    {/* Article Info */}
                                    <div className="space-y-4">
                                        <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100">
                                            {selectedArticle.category}
                                        </span>
                                        <h1 className="text-4xl font-black text-gray-900 leading-tight">
                                            {selectedArticle.title}
                                        </h1>
                                        <div className="flex items-center gap-6 text-sm text-gray-400 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} />
                                                Updated {new Date(selectedArticle.updated_at).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={16} className="text-emerald-500" />
                                                Verified Solution
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary Alert */}
                                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                                        <div className="shrink-0 text-amber-500">
                                            <AlertCircle size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-amber-900 text-sm uppercase tracking-wider mb-1">Article Summary</h4>
                                            <p className="text-amber-800/80 text-sm leading-relaxed">{selectedArticle.summary}</p>
                                        </div>
                                    </div>

                                    {/* Main Body (HTML Supported) */}
                                    <div
                                        className="prose prose-indigo max-w-none prose-p:text-gray-600 prose-headings:text-gray-900 prose-headings:font-black prose-img:rounded-2xl prose-img:shadow-lg"
                                        dangerouslySetInnerHTML={{ __html: selectedArticle.body_html || '<p class="text-gray-400 italic">No detailed content available for this article.</p>' }}
                                    ></div>

                                    {/* Help Feedback */}
                                    <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col items-center text-center space-y-6">
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-black text-gray-900">Did this article help you?</h3>
                                            <p className="text-gray-500 text-sm">Your feedback helps us improve our support knowledge.</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <button className="px-8 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 hover:border-indigo-200 transition-all flex items-center gap-2">
                                                <X size={18} className="text-gray-400" /> No, I still have issues
                                            </button>
                                            <button className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2">
                                                <CheckCircle2 size={18} /> Yes, this resolved it
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="p-4 bg-gray-50 rounded-full text-gray-300">
                                        <AlertCircle size={48} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Article Not Found</h3>
                                        <p className="text-gray-500">The article you're looking for might have been moved or archived.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default UserDashboard;
