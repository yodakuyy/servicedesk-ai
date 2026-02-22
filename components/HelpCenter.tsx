'use client';

import React, { useState, useEffect } from 'react';

import {
    Search, FileText, HelpCircle, Monitor, Shield, Phone, Settings,
    ArrowLeft, Clock, ChevronRight, Loader2, ThumbsUp, ThumbsDown,
    CheckCircle, Sparkles, BookOpen, Tag, Folder, Grid3X3, List,
    Plus, Ticket, ChevronDown, Megaphone, AlertTriangle, Smartphone, Mail,
    Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface Article {
    id: string;
    title: string;
    summary: string;
    content: {
        problem?: string;
        solution?: string;
        verification?: string;
        notes?: string;
    };
    category_id: string;
    category_name?: string;
    updated_at: string;
    tags?: string[];
}

interface CategoryWithCount {
    id: string;
    name: string;
    description?: string;
    article_count: number;
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'alert';
    created_at: string;
}

interface SLAPolicy {
    id: string;
    name: string;
    description?: string;
    conditions?: any[];
    business_hours_id?: string;
    business_hours_summary?: string;
    targets: {
        priority: string;
        response: string;
        resolution: string;
    }[];
}

interface CompanyInfo {
    company_id: number;
    company_name: string;
    support_email?: string;
    support_phone?: string;
    support_hours?: string;
}

// Mapping Help Center sections to article_type values
const SECTION_TYPE_MAP: { [key: string]: string } = {
    'Getting Started': 'getting-started',
    'FAQ': 'faq',
    'System How-To': 'how-to',
};

const HelpCenter: React.FC = () => {
    const [userRole, setUserRole] = useState<string | null>('requester');
    const [view, setView] = useState<'home' | 'categories' | 'articles' | 'detail' | 'faq' | 'policies' | 'contact' | 'updates'>('home');

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single();
                if (profile) {
                    setUserRole(profile.role);
                    fetchRealData(profile.company_id);
                    return;
                }
            }
            // Fallback for guests or if profile fetch fails
            fetchRealData(null);
        };
        checkUser();
    }, []);

    const [slaPolicies, setSlaPolicies] = useState<SLAPolicy[]>([]);
    const [activePolicyIndex, setActivePolicyIndex] = useState(0);
    const [liveAnnouncements, setLiveAnnouncements] = useState<Announcement[]>([]);
    const [companyData, setCompanyData] = useState<CompanyInfo | null>(null);

    const fetchRealData = async (companyId: number | null) => {
        console.log("HelpCenter: Starting fetchRealData. CompanyId context:", companyId);

        try {
            // 1. Fetch Company Info
            if (companyId) {
                const { data: compData, error: compErr } = await supabase
                    .from('company')
                    .select('*')
                    .eq('company_id', companyId)
                    .single();
                if (compErr) console.warn("HelpCenter: Company fetch error:", compErr);
                if (compData) {
                    console.log("HelpCenter: Found company:", compData.company_name);
                    setCompanyData(compData);
                }
            }

            // 2. Fetch Announcements
            const { data: announceData } = await supabase
                .from('announcements')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            if (announceData) setLiveAnnouncements(announceData);

            // 3. Fetch SLA Policies & Targets
            console.log("HelpCenter: Fetching sla_policies...");
            const { data: policiesData, error: polErr } = await supabase
                .from('sla_policies')
                .select('*')
                .order('name');

            if (polErr) {
                console.error("HelpCenter: Policies Query Error:", polErr);
                return;
            }

            if (!policiesData || policiesData.length === 0) {
                console.log("HelpCenter: No policies found in database at all.");
                return;
            }

            console.log(`HelpCenter: Found ${policiesData.length} records in sla_policies.`);

            // Filter active and relevant
            const filtered = policiesData.filter(p => {
                const isActive = p.is_active === true;
                const isMyCompany = !p.company_id || (companyId && p.company_id === companyId);
                const isDIT = p.name?.toLowerCase().includes('dit');
                const isStandard = p.name?.toLowerCase().includes('standard');
                return isActive && (isMyCompany || isDIT || isStandard);
            });

            console.log(`HelpCenter: ${filtered.length} policies passed relevance filter.`);

            if (filtered.length > 0) {
                const relevantPolicies = filtered;
                const policyIds = relevantPolicies.map(p => p.id);
                const bhIds = relevantPolicies.map(p => p.business_hours_id).filter(Boolean);

                const [{ data: targetsData }, { data: bhData }] = await Promise.all([
                    supabase.from('sla_targets').select('*').in('sla_policy_id', policyIds),
                    supabase.from('business_hours').select('id, name, weekly_schedule').in('id', bhIds)
                ]);

                // Helper to summarize business hours
                const summarizeBH = (schedule: any[]) => {
                    if (!schedule || !Array.isArray(schedule)) return 'Business Hours';
                    const activeDays = schedule.filter(d => d.isActive && !d.isClosed);
                    if (activeDays.length === 0) return 'Closed';
                    if (activeDays.length === 5 && activeDays[0].day === 'Monday' && activeDays[4].day === 'Friday') {
                        const start = activeDays[0].startTime;
                        const end = activeDays[0].endTime;
                        return `Mon-Fri, ${start} - ${end}`;
                    }
                    if (activeDays.length === 7) return `24/7 Support`;
                    return `${activeDays[0].day}-${activeDays[activeDays.length - 1].day}, ${activeDays[0].startTime} - ${activeDays[0].endTime}`;
                };

                const formatted = relevantPolicies.map(policy => {
                    const bh = bhData?.find(b => b.id === policy.business_hours_id);
                    const bhSummary = bh ? summarizeBH(bh.weekly_schedule) : 'Business Hours';

                    const targets = ['Urgent', 'High', 'Medium', 'Low'].map(priority => {
                        const response = targetsData?.find(t => t.sla_policy_id === policy.id && t.priority === priority && t.sla_type === 'response');
                        const resolution = targetsData?.find(t => t.sla_policy_id === policy.id && t.priority === priority && t.sla_type === 'resolution');

                        const formatTarget = (mins: number) => {
                            if (!mins) return '-';
                            if (mins >= 1440) return `${Math.floor(mins / 1440)} Days`;
                            if (mins >= 60) return `${Math.floor(mins / 60)} Hours`;
                            return `${mins} Mins`;
                        };

                        // Check both target_minutes and any legacy column just in case
                        const getMins = (obj: any) => obj?.target_minutes || obj?.resolution_time_minutes || obj?.first_response_time_minutes || 0;

                        return {
                            priority,
                            response: response ? formatTarget(getMins(response)) : '-',
                            resolution: resolution ? formatTarget(getMins(resolution)) : '-'
                        };
                    });
                    return {
                        id: policy.id,
                        name: policy.name,
                        description: policy.description,
                        conditions: policy.conditions,
                        business_hours_id: policy.business_hours_id,
                        business_hours_summary: bhSummary,
                        targets
                    };
                });

                setSlaPolicies(formatted as any);
                setActivePolicyIndex(0);
            }
        } catch (err) {
            console.error("Error fetching Help Center real data:", err);
        }
    };
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<CategoryWithCount | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [categories, setCategories] = useState<CategoryWithCount[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categorySearchQuery, setCategorySearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Article[]>([]);
    const [searching, setSearching] = useState(false);
    const [feedbackGiven, setFeedbackGiven] = useState<{ [key: string]: boolean }>({});
    const [articleSearchQuery, setArticleSearchQuery] = useState('');
    const [subCategories, setSubCategories] = useState<{ id: string; name: string }[]>([]);
    const [expandedSubCats, setExpandedSubCats] = useState<{ [key: string]: boolean }>({});
    const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

    // Global search functionality with debounce
    useEffect(() => {
        if (searchQuery.trim().length >= 2) {
            const debounce = setTimeout(() => {
                handleSearch(searchQuery);
            }, 300);
            return () => clearTimeout(debounce);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const handleSearch = async (query: string) => {
        setSearching(true);
        try {
            const { data } = await supabase
                .from('kb_articles')
                .select(`
                    id, title, summary, content, category_id, updated_at,
                    kb_categories!inner(name)
                `)
                .eq('visibility', 'public')
                .eq('status', 'published')
                .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
                .limit(10);

            if (data) {
                const results = data.map((a: any) => ({
                    ...a,
                    category_name: a.kb_categories?.name
                }));
                setSearchResults(results);
            }
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleSectionClick = async (sectionTitle: string) => {
        const articleType = SECTION_TYPE_MAP[sectionTitle];

        if (articleType) {
            setSelectedSection(sectionTitle);
            setLoading(true);
            setView('categories');
            setCategorySearchQuery('');

            try {
                // Special handling for Getting Started: Fetch articles directly and show in Split View
                if (articleType === 'getting-started') {
                    setView('articles'); // Use split view directly

                    const { data: articlesData } = await supabase
                        .from('kb_articles')
                        .select('*, kb_categories(name)')
                        .eq('visibility', 'public')
                        .eq('status', 'published')
                        .eq('article_type', articleType)
                        .order('title', { ascending: true });

                    if (articlesData) {
                        const formattedArticles = articlesData.map((a: any) => ({
                            ...a,
                            category_name: a.kb_categories?.name
                        }));
                        setArticles(formattedArticles);
                        setCategories([]);

                        // Set dummy category for the split view header
                        setSelectedCategory({
                            id: 'getting-started-section',
                            name: 'Getting Started',
                            description: 'Learn how to use the Service Desk efficiently.',
                            article_count: articlesData.length
                        });

                        // Auto-select first article if available for better UX
                        if (formattedArticles.length > 0) {
                            setSelectedArticle(formattedArticles[0]);
                        }
                    }
                    setLoading(false);
                    return;
                }

                // Special handling for FAQ: Fetch articles directly and show in Accordion View
                if (articleType === 'faq') {
                    const { data: articlesData } = await supabase
                        .from('kb_articles')
                        .select('*')
                        .eq('visibility', 'public')
                        .eq('status', 'published')
                        .eq('article_type', articleType)
                        .order('title', { ascending: true });

                    if (articlesData) {
                        setArticles(articlesData);
                        setCategories([]);
                        setView('faq');
                    }
                    setLoading(false);
                    return;
                }

                // Normal handling for other sections (aggregated by category)
                // Fetch all categories with their parent info
                const { data: allCategories } = await supabase
                    .from('kb_categories')
                    .select('id, name, parent_id, description');

                // Fetch articles with this type
                const { data: articlesData } = await supabase
                    .from('kb_articles')
                    // Only need category_id for counting
                    .select('category_id')
                    .eq('visibility', 'public')
                    .eq('status', 'published')
                    .eq('article_type', articleType);

                if (articlesData && allCategories) {
                    // Separate parent and child categories
                    const parentCategories = allCategories.filter((cat: any) => cat.parent_id === null);
                    const childCategories = allCategories.filter((cat: any) => cat.parent_id !== null);

                    // Build a map of parent_id -> child category IDs
                    const parentToChildrenMap: { [key: string]: string[] } = {};
                    childCategories.forEach((child: any) => {
                        if (!parentToChildrenMap[child.parent_id]) {
                            parentToChildrenMap[child.parent_id] = [];
                        }
                        parentToChildrenMap[child.parent_id].push(child.id);
                    });

                    // Count articles per parent category (including articles in sub-categories)
                    const parentCountMap: { [key: string]: { id: string; name: string; description?: string; count: number } } = {};

                    // Initialize parent categories
                    parentCategories.forEach((parent: any) => {
                        parentCountMap[parent.id] = {
                            id: parent.id,
                            name: parent.name,
                            description: parent.description || undefined,
                            count: 0
                        };
                    });

                    // Build category to parent mapping
                    const categoryToParent: { [key: string]: string } = {};
                    childCategories.forEach((child: any) => {
                        categoryToParent[child.id] = child.parent_id;
                    });
                    // Also map parent to itself
                    parentCategories.forEach((parent: any) => {
                        categoryToParent[parent.id] = parent.id;
                    });

                    // Count articles - attribute to parent category
                    articlesData.forEach((article: any) => {
                        const catId = article.category_id;

                        // Find the parent category
                        let parentId = categoryToParent[catId];

                        // If catId is a sub-category, parentId will be its parent
                        // If catId is a parent category, parentId will be itself

                        if (parentId && parentCountMap[parentId]) {
                            parentCountMap[parentId].count++;
                        }
                    });

                    // Convert to array (show all parent categories, even with 0 articles)
                    const categoriesWithCount = Object.values(parentCountMap)
                        .map(cat => ({
                            id: cat.id,
                            name: cat.name,
                            description: cat.description,
                            article_count: cat.count
                        }));

                    // Sort by name
                    categoriesWithCount.sort((a, b) => a.name.localeCompare(b.name));

                    setCategories(categoriesWithCount);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
            } finally {
                setLoading(false);
            }
        } else {
            // New navigation for non-KB sections
            if (sectionTitle === 'Policies & SLA') setView('policies');
            else if (sectionTitle === 'Contact Support') setView('contact');
            else if (sectionTitle === 'Maintenance & Updates') setView('updates');
            setSelectedSection(sectionTitle);
        }
    };

    const handleCategoryClick = async (category: CategoryWithCount) => {
        const articleType = SECTION_TYPE_MAP[selectedSection || ''];

        setSelectedCategory(category);
        setLoading(true);
        setView('articles');
        setSelectedArticle(null);
        setArticleSearchQuery('');

        try {
            // First, get all sub-categories under this parent
            const { data: subCatsData } = await supabase
                .from('kb_categories')
                .select('id, name')
                .eq('parent_id', category.id)
                .order('name');

            // Build array of category IDs to search (parent + all sub-categories)
            const categoryIds = [category.id];
            const subCatsList: { id: string; name: string }[] = [];
            const expandedMap: { [key: string]: boolean } = {};

            if (subCatsData) {
                subCatsData.forEach((sub: any) => {
                    categoryIds.push(sub.id);
                    subCatsList.push({ id: sub.id, name: sub.name });
                    expandedMap[sub.id] = true; // Auto-expand all
                });
            }

            setSubCategories(subCatsList);
            setExpandedSubCats(expandedMap);

            // Fetch articles from parent AND all sub-categories
            const { data } = await supabase
                .from('kb_articles')
                .select(`
                    id, title, summary, content, category_id, updated_at,
                    kb_categories!inner(name)
                `)
                .eq('visibility', 'public')
                .eq('status', 'published')
                .eq('article_type', articleType)
                .in('category_id', categoryIds)
                .order('title');

            if (data) {
                const articlesWithCategory = data.map((a: any) => ({
                    ...a,
                    category_name: a.kb_categories?.name
                }));
                setArticles(articlesWithCategory);

                // Auto-select first article
                if (articlesWithCategory.length > 0) {
                    const firstArticle = articlesWithCategory[0];
                    // Fetch tags for first article
                    const { data: tagsData } = await supabase
                        .from('kb_article_tags')
                        .select('tag')
                        .eq('article_id', firstArticle.id);

                    setSelectedArticle({
                        ...firstArticle,
                        tags: tagsData?.map(t => t.tag) || []
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching articles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleArticleClick = async (article: Article) => {
        try {
            const { data: tagsData } = await supabase
                .from('kb_article_tags')
                .select('tag')
                .eq('article_id', article.id);

            setSelectedArticle({
                ...article,
                tags: tagsData?.map(t => t.tag) || []
            });

            // Only switch to full detail view if NOT in split-view mode (articles view)
            if (view !== 'articles') {
                setView('detail');
            }
        } catch (error) {
            console.error('Error fetching article:', error);
            setSelectedArticle(article);
            if (view !== 'articles') {
                setView('detail');
            }
        }
    };

    const handleFeedback = async (articleId: string, isHelpful: boolean) => {
        try {
            await supabase
                .from('kb_article_feedback')
                .insert({
                    article_id: articleId,
                    is_helpful: isHelpful,
                    created_at: new Date().toISOString()
                });

            setFeedbackGiven(prev => ({ ...prev, [articleId]: true }));

            Swal.fire({
                icon: 'success',
                title: 'Thank you!',
                text: 'Your feedback helps us improve.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const goBack = () => {
        if (view === 'detail') {
            setView('articles');
            setSelectedArticle(null);
        } else if (view === 'articles') {
            if (selectedSection === 'Getting Started') {
                setView('home');
                setSelectedSection(null);
                setArticles([]);
                setSelectedCategory(null);
            } else {
                setView('categories');
                setSelectedCategory(null);
                setArticles([]);
            }
        } else if (view === 'categories') {
            setView('home');
            setSelectedSection(null);
            setCategories([]);
            setCategorySearchQuery('');
        } else if (view === 'faq' || view === 'policies' || view === 'contact' || view === 'updates') {
            setView('home');
            setSelectedSection(null);
            setArticles([]);
            setCategorySearchQuery('');
        }
    };

    const helpCategories = [
        {
            icon: FileText,
            title: 'Getting Started',
            description: 'Learn how to use the system',
            color: 'text-indigo-500',
            bgColor: 'bg-indigo-50',
            hasKB: true
        },
        {
            icon: HelpCircle,
            title: 'FAQ',
            description: 'Find answers to common questions',
            color: 'text-purple-500',
            bgColor: 'bg-purple-50',
            hasKB: true
        },
        {
            icon: Monitor,
            title: 'System How-To',
            description: 'Step-by-step guides and tutorials',
            color: 'text-blue-500',
            bgColor: 'bg-blue-50',
            hasKB: true
        },
        {
            icon: Shield,
            title: 'Policies & SLA',
            description: 'Learn about our policies and SLAs',
            color: 'text-green-500',
            bgColor: 'bg-green-50',
            hasKB: false
        },
        {
            icon: Phone,
            title: 'Contact Support',
            description: 'Get in touch with our support team',
            color: 'text-pink-500',
            bgColor: 'bg-pink-50',
            hasKB: false
        },
        {
            icon: Settings,
            title: 'Maintenance & Updates',
            description: 'Stay up-to-date with the latest news',
            color: 'text-orange-500',
            bgColor: 'bg-orange-50',
            hasKB: false
        },
    ];

    // Filter categories based on search
    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );

    // Article Detail View
    if (view === 'detail' && selectedArticle) {
        // ... (existing detail view code)
    }

    // ==========================================
    // POLICIES & SLA VIEW
    // ==========================================
    if (view === 'policies') {
        return (
            <div className="p-8 max-w-5xl mx-auto">
                <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 mb-6 transition-colors">
                    <ArrowLeft size={20} /> <span className="font-medium">Back to Help Center</span>
                </button>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Policies & SLA</h1>
                    <p className="text-gray-500">Learn about our service level agreements and support commitments.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    {[
                        {
                            title: 'Response Time',
                            icon: Clock,
                            color: 'indigo',
                            desc: slaPolicies[activePolicyIndex]?.targets?.[0]?.response !== '-'
                                ? `Starting from ${slaPolicies[activePolicyIndex].targets.find(t => t.response !== '-')?.response}`
                                : 'How quickly we acknowledge your request'
                        },
                        {
                            title: 'Resolution Time',
                            icon: CheckCircle,
                            color: 'green',
                            desc: slaPolicies[activePolicyIndex]?.targets?.[0]?.resolution !== '-'
                                ? `Target resolved in ${slaPolicies[activePolicyIndex].targets.find(t => t.resolution !== '-')?.resolution}`
                                : 'Target duration to solve the issue'
                        },
                        {
                            title: 'Operational Hours',
                            icon: Settings,
                            color: 'blue',
                            desc: slaPolicies[activePolicyIndex]?.business_hours_summary || 'When our team is available to help'
                        },
                    ].map((item, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                            <div className={`w-12 h-12 bg-${item.color}-50 rounded-xl flex items-center justify-center text-${item.color}-600 mb-4 group-hover:scale-110 transition-transform`}>
                                <item.icon size={24} />
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Policy Tabs */}
                {slaPolicies.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {slaPolicies.map((policy, idx) => {
                            // Extract ticket type if available in conditions
                            const ticketType = policy.conditions?.find((c: any) => c.field === 'ticket_type')?.value;
                            const label = ticketType || policy.name;

                            return (
                                <button
                                    key={policy.id}
                                    onClick={() => setActivePolicyIndex(idx)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activePolicyIndex === idx
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                        : 'bg-white text-gray-500 border border-gray-100 hover:border-indigo-200'
                                        }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
                    <div className="p-6 border-b border-gray-50">
                        <div className="flex justify-between items-center mb-1">
                            <h2 className="font-bold text-gray-900">
                                {slaPolicies[activePolicyIndex]?.name || 'Standard Service Targets'}
                            </h2>
                            {slaPolicies.length > 1 && (
                                <span className="text-xs text-gray-400">Policy {activePolicyIndex + 1} of {slaPolicies.length}</span>
                            )}
                        </div>
                        {slaPolicies[activePolicyIndex]?.description && (
                            <p className="text-sm text-gray-500">{slaPolicies[activePolicyIndex].description}</p>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Response Target</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Resolution Target</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(slaPolicies.length > 0 && slaPolicies[activePolicyIndex] ? slaPolicies[activePolicyIndex].targets : [
                                    { priority: 'Urgent', response: '15 Minutes', resolution: '4 Hours' },
                                    { priority: 'High', response: '1 Hour', resolution: '8 Hours' },
                                    { priority: 'Medium', response: '4 Hours', resolution: '24 Hours' },
                                    { priority: 'Low', response: '8 Hours', resolution: '3 Days' },
                                ]).map((row: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${row.priority === 'Urgent' ? 'text-red-600 bg-red-50' :
                                                row.priority === 'High' ? 'text-orange-600 bg-orange-50' :
                                                    row.priority === 'Medium' ? 'text-amber-600 bg-amber-50' :
                                                        'text-green-600 bg-green-50'
                                                }`}>{row.priority}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{row.response}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{row.resolution}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-4">
                    <Shield className="text-indigo-600 shrink-0 mt-1" size={24} />
                    <div>
                        <h4 className="font-bold text-indigo-900 mb-1">Our Commitment</h4>
                        <p className="text-sm text-indigo-700 leading-relaxed">
                            These targets represent our commitment to providing timely and effective support.
                            Actual resolution times may vary based on the complexity of the issue and required vendor coordination.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // CONTACT SUPPORT VIEW
    // ==========================================
    if (view === 'contact') {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 mb-6 transition-colors">
                    <ArrowLeft size={20} /> <span className="font-medium">Back to Help Center</span>
                </button>

                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">How can we help?</h1>
                    <p className="text-gray-500 text-lg">Our team is available through multiple channels.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                            <Phone size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Hotline Support</h3>
                        <p className="text-gray-500 mb-6 text-sm">Best for urgent issues that need immediate attention.</p>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-sm font-medium text-gray-600">Extension</span>
                                <span className="font-bold text-indigo-600">{companyData?.support_phone?.slice(-4) || '8888'}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-sm font-medium text-gray-600">Direct Number</span>
                                <span className="font-bold text-gray-900">{companyData?.support_phone || '+62 21 1234 5678'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                            <HelpCircle size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">General Inquiry</h3>
                        <p className="text-gray-500 mb-6 text-sm">For standard requests and non-urgent questions.</p>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-sm font-medium text-gray-600">Email</span>
                                <span className="font-bold text-indigo-600 truncate ml-2">{companyData?.support_email || 'it.support@company.com'}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-sm font-medium text-gray-600">Business Hours</span>
                                <span className="font-bold text-gray-900">{companyData?.support_hours || '08:00 - 17:00 (Mon-Fri)'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-10 bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-3xl text-white flex flex-col items-center text-center shadow-lg shadow-indigo-200">
                    <Sparkles className="mb-4" size={32} />
                    <h3 className="text-2xl font-bold mb-2">Need a Ticket?</h3>
                    <p className="opacity-90 mb-6 max-w-md">For better tracking and escalation, always create a ticket for your issues.</p>
                    <button className="px-8 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-gray-50 transition-colors">
                        Create New Ticket
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================
    // MAINTENANCE & UPDATES VIEW
    // ==========================================
    if (view === 'updates') {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 mb-6 transition-colors">
                    <ArrowLeft size={20} /> <span className="font-medium">Back to Help Center</span>
                </button>

                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance & Updates</h1>
                    <p className="text-gray-500">Track system availability and recent releases.</p>
                </div>

                <div className="space-y-8">
                    {/* Active Status Card */}
                    <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-4 h-4 rounded-full animate-pulse ${liveAnnouncements.some(a => a.type === 'alert') ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
                            <div>
                                <h4 className="font-bold text-gray-900">
                                    {liveAnnouncements.some(a => a.type === 'alert') ? 'Service Disruption Detected' : 'All Systems Operational'}
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">Last checked: {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                            </div>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${liveAnnouncements.some(a => a.type === 'alert')
                            ? 'text-rose-600 bg-rose-50 border-rose-100'
                            : 'text-green-600 bg-green-50 border-green-100'
                            }`}>
                            {liveAnnouncements.some(a => a.type === 'alert') ? 'ISSUES' : 'STABLE'}
                        </span>
                    </div>
                    {/* Timeline */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2">Recent Events</h3>
                        {liveAnnouncements.length > 0 ? (
                            liveAnnouncements.map((item: any, i: number) => {
                                const typeLabel = item.type === 'alert' ? 'Maintenance' : item.type === 'warning' ? 'Security' : 'Update';
                                const typeColor = item.type === 'alert' ? 'rose' : item.type === 'warning' ? 'orange' : 'indigo';

                                return (
                                    <div key={i} className="relative pl-8 pb-8 last:pb-0 group">
                                        {/* Vertical Line */}
                                        <div className="absolute left-[7px] top-6 bottom-0 w-0.5 bg-gray-100 group-last:hidden" />
                                        {/* Marker */}
                                        <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white bg-${typeColor}-500 shadow-sm shadow-${typeColor}-200`} />

                                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-colors">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-bold text-${typeColor}-600 bg-${typeColor}-50 px-2 py-0.5 rounded-md uppercase`}>{typeLabel}</span>
                                                <span className="text-xs text-gray-400 font-medium">{formatDate(item.created_at)}</span>
                                            </div>
                                            <h4 className="font-bold text-gray-900 mb-2">{item.title}</h4>
                                            <p className="text-sm text-gray-600 leading-relaxed">{item.content}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                                    <Megaphone size={24} />
                                </div>
                                <h4 className="font-bold text-gray-400 mb-1">No recent events</h4>
                                <p className="text-xs text-gray-400">Everything is running smoothly. Check back later for updates.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Original Article Detail View (placed after new views to fix index)
    if (view === 'detail' && selectedArticle) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
// Rest of the 500+ lines are the same...

                {/* Back Button */}
                <button
                    onClick={goBack}
                    className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
                >
                    <ArrowLeft size={20} />
                    <span className="font-medium">Back to {selectedCategory?.name || 'Articles'}</span>
                </button>

                {/* Article */}
                <article className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="p-8 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-sm text-indigo-600 mb-3">
                            <Folder size={14} />
                            <span>{selectedArticle.category_name}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">
                            {selectedArticle.title}
                        </h1>
                        {selectedArticle.summary && (
                            <p className="text-gray-600">{selectedArticle.summary}</p>
                        )}
                        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <Clock size={14} />
                                Updated {formatDate(selectedArticle.updated_at)}
                            </span>
                        </div>
                        {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                            <div className="flex items-center gap-2 mt-4 flex-wrap">
                                <Tag size={14} className="text-gray-400" />
                                {selectedArticle.tags.map(tag => (
                                    <span
                                        key={tag}
                                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-8 space-y-8">
                        {selectedArticle.content?.problem && (
                            <section>
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                    <HelpCircle size={20} className="text-amber-500" />
                                    Problem
                                </h2>
                                <div
                                    className="prose prose-sm max-w-none text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: selectedArticle.content.problem }}
                                />
                            </section>
                        )}

                        {selectedArticle.content?.solution && (
                            <section>
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                    <Sparkles size={20} className="text-green-500" />
                                    Solution
                                </h2>
                                <div
                                    className="prose prose-sm max-w-none text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: selectedArticle.content.solution }}
                                />
                            </section>
                        )}

                        {selectedArticle.content?.verification && (
                            <section>
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                    <CheckCircle size={20} className="text-blue-500" />
                                    How to Verify
                                </h2>
                                <div
                                    className="prose prose-sm max-w-none text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: selectedArticle.content.verification }}
                                />
                            </section>
                        )}

                        {selectedArticle.content?.notes && (
                            <section>
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                    <BookOpen size={20} className="text-purple-500" />
                                    Additional Notes
                                </h2>
                                <div
                                    className="prose prose-sm max-w-none text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: selectedArticle.content.notes }}
                                />
                            </section>
                        )}
                    </div>

                    {/* Feedback */}
                    <div className="p-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-100">
                        {feedbackGiven[selectedArticle.id] ? (
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
                                    <CheckCircle size={18} className="text-green-500" />
                                    <span className="text-gray-700 font-medium">Thanks for your feedback!</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Was this article helpful?
                                </h3>
                                <p className="text-gray-600 text-sm mb-4">
                                    Your feedback helps us improve
                                </p>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => handleFeedback(selectedArticle.id, true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-green-500/25"
                                    >
                                        <ThumbsUp size={18} />
                                        Yes, it helped!
                                    </button>
                                    <button
                                        onClick={() => handleFeedback(selectedArticle.id, false)}
                                        className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all hover:scale-105"
                                    >
                                        <ThumbsDown size={18} />
                                        Not really
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </article>
            </div>
        );
    }

    // Article List View (after selecting a category) - 2 Panel Layout
    if (view === 'articles' && selectedCategory) {
        const sectionConfig = helpCategories.find(c => c.title === selectedSection);
        const Icon = sectionConfig?.icon || FileText;

        // Group articles by sub-category
        const getArticlesBySubCat = (subCatId: string) => {
            return articles.filter(a => a.category_id === subCatId);
        };

        // Articles directly in parent category
        const directArticles = articles.filter(a => a.category_id === selectedCategory.id);

        // Filter articles based on search
        const filterArticles = (arts: Article[]) => {
            if (!articleSearchQuery.trim()) return arts;
            return arts.filter(a =>
                a.title.toLowerCase().includes(articleSearchQuery.toLowerCase())
            );
        };

        const toggleSubCat = (subCatId: string) => {
            setExpandedSubCats(prev => ({
                ...prev,
                [subCatId]: !prev[subCatId]
            }));
        };

        return (
            <div className="flex h-full bg-gray-50">
                {/* Left Sidebar - Article List */}
                <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100">
                        <button
                            onClick={goBack}
                            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4 text-sm"
                        >
                            <ArrowLeft size={16} />
                            <span>{selectedSection === 'Getting Started' ? 'Back to Help Center' : 'Back to Categories'}</span>
                        </button>
                        <h2 className="font-bold text-gray-900 text-lg">{selectedCategory.name}</h2>
                        <p className="text-sm text-gray-500">{articles.length} articles</p>
                    </div>

                    {/* Search */}
                    <div className="p-3 border-b border-gray-100">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={articleSearchQuery}
                                onChange={(e) => setArticleSearchQuery(e.target.value)}
                                placeholder="Search articles..."
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            />
                        </div>
                    </div>

                    {/* Article List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={24} className="animate-spin text-indigo-500" />
                            </div>
                        ) : filterArticles(articles).length > 0 ? (
                            <div>
                                {filterArticles(articles).map(article => (
                                    <button
                                        key={article.id}
                                        onClick={() => handleArticleClick(article)}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${selectedArticle?.id === article.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <FileText size={16} className={`mt-0.5 shrink-0 ${selectedArticle?.id === article.id ? 'text-indigo-600' : 'text-gray-400'
                                                }`} />
                                            <span className={`text-sm line-clamp-2 ${selectedArticle?.id === article.id ? 'text-indigo-700 font-medium' : 'text-gray-700'
                                                }`}>
                                                {article.title}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                {articleSearchQuery ? 'No articles found' : 'No articles yet'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Article Detail */}
                <div className="flex-1 overflow-y-auto">
                    {selectedArticle ? (
                        <div className="max-w-4xl mx-auto p-8">
                            {/* Article Header */}
                            <div className="mb-8">
                                {/* Title */}
                                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                                    {selectedArticle.title}
                                </h1>

                                {/* Summary */}
                                {selectedArticle.summary && (
                                    <p className="text-lg text-gray-600 mb-6">{selectedArticle.summary}</p>
                                )}

                                {/* Meta: Date & Tags */}
                                <div className="flex items-center flex-wrap gap-6 text-sm text-gray-500">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-gray-400" />
                                        <span>Updated {formatDate(selectedArticle.updated_at)}</span>
                                    </div>

                                    {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                                        <div className="flex items-center gap-3">
                                            <Tag size={16} className="text-gray-400" />
                                            <div className="flex gap-2">
                                                {selectedArticle.tags.map(tag => (
                                                    <span
                                                        key={tag}
                                                        className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Article Content */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-8 space-y-8">
                                    {selectedArticle.content?.problem && (
                                        <section>
                                            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                                <HelpCircle size={20} className="text-amber-500" />
                                                Problem
                                            </h2>
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: selectedArticle.content.problem }}
                                            />
                                        </section>
                                    )}

                                    {selectedArticle.content?.solution && (
                                        <section>
                                            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                                <Sparkles size={20} className="text-green-500" />
                                                Solution
                                            </h2>
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: selectedArticle.content.solution }}
                                            />
                                        </section>
                                    )}

                                    {selectedArticle.content?.verification && (
                                        <section>
                                            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                                <CheckCircle size={20} className="text-blue-500" />
                                                How to Verify
                                            </h2>
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: selectedArticle.content.verification }}
                                            />
                                        </section>
                                    )}

                                    {selectedArticle.content?.notes && (
                                        <section>
                                            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                                                <BookOpen size={20} className="text-purple-500" />
                                                Additional Notes
                                            </h2>
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: selectedArticle.content.notes }}
                                            />
                                        </section>
                                    )}
                                </div>

                                {/* Feedback Section */}
                                <div className="p-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-100">
                                    {feedbackGiven[selectedArticle.id] ? (
                                        <div className="text-center">
                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
                                                <CheckCircle size={18} className="text-green-500" />
                                                <span className="text-gray-700 font-medium">Thanks for your feedback!</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                Was this article helpful?
                                            </h3>
                                            <p className="text-gray-600 text-sm mb-4">
                                                Your feedback helps us improve
                                            </p>
                                            <div className="flex items-center justify-center gap-4">
                                                <button
                                                    onClick={() => handleFeedback(selectedArticle.id, true)}
                                                    className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-green-500/25"
                                                >
                                                    <ThumbsUp size={18} />
                                                    Yes, it helped!
                                                </button>
                                                <button
                                                    onClick={() => handleFeedback(selectedArticle.id, false)}
                                                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all hover:scale-105"
                                                >
                                                    <ThumbsDown size={18} />
                                                    Not really
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Create Ticket Section */}
                                <div className="p-6 bg-gray-50 border-t border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-gray-900 mb-1">Still need help?</h4>
                                            <p className="text-sm text-gray-500">If this article didn't solve your issue, create a support ticket.</p>
                                        </div>
                                        {userRole === 'requester' && (
                                            <button
                                                onClick={() => {
                                                    window.location.hash = '#dashboard/tickets';
                                                    window.location.reload();
                                                }}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-indigo-500/25"
                                            >
                                                <Ticket size={18} />
                                                Create Ticket
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FileText size={32} className="text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an article</h3>
                                <p className="text-gray-500">Choose an article from the list to view its content</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // FAQ View (Custom Accordion Layout)
    if (view === 'faq' && selectedSection) {
        const filteredFAQ = articles.filter(a =>
            a.title.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
            (a.summary && a.summary.toLowerCase().includes(categorySearchQuery.toLowerCase()))
        );

        return (
            <div className="min-h-full bg-slate-50">
                {/* Hero Header */}
                <div className="bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 px-6 py-12 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                        <HelpCircle size={300} />
                    </div>

                    <div className="relative max-w-3xl mx-auto">
                        <button onClick={goBack} className="flex items-center gap-2 text-white/80 hover:text-white mb-8 transition-colors group">
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Help Center
                        </button>

                        <div className="text-center mb-8">
                            <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
                            <p className="text-purple-100 text-lg">Find quick answers to common questions about our services.</p>
                        </div>

                        {/* Search Local FAQ */}
                        <div className="relative max-w-xl mx-auto">
                            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={categorySearchQuery}
                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                placeholder="Search for questions..."
                                className="w-full pl-12 pr-4 py-4 bg-white/95 backdrop-blur rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-2xl transition-all text-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Accordion Content */}
                <div className="max-w-3xl mx-auto px-6 py-12 -mt-4 relative z-10">
                    {filteredFAQ.length > 0 ? (
                        <div className="space-y-4">
                            {filteredFAQ.map((article) => {
                                const isExpanded = expandedFaq === article.id;
                                return (
                                    <div key={article.id} className={`bg-white rounded-2xl transition-all duration-300 ${isExpanded ? 'shadow-xl ring-1 ring-purple-100 scale-[1.01]' : 'shadow-sm hover:shadow-md border border-gray-100'}`}>
                                        <button
                                            onClick={() => setExpandedFaq(isExpanded ? null : article.id)}
                                            className="w-full px-6 py-5 flex items-start justify-between text-left gap-4"
                                        >
                                            <h3 className={`font-semibold text-lg leading-relaxed ${isExpanded ? 'text-purple-700' : 'text-gray-900'}`}>
                                                {article.title}
                                            </h3>
                                            <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-purple-100 text-purple-600 rotate-180' : 'bg-gray-50 text-gray-400'}`}>
                                                <ChevronDown size={20} />
                                            </div>
                                        </button>

                                        {/* Answer Content */}
                                        <div
                                            className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
                                        >
                                            <div className="px-8 pb-8 pt-0">
                                                <div className="h-px bg-gradient-to-r from-transparent via-purple-100 to-transparent mb-6"></div>
                                                <div className="prose prose-purple prose-sm max-w-none text-gray-600 leading-relaxed">
                                                    <div dangerouslySetInnerHTML={{ __html: article.content.solution || article.content.problem || article.summary || 'No content provided.' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search size={24} className="text-gray-400" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-900 mb-1">No matches found</h3>
                            <p className="text-gray-500">Try searching for something else</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Category List View (after selecting a section)
    if (view === 'categories' && selectedSection) {
        const sectionConfig = helpCategories.find(c => c.title === selectedSection);
        const Icon = sectionConfig?.icon || FileText;

        const gradientMap: { [key: string]: string } = {
            'Getting Started': 'from-indigo-600 via-blue-600 to-cyan-500',
            'FAQ': 'from-purple-600 via-violet-600 to-indigo-500',
            'System How-To': 'from-blue-600 via-indigo-600 to-purple-500',
        };
        const gradient = gradientMap[selectedSection] || 'from-indigo-600 to-purple-600';

        return (
            <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                {/* Hero Header */}
                <div className="relative overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}></div>
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}></div>

                    <div className="relative px-6 py-10">
                        {/* Back Button */}
                        <button
                            onClick={goBack}
                            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6"
                        >
                            <ArrowLeft size={20} />
                            <span className="font-medium">Back to Help Center</span>
                        </button>

                        {/* Section Title */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                                <Icon size={32} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">{selectedSection}</h1>
                                <p className="text-white/80">{sectionConfig?.description}</p>
                            </div>
                        </div>

                        {/* Search Categories */}
                        <div className="relative max-w-md">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={categorySearchQuery}
                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                placeholder="Search categories..."
                                className="w-full pl-11 pr-4 py-3 bg-white/90 backdrop-blur-sm rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Categories Grid */}
                <div className="px-6 py-8">
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-gray-600">
                            {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'} found
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                            <p className="text-gray-500">Loading categories...</p>
                        </div>
                    ) : filteredCategories.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredCategories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => handleCategoryClick(category)}
                                    className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-indigo-300 hover:shadow-xl transition-all text-left group"
                                >
                                    {/* Header with icon and count */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-12 h-12 ${sectionConfig?.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                            <Folder size={24} className={sectionConfig?.color} />
                                        </div>
                                        <span className="text-sm font-medium text-indigo-600">
                                            {category.article_count} Articles
                                        </span>
                                    </div>

                                    {/* Category name */}
                                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2 line-clamp-2">
                                        {category.name}
                                    </h3>

                                    {/* Description */}
                                    {category.description && (
                                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{category.description}</p>
                                    )}

                                    {/* View Documentation link */}
                                    <div className="flex items-center gap-1 text-indigo-600 group-hover:text-indigo-700 text-sm font-medium mt-auto pt-2">
                                        <span>View Documentation</span>
                                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search size={32} className="text-gray-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                {categorySearchQuery ? 'No categories found' : 'No categories yet'}
                            </h3>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                {categorySearchQuery
                                    ? `No categories match "${categorySearchQuery}"`
                                    : 'Categories will appear here once articles are published.'
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Home View
    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Help Center</h1>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search help..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    {searching && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-500 animate-spin" size={20} />
                    )}
                </div>
            </div>

            {/* Search Results */}
            {searchQuery.trim().length >= 2 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">
                        Search Results {searchResults.length > 0 && `(${searchResults.length})`}
                    </h2>
                    {searchResults.length > 0 ? (
                        <div className="space-y-3">
                            {searchResults.map(article => (
                                <button
                                    key={article.id}
                                    onClick={() => handleArticleClick(article)}
                                    className="w-full p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all text-left group flex items-center gap-4"
                                >
                                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                        <BookOpen size={18} className="text-indigo-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                                            {article.title}
                                        </h3>
                                        <p className="text-sm text-gray-500">{article.category_name}</p>
                                    </div>
                                    <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                </button>
                            ))}
                        </div>
                    ) : !searching ? (
                        <div className="p-6 bg-gray-50 rounded-xl text-center">
                            <p className="text-gray-500">No results found for "{searchQuery}"</p>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Categories Grid */}
            {(!searchQuery.trim() || searchQuery.trim().length < 2) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {helpCategories.map((category, index) => (
                        <div
                            key={index}
                            onClick={() => handleSectionClick(category.title)}
                            className={`bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group flex flex-col items-center text-center h-64 justify-center ${!category.hasKB ? 'opacity-80' : ''}`}
                        >
                            <div className={`w-16 h-16 ${category.bgColor} ${category.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                <category.icon size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-indigo-700 transition-colors">
                                {category.title}
                            </h3>
                            <p className="text-gray-500">
                                {category.description}
                            </p>
                            {!category.hasKB && (
                                <span className="mt-3 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                                    Coming Soon
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HelpCenter;
