'use client';

import React, { useState, useEffect } from 'react';

import {
    Search, FileText, HelpCircle, Monitor, Shield, Phone, Settings,
    ArrowLeft, Clock, ChevronRight, Loader2, ThumbsUp, ThumbsDown,
    CheckCircle, Sparkles, BookOpen, Tag, Folder, Grid3X3, List,
    Plus, Ticket, ChevronDown
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

// Mapping Help Center sections to article_type values
const SECTION_TYPE_MAP: { [key: string]: string } = {
    'Getting Started': 'getting-started',
    'FAQ': 'faq',
    'System How-To': 'how-to',
};

const HelpCenter: React.FC = () => {
    const [userRole, setUserRole] = useState<string | null>('requester');
    const [view, setView] = useState<'home' | 'categories' | 'articles' | 'detail'>('home');

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (profile) setUserRole(profile.role);
            }
        };
        checkUser();
    }, []);
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
                // Fetch all categories with their parent info
                const { data: allCategories } = await supabase
                    .from('kb_categories')
                    .select('id, name, parent_id, description');

                // Fetch articles with this type
                const { data: articlesData } = await supabase
                    .from('kb_articles')
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
            Swal.fire({
                icon: 'info',
                title: sectionTitle,
                text: 'This section is coming soon!',
                confirmButtonColor: '#6366f1'
            });
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
            setView('categories');
            setSelectedCategory(null);
            setArticles([]);
        } else if (view === 'categories') {
            setView('home');
            setSelectedSection(null);
            setCategories([]);
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
        return (
            <div className="p-8 max-w-4xl mx-auto">
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
                            <span>Back to Categories</span>
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
