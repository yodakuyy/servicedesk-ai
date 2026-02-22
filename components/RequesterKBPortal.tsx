'use client';

import React, { useState, useEffect } from 'react';
import {
    Search, Book, ChevronRight, ThumbsUp, ThumbsDown,
    ArrowLeft, Clock, Tag, Folder, HelpCircle,
    Loader2, MessageCircle, Ticket, CheckCircle,
    Sparkles, TrendingUp, BookOpen
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

interface Category {
    id: string;
    name: string;
    parent_id: string | null;
    article_count?: number;
    children?: Category[];
}

const RequesterKBPortal: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [articles, setArticles] = useState<Article[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [feedbackGiven, setFeedbackGiven] = useState<{ [key: string]: boolean | null }>({});
    const [popularArticles, setPopularArticles] = useState<Article[]>([]);
    const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null);

    useEffect(() => {
        const initialize = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('groups!user_groups(company_id)')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    // @ts-ignore
                    const companyId = profile.groups?.[0]?.company_id;
                    setCurrentCompanyId(companyId);
                    fetchCategories(companyId);
                    fetchPopularArticles(companyId);
                }
            } else {
                fetchCategories();
                fetchPopularArticles();
            }
        };
        initialize();
    }, []);

    useEffect(() => {
        if (searchQuery.trim()) {
            const debounce = setTimeout(() => {
                searchArticles(searchQuery);
            }, 300);
            return () => clearTimeout(debounce);
        } else if (selectedCategory) {
            fetchArticlesByCategory(selectedCategory, currentCompanyId);
        } else {
            setArticles([]);
        }
    }, [searchQuery, selectedCategory, currentCompanyId]);

    const fetchCategories = async (companyId?: number | null) => {
        try {
            // Fetch categories with article count
            const { data: categoriesData } = await supabase
                .from('kb_categories')
                .select('id, name, parent_id')
                .order('name');

            if (categoriesData) {
                // Get article count per category (only public + published)
                const { data: articleCounts } = await supabase
                    .from('kb_articles')
                    .select('category_id')
                    .eq('visibility', 'public')
                    .eq('status', 'published')
                    .eq('company_id', companyId);

                const countMap: { [key: string]: number } = {};
                articleCounts?.forEach(a => {
                    countMap[a.category_id] = (countMap[a.category_id] || 0) + 1;
                });

                // Build tree structure
                const rootCategories = categoriesData
                    .filter(c => !c.parent_id)
                    .map(c => ({
                        ...c,
                        article_count: countMap[c.id] || 0,
                        children: categoriesData
                            .filter(child => child.parent_id === c.id)
                            .map(child => ({
                                ...child,
                                article_count: countMap[child.id] || 0
                            }))
                    }))
                    // Only show categories that have articles
                    .filter(c => c.article_count > 0 || c.children?.some(ch => ch.article_count > 0));

                setCategories(rootCategories);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPopularArticles = async (companyId?: number | null) => {
        try {
            // For now, just get the 5 most recent published public articles
            // In future, could use kb_article_feedback or view count
            const { data } = await supabase
                .from('kb_articles')
                .select(`
                    id, title, summary, content, category_id, updated_at,
                    kb_categories!inner(name)
                `)
                .eq('visibility', 'public')
                .eq('status', 'published')
                .eq('company_id', companyId)
                .order('updated_at', { ascending: false })
                .limit(5);

            if (data) {
                const articlesWithCategory = data.map((a: any) => ({
                    ...a,
                    category_name: a.kb_categories?.name
                }));
                setPopularArticles(articlesWithCategory);
            }
        } catch (error) {
            console.error('Error fetching popular articles:', error);
        }
    };

    const searchArticles = async (query: string) => {
        setSearchLoading(true);
        try {
            const { data } = await supabase
                .from('kb_articles')
                .select(`
                    id, title, summary, content, category_id, updated_at,
                    kb_categories!inner(name)
                `)
                .eq('visibility', 'public')
                .eq('status', 'published')
                .eq('company_id', currentCompanyId)
                .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
                .order('updated_at', { ascending: false })
                .limit(20);

            if (data) {
                const articlesWithCategory = data.map((a: any) => ({
                    ...a,
                    category_name: a.kb_categories?.name
                }));
                setArticles(articlesWithCategory);
            }
        } catch (error) {
            console.error('Error searching articles:', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const fetchArticlesByType = async (type: string) => {
        setSearchLoading(true);
        try {
            const { data } = await supabase
                .from('kb_articles')
                .select(`
                    id, title, summary, content, category_id, updated_at,
                    kb_categories!inner(name)
                `)
                .eq('visibility', 'public')
                .eq('status', 'published')
                .eq('company_id', currentCompanyId)
                .eq('article_type', type)
                .order('title', { ascending: true });

            if (data) {
                const articlesWithCategory = data.map((a: any) => ({
                    ...a,
                    category_name: a.kb_categories?.name
                }));
                setArticles(articlesWithCategory);
                // Use a special prefix to indicate type-based selection
                setSelectedCategory('type:' + type);
            }
        } catch (error) {
            console.error('Error fetching articles by type:', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const fetchArticlesByCategory = async (categoryId: string, companyId?: number | null) => {
        setSearchLoading(true);
        try {
            // Get articles from this category and its children
            const { data: childCategories } = await supabase
                .from('kb_categories')
                .select('id')
                .eq('parent_id', categoryId);

            const categoryIds = [categoryId, ...(childCategories?.map(c => c.id) || [])];

            const { data } = await supabase
                .from('kb_articles')
                .select(`
                    id, title, summary, content, category_id, updated_at,
                    kb_categories!inner(name)
                `)
                .eq('visibility', 'public')
                .eq('status', 'published')
                .eq('company_id', currentCompanyId)
                .in('category_id', categoryIds)
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
            setSearchLoading(false);
        }
    };

    const fetchArticleDetail = async (article: Article) => {
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
        } catch (error) {
            console.error('Error fetching article detail:', error);
            setSelectedArticle(article);
        }
    };

    const handleFeedback = async (articleId: string, isHelpful: boolean) => {
        try {
            // Insert feedback
            await supabase
                .from('kb_article_feedback')
                .insert({
                    article_id: articleId,
                    is_helpful: isHelpful,
                    created_at: new Date().toISOString()
                });

            setFeedbackGiven(prev => ({ ...prev, [articleId]: isHelpful }));

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

    // Article Detail View
    if (selectedArticle) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
                    <div className="max-w-4xl mx-auto px-6 py-4">
                        <button
                            onClick={() => setSelectedArticle(null)}
                            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span className="font-medium">Back to Articles</span>
                        </button>
                    </div>
                </div>

                {/* Article Content */}
                <div className="max-w-4xl mx-auto px-6 py-8">
                    <article className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                        {/* Article Header */}
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

                        {/* Article Body */}
                        <div className="p-8 space-y-8">
                            {/* Problem Section */}
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

                            {/* Solution Section */}
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

                            {/* Verification Section */}
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
                        </div>

                        {/* Feedback Section */}
                        <div className="p-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-100">
                            {feedbackGiven[selectedArticle.id] !== undefined ? (
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
                                        Your feedback helps us improve our knowledge base
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

                        {/* Still Need Help */}
                        <div className="p-6 bg-white border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                        <MessageCircle size={20} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Still need help?</p>
                                        <p className="text-sm text-gray-500">Our support team is here for you</p>
                                    </div>
                                </div>
                                <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors">
                                    <Ticket size={18} />
                                    Create Ticket
                                </button>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        );
    }

    // Main Portal View
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500"></div>
                <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}></div>

                <div className="relative max-w-4xl mx-auto px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-6">
                        <BookOpen size={16} />
                        Knowledge Base
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        How can we help you?
                    </h1>
                    <p className="text-xl text-white/80 mb-8">
                        Search our knowledge base or browse by category
                    </p>

                    {/* Search Box */}
                    <div className="relative max-w-2xl mx-auto">
                        <div className="relative">
                            <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setSelectedCategory(null);
                                }}
                                placeholder="Search for articles, guides, and solutions..."
                                className="w-full pl-14 pr-6 py-5 bg-white rounded-2xl text-gray-900 placeholder-gray-400 text-lg shadow-xl focus:outline-none focus:ring-4 focus:ring-white/30 transition-all"
                            />
                            {searchLoading && (
                                <Loader2 size={22} className="absolute right-5 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Search Results */}
                {(searchQuery || selectedCategory) && articles.length > 0 && (
                    <div className="mb-12">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                {searchQuery ? `Search Results for "${searchQuery}"` : 'Articles'}
                            </h2>
                            <span className="text-sm text-gray-500">{articles.length} articles found</span>
                        </div>
                        <div className="grid gap-4">
                            {articles.map(article => (
                                <button
                                    key={article.id}
                                    onClick={() => fetchArticleDetail(article)}
                                    className="w-full p-6 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all text-left group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 text-sm text-indigo-600 mb-2">
                                                <Folder size={14} />
                                                <span>{article.category_name}</span>
                                            </div>
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
                                        <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-500 transition-colors mt-2" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* No Results */}
                {(searchQuery || selectedCategory) && articles.length === 0 && !searchLoading && (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search size={24} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No articles found</h3>
                        <p className="text-gray-600">Try different keywords or browse categories below</p>
                    </div>
                )}

                {/* Categories Section */}
                {!searchQuery && !selectedCategory && (
                    <>
                        {/* 🌟 Quick Help Section */}
                        <div className="mb-12">
                            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Sparkles size={22} className="text-indigo-600" />
                                Quick Help
                            </h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                {/* Getting Started */}
                                <div
                                    onClick={() => fetchArticlesByType('getting-started')}
                                    className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white cursor-pointer hover:scale-105 transition-transform shadow-lg shadow-blue-500/20 group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <BookOpen size={100} />
                                    </div>
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                                        <BookOpen size={24} className="text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 relative z-10">Getting Started</h3>
                                    <p className="text-blue-100 text-sm relative z-10">New to Service Desk? Learn the basics of how to use the portal.</p>
                                </div>

                                {/* System How-To */}
                                <div
                                    onClick={() => fetchArticlesByType('how-to')}
                                    className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white cursor-pointer hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20 group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Folder size={100} />
                                    </div>
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                                        <Folder size={24} className="text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 relative z-10">System How-To</h3>
                                    <p className="text-indigo-100 text-sm relative z-10">Step-by-step technical guides and tutorials.</p>
                                </div>

                                {/* FAQ */}
                                <div
                                    onClick={() => fetchArticlesByType('faq')}
                                    className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 text-white cursor-pointer hover:scale-105 transition-transform shadow-lg shadow-purple-500/20 group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <HelpCircle size={100} />
                                    </div>
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                                        <HelpCircle size={24} className="text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 relative z-10">FAQ</h3>
                                    <p className="text-purple-100 text-sm relative z-10">Frequently asked questions and answers.</p>
                                </div>
                            </div>
                        </div>

                        {/* Browse by Category */}
                        <div className="mb-12">
                            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Folder size={22} className="text-indigo-600" />
                                Browse by Category
                            </h2>
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                                </div>
                            ) : categories.length > 0 ? (
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {categories.map(category => (
                                        <button
                                            key={category.id}
                                            onClick={() => setSelectedCategory(category.id)}
                                            className="p-6 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all text-left group"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                        <Book size={22} className="text-white" />
                                                    </div>
                                                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">
                                                        {category.name}
                                                    </h3>
                                                    <p className="text-sm text-gray-500">
                                                        {(category.article_count || 0) + (category.children?.reduce((sum, c) => sum + (c.article_count || 0), 0) || 0)} articles
                                                    </p>
                                                </div>
                                                <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                                    <p className="text-gray-500">No categories available yet</p>
                                </div>
                            )}
                        </div>

                        {/* Popular Articles */}
                        {popularArticles.length > 0 && (
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <TrendingUp size={22} className="text-amber-500" />
                                    Popular Articles
                                </h2>
                                <div className="grid gap-4">
                                    {popularArticles.map(article => (
                                        <button
                                            key={article.id}
                                            onClick={() => fetchArticleDetail(article)}
                                            className="w-full p-5 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all text-left group flex items-center gap-4"
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
                                                <BookOpen size={18} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                                                    {article.title}
                                                </h3>
                                                <p className="text-sm text-gray-500">{article.category_name}</p>
                                            </div>
                                            <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Back to Categories Button */}
                {selectedCategory && !searchQuery && (
                    <div className="mb-6">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            <ArrowLeft size={18} />
                            Back to Categories
                        </button>
                    </div>
                )}
            </div>

            {/* Footer CTA */}
            <div className="bg-white border-t border-gray-100">
                <div className="max-w-6xl mx-auto px-6 py-12">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 md:p-12 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                            Can&apos;t find what you&apos;re looking for?
                        </h2>
                        <p className="text-white/80 mb-6 max-w-xl mx-auto">
                            Our support team is ready to help you with any questions or issues
                        </p>
                        <button
                            onClick={() => {
                                window.location.hash = '';
                                window.location.reload();
                            }}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-lg"
                        >
                            <Ticket size={20} />
                            Log In to Create Ticket
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequesterKBPortal;

