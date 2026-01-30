import React, { useState, useEffect } from 'react';
import {
    Search, Filter, Clock, AlertCircle, CheckCircle2, MoreHorizontal,
    MessageSquare, FileText, GitBranch, Shield, Send, Sparkles,
    ChevronRight, ChevronLeft, ChevronDown, Paperclip, Mic, User, Copy, ExternalLink,
    ThumbsUp, RefreshCw, AlertTriangle, Loader2, Zap, X, Info, BookOpen,
    ArrowUpRight, ArrowRight, BarChart3, Lock, List, Users, Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import RichTextEditor from './RichTextEditor';

interface AgentTicketViewProps {
    userProfile?: any;
    initialQueueFilter?: 'assigned' | 'submitted' | 'all';
}

const workflowMap: Record<string, string[]> = {
    'Open': ['In Progress', 'Canceled'],
    'In Progress': ['Pending', 'Resolved', 'Canceled'],
    'Pending': ['In Progress', 'Resolved', 'Canceled'],
    'Resolved': ['Closed', 'In Progress'],
    'Closed': ['In Progress'],
    'Canceled': ['Open']
};

const AgentTicketView: React.FC<AgentTicketViewProps> = ({ userProfile, initialQueueFilter = 'assigned' }) => {
    // State
    const [tickets, setTickets] = useState<any[]>([]);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<'conversation' | 'details' | 'workflow' | 'sla' | 'activities' | 'attachments'>('conversation');
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [aiInsight, setAiInsight] = useState<any>(null);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [agentGroups, setAgentGroups] = useState<string[]>([]);
    const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
    const [allGroups, setAllGroups] = useState<any[]>([]);
    const [allAgents, setAllAgents] = useState<any[]>([]);
    const [allCategories, setAllCategories] = useState<any[]>([]);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);

    // AI Copilot States
    const [aiSummary, setAiSummary] = useState<string[]>([]);
    const [aiClassification, setAiClassification] = useState<{ category: string; priority: string } | null>(null);
    const [aiSuggestedReply, setAiSuggestedReply] = useState<string>('');
    const [aiReplyIndex, setAiReplyIndex] = useState(0);
    const [slaRisk, setSlaRisk] = useState<{
        percentage: number;
        timeElapsed: string;
        timeRemaining: string;
        hasResponse: boolean;
        breachTime?: string;
        pauseAt?: string;
        recommendation?: string;
    }>({ percentage: 0, timeElapsed: '0h 0m', timeRemaining: '0h 0m', hasResponse: false });
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiConfidence, setAiConfidence] = useState<'high' | 'medium' | 'low'>('low');
    const [isApplyingSummary, setIsApplyingSummary] = useState(false);
    const [isInternalNote, setIsInternalNote] = useState(false);

    // Queue Filter State - for switching between different ticket views
    const [queueFilter, setQueueFilter] = useState<'assigned' | 'submitted' | 'all'>(initialQueueFilter);

    // Search and Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [agentFilter, setAgentFilter] = useState<string>('all');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [now, setNow] = useState(new Date());

    // --- REAL-TIME TICKER ---
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 60000); // Tick every minute for performance & accuracy
        return () => clearInterval(timer);
    }, []);

    // SLA Data States
    const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
    const [slaTargets, setSlaTargets] = useState<any[]>([]);

    // --- SLA CALCULATIONS (Business Hours Aware) ---
    // --- SLA CALCULATIONS (Business Hours Aware) ---
    const calculateBusinessDeadline = (startDate: Date, targetMinutes: number, schedule: any[]) => {
        if (!schedule || schedule.length === 0) return new Date(startDate.getTime() + targetMinutes * 60000);

        let remainingMinutes = targetMinutes;
        let currentDate = new Date(startDate);

        while (remainingMinutes > 0) {
            const dayName = currentDate.toLocaleString('en-US', { weekday: 'long' });
            const dayConfig = schedule.find((d: any) => d.day === dayName);

            if (!dayConfig || !dayConfig.isActive) {
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(0, 0, 0, 0);
                continue;
            }

            const [startH, startM] = dayConfig.startTime.split(':').map(Number);
            const [endH, endM] = dayConfig.endTime.split(':').map(Number);

            const workStart = new Date(currentDate);
            workStart.setHours(startH, startM, 0, 0);
            const workEnd = new Date(currentDate);
            workEnd.setHours(endH, endM, 0, 0);

            if (currentDate < workStart) currentDate = workStart;
            if (currentDate >= workEnd) {
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(0, 0, 0, 0);
                continue;
            }

            // Check for break
            if (dayConfig.breakActive) {
                const [bStartH, bStartM] = dayConfig.breakStartTime.split(':').map(Number);
                const [bEndH, bEndM] = dayConfig.breakEndTime.split(':').map(Number);
                const bStart = new Date(currentDate); bStart.setHours(bStartH, bStartM, 0, 0);
                const bEnd = new Date(currentDate); bEnd.setHours(bEndH, bEndM, 0, 0);

                if (currentDate < bStart) {
                    const minsToBreak = (bStart.getTime() - currentDate.getTime()) / 60000;
                    if (remainingMinutes <= minsToBreak) {
                        currentDate = new Date(currentDate.getTime() + remainingMinutes * 60000);
                        remainingMinutes = 0;
                        break;
                    } else {
                        remainingMinutes -= minsToBreak;
                        currentDate = bEnd;
                        continue;
                    }
                } else if (currentDate < bEnd) {
                    currentDate = bEnd;
                    continue;
                }
            }

            const minsToday = (workEnd.getTime() - currentDate.getTime()) / 60000;
            if (remainingMinutes <= minsToday) {
                currentDate = new Date(currentDate.getTime() + remainingMinutes * 60000);
                remainingMinutes = 0;
            } else {
                remainingMinutes -= minsToday;
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(0, 0, 0, 0);
            }
        }
        return currentDate;
    };

    const calculateBusinessElapsed = (startDate: Date, endDate: Date, schedule: any[]) => {
        if (!schedule || schedule.length === 0) return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));

        let elapsedMinutes = 0;
        let currentDate = new Date(startDate);

        while (currentDate < endDate) {
            const dayName = currentDate.toLocaleString('en-US', { weekday: 'long' });
            const dayConfig = schedule.find((d: any) => d.day === dayName);

            if (!dayConfig || !dayConfig.isActive) {
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(0, 0, 0, 0);
                continue;
            }

            const [startH, startM] = dayConfig.startTime.split(':').map(Number);
            const [endH, endM] = dayConfig.endTime.split(':').map(Number);

            const workStart = new Date(currentDate);
            workStart.setHours(startH, startM, 0, 0);
            const workEnd = new Date(currentDate);
            workEnd.setHours(endH, endM, 0, 0);

            let segmentStart = currentDate < workStart ? workStart : currentDate;
            let segmentEnd = endDate < workEnd ? endDate : workEnd;

            if (segmentStart < segmentEnd) {
                if (dayConfig.breakActive) {
                    const [bStartH, bStartM] = dayConfig.breakStartTime.split(':').map(Number);
                    const [bEndH, bEndM] = dayConfig.breakEndTime.split(':').map(Number);
                    const bStart = new Date(segmentStart); bStart.setHours(bStartH, bStartM, 0, 0);
                    const bEnd = new Date(segmentStart); bEnd.setHours(bEndH, bEndM, 0, 0);

                    if (segmentStart < bStart && segmentEnd > bEnd) {
                        elapsedMinutes += (bStart.getTime() - segmentStart.getTime()) / 60000;
                        elapsedMinutes += (segmentEnd.getTime() - bEnd.getTime()) / 60000;
                    } else if (segmentEnd <= bStart || segmentStart >= bEnd) {
                        elapsedMinutes += (segmentEnd.getTime() - segmentStart.getTime()) / 60000;
                    } else if (segmentStart < bStart) {
                        elapsedMinutes += (bStart.getTime() - segmentStart.getTime()) / 60000;
                    } else if (segmentEnd > bEnd) {
                        elapsedMinutes += (segmentEnd.getTime() - bEnd.getTime()) / 60000;
                    }
                } else {
                    elapsedMinutes += (segmentEnd.getTime() - segmentStart.getTime()) / 60000;
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
        }
        return Math.floor(elapsedMinutes);
    };

    // Memoized filtered tickets
    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch =
            ticket.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.requester?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || ticket.ticket_statuses?.status_name === statusFilter;
        const matchesPriority = priorityFilter === 'all' || ticket.priority?.toLowerCase() === priorityFilter.toLowerCase();
        const matchesAgent =
            agentFilter === 'all' ||
            (agentFilter === 'unassigned' && !ticket.assigned_to) ||
            (ticket.assigned_to === agentFilter);

        return matchesSearch && matchesStatus && matchesPriority && matchesAgent;
    }).sort((a, b) => {
        // Status Priority: Active (Open, In Progress, Pending) first
        const terminalStatuses = ['Resolved', 'Closed', 'Canceled'];
        const isTerminalA = terminalStatuses.includes(a.ticket_statuses?.status_name);
        const isTerminalB = terminalStatuses.includes(b.ticket_statuses?.status_name);

        if (isTerminalA && !isTerminalB) return 1;
        if (!isTerminalA && isTerminalB) return -1;

        // Within same group, sort by updated_at DESC (newest activity first)
        const timeA = new Date(a.updated_at).getTime();
        const timeB = new Date(b.updated_at).getTime();

        return timeB - timeA;
    });

    useEffect(() => {
        const fetchAgentGroups = async () => {
            if (!userProfile?.id) return;
            const { data } = await supabase.from('user_groups').select('group_id').eq('user_id', userProfile.id);
            if (data) setAgentGroups(data.map(g => g.group_id));
        };
        const fetchStatuses = async () => {
            const { data } = await supabase.from('ticket_statuses').select('*').order('status_name');
            if (data) setAvailableStatuses(data);
        };
        const fetchAllGroups = async () => {
            const { data, error } = await supabase.from('groups').select('id, name, company_id').order('name');
            if (error) console.error('Error fetching groups:', error);
            if (data) setAllGroups(data);
        };
        const fetchAllAgents = async () => {
            // Fetch profiles with their group and company associations
            const { data, error } = await supabase
                .from('user_groups')
                .select(`
                    user_id,
                    group_id,
                    profiles:user_id (id, full_name, role_id, roles:role_id(role_name)),
                    groups:group_id (company_id)
                `)
                .neq('profiles.role_id', 4); // Not a Requester

            if (error) {
                console.error('Error fetching agents:', error);
            } else {
                // Flatten and unique agents, collecting companies and groups
                const processedAgents = data.reduce((acc: any[], item: any) => {
                    const profile = item.profiles;
                    if (!profile) return acc;

                    const existing = acc.find(a => a.id === profile.id);
                    const companyId = item.groups?.company_id;
                    const groupId = item.group_id;

                    const roleName = profile.roles?.role_name || '';

                    if (existing) {
                        if (companyId && !existing.companies.includes(companyId)) {
                            existing.companies.push(companyId);
                        }
                        if (groupId && !existing.group_ids.includes(groupId)) {
                            existing.group_ids.push(groupId);
                        }
                    } else {
                        acc.push({
                            ...profile,
                            role_name: roleName,
                            companies: companyId ? [companyId] : [],
                            group_ids: groupId ? [groupId] : []
                        });
                    }
                    return acc;
                }, []);

                setAllAgents(processedAgents);
            }
        };
        const fetchCategories = async () => {
            const { data } = await supabase.from('ticket_categories').select('*');
            if (data) setAllCategories(data);
        };
        fetchAgentGroups();
        fetchStatuses();
        fetchAllGroups();
        fetchAllAgents();
        fetchCategories();

        const fetchSLAData = async () => {
            const [policiesRes, targetsRes] = await Promise.all([
                supabase.from('sla_policies').select('*').eq('is_active', true),
                supabase.from('sla_targets').select('*')
            ]);
            if (policiesRes.data) setSlaPolicies(policiesRes.data);
            if (targetsRes.data) setSlaTargets(targetsRes.data);
        };
        fetchSLAData();
    }, [userProfile]);

    useEffect(() => {
        const fetchTickets = async () => {
            if (!userProfile?.id) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            // Base query builder
            let query = supabase
                .from('tickets')
                .select(`
                    id, ticket_number, subject, priority, created_at, updated_at, ticket_type,
                    assignment_group_id, status_id, assigned_to, requester_id,
                    ticket_statuses!fk_tickets_status (status_name),
                    requester:profiles!fk_tickets_requester (full_name),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name),
                    group:groups!assignment_group_id (
                        id, name, company_id,
                        business_hours (weekly_schedule),
                        group_sla_policies (sla_policy_id)
                    )
                `)
                .order('updated_at', { ascending: false });

            // Apply filter based on queueFilter
            if (queueFilter === 'assigned') {
                // Tickets assigned to me (as agent)
                query = query.eq('assigned_to', userProfile.id);
            } else if (queueFilter === 'submitted') {
                // Tickets I submitted (as requester)
                query = query.eq('requester_id', userProfile.id);
            } else if (queueFilter === 'all') {
                // All tickets in my groups (for supervisors/admins)
                if (agentGroups.length > 0) {
                    query = query.in('assignment_group_id', agentGroups);
                }
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching tickets:', error);
                setIsLoading(false);
                return;
            }

            if (data) {
                setTickets(data);
                // Auto-select first ticket if none selected
                if (data.length > 0 && !selectedTicketId) {
                    setSelectedTicketId(data[0].id);
                } else if (data.length === 0) {
                    setSelectedTicketId(null);
                    setSelectedTicket(null);
                }
            }
            setIsLoading(false);
        };

        // Fetch based on filter type
        if (queueFilter === 'all' && agentGroups.length === 0) {
            // Wait for agentGroups to load for 'all' filter
            return;
        }

        fetchTickets();
    }, [queueFilter, agentGroups, userProfile?.id]);

    useEffect(() => {
        if (!selectedTicketId) return;

        const fetchDetails = async () => {
            const { data: ticket } = await supabase
                .from('tickets')
                .select(`
                    *,
                    category_id,
                    ticket_statuses!fk_tickets_status (status_name),
                    ticket_categories (name),
                    services (name),
                    requester:profiles!fk_tickets_requester (full_name, email),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name),
                    group:groups!assignment_group_id (
                        id, name, company_id, 
                        company:company_id(company_name),
                        group_sla_policies(sla_policy_id),
                        business_hours(weekly_schedule)
                    ),
                    ticket_attachments (*)
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
                    sender_name: m.sender?.full_name || (m.sender_role === 'requester' ? 'User' : 'Agent')
                })));
            }
        };
        const fetchActivityLogs = async () => {
            if (!selectedTicketId) return;
            const { data } = await supabase
                .from('ticket_activity_log')
                .select('*')
                .eq('ticket_id', selectedTicketId)
                .order('created_at', { ascending: false });
            if (data) setActivityLogs(data);
        };
        fetchDetails();
        fetchActivityLogs();
    }, [selectedTicketId]);

    // AI Helper - Knowledge Base & History
    const [suggestedKB, setSuggestedKB] = useState<any[]>([]);
    const [similarTickets, setSimilarTickets] = useState<any[]>([]);

    useEffect(() => {
        const fetchAISuggestions = async () => {
            if (!selectedTicket?.subject && !selectedTicket?.description) return;
            setIsAiLoading(true);

            try {
                // ==========================================
                // 1. EXTRACT KEYWORDS FROM SUBJECT + DESCRIPTION
                // ==========================================
                const stopWords = new Set([
                    'the', 'and', 'is', 'to', 'in', 'of', 'for', 'a', 'an', 'on', 'with', 'at', 'by',
                    'dan', 'yang', 'di', 'ke', 'dari', 'ini', 'itu', 'saya', 'tidak', 'bisa', 'ada',
                    'karena', 'jika', 'atau', 'dengan', 'untuk', 'pada', 'adalah', 'sebagai', 'sudah', 'telah'
                ]);

                const text = `${selectedTicket.subject || ''} ${selectedTicket.description || ''}`.toLowerCase();
                const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/[^a-zA-Z0-9\s]/g, ' ');
                const words = cleanText.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
                const keywords = [...new Set(words)].slice(0, 10);

                // Also use tags if available
                const ticketTags = selectedTicket.tags || [];
                const allSearchTerms = [...new Set([...keywords, ...ticketTags])];

                // ==========================================
                // 2. FETCH KB ARTICLES WITH RELEVANCE SCORING
                // ==========================================
                if (allSearchTerms.length > 0) {
                    // Get more articles initially, then score and filter
                    const kbQuery = allSearchTerms.slice(0, 5).map(w => `title.ilike.%${w}%,summary.ilike.%${w}%`).join(',');
                    const { data: kbData } = await supabase
                        .from('kb_articles')
                        .select('id, title, summary, visibility')
                        .eq('status', 'published')
                        .or(kbQuery)
                        .limit(10);

                    if (kbData && kbData.length > 0) {
                        // Score each article based on relevance
                        const scoredArticles = kbData.map(article => {
                            let score = 0;
                            const titleLower = (article.title || '').toLowerCase();
                            const summaryLower = (article.summary || '').toLowerCase();

                            // Priority keywords from subject (more important)
                            const subjectKeywords = (selectedTicket.subject || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);

                            subjectKeywords.forEach((word: string) => {
                                // Exact word match in title = highest score
                                if (titleLower.split(/\s+/).includes(word)) score += 20;
                                // Partial match in title
                                else if (titleLower.includes(word)) score += 10;
                                // Match in summary
                                if (summaryLower.includes(word)) score += 5;
                            });

                            // Bonus for tag matches
                            ticketTags.forEach((tag: string) => {
                                if (titleLower.includes(tag.toLowerCase())) score += 15;
                                if (summaryLower.includes(tag.toLowerCase())) score += 8;
                            });

                            return { ...article, relevanceScore: score };
                        });

                        // Filter articles with minimum relevance score and sort by score
                        const relevantArticles = scoredArticles
                            .filter(a => a.relevanceScore >= 10) // Minimum threshold
                            .sort((a, b) => b.relevanceScore - a.relevanceScore)
                            .slice(0, 3);

                        setSuggestedKB(relevantArticles);
                    } else {
                        setSuggestedKB([]);
                    }
                }

                // ==========================================
                // 3. FETCH SIMILAR SOLVED TICKETS (using tags + subject)
                // ==========================================
                // First try by tags overlap
                let similarData: any[] = [];

                if (ticketTags.length > 0) {
                    const { data: byTags } = await supabase
                        .from('tickets')
                        .select('id, subject, status_id, created_at, tags, ticket_statuses!fk_tickets_status(status_name)')
                        .neq('id', selectedTicket.id)
                        .overlaps('tags', ticketTags)
                        .order('created_at', { ascending: false })
                        .limit(5);

                    if (byTags) similarData = byTags;
                }

                // Fallback: search by subject keywords
                if (similarData.length < 3 && keywords.length > 0) {
                    const subjectQuery = keywords.slice(0, 3).map(w => `subject.ilike.%${w}%`).join(',');
                    const { data: bySubject } = await supabase
                        .from('tickets')
                        .select('id, subject, status_id, created_at, tags, ticket_statuses!fk_tickets_status(status_name)')
                        .neq('id', selectedTicket.id)
                        .or(subjectQuery)
                        .order('created_at', { ascending: false })
                        .limit(5);

                    if (bySubject) {
                        // Merge and dedupe
                        const existingIds = new Set(similarData.map(t => t.id));
                        bySubject.forEach(t => {
                            if (!existingIds.has(t.id)) similarData.push(t);
                        });
                    }
                }

                // Filter to ONLY show resolved/closed tickets (exclude canceled, open, etc)
                const prioritizedSimilar = similarData
                    .filter(t => {
                        const status = t.ticket_statuses?.status_name?.toLowerCase() || '';
                        return status === 'resolved' || status === 'closed';
                    })
                    .slice(0, 3)
                    .map(t => ({
                        id: t.id,
                        title: t.subject,
                        status: t.ticket_statuses?.status_name || 'Unknown',
                        created_at: t.created_at
                    }));

                setSimilarTickets(prioritizedSimilar);

                // ==========================================
                // 4. AI SUMMARY GENERATION (Client-side NLP simulation)
                // ==========================================
                const summaryPoints: string[] = [];
                const descLower = (selectedTicket.description || '').toLowerCase();

                // Extract key information
                if (selectedTicket.requester?.full_name) {
                    summaryPoints.push(`Reported by ${selectedTicket.requester.full_name}`);
                }

                // Detect issue type
                if (descLower.includes('login') || descLower.includes('password') || descLower.includes('akses')) {
                    summaryPoints.push('Issue involves login/access problem');
                } else if (descLower.includes('error') || descLower.includes('gagal')) {
                    summaryPoints.push('User experiencing error/failure');
                } else if (descLower.includes('slow') || descLower.includes('lambat')) {
                    summaryPoints.push('Performance/slowness issue reported');
                }

                // Extract system mentions
                const systems = ['sap', 'finance', 'more', 'vms', 'email', 'outlook', 'excel', 'word'];
                const mentionedSystems = systems.filter(s => descLower.includes(s));
                if (mentionedSystems.length > 0) {
                    summaryPoints.push(`Affected system(s): ${mentionedSystems.map(s => s.toUpperCase()).join(', ')}`);
                }

                // Time detection
                const timeMatch = text.match(/\b(\d{1,2}[:.]\d{2}|\d{1,2}\s*(am|pm)|sejak\s+\w+|since\s+\w+)/i);
                if (timeMatch) {
                    summaryPoints.push(`Issue started around: ${timeMatch[0]}`);
                }

                if (summaryPoints.length === 0) {
                    summaryPoints.push('User reported a general issue');
                }

                setAiSummary(summaryPoints);

                // ==========================================
                // 5. AI CLASSIFICATION SUGGESTION
                // ==========================================
                let suggestedCategory = 'General';
                let suggestedPriority = 'medium';

                // Category detection
                if (descLower.includes('login') || descLower.includes('password') || descLower.includes('akses') || descLower.includes('permission')) {
                    suggestedCategory = 'Access & Authentication';
                } else if (descLower.includes('hardware') || descLower.includes('laptop') || descLower.includes('monitor')) {
                    suggestedCategory = 'Hardware';
                } else if (descLower.includes('network') || descLower.includes('wifi') || descLower.includes('internet') || descLower.includes('vpn')) {
                    suggestedCategory = 'Network & Connectivity';
                } else if (descLower.includes('software') || descLower.includes('install') || descLower.includes('app')) {
                    suggestedCategory = 'Software & Applications';
                }

                // Priority detection
                if (descLower.includes('urgent') || descLower.includes('critical') || descLower.includes('mati') || descLower.includes('down')) {
                    suggestedPriority = 'urgent';
                } else if (descLower.includes('error') || descLower.includes('gagal') || descLower.includes('tidak bisa')) {
                    suggestedPriority = 'high';
                } else if (descLower.includes('slow') || descLower.includes('lambat')) {
                    suggestedPriority = 'medium';
                }

                setAiClassification({ category: suggestedCategory, priority: suggestedPriority });

                // ==========================================
                // 6. AI SUGGESTED REPLY GENERATION (Context-Aware)
                // ==========================================
                const requesterName = selectedTicket.requester?.full_name?.split(' ')[0] || 'User';

                // Get last requester message for context
                const lastRequesterMsg = [...messages].reverse().find(m => m.sender_role === 'requester');
                const lastMsgContent = lastRequesterMsg?.content?.toLowerCase().replace(/<[^>]*>/g, '') || '';
                const analyzeContent = lastMsgContent || descLower;

                // Template Categorization with Variations
                const templates = {
                    success: [
                        `Halo ${requesterName}, senang mendengarnya jika kendala tersebut sudah teratasi. Apakah ada hal lain yang bisa kami bantu sebelum tiket ini kami tutup?`,
                        `Alhamdulillah sudah normal kembali ya ${requesterName}. Baik, saya standby dulu sebentar, jika tidak ada kendala lain tiket ini akan saya selesaikan. Terimakasih!`,
                        `Sama-sama ${requesterName}, senang bisa membantu. Silakan dicoba kembali secara menyeluruh. Ada lagi yang bisa saya bantu sebelum sesi ini berakhir?`
                    ],
                    access: [
                        `Halo ${requesterName}, terkait kendala akses tersebut, kami sedang melakukan pengecekan pada akun Anda di sistem. Mohon dicoba kembali dalam 5 menit ya.`,
                        `Baik ${requesterName}, akses Anda sedang kami reset. Bisa diinfokan apakah Anda menggunakan koneksi VPN atau jaringan kantor saat mencoba login?`,
                        `Halo ${requesterName}, kami sedang memvalidasi permission user Anda. Mohon tunggu sebentar, kami akan segera menginfokan jika sudah bisa dicoba lagi.`
                    ],
                    error: [
                        `Halo ${requesterName}, mohon maaf atas ketidaknyamanannya. Terkait error tersebut, boleh dibantu screenshot pesan error lengkapnya? Kami akan cek ke tim terkait.`,
                        `Baik ${requesterName}, laporan error Anda sudah kami terima. Kami sedang melakukan investigasi pada log sistem. Apakah ini baru saja terjadi atau sudah dari tadi?`,
                        `Halo ${requesterName}, kami sedang meninjau laporan kendala Anda. Bisa diinfokan langkah-langkah detail sebelum muncul error tersebut untuk memudahkan kami mereplikasi masalahnya?`
                    ],
                    performance: [
                        `Halo ${requesterName}, kami memahami kendala performa tersebut memang cukup menghambat. Kami sedang mengecek utilisasi server saat ini. Apakah user lain juga merasakannya?`,
                        `Mohon maaf atas keterlambatan sistemnya ${requesterName}. Kami sedang melakukan pembersihan cache server. Mohon dicoba kembali secara berkala ya.`,
                        `Baik ${requesterName}, kendala slowness sudah kami eskalasi ke tim infrastruktur. Kami akan memberikan update segera setelah ada perbaikan jalur koneksi.`
                    ],
                    general: [
                        `Halo ${requesterName}, baik kami mengerti. Laporan Anda sedang kami proses lebih lanjut oleh tim terkait. Kami akan segera memberikan update kembali.`,
                        `Siap ${requesterName}, pesan sudah kami terima. Sedang ditangani oleh tim PIC terkait. Mohon ditunggu ya update selanjutnya.`,
                        `Terima kasih laporannya ${requesterName}. Kami akan segera menindaklanjuti hal tersebut. Estimasi pengecekan sekitar 15-30 menit ke depan.`
                    ]
                };

                let category: keyof typeof templates = 'general';
                if (analyzeContent.includes('sudah bisa') || analyzeContent.includes('berhasil') || analyzeContent.includes('terima kasih') || analyzeContent.includes('thanks') || analyzeContent.includes('oke') || analyzeContent.includes('aman')) {
                    category = 'success';
                } else if (analyzeContent.includes('login') || analyzeContent.includes('akses') || analyzeContent.includes('password') || analyzeContent.includes('akun')) {
                    category = 'access';
                } else if (analyzeContent.includes('error') || analyzeContent.includes('failed') || analyzeContent.includes('gagal') || analyzeContent.includes('salah')) {
                    category = 'error';
                } else if (analyzeContent.includes('slow') || analyzeContent.includes('lambat') || analyzeContent.includes('loading')) {
                    category = 'performance';
                }

                const selectedVariations = templates[category];
                const finalReply = selectedVariations[aiReplyIndex % selectedVariations.length];
                setAiSuggestedReply(finalReply);

                // ==========================================
                // 7. CALCULATE AI CONFIDENCE LEVEL
                // ==========================================
                // Based on: KB matches + Similar tickets found + Summary points generated
                const kbCount = suggestedKB.length;
                const similarCount = prioritizedSimilar.length;
                const summaryCount = summaryPoints.length;

                if ((kbCount >= 2 && similarCount >= 1) || (kbCount >= 1 && similarCount >= 2) || summaryCount >= 3) {
                    setAiConfidence('high');
                } else if (kbCount >= 1 || similarCount >= 1 || summaryCount >= 2) {
                    setAiConfidence('medium');
                } else {
                    setAiConfidence('low');
                }

            } catch (error) {
                console.error('AI Suggestions Error:', error);
            } finally {
                setIsAiLoading(false);
            }
        };

        fetchAISuggestions();
    }, [selectedTicket?.id, messages.length, aiReplyIndex]);

    // --- LIVE SLA RISK UPDATE ---
    useEffect(() => {
        if (!selectedTicket || !selectedTicket.created_at) return;

        const schedule = selectedTicket.group?.business_hours?.weekly_schedule || [];
        const firstResponseTime = messages.find(m => !m.is_internal && m.sender_id !== selectedTicket.requester_id)?.created_at;
        const createdAt = new Date(selectedTicket.created_at);

        const linkedSlaIds = selectedTicket.group?.group_sla_policies?.map((ug: any) => ug.sla_policy_id) || [];
        const matchingPolicy = slaPolicies.find(policy => {
            if (linkedSlaIds.length > 0 && !linkedSlaIds.includes(policy.id)) return false;
            if (!policy.conditions || !Array.isArray(policy.conditions)) return false;
            return policy.conditions.every((cond: any) => {
                let ticketVal: any;
                switch (cond.field) {
                    case 'company': ticketVal = selectedTicket.group?.company?.company_name; break;
                    case 'ticket_type': ticketVal = selectedTicket.ticket_type; break;
                    case 'category': ticketVal = selectedTicket.ticket_categories?.name; break;
                    case 'priority': ticketVal = selectedTicket.priority; break;
                    default: return false;
                }
                if (!ticketVal) return false;
                const valLower = String(cond.value).toLowerCase();
                const ticketValLower = String(ticketVal).toLowerCase();
                if (cond.operator === 'equals') return ticketValLower === valLower;
                if (cond.operator === 'not_equals') return ticketValLower !== valLower;
                if (cond.operator === 'in') return valLower.split(',').map(s => s.trim()).includes(ticketValLower);
                if (cond.operator === 'not_in') return !valLower.split(',').map(s => s.trim()).includes(ticketValLower);
                return false;
            });
        });

        const targets = slaTargets.filter(t => t.sla_policy_id === matchingPolicy?.id && t.priority?.toLowerCase() === (selectedTicket.priority || 'Medium').toLowerCase());
        const responseTarget = targets.find(t => t.sla_type === 'response');
        const resolutionTarget = targets.find(t => t.sla_type === 'resolution');

        const activeSlaType = firstResponseTime ? 'resolution' : 'response';
        const activeTarget = firstResponseTime ? resolutionTarget : responseTarget;
        const isTerminal = ['Resolved', 'Closed', 'Canceled'].includes(selectedTicket.ticket_statuses?.status_name);
        const stopTime = activityLogs.find(l => l.action.toLowerCase().includes('resolved') || l.action.toLowerCase().includes('canceled'))?.created_at;

        const businessElapsed = calculateBusinessElapsed(createdAt, (firstResponseTime && activeSlaType === 'response') ? new Date(firstResponseTime) : (isTerminal && stopTime ? new Date(stopTime) : now), schedule);
        const targetMins = activeTarget?.target_minutes || (activeSlaType === 'response' ? 240 : 480);

        const usedPercentage = Math.floor((businessElapsed / targetMins) * 100);
        const remMins = Math.max(0, targetMins - businessElapsed);

        // --- NEW ANALYSIS LOGIC ---
        const breachDate = calculateBusinessDeadline(createdAt, targetMins, schedule);

        // Find today's end time
        const todayName = now.toLocaleString('en-US', { weekday: 'long' });
        const todayConfig = schedule.find((d: any) => d.day === todayName);
        let pauseInfo = undefined;
        if (todayConfig && todayConfig.isActive && !isTerminal) {
            pauseInfo = todayConfig.endTime;
        }

        let rec = "";
        if (isTerminal) rec = "SLA Berhenti: Tiket sudah diproses hingga tahap akhir.";
        else if (usedPercentage >= 100) {
            rec = "OVERDUE: Target waktu telah terlampaui. Mohon segera selesaikan tiket dan komunikasikan kendala dengan user.";
        } else if (!firstResponseTime) {
            rec = usedPercentage > 50 ? "URGENT: Segera kirim respon pertama untuk mengamankan Response SLA!" : "Saran: Berikan respon awal agar user tahu tiket sedang ditangani.";
        } else {
            rec = usedPercentage > 75 ? "KRITIS: Resolusi sudah mendekati batas. Mohon fokus penyelesaian atau koordinasi tim." : "Aman: Fokus pada progres pengerjaan sesuai alur kerja.";
        }

        setSlaRisk({
            percentage: usedPercentage,
            timeElapsed: `${Math.floor(businessElapsed / 60)}h ${businessElapsed % 60}m`,
            timeRemaining: `${Math.floor(remMins / 60)}h ${remMins % 60}m`,
            hasResponse: !!firstResponseTime,
            breachTime: breachDate.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' WIB',
            pauseAt: pauseInfo,
            recommendation: rec
        });
    }, [now, selectedTicket?.id, messages.length, activityLogs.length]);

    // Apply AI Summary to Internal Notes
    // Apply AI Summary to Internal Notes (Fills composer instead of direct insert)
    const handleApplySummary = async () => {
        if (!selectedTicketId || aiSummary.length === 0) return;

        setIsApplyingSummary(true);
        try {
            // Format summary as HTML list
            const summaryHtml = `
                <div style="background: #fef3c7; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <strong style="color: #92400e;">🤖 AI Summary:</strong>
                    <ul style="margin: 8px 0 0; padding-left: 20px; color: #78350f;">
                        ${aiSummary.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                </div>
            `;

            // FILLS THE COMPOSER instead of immediate database insert
            setNewMessage(summaryHtml);
            setIsInternalNote(true); // Switch to internal note tab automatically

            // @ts-ignore
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({
                icon: 'success',
                title: 'Summary Inserted',
                text: 'AI Summary has been inserted into the Internal Note composer.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });

        } catch (error) {
            console.error('Apply Summary Error:', error);
        } finally {
            setIsApplyingSummary(false);
        }
    };

    // Helper to build category path (Breadcrumb)
    const getCategoryPath = (catId: string) => {
        if (!catId || allCategories.length === 0) return '';

        const path: string[] = [];
        let currentId: string | null = catId;
        let depth = 0; // Prevent infinite loops

        while (currentId && depth < 5) {
            const cat = allCategories.find(c => c.id === currentId);
            if (cat) {
                path.unshift(cat.name);
                currentId = cat.parent_id;
            } else {
                currentId = null;
            }
            depth++;
        }

        return path.join(' › ');
    };

    const [isSending, setIsSending] = useState(false);

    const handleSendMessage = async () => {
        const cleanMessage = newMessage.replace(/<[^>]*>/g, '').trim();
        const hasImage = newMessage.includes('<img');

        if ((!cleanMessage && !hasImage) || !selectedTicketId) return;

        setIsSending(true);
        try {
            // Priority 1: Use userProfile ID
            // Priority 2: Use current auth session
            let senderId = userProfile?.id;

            if (!senderId) {
                const { data: { user } } = await supabase.auth.getUser();
                senderId = user?.id;
            }

            if (!senderId) {
                // @ts-ignore
                const Swal = (await import('sweetalert2')).default;
                Swal.fire({
                    icon: 'error',
                    title: 'Authentication Error',
                    text: 'Unable to identify your agent profile. Please re-login.',
                    confirmButtonColor: '#6366f1'
                });
                return;
            }

            const { error: insertError } = await supabase.from('ticket_messages').insert({
                ticket_id: selectedTicketId,
                sender_id: senderId,
                sender_role: 'agent',
                content: newMessage,
                is_internal: isInternalNote
            });

            if (insertError) throw insertError;

            setNewMessage('');

            // Re-fetch messages
            const { data: msgs, error: fetchError } = await supabase
                .from('ticket_messages')
                .select('*, sender:profiles!sender_id(full_name)')
                .eq('ticket_id', selectedTicketId)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;

            if (msgs) {
                setMessages(msgs.map(m => ({
                    ...m,
                    sender_name: m.sender?.full_name || (m.sender_role === 'requester' ? 'User' : 'Agent')
                })));
            }

            // Always update ticket updated_at to bump it to top of list
            await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', selectedTicketId);

            // Auto-update status to In Progress if currently Open
            if (selectedTicket.ticket_statuses?.status_name === 'Open') {
                const inProgressStatus = availableStatuses.find(s => s.status_name === 'In Progress');
                if (inProgressStatus) {
                    await handleStatusUpdate(inProgressStatus.status_id);
                }
            }

            // Log activity
            await supabase.from('ticket_activity_log').insert({
                ticket_id: selectedTicketId,
                actor_id: senderId,
                action: 'Agent replied to ticket'
            });

            // Refresh activity logs
            const { data: logs } = await supabase
                .from('ticket_activity_log')
                .select('*')
                .eq('ticket_id', selectedTicketId)
                .order('created_at', { ascending: false });
            if (logs) setActivityLogs(logs);

            // Success feedback (optional, toast is better)
            // @ts-ignore
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({
                icon: 'success',
                title: 'Sent',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });

        } catch (err: any) {
            console.error('Send Error:', err);
            // @ts-ignore
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({
                icon: 'error',
                title: 'Send Failed',
                text: err.message || 'An error occurred while sending your message.',
                confirmButtonColor: '#6366f1'
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleStatusUpdate = async (newStatusId: string) => {
        if (!selectedTicketId || isUpdatingStatus) return;

        // Find status name
        const statusObj = availableStatuses.find(s => s.status_id === newStatusId);
        const newStatusName = statusObj?.status_name;
        let remark = '';

        // specialized handling for Pending / Resolved / Canceled
        if (['Pending', 'Resolved', 'Canceled'].includes(newStatusName)) {
            // @ts-ignore
            const Swal = (await import('sweetalert2')).default;
            const { value: text } = await Swal.fire({
                title: `${newStatusName} Remark`,
                input: 'textarea',
                inputLabel: `Please provide a reason or remark for setting status to ${newStatusName}`,
                inputPlaceholder: 'Type your remark here...',
                showCancelButton: true,
                confirmButtonText: 'Update Status',
                inputValidator: (value) => {
                    if (!value) {
                        return 'You need to write a remark!'
                    }
                }
            });

            if (!text) return; // User canceled or closed modal
            remark = text;
        }

        setIsUpdatingStatus(true);
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ status_id: newStatusId })
                .eq('id', selectedTicketId);

            if (error) throw error;

            // Refetch ticket details to update UI
            const { data: updatedTicket } = await supabase
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

            if (updatedTicket) {
                setSelectedTicket(updatedTicket);
                // Also update in the list
                setTickets(prev => prev.map(t => t.id === selectedTicketId ? updatedTicket : t));

                // Log activity
                let actorId = userProfile?.id;
                if (!actorId) {
                    const { data: { user } } = await supabase.auth.getUser();
                    actorId = user?.id;
                }

                const logAction = `Status changed from ${selectedTicket.ticket_statuses?.status_name} to ${updatedTicket.ticket_statuses?.status_name}${remark ? `. Remark: ${remark}` : ''}`;

                await supabase.from('ticket_activity_log').insert({
                    ticket_id: selectedTicketId,
                    actor_id: actorId,
                    action: logAction
                });

                // Refresh activity logs
                const { data: logs } = await supabase
                    .from('ticket_activity_log')
                    .select('*')
                    .eq('ticket_id', selectedTicketId)
                    .order('created_at', { ascending: false });
                if (logs) setActivityLogs(logs);
            }

            // @ts-ignore
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({
                icon: 'success',
                title: 'Status Updated',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
        } catch (err: any) {
            console.error('Status Update Error:', err);
            // @ts-ignore
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: err.message || 'An error occurred while updating status.',
                confirmButtonColor: '#6366f1'
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleAssignToMe = async () => {
        if (!selectedTicketId || isAssigning) return;

        setIsAssigning(true);
        try {
            let actorId = userProfile?.id;
            if (!actorId) {
                const { data: { user } } = await supabase.auth.getUser();
                actorId = user?.id;
            }

            if (!actorId) throw new Error("Could not find agent identity.");

            const { error } = await supabase
                .from('tickets')
                .update({ assigned_to: actorId })
                .eq('id', selectedTicketId);

            if (error) throw error;

            // Refetch ticket details to update UI
            const { data: updatedTicket } = await supabase
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

            if (updatedTicket) {
                setSelectedTicket(updatedTicket);
                // Also update in the list
                setTickets(prev => prev.map(t => t.id === selectedTicketId ? updatedTicket : t));

                // Log activity
                const agentName = userProfile?.full_name || updatedTicket.assigned_agent?.full_name || 'Agent';
                await supabase.from('ticket_activity_log').insert({
                    ticket_id: selectedTicketId,
                    actor_id: actorId,
                    action: `Ticket assigned to ${agentName}`
                });

                // Refresh activity logs
                const { data: logs } = await supabase
                    .from('ticket_activity_log')
                    .select('*')
                    .eq('ticket_id', selectedTicketId)
                    .order('created_at', { ascending: false });
                if (logs) setActivityLogs(logs);
            }

            // @ts-ignore
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({
                icon: 'success',
                title: 'Ticket Assigned',
                text: 'You are now the owner of this ticket.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
        } catch (err: any) {
            console.error('Assignment Error:', err);
            // @ts-ignore
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({ icon: 'error', title: 'Assignment Failed', text: err.message });
        } finally {
            setIsAssigning(false);
        }
    };

    const handleTransferGroup = async (newGroupId: string) => {
        if (!selectedTicketId || isTransferring || !newGroupId) return;

        const groupName = allGroups.find(g => g.id === newGroupId)?.name || 'New Group';

        // @ts-ignore
        const Swal = (await import('sweetalert2')).default;
        const result = await Swal.fire({
            title: 'Transfer Group?',
            text: `Move this ticket to ${groupName}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#6366f1',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, move it!'
        });

        if (!result.isConfirmed) return;

        setIsTransferring(true);
        try {
            const { error } = await supabase
                .from('tickets')
                .update({
                    assignment_group_id: newGroupId,
                    assigned_to: null
                })
                .eq('id', selectedTicketId);

            if (error) throw error;

            await supabase.from('ticket_activity_log').insert({
                ticket_id: selectedTicketId,
                actor_id: userProfile?.id,
                action: `Ticket transferred to group: ${groupName}`
            });

            // Refresh activity logs
            const { data: logs } = await supabase
                .from('ticket_activity_log')
                .select('*')
                .eq('ticket_id', selectedTicketId)
                .order('created_at', { ascending: false });
            if (logs) setActivityLogs(logs);

            // Refresh ticket details
            const { data: updatedTicket } = await supabase
                .from('tickets')
                .select(`
                    *,
                    ticket_statuses!fk_tickets_status (status_name),
                    ticket_categories (name),
                    services (name),
                    requester:profiles!fk_tickets_requester (full_name, email),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name),
                    group:groups!assignment_group_id (id, name, company_id)
                `)
                .eq('id', selectedTicketId)
                .single();

            if (updatedTicket) {
                setSelectedTicket(updatedTicket);
                setTickets(prev => prev.map(t => t.id === selectedTicketId ? updatedTicket : t));
            }

            Swal.fire({ icon: 'success', title: 'Transferred', timer: 1500 });
        } catch (err: any) {
            console.error('Transfer Error:', err);
            Swal.fire({ icon: 'error', title: 'Transfer Failed', text: err.message });
        } finally {
            setIsTransferring(false);
        }
    };


    const handleEscalate = async (targetId: string) => {
        if (!selectedTicketId || isTransferring || !targetId) return;



        const targetAgent = allAgents.find(a => a.id === targetId);
        const targetName = targetAgent?.full_name || 'Agent';

        // @ts-ignore
        const Swal = (await import('sweetalert2')).default;
        const result = await Swal.fire({
            title: 'Escalate to L2?',
            text: `Are you sure you want to escalate this ticket to ${targetName}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#fbbf24',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, escalate!'
        });

        if (!result.isConfirmed) return;

        setIsTransferring(true);
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ assigned_to: targetId })
                .eq('id', selectedTicketId);

            if (error) throw error;

            await supabase.from('ticket_activity_log').insert({
                ticket_id: selectedTicketId,
                actor_id: userProfile?.id,
                action: `Ticket escalated to L2 Agent: ${targetName}`
            });

            // Refresh activity logs
            const { data: logs } = await supabase
                .from('ticket_activity_log')
                .select('*')
                .eq('ticket_id', selectedTicketId)
                .order('created_at', { ascending: false });
            if (logs) setActivityLogs(logs);

            // Refresh ticket details
            const { data: updatedTicket } = await supabase
                .from('tickets')
                .select(`
                    *,
                    ticket_statuses!fk_tickets_status (status_name),
                    ticket_categories (name),
                    services (name),
                    requester:profiles!fk_tickets_requester (full_name, email),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name),
                    group:groups!assignment_group_id (id, name, company_id)
                `)
                .eq('id', selectedTicketId)
                .single();

            if (updatedTicket) {
                setSelectedTicket(updatedTicket);
                setTickets(prev => prev.map(t => t.id === selectedTicketId ? updatedTicket : t));
            }

            Swal.fire({ icon: 'success', title: 'Escalated', timer: 1500 });
        } catch (err: any) {
            console.error('Escalation Error:', err);
            Swal.fire({ icon: 'error', title: 'Escalation Failed', text: err.message });
        } finally {
            setIsTransferring(false);
        }
    };

    const handleReassign = async (targetId: string) => {
        if (!selectedTicketId || isTransferring || !targetId) return;

        const targetAgent = allAgents.find(a => a.id === targetId);
        const targetName = targetAgent?.full_name || 'Agent';

        // @ts-ignore
        const Swal = (await import('sweetalert2')).default;
        const result = await Swal.fire({
            title: 'Confirm Reassignment',
            text: `Are you sure you want to reassign this ticket to ${targetName}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, reassign'
        });

        if (!result.isConfirmed) return;

        setIsTransferring(true);
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ assigned_to: targetId })
                .eq('id', selectedTicketId);

            if (error) throw error;

            await supabase.from('ticket_activity_log').insert({
                ticket_id: selectedTicketId,
                actor_id: userProfile?.id,
                action: `Ticket reassigned to team member: ${targetName}`
            });

            // Refresh activity logs
            const { data: logs } = await supabase
                .from('ticket_activity_log')
                .select('*')
                .eq('ticket_id', selectedTicketId)
                .order('created_at', { ascending: false });
            if (logs) setActivityLogs(logs);

            // Refresh ticket details
            const { data: updatedTicket } = await supabase
                .from('tickets')
                .select(`
                    *,
                    ticket_statuses!fk_tickets_status (status_name),
                    ticket_categories (name),
                    services (name),
                    requester:profiles!fk_tickets_requester (full_name, email),
                    assigned_agent:profiles!fk_tickets_assigned_agent (full_name),
                    group:groups!assignment_group_id (id, name, company_id)
                `)
                .eq('id', selectedTicketId)
                .single();

            if (updatedTicket) {
                setSelectedTicket(updatedTicket);
                setTickets(prev => prev.map(t => t.id === selectedTicketId ? updatedTicket : t));
            }

            Swal.fire({ icon: 'success', title: 'Reassigned', timer: 1500 });
        } catch (err: any) {
            console.error('Reassignment Error:', err);
            Swal.fire({ icon: 'error', title: 'Reassignment Failed', text: err.message });
        } finally {
            setIsTransferring(false);
        }
    };

    return (
        <div className="flex h-full bg-[#f8f9fa] font-sans overflow-hidden text-[#333]">

            {/* 1. LEFT PANEL - Ticket List */}
            <div className="w-[320px] flex flex-col border-r border-gray-200 bg-white">
                {/* Search & Filter Bar */}
                <div className="p-3 border-b border-gray-100 flex flex-col gap-2 bg-white">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search Incidents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-md py-1.5 pl-8 pr-3 text-xs focus:ring-1 focus:ring-indigo-500/20 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                            className={`p-1.5 rounded-md border transition-all ${isFilterMenuOpen || statusFilter !== 'all' || priorityFilter !== 'all' || agentFilter !== 'all'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                : 'bg-white border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Filter size={16} />
                        </button>
                    </div>

                    {/* Filter Dropdown */}
                    {isFilterMenuOpen && (
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Status</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {['all', 'Open', 'In Progress', 'Resolved'].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setStatusFilter(s)}
                                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${statusFilter === s
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
                                                }`}
                                        >
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Priority</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {['all', 'low', 'medium', 'high', 'urgent'].map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPriorityFilter(p)}
                                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${priorityFilter === p
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
                                                }`}
                                        >
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Agent (PIC)</label>
                                <select
                                    value={agentFilter}
                                    onChange={(e) => setAgentFilter(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-[10px] font-bold text-gray-600 focus:ring-1 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                >
                                    <option value="all">All Agents</option>
                                    {allAgents
                                        .filter(agent =>
                                            // Only show agents that share at least one group with the current user
                                            agent.group_ids?.some((gid: any) => agentGroups.includes(gid)) &&
                                            // Exclude Admin roles
                                            !agent.role_name?.toLowerCase().includes('admin')
                                        )
                                        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // Unique agents
                                        .map(agent => (
                                            <option key={agent.id} value={agent.id}>{agent.full_name}</option>
                                        ))}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    setStatusFilter('all');
                                    setPriorityFilter('all');
                                    setAgentFilter('all');
                                    setSearchTerm('');
                                }}
                                className="w-full py-1 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 rounded transition-colors"
                            >
                                Reset Filters
                            </button>
                        </div>
                    )}
                </div>

                {/* Queue Filter Tabs */}
                <div className="flex border-b border-gray-100 bg-gray-50/50">
                    <button
                        onClick={() => setQueueFilter('assigned')}
                        className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${queueFilter === 'assigned'
                            ? 'text-blue-600 bg-white'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <User size={12} />
                            Assigned
                        </span>
                        {queueFilter === 'assigned' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                        )}
                    </button>
                    <button
                        onClick={() => setQueueFilter('submitted')}
                        className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${queueFilter === 'submitted'
                            ? 'text-blue-600 bg-white'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <FileText size={12} />
                            My Tickets
                        </span>
                        {queueFilter === 'submitted' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                        )}
                    </button>
                    <button
                        onClick={() => setQueueFilter('all')}
                        className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${queueFilter === 'all'
                            ? 'text-blue-600 bg-white'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <List size={12} />
                            All
                        </span>
                        {queueFilter === 'all' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                        )}
                    </button>
                </div>

                {/* Ticket Count Badge */}
                <div className="px-4 py-2 text-[11px] text-gray-500 bg-gray-50/30 border-b border-gray-50 flex justify-between items-center">
                    <span>
                        {queueFilter === 'assigned' && 'Tickets assigned to me'}
                        {queueFilter === 'submitted' && 'Tickets I submitted'}
                        {queueFilter === 'all' && 'All team tickets'}
                    </span>
                    <span className="font-bold text-blue-600">{filteredTickets.length}</span>
                </div>

                {/* Ticket List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' ? (
                                    <Search size={20} className="text-gray-400" />
                                ) : (
                                    <>
                                        {queueFilter === 'assigned' && <User size={20} className="text-gray-400" />}
                                        {queueFilter === 'submitted' && <FileText size={20} className="text-gray-400" />}
                                        {queueFilter === 'all' && <List size={20} className="text-gray-400" />}
                                    </>
                                )}
                            </div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">
                                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' ? 'No matches found' : 'No tickets found'}
                            </h4>
                            <p className="text-xs text-gray-500">
                                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                                    ? 'Try adjusting your search or filters'
                                    : queueFilter === 'assigned'
                                        ? 'No tickets assigned to you yet'
                                        : queueFilter === 'submitted'
                                            ? 'You haven\'t submitted any tickets'
                                            : 'No tickets in your team queue'}
                            </p>
                        </div>
                    ) : (
                        filteredTickets.map(ticket => {
                            // Time Since Last Activity
                            const ticketCreatedAt = new Date(ticket.created_at);
                            const ticketUpdatedAt = new Date(ticket.updated_at);
                            const diffMs = now.getTime() - ticketUpdatedAt.getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            const timeAgo = diffMins < 60 ? `${diffMins}m ago` :
                                diffMins < 1440 ? `${Math.floor(diffMins / 60)}h ago` :
                                    `${Math.floor(diffMins / 1440)}d ago`;

                            // SLA Calculation (Dynamic)
                            const schedule = ticket.group?.business_hours?.weekly_schedule || [];
                            const isTerminal = ['Resolved', 'Closed', 'Canceled'].includes(ticket.ticket_statuses?.status_name);

                            // Check if already responded to decide which SLA to show
                            // Note: messages isn't available for ALL tickets at once, so we assume response if status bukan Open
                            const likelyHasResponse = ticket.ticket_statuses?.status_name !== 'Open';
                            const activeSlaType = likelyHasResponse ? 'resolution' : 'response';

                            // Find matching policy (Simplified for list performance)
                            const linkedSlaIds = ticket.group?.group_sla_policies?.map((ug: any) => ug.sla_policy_id) || [];
                            const matchingPolicy = slaPolicies.find(policy => {
                                if (linkedSlaIds.length > 0 && !linkedSlaIds.includes(policy.id)) return false;
                                if (!policy.conditions || !Array.isArray(policy.conditions)) return false;
                                return policy.conditions.every((cond: any) => {
                                    let val: any;
                                    if (cond.field === 'ticket_type') val = ticket.ticket_type;
                                    else if (cond.field === 'priority') val = ticket.priority;
                                    else return true; // Skip complex conditions for list
                                    return String(val).toLowerCase() === String(cond.value).toLowerCase();
                                });
                            });

                            const target = slaTargets.find(t =>
                                t.sla_policy_id === matchingPolicy?.id &&
                                t.sla_type === activeSlaType &&
                                t.priority?.toLowerCase() === (ticket.priority || 'Medium').toLowerCase()
                            );

                            const elapsed = calculateBusinessElapsed(ticketCreatedAt, now, schedule);
                            const targetMins = target?.target_minutes || (activeSlaType === 'response' ? 240 : 480);
                            const remaining = Math.max(0, targetMins - elapsed);
                            const remH = Math.floor(remaining / 60);
                            const remM = remaining % 60;
                            const isBreached = remaining === 0 && !isTerminal;

                            return (
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
                                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{timeAgo}</span>
                                    </div>
                                    <h4 className="text-[13px] font-semibold text-gray-700 line-clamp-1 mb-1 leading-snug">
                                        {ticket.subject}
                                    </h4>
                                    <div className="flex justify-between items-center text-[11px] font-medium">
                                        <span className="text-gray-400 truncate max-w-[120px]">{ticket.requester?.full_name || 'Anonymous'}</span>
                                        <div className="flex items-center gap-2">
                                            {!isTerminal && (
                                                <span className={`${isBreached ? 'text-rose-600' : 'text-red-500'} font-bold tracking-tighter text-[10px]`}>
                                                    {isBreached ? 'OVERDUE' : `${String(remH).padStart(2, '0')}:${String(remM).padStart(2, '0')}:00`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-1.5">
                                        <div className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                            PIC: {ticket.assigned_agent?.full_name || 'UNASSIGNED'}
                                        </div>
                                        <div className={`text-[10px] font-black uppercase tracking-tight ${ticket.ticket_statuses?.status_name === 'Open' ? 'text-blue-600' :
                                            ticket.ticket_statuses?.status_name === 'In Progress' ? 'text-indigo-600' :
                                                ticket.ticket_statuses?.status_name === 'Resolved' ? 'text-emerald-600' :
                                                    ticket.ticket_statuses?.status_name === 'Canceled' ? 'text-rose-600' :
                                                        ticket.ticket_statuses?.status_name === 'Closed' ? 'text-slate-400' :
                                                            'text-gray-400'
                                            }`}>
                                            {ticket.ticket_statuses?.status_name}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* 2. CENTER PANEL - Incident Detail */}
            {selectedTicket ? (
                <div className="flex-1 flex flex-col min-w-0 bg-white">
                    {/* Header Section */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-black text-gray-800 mb-2 break-words">
                                    <span className="text-gray-400 font-bold text-lg block mb-1">{selectedTicket.ticket_number}</span>
                                    {selectedTicket.subject}
                                </h1>
                                <div className="flex items-center gap-3">
                                    {/* Dynamic Priority Badge */}
                                    <span className={`px-2.5 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${selectedTicket.priority?.toLowerCase() === 'high' || selectedTicket.priority?.toLowerCase() === 'urgent'
                                        ? 'bg-red-50 text-red-600 border-red-100' :
                                        selectedTicket.priority?.toLowerCase() === 'medium'
                                            ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        }`}>
                                        {
                                            (() => {
                                                const p = selectedTicket.priority?.toLowerCase() || 'low';
                                                if (p === 'critical') return 'P1 - CRITICAL';
                                                if (p === 'high') return 'P2 - HIGH';
                                                if (p === 'medium') return 'P3 - MEDIUM';
                                                return 'P4 - LOW';
                                            })()
                                        }
                                    </span>

                                    {/* Improved Status Selector */}
                                    <div className="relative group/status flex items-center">
                                        <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter">Status &nbsp;</span>
                                        <div className="relative">
                                            <select
                                                value={selectedTicket.status_id}
                                                disabled={isUpdatingStatus}
                                                onChange={(e) => handleStatusUpdate(e.target.value)}
                                                className={`appearance-none pl-3 pr-8 py-1 rounded text-[10px] font-black tracking-widest uppercase border cursor-pointer outline-none transition-all
                                                    ${selectedTicket.ticket_statuses?.status_name === 'Open' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                        selectedTicket.ticket_statuses?.status_name === 'In Progress' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                            selectedTicket.ticket_statuses?.status_name === 'Resolved' ? 'bg-green-50 text-green-600 border-green-200' :
                                                                selectedTicket.ticket_statuses?.status_name === 'Canceled' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                                                    'bg-slate-50 text-slate-600 border-slate-200'}`}
                                            >
                                                {availableStatuses
                                                    .filter(s => {
                                                        const currentName = selectedTicket.ticket_statuses?.status_name;
                                                        const allowed = workflowMap[currentName] || [];
                                                        // Always show current status, plus allowed next steps
                                                        // BUT ban 'Closed' from manual selection (automation only)
                                                        return (s.status_id === selectedTicket.status_id || allowed.includes(s.status_name)) && s.status_name !== 'Closed';
                                                    })
                                                    .sort((a, b) => {
                                                        // Put current status first in the dropdown for clarity
                                                        if (a.status_id === selectedTicket.status_id) return -1;
                                                        if (b.status_id === selectedTicket.status_id) return 1;
                                                        return 0;
                                                    })
                                                    .map(status => (
                                                        <option key={status.status_id} value={status.status_id} className="bg-white text-gray-800">
                                                            {status.status_name}
                                                        </option>
                                                    ))}
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                                <ChevronDown size={8} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleAssignToMe}
                                    disabled={isAssigning || selectedTicket.assigned_to === userProfile?.id}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2
                                        ${selectedTicket.assigned_to === userProfile?.id
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-none cursor-default'
                                            : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                                        }`}
                                >
                                    {isAssigning ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : selectedTicket.assigned_to === userProfile?.id ? (
                                        <><CheckCircle2 size={12} /> Assigned to me</>
                                    ) : (
                                        'Assign to me'
                                    )}
                                </button>

                                {userProfile?.role_id === 2 && (
                                    <div className="relative group">
                                        <button
                                            className={`p-2 text-gray-400 hover:text-emerald-600 rounded-lg border border-gray-200 transition-colors flex items-center gap-1.5 ${isTransferring ? 'opacity-50' : ''}`}
                                            title="Reassign to Team Member"
                                        >
                                            <Users size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-widest pr-1 text-emerald-600">Reassign</span>
                                        </button>
                                        <select
                                            onChange={(e) => handleReassign(e.target.value)}
                                            value=""
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                        >
                                            <option value="" disabled>Select Team Member</option>
                                            {allAgents
                                                .filter(a =>
                                                    a.id !== userProfile?.id &&
                                                    a.group_ids?.some((gid: any) => String(gid) === String(selectedTicket.assignment_group_id)) &&
                                                    !a.role_name?.includes('Admin') &&
                                                    !a.role_name?.includes('L2')
                                                )
                                                .map(agent => (
                                                    <option key={agent.id} value={agent.id}>{agent.full_name}</option>
                                                ))
                                            }
                                            {allAgents.filter(a =>
                                                a.id !== userProfile?.id &&
                                                a.group_ids?.some((gid: any) => String(gid) === String(selectedTicket.assignment_group_id)) &&
                                                !a.role_name?.includes('Admin') &&
                                                !a.role_name?.includes('L2')
                                            ).length === 0 && (
                                                    <option disabled>No other team members available</option>
                                                )}
                                        </select>
                                    </div>
                                )}

                                <div className="relative group">
                                    <button
                                        className={`p-2 text-gray-400 hover:text-blue-600 rounded-lg border border-gray-200 transition-colors flex items-center gap-1.5 ${isTransferring ? 'opacity-50' : ''}`}
                                        title="Transfer Group"
                                    >
                                        <ArrowRight size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest pr-1">Transfer</span>
                                    </button>
                                    <select
                                        onChange={(e) => handleTransferGroup(e.target.value)}
                                        value=""
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                    >
                                        <option value="" disabled>Select Group</option>
                                        {allGroups
                                            .filter(g =>
                                                g.id !== selectedTicket.assignment_group_id &&
                                                g.company_id === selectedTicket.group?.company_id
                                            )
                                            .map(group => (
                                                <option key={group.id} value={group.id}>{group.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div className="relative group">
                                    <button
                                        className={`p-2 text-gray-400 hover:text-orange-600 rounded-lg border border-gray-200 transition-colors flex items-center gap-1.5 ${isTransferring ? 'opacity-50' : ''}`}
                                        title="Escalate to L2"
                                    >
                                        <ArrowUpRight size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest pr-1 text-orange-600">Escalate</span>
                                    </button>
                                    <select
                                        onChange={(e) => handleEscalate(e.target.value)}
                                        value=""
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                    >
                                        <option value="" disabled>Select L2 Agent</option>
                                        {allAgents
                                            .filter(a =>
                                                a.id !== userProfile?.id &&
                                                a.id !== selectedTicket.assigned_to &&
                                                a.companies.includes(selectedTicket.group?.company_id) &&
                                                a.role_name?.includes('L2')
                                            )
                                            .map(agent => (
                                                <option key={agent.id} value={agent.id}>{agent.full_name} ({agent.role_name})</option>
                                            ))
                                        }
                                        {allAgents.filter(a => a.companies.includes(selectedTicket.group?.company_id) && a.role_name?.includes('L2')).length === 0 && (
                                            <option disabled>No L2 Agents found</option>
                                        )}
                                    </select>
                                </div>
                                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg border border-gray-200"><MoreHorizontal size={16} /></button>
                            </div>
                        </div>

                        {/* Real SLA Bar */}
                        {(() => {
                            const schedule = selectedTicket.group?.business_hours?.weekly_schedule || [];
                            const firstResponseTime = messages.find(m => !m.is_internal && m.sender_id !== selectedTicket.requester_id)?.created_at;

                            const linkedSlaIds = selectedTicket.group?.group_sla_policies?.map((ug: any) => ug.sla_policy_id) || [];
                            const matchingPolicy = slaPolicies.find(policy => {
                                if (linkedSlaIds.length > 0 && !linkedSlaIds.includes(policy.id)) return false;
                                if (!policy.conditions || !Array.isArray(policy.conditions)) return false;
                                return policy.conditions.every((cond: any) => {
                                    let ticketVal: any;
                                    switch (cond.field) {
                                        case 'company': ticketVal = selectedTicket.group?.company?.company_name; break;
                                        case 'ticket_type': ticketVal = selectedTicket.ticket_type; break;
                                        case 'category': ticketVal = selectedTicket.ticket_categories?.name; break;
                                        case 'priority': ticketVal = selectedTicket.priority; break;
                                        default: return false;
                                    }
                                    if (!ticketVal) return false;
                                    const valLower = String(cond.value).toLowerCase();
                                    const ticketValLower = String(ticketVal).toLowerCase();
                                    if (cond.operator === 'equals') return ticketValLower === valLower;
                                    if (cond.operator === 'not_equals') return ticketValLower !== valLower;
                                    if (cond.operator === 'in') return valLower.split(',').map(s => s.trim()).includes(ticketValLower);
                                    if (cond.operator === 'not_in') return !valLower.split(',').map(s => s.trim()).includes(ticketValLower);
                                    return false;
                                });
                            });

                            const targets = slaTargets.filter(t => t.sla_policy_id === matchingPolicy?.id && t.priority?.toLowerCase() === (selectedTicket.priority || 'Medium').toLowerCase());
                            const responseTarget = targets.find(t => t.sla_type === 'response');
                            const resolutionTarget = targets.find(t => t.sla_type === 'resolution');

                            const activeSlaType = firstResponseTime ? 'Resolution' : 'Response';
                            const activeTarget = firstResponseTime ? resolutionTarget : responseTarget;
                            const isTerminal = ['Resolved', 'Closed', 'Canceled'].includes(selectedTicket.ticket_statuses?.status_name);
                            const stopTime = activityLogs.find(l => l.action.toLowerCase().includes('resolved') || l.action.toLowerCase().includes('canceled'))?.created_at;

                            const activeElapsed = firstResponseTime ?
                                calculateBusinessElapsed(new Date(selectedTicket.created_at), stopTime ? new Date(stopTime) : now, schedule) :
                                calculateBusinessElapsed(new Date(selectedTicket.created_at), now, schedule);

                            const targetMins = activeTarget?.target_minutes || 60;
                            const percentage = Math.min(100, (activeElapsed / targetMins) * 100);

                            const h = Math.floor(activeElapsed / 60);
                            const m = activeElapsed % 60;
                            const remMins = Math.max(0, targetMins - activeElapsed);
                            const rh = Math.floor(remMins / 60);
                            const rm = remMins % 60;

                            return (
                                <div className="mt-6 flex flex-col gap-1.5">
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-gray-400 font-black uppercase tracking-widest">{activeSlaType} SLA</span>
                                        <div className="flex items-center gap-3">
                                            <span className={`${percentage >= 75 ? 'text-red-500' : 'text-amber-500'} font-black`}>{Math.floor(percentage)}% Used</span>
                                            <span className="text-indigo-600 font-black flex items-center gap-1">Remaining: {rh}h {rm}m</span>
                                            <span className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1 font-black">
                                                <Clock size={10} /> {h}h {m}m
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                                        <div
                                            className={`h-full transition-all duration-500 ${percentage >= 75 ? 'bg-red-500' :
                                                percentage >= 50 ? 'bg-amber-500' :
                                                    'bg-green-500'
                                                }`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-gray-100 px-6">
                        <TabItem active={activeTab === 'conversation'} onClick={() => setActiveTab('conversation')} icon={MessageSquare} label="Conversation" />
                        <TabItem active={activeTab === 'details'} onClick={() => setActiveTab('details')} icon={FileText} label="Details" />
                        <TabItem active={activeTab === 'workflow'} onClick={() => setActiveTab('workflow')} icon={GitBranch} label="Work Flow" />
                        <TabItem active={activeTab === 'sla'} onClick={() => setActiveTab('sla')} icon={Clock} label="SLA" />
                        <TabItem active={activeTab === 'activities'} onClick={() => setActiveTab('activities')} icon={List} label="Activities" />
                        <TabItem active={activeTab === 'attachments'} onClick={() => setActiveTab('attachments')} icon={Paperclip} label="Attachments" />
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
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(selectedTicket.created_at).toLocaleString()} WIB</span>
                                                <span className="bg-slate-50 text-slate-500 text-[9px] px-1.5 py-0.5 font-black uppercase rounded-md border border-slate-200 flex items-center gap-1">
                                                    Requester
                                                </span>
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

                                {messages.map((msg) => {
                                    const isAgent = msg.sender_role === 'agent';
                                    const isInternal = msg.is_internal;

                                    return (
                                        <div key={msg.id} className={`flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isAgent ? 'flex-row-reverse' : ''}`}>
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 shadow-sm transition-transform group-hover:scale-105
                                                ${isAgent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                {msg.sender_name?.charAt(0) || 'U'}
                                            </div>
                                            <div className={`flex-1 flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                                                <div className={`flex items-center gap-2 mb-2 ${isAgent ? 'flex-row-reverse' : ''}`}>
                                                    <span className="text-[13px] font-black text-gray-900">{msg.sender_name}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB
                                                    </span>
                                                    {isAgent ? (
                                                        <span className="bg-indigo-50 text-indigo-700 text-[9px] px-1.5 py-0.5 font-black uppercase rounded-md border border-indigo-100 flex items-center gap-1">
                                                            Agent
                                                        </span>
                                                    ) : (
                                                        <span className="bg-slate-100 text-slate-700 text-[9px] px-1.5 py-0.5 font-black uppercase rounded-md border border-slate-200 flex items-center gap-1">
                                                            Requester
                                                        </span>
                                                    )}
                                                    {isInternal && (
                                                        <span className="bg-amber-50 text-amber-600 text-[9px] px-1.5 py-0.5 font-black uppercase rounded-md border border-amber-100 flex items-center gap-1">
                                                            <Lock size={10} /> Private Note
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`p-4 rounded-2xl text-[14px] leading-relaxed font-medium shadow-sm transition-all
                                                    ${isInternal
                                                        ? 'bg-amber-50/40 border-2 border-amber-100/50 text-amber-900'
                                                        : isAgent
                                                            ? 'bg-white border-2 border-indigo-50 text-slate-700 hover:border-indigo-100 hover:shadow-indigo-50/50'
                                                            : 'bg-slate-50 border border-slate-100 text-slate-700'}`}>
                                                    <div className="prose prose-slate prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: msg.content }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* System Divider */}
                                <div className="flex items-center gap-4 py-8">
                                    <div className="h-px bg-slate-100 flex-1" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">End of History</span>
                                    <div className="h-px bg-slate-100 flex-1" />
                                </div>
                            </div>
                        )}

                        {activeTab === 'details' && (
                            <div className="grid grid-cols-2 gap-x-12 gap-y-8 max-w-4xl mx-auto p-4">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-6 border-b border-gray-100 pb-2">System Information</h4>
                                    <div className="space-y-5">
                                        <DetailRow label="Ticket ID" value={selectedTicket.ticket_number} />
                                        <DetailRow label="Current Status" value={selectedTicket.ticket_statuses?.status_name} />
                                        <DetailRow label="Priority Level" value={
                                            (() => {
                                                const p = selectedTicket.priority?.toLowerCase() || 'low';
                                                if (p === 'critical') return 'P1 - Critical';
                                                if (p === 'high') return 'P2 - High';
                                                if (p === 'medium') return 'P3 - Medium';
                                                return 'P4 - Low';
                                            })()
                                        } />
                                        <DetailRow label="Category" value={getCategoryPath(selectedTicket.category_id) || selectedTicket.ticket_categories?.name || 'System Classification Pending'} />
                                        <DetailRow label="Affected Service" value={selectedTicket.services?.name || '-'} />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-6 border-b border-gray-100 pb-2">People & Assignment</h4>
                                    <div className="space-y-5">
                                        <DetailRow label="Assignment Group" value={selectedTicket.group?.name || '-'} />
                                        <DetailRow label="Assigned Agent" value={selectedTicket.assigned_agent?.full_name || 'Unassigned'} />
                                        <DetailRow label="Requester Name" value={selectedTicket.requester?.full_name} />
                                        <DetailRow label="Requester Email" value={selectedTicket.requester?.email} />
                                        <DetailRow label="Created At" value={`${new Date(selectedTicket.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} WIB`} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'workflow' && (
                            <div className="max-w-3xl mx-auto py-4">
                                <div className="space-y-8">
                                    {[
                                        { step: 'Identification', date: selectedTicket.created_at, status: 'completed', desc: 'Incident logged via Portal' },
                                        { step: 'Classification', date: selectedTicket.created_at, status: 'completed', desc: 'Priority set and Categorized' },
                                        {
                                            step: 'Investigation',
                                            date: activityLogs.find(l => l.action.includes('In Progress'))?.created_at,
                                            status: ['In Progress', 'Pending'].includes(selectedTicket.ticket_statuses?.status_name) ? 'current' :
                                                (['Resolved', 'Closed'].includes(selectedTicket.ticket_statuses?.status_name) ? 'completed' : 'pending'),
                                            desc: 'Currently being handled by ' + (selectedTicket?.assigned_agent?.full_name || 'Service Desk')
                                        },
                                        {
                                            step: 'Resolution',
                                            date: activityLogs.find(l => l.action.includes('Resolved'))?.created_at,
                                            status: selectedTicket.ticket_statuses?.status_name === 'Resolved' ? 'current' :
                                                (selectedTicket.ticket_statuses?.status_name === 'Closed' ? 'completed' : 'pending'),
                                            desc: 'Awaiting solution confirmation'
                                        },
                                        {
                                            step: 'Closure',
                                            date: activityLogs.find(l => l.action.includes('Closed'))?.created_at,
                                            status: selectedTicket.ticket_statuses?.status_name === 'Closed' ? 'completed' : 'pending',
                                            desc: 'Final review and documentation'
                                        }
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
                                                    {item.date && <span className="text-[10px] font-bold text-gray-400">{new Date(item.date).toLocaleString()} WIB</span>}
                                                </div>
                                                <p className={`text-xs ${item.status === 'pending' ? 'text-gray-300' : 'text-gray-500 font-medium'}`}>{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'sla' && (() => {
                            // Calculate SLA data for the tab
                            const linkedSlaIds = selectedTicket.group?.group_sla_policies?.map((ug: any) => ug.sla_policy_id) || [];
                            const matchingPolicy = slaPolicies.find(policy => {
                                if (linkedSlaIds.length > 0 && !linkedSlaIds.includes(policy.id)) return false;
                                if (!policy.conditions || !Array.isArray(policy.conditions)) return false;
                                return policy.conditions.every((cond: any) => {
                                    let ticketValue: any;
                                    switch (cond.field) {
                                        case 'company': ticketValue = selectedTicket.group?.company?.company_name; break;
                                        case 'ticket_type': ticketValue = selectedTicket.ticket_type; break;
                                        case 'category': ticketValue = selectedTicket.ticket_categories?.name; break;
                                        case 'priority': ticketValue = selectedTicket.priority; break;
                                        default: return false;
                                    }
                                    if (!ticketValue) return false;
                                    const valLower = String(cond.value).toLowerCase();
                                    const ticketValLower = String(ticketValue).toLowerCase();
                                    if (cond.operator === 'equals') return ticketValLower === valLower;
                                    if (cond.operator === 'not_equals') return ticketValLower !== valLower;
                                    if (cond.operator === 'in') return valLower.split(',').map(s => s.trim()).includes(ticketValLower);
                                    if (cond.operator === 'not_in') return !valLower.split(',').map(s => s.trim()).includes(ticketValLower);
                                    return false;
                                });
                            });

                            const responseTarget = slaTargets.find(t =>
                                t.sla_policy_id === matchingPolicy?.id &&
                                t.sla_type === 'response' &&
                                t.priority?.toLowerCase() === (selectedTicket.priority || 'Medium').toLowerCase()
                            );

                            const resolutionTarget = slaTargets.find(t =>
                                t.sla_policy_id === matchingPolicy?.id &&
                                t.sla_type === 'resolution' &&
                                t.priority?.toLowerCase() === (selectedTicket.priority || 'Medium').toLowerCase()
                            );

                            // Deadlines are now calculated below using Business Hours logic

                            const formatTarget = (mins: number) => {
                                if (!mins) return 'No target';
                                if (mins >= 1440) return `${Math.round(mins / 1440)} Days`;
                                if (mins >= 60) return `${Math.round(mins / 60)} Hours`;
                                return `${mins} Minutes`;
                            };

                            const firstResponseTime = messages.find(m => !m.is_internal && m.sender_id !== selectedTicket.requester_id)?.created_at;
                            const schedule = selectedTicket.group?.business_hours?.weekly_schedule || [];

                            const responseElapsed = firstResponseTime ?
                                calculateBusinessElapsed(new Date(selectedTicket.created_at), new Date(firstResponseTime), schedule) :
                                calculateBusinessElapsed(new Date(selectedTicket.created_at), now, schedule);

                            const isTerminal = ['Resolved', 'Closed', 'Canceled'].includes(selectedTicket.ticket_statuses?.status_name);
                            const stopTime = activityLogs.find(l => l.action.toLowerCase().includes('resolved') || l.action.toLowerCase().includes('canceled'))?.created_at;
                            const resolutionElapsed = stopTime ?
                                calculateBusinessElapsed(new Date(selectedTicket.created_at), new Date(stopTime), schedule) :
                                calculateBusinessElapsed(new Date(selectedTicket.created_at), now, schedule);

                            const responseDeadline = responseTarget?.target_minutes ?
                                calculateBusinessDeadline(new Date(selectedTicket.created_at), responseTarget.target_minutes, schedule) : null;

                            const resolutionDeadline = resolutionTarget?.target_minutes ?
                                calculateBusinessDeadline(new Date(selectedTicket.created_at), resolutionTarget.target_minutes, schedule) : null;

                            const getStatusSla = (elapsed: number, target: number, isMet: boolean) => {
                                if (isMet) return 'met';
                                if (!target) return 'running';
                                if (elapsed > target) return 'breached';
                                if (elapsed > target * 0.75) return 'at_risk';
                                return 'running';
                            };

                            const getSlaPercentage = (elapsed: number, target: number, isMet: boolean) => {
                                if (isMet) return 100;
                                if (!target) return 0;
                                return Math.min(100, (elapsed / target) * 100);
                            };

                            return (
                                <div className="max-w-4xl mx-auto space-y-6">
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Applied SLA Policy</h4>
                                            <div className="text-lg font-black text-slate-800">{matchingPolicy?.name || 'Default System Policy'}</div>
                                            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                                                <Building2 size={10} /> {selectedTicket.group?.company?.company_name || 'Generic'} • {selectedTicket.priority} Priority
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</div>
                                            {responseElapsed > (responseTarget?.target_minutes || 240) ? (
                                                <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black border border-red-100">OVERDUE</span>
                                            ) : responseElapsed > (responseTarget?.target_minutes || 240) * 0.8 ? (
                                                <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black border border-amber-100">AT RISK</span>
                                            ) : (
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100">HEALTHY</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <SLACard
                                            label="First Response"
                                            target={formatTarget(responseTarget?.target_minutes)}
                                            actual={firstResponseTime ? `${Math.floor(responseElapsed / 60)}h ${responseElapsed % 60}m` : `${Math.floor(responseElapsed / 60)}h ${responseElapsed % 60}m (Elapsed)`}
                                            remaining={!firstResponseTime && responseTarget?.target_minutes ? (() => {
                                                const rem = Math.max(0, responseTarget.target_minutes - responseElapsed);
                                                return `${Math.floor(rem / 60)}h ${rem % 60}m (Remaining)`;
                                            })() : undefined}
                                            status={getStatusSla(responseElapsed, responseTarget?.target_minutes, !!firstResponseTime)}
                                            percentage={getSlaPercentage(responseElapsed, responseTarget?.target_minutes, !!firstResponseTime)}
                                            deadline={responseDeadline ? responseDeadline.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                                        />
                                        <SLACard
                                            label="Resolution"
                                            target={formatTarget(resolutionTarget?.target_minutes)}
                                            actual={stopTime ? `${Math.floor(resolutionElapsed / 60)}h ${resolutionElapsed % 60}m` : `${Math.floor(resolutionElapsed / 60)}h ${resolutionElapsed % 60}m (Elapsed)`}
                                            remaining={!isTerminal && resolutionTarget?.target_minutes ? (() => {
                                                const rem = Math.max(0, resolutionTarget.target_minutes - resolutionElapsed);
                                                return `${Math.floor(rem / 60)}h ${rem % 60}m (Remaining)`;
                                            })() : undefined}
                                            status={getStatusSla(resolutionElapsed, resolutionTarget?.target_minutes, isTerminal)}
                                            percentage={getSlaPercentage(resolutionElapsed, resolutionTarget?.target_minutes, isTerminal)}
                                            deadline={resolutionDeadline ? resolutionDeadline.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                                        />
                                    </div>

                                    <div className="pt-6 border-t border-gray-100">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Milestones History</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs font-bold py-2 border-b border-gray-50">
                                                <span className="text-gray-500">Ticket Created</span>
                                                <span className="text-gray-800">{new Date(selectedTicket.created_at).toLocaleString()} WIB</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-bold py-2 border-b border-gray-50">
                                                <span className="text-gray-500">SLA Response Counter Started</span>
                                                <span className="text-gray-800">{new Date(selectedTicket.created_at).toLocaleTimeString()} WIB</span>
                                            </div>
                                            {firstResponseTime && (
                                                <div className="flex justify-between text-xs font-bold py-2">
                                                    <span className="text-gray-500">First Response Met</span>
                                                    <span className="text-green-600 font-black">SUCCESS • {new Date(firstResponseTime).toLocaleTimeString()} WIB</span>
                                                </div>
                                            )}
                                            {isTerminal && stopTime && (
                                                <div className="flex justify-between text-xs font-bold py-2">
                                                    <span className="text-gray-500">
                                                        {selectedTicket.ticket_statuses?.status_name === 'Canceled' ? 'Ticket Canceled' : 'Resolution Met'}
                                                    </span>
                                                    <span className={`${selectedTicket.ticket_statuses?.status_name === 'Canceled' ? 'text-rose-600' : 'text-indigo-600'} font-black`}>
                                                        {selectedTicket.ticket_statuses?.status_name?.toUpperCase()} • {new Date(stopTime).toLocaleTimeString()} WIB
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {activeTab === 'activities' && (
                            <div className="max-w-4xl mx-auto space-y-4">
                                {activityLogs.map((log) => (
                                    <div key={log.id} className="flex gap-4 p-4 rounded-xl border border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                            {log.actor_id === userProfile?.id ? 'Y' : (log.actor_id ? 'A' : 'S')}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <p className="text-[13px] font-bold text-slate-800">{log.action}</p>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 font-medium">
                                                Performed by {
                                                    log.actor_id === userProfile?.id ? 'You' :
                                                        (log.actor?.full_name ||
                                                            allAgents.find(a => a.id === log.actor_id)?.full_name ||
                                                            'System / Agent')
                                                }
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {/* Static Ticket Creation Log */}
                                <div className="flex gap-4 p-4 rounded-xl border border-slate-50 hover:bg-slate-50/50 transition-colors opacity-75">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                        {selectedTicket.requester?.full_name?.charAt(0) || 'R'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="text-[13px] font-bold text-slate-800">Ticket Created</p>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {new Date(selectedTicket.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium">Performed by {selectedTicket.requester?.full_name || 'Requester'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'attachments' && (
                            <div className="max-w-4xl mx-auto p-4 space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Attached Files</h3>
                                </div>
                                {(!selectedTicket.ticket_attachments || selectedTicket.ticket_attachments.length === 0) ? (
                                    <div className="text-sm text-gray-500 italic bg-gray-50 p-8 rounded-xl border border-gray-100 flex flex-col items-center justify-center gap-2 text-center">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 mb-2">
                                            <Paperclip size={20} />
                                        </div>
                                        <p>No files attached to this ticket.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedTicket.ticket_attachments?.map((file: any, index: number) => {
                                            const fileUrl = supabase.storage.from('ticket-attachments').getPublicUrl(file.file_path).data.publicUrl;
                                            return (
                                                <a
                                                    key={file.id || index}
                                                    href={fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all group"
                                                >
                                                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-indigo-600">{file.file_name}</p>
                                                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{file.mime_type || 'Unknown'}</p>
                                                    </div>
                                                    <ExternalLink size={16} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom Composer */}
                    {activeTab === 'conversation' && (
                        <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
                            <div className="flex gap-5 mb-4 border-b border-gray-50">
                                <button
                                    onClick={() => setIsInternalNote(false)}
                                    className={`text-xs font-black uppercase tracking-widest pb-3 transition-all ${!isInternalNote ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-500'}`}
                                >
                                    Reply
                                </button>
                                <button
                                    onClick={() => setIsInternalNote(true)}
                                    className={`text-xs font-black uppercase tracking-widest pb-3 transition-all ${isInternalNote ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-400 hover:text-gray-500'}`}
                                >
                                    Internal Note
                                </button>
                            </div>
                            <RichTextEditor
                                content={newMessage}
                                onChange={setNewMessage}
                                placeholder="Type your response..."
                                minHeight="80px"
                            />
                            <div className="flex justify-between items-center mt-4">
                                <button
                                    onClick={() => aiSuggestedReply && setNewMessage(aiSuggestedReply)}
                                    disabled={!aiSuggestedReply}
                                    className="flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Sparkles size={14} fill="currentColor" /> Insert AI Suggestion
                                </button>
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isSending}
                                    className={`flex items-center gap-3 px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isInternalNote ? 'bg-amber-600 shadow-amber-100 hover:bg-amber-700 text-white' : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700 text-white'}`}
                                >
                                    {isSending ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" /> Sending...
                                        </>
                                    ) : (
                                        <>
                                            {isInternalNote ? <Lock size={14} /> : <Send size={14} />}
                                            {isInternalNote ? 'Add Private Note' : 'Send Reply'}
                                        </>
                                    )}
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
                            {isAiLoading ? (
                                <span className="text-amber-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Analyzing...</span>
                            ) : (
                                <span className={`${aiConfidence === 'high' ? 'text-green-500' :
                                    aiConfidence === 'medium' ? 'text-blue-500' :
                                        'text-gray-400'
                                    }`}>
                                    Confidence: {aiConfidence.charAt(0).toUpperCase() + aiConfidence.slice(1)}
                                </span>
                            )}
                        </div>

                        {/* Summary Card */}
                        <AICard title="Ticket Summary" icon={FileText}>
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                {aiSummary.length > 0 ? (
                                    <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 font-medium leading-relaxed">
                                        {aiSummary.map((point, idx) => (
                                            <li key={idx}>{point}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">Analyzing ticket content...</p>
                                )}
                                <button
                                    onClick={handleApplySummary}
                                    disabled={isApplyingSummary || aiSummary.length === 0}
                                    className="mt-4 w-full text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isApplyingSummary ? (
                                        <><Loader2 size={12} className="animate-spin" /> Applying...</>
                                    ) : (
                                        <>Add as Internal Note</>
                                    )}
                                </button>
                            </div>
                        </AICard>

                        {/* Classification Card */}
                        <AICard title="Suggested Classification" icon={Shield}>
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-tighter">Category</span>
                                    <span className="text-gray-800 font-black">{aiClassification?.category || 'Analyzing...'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-tighter">Priority</span>
                                    <span className={`font-black ${aiClassification?.priority === 'urgent' ? 'text-red-500' :
                                        aiClassification?.priority === 'high' ? 'text-orange-500' :
                                            aiClassification?.priority === 'medium' ? 'text-amber-500' : 'text-green-500'
                                        }`}>
                                        {aiClassification?.priority?.toUpperCase() || 'N/A'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <button className="py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-indigo-700 transition-colors">Apply</button>
                                    <button className="py-2.5 bg-white text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">Edit</button>
                                </div>
                            </div>
                        </AICard>

                        {/* Suggested Reply Card */}
                        <AICard title="Suggested Reply" icon={Zap}>
                            <div className="bg-green-50/30 p-4 rounded-xl border border-green-100 space-y-3">
                                <p className="text-[12px] text-gray-700 italic font-medium leading-relaxed">
                                    "{aiSuggestedReply || 'Generating suggested reply...'}"
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setNewMessage(aiSuggestedReply);
                                            setIsInternalNote(false);
                                        }}
                                        className="flex-1 py-2 bg-white text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-green-200 flex items-center justify-center gap-2 shadow-sm hover:bg-green-50 transition-colors"
                                    >
                                        <Copy size={12} /> Insert
                                    </button>
                                    <button
                                        onClick={() => setAiReplyIndex(prev => prev + 1)}
                                        className="flex-1 py-2 bg-white text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                                    >
                                        <RefreshCw size={12} /> Rewrite
                                    </button>
                                </div>
                            </div>
                        </AICard>

                        {/* Knowledge Card */}
                        <AICard title="Knowledge Base" icon={BookOpen}>
                            <div className="space-y-3">
                                {suggestedKB.length > 0 ? (
                                    suggestedKB.map(kb => (
                                        <button key={kb.id} onClick={() => alert(`View Article: ${kb.title}`)} className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 text-indigo-600 transition-all flex items-center justify-between group">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black truncate block">{kb.title}</span>
                                                    {kb.visibility === 'internal' && (
                                                        <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold uppercase">Internal</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-medium line-clamp-1">{kb.summary}</span>
                                            </div>
                                            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-[10px] text-gray-400 italic p-2 border border-dashed border-gray-200 rounded text-center">
                                        No relevant articles found.
                                    </div>
                                )}
                            </div>
                        </AICard>

                        {/* Similar Tickets Card */}
                        <AICard title="Similar Tickets" icon={CheckCircle2}>
                            <div className="space-y-3">
                                {similarTickets.length > 0 ? (
                                    similarTickets.map(t => {
                                        const statusLower = t.status?.toLowerCase() || '';
                                        const isResolved = statusLower === 'resolved' || statusLower === 'closed';
                                        return (
                                            <div key={t.id} className={`w-full text-left p-3 rounded-lg border bg-white/50 transition-all flex items-center justify-between group cursor-pointer ${isResolved ? 'border-green-100 hover:border-green-200 hover:bg-green-50/20' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/20'
                                                }`} onClick={() => setSelectedTicketId(t.id)}>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs font-bold text-gray-700 truncate block">{t.title}</span>
                                                    <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                                        <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider ${isResolved ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                            }`}>{t.status}</span>
                                                        • {new Date(t.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <ArrowUpRight size={14} className={`opacity-0 group-hover:opacity-100 flex-shrink-0 ${isResolved ? 'text-green-600' : 'text-blue-600'}`} />
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-[10px] text-gray-400 italic p-2 border border-dashed border-gray-200 rounded text-center">
                                        No similar cases found.
                                    </div>
                                )}
                            </div>
                        </AICard>

                        {/* SLA Risk Card */}
                        <AICard title="SLA Risk Analysis" icon={BarChart3}>
                            <div className={`p-4 rounded-xl border space-y-4 transition-all duration-500 ${slaRisk.percentage >= 90 ? 'bg-red-100/50 border-red-300 shadow-lg shadow-red-100' :
                                slaRisk.percentage >= 75 ? 'bg-red-50/30 border-red-100' :
                                    slaRisk.percentage >= 50 ? 'bg-amber-50/30 border-amber-100' :
                                        'bg-green-50/30 border-green-100'
                                }`}>
                                <div className="flex justify-between items-center font-black">
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">{slaRisk.hasResponse ? 'Resolution' : 'Response'} SLA Used</span>
                                    <span className={`text-xs tracking-tighter ${slaRisk.percentage >= 75 ? 'text-red-500' :
                                        slaRisk.percentage >= 50 ? 'text-amber-500' :
                                            'text-green-500'
                                        }`}>
                                        {slaRisk.percentage}% {slaRisk.percentage >= 100 ? '- OVERDUE' : slaRisk.percentage >= 90 ? '- CRITICAL' : slaRisk.percentage >= 75 ? '- NEAR OVERDUE' : slaRisk.percentage >= 50 ? '- WARNING' : '- OK'}
                                    </span>
                                </div>

                                {/* Visual Stress Meter (Gradient) */}
                                <div className="h-2.5 w-full bg-slate-200/50 rounded-full overflow-hidden shadow-inner p-0.5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${slaRisk.percentage >= 90 ? 'bg-gradient-to-r from-orange-500 via-red-500 to-rose-700 animate-pulse' :
                                            slaRisk.percentage >= 75 ? 'bg-gradient-to-r from-amber-400 to-red-500' :
                                                slaRisk.percentage >= 50 ? 'bg-gradient-to-r from-green-400 to-amber-500' :
                                                    'bg-gradient-to-r from-emerald-400 to-green-500'
                                            }`}
                                        style={{ width: `${Math.min(100, slaRisk.percentage)}%` }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <div className="bg-white/60 p-2 rounded-lg border border-white/50">
                                        <span className="text-[8px] text-gray-400 uppercase font-black block mb-0.5">Predicted Overdue</span>
                                        <span className="text-xs font-black text-gray-800">{slaRisk.breachTime || '-'}</span>
                                    </div>
                                    <div className="bg-white/60 p-2 rounded-lg border border-white/50">
                                        <span className="text-[8px] text-gray-400 uppercase font-black block mb-0.5">Timer Pause</span>
                                        <span className="text-xs font-black text-indigo-600">{slaRisk.pauseAt ? `${slaRisk.pauseAt} WIB` : 'Active 24/7'}</span>
                                    </div>
                                </div>

                                <div className="p-3 bg-white/40 rounded-lg border border-white/60">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                        <Info size={10} /> Smart Recommendation
                                    </div>
                                    <p className={`text-[11px] font-bold leading-relaxed ${slaRisk.percentage >= 75 ? 'text-red-700' : 'text-slate-700'
                                        }`}>
                                        {slaRisk.recommendation}
                                    </p>
                                </div>

                                <ul className="text-[9px] text-gray-400 font-bold space-y-1 pt-2 border-t border-gray-100/50">
                                    <li className="flex justify-between"><span>Time elapsed</span> <span className="text-gray-600">{slaRisk.timeElapsed}</span></li>
                                    <li className="flex justify-between"><span>Time remaining</span> <span className="text-indigo-600 font-black">{slaRisk.timeRemaining}</span></li>
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

const SLACard: React.FC<{ label: string, target: string, actual: string, percentage: number, remaining?: string, deadline?: string, status: 'met' | 'breached' | 'running' | 'at_risk' }> = ({ label, target, actual, percentage, remaining, deadline, status }) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">{label}</div>
        <div className="space-y-4">
            <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-400">Target</span>
                <span className="text-gray-800">{target}</span>
            </div>
            {deadline && (
                <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-400">Deadline</span>
                    <span className="text-indigo-600 font-black">{deadline}</span>
                </div>
            )}
            <div className="flex justify-between text-xs font-black">
                <span className="text-gray-400 font-bold">{status === 'running' || status === 'at_risk' ? 'Elapsed' : 'Actual'}</span>
                <span className={status === 'met' ? 'text-green-600' : status === 'breached' ? 'text-red-600' : 'text-amber-600'}>{actual}</span>
            </div>
            {remaining && (status === 'running' || status === 'at_risk') && (
                <div className="flex justify-between text-xs font-black border-t border-dashed border-gray-100 pt-2 mt-2">
                    <span className="text-gray-400 font-bold">Remaining</span>
                    <span className="text-indigo-500">{remaining}</span>
                </div>
            )}
            <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden mt-2 border border-gray-100/50">
                <div className={`h-full transition-all duration-700 ${status === 'met' ? 'bg-green-500' : status === 'breached' ? 'bg-red-500' : status === 'at_risk' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percentage}%` }} />
            </div>
        </div>
        {status === 'breached' && (
            <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 group-hover:opacity-10 transition-opacity">
                <AlertCircle size={48} className="text-red-600" />
            </div>
        )}
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
