'use client';

import React, { useState, useEffect } from 'react';
import {
    Search, FileText, HelpCircle, Monitor, Shield, Phone, Settings,
    ArrowLeft, Clock, ChevronRight, Loader2, ThumbsUp, ThumbsDown,
    CheckCircle, Sparkles, BookOpen, Tag, Folder
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

// Mapping Help Center sections to article_type values
const SECTION_TYPE_MAP: { [key: string]: string } = {
    'Getting Started': 'getting-started',
    'FAQ': 'faq',
    'System How-To': 'how-to',
    // 'Policies & SLA': 'policies', // Skipped for now
};

const HelpCenter: React.FC = () => {
    const [view, setView] = useState<'home' | 'list' | 'detail'>('home');
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Article[]>([]);
    const [searching, setSearching] = useState(false);
    const [feedbackGiven, setFeedbackGiven] = useState<{ [key: string]: boolean }>({});

    // Search functionality with debounce
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
        // Check if this section has KB integration
        const articleType = SECTION_TYPE_MAP[sectionTitle];

        if (articleType) {
            setSelectedSection(sectionTitle);
            setLoading(true);
            setView('list');

            try {
                const { data } = await supabase
                    .from('kb_articles')
                    .select(`
                        id, title, summary, content, category_id, updated_at,
                        kb_categories!inner(name)
                    `)
                    .eq('visibility', 'public')
                    .eq('status', 'published')
                    .eq('article_type', articleType)
                    .order('updated_at', { ascending: false });

                if (data) {
                    const articlesWithCategory = data.map((a: any) => ({
                        ...a,
                        category_name: a.kb_categories?.name
                    }));
                    setArticles(articlesWithCategory);
                }
            } catch (error) {
                console.error('Error fetching articles:', error);
            } finally {
                setLoading(false);
            }
        } else {
            // For sections without KB integration, show placeholder
            Swal.fire({
                icon: 'info',
                title: sectionTitle,
                text: 'This section is coming soon!',
                confirmButtonColor: '#6366f1'
            });
        }
    };

    const handleArticleClick = async (article: Article) => {
        try {
            // Fetch tags
            const { data: tagsData } = await supabase
                .from('kb_article_tags')
                .select('tag')
                .eq('article_id', article.id);

            setSelectedArticle({
                ...article,
                tags: tagsData?.map(t => t.tag) || []
            });
            setView('detail');
        } catch (error) {
            console.error('Error fetching article:', error);
            setSelectedArticle(article);
            setView('detail');
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
            setView('list');
            setSelectedArticle(null);
        } else if (view === 'list') {
            setView('home');
            setSelectedSection(null);
            setArticles([]);
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
            hasKB: false // Disabled for now
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

    // Article Detail View
    if (view === 'detail' && selectedArticle) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={goBack}
                    className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
                >
                    <ArrowLeft size={20} />
                    <span className="font-medium">Back to {selectedSection}</span>
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

    // Article List View
    if (view === 'list' && selectedSection) {
        const sectionConfig = helpCategories.find(c => c.title === selectedSection);
        const Icon = sectionConfig?.icon || FileText;

        return (
            <div className="p-8 max-w-4xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={goBack}
                    className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
                >
                    <ArrowLeft size={20} />
                    <span className="font-medium">Back to Help Center</span>
                </button>

                {/* Section Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className={`w-14 h-14 ${sectionConfig?.bgColor} ${sectionConfig?.color} rounded-2xl flex items-center justify-center`}>
                        <Icon size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{selectedSection}</h1>
                        <p className="text-gray-500">{sectionConfig?.description}</p>
                    </div>
                </div>

                {/* Articles */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                    </div>
                ) : articles.length > 0 ? (
                    <div className="space-y-4">
                        {articles.map(article => (
                            <button
                                key={article.id}
                                onClick={() => handleArticleClick(article)}
                                className="w-full p-6 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all text-left group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2">
                                            {article.title}
                                        </h3>
                                        {article.summary && (
                                            <p className="text-gray-600 text-sm line-clamp-2">{article.summary}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                                            <Clock size={12} />
                                            <span>Updated {formatDate(article.updated_at)}</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-500 transition-colors mt-2 shrink-0" />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText size={24} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No articles yet</h3>
                        <p className="text-gray-500">Articles will appear here once they are published</p>
                    </div>
                )}
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
