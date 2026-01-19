import React, { useState, useEffect } from 'react';
import {
    Save, X, Calendar, User, Clock,
    AlertCircle, CheckCircle2, FileText,
    Image as ImageIcon, Loader2, Tag,
    Eye, EyeOff, Layout, Type, List,
    Lightbulb, Sparkles, ChevronLeft,
    Folder, ChevronDown, Wand2,
    PenLine, ClipboardCheck, StickyNote, Send, Lock, MessageSquare
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import RichTextEditor from './RichTextEditor';

import { supabase } from '../lib/supabase';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface ArticleEditorProps {
    articleId?: string | null;
    onClose: () => void;
    onSave?: () => void;
}

interface Category {
    id: string;
    name: string;
    parent_id?: string | null;
    level?: number;
    displayName?: string;
    disabled?: boolean;
}

interface ArticleData {
    id?: string;
    title: string;
    summary: string;
    category_id: string;
    visibility: 'public' | 'internal';
    status: 'draft' | 'review' | 'published' | 'archived';
    article_type: 'how-to' | 'faq' | 'getting-started' | 'troubleshooting' | 'reference';
    // Helper fields for editor state
    content_problem: string;
    content_solution: string;
    content_verification: string;
    content_notes: string;
    tags: string[];
    is_ai_enabled: boolean;
    reviewer_feedback?: string;
}

const initialArticle: ArticleData = {
    title: '',
    summary: '',
    category_id: '',
    visibility: 'internal',
    status: 'draft',
    article_type: 'troubleshooting',
    content_problem: '',
    content_solution: '',
    content_verification: '',
    content_notes: '',
    tags: [],
    is_ai_enabled: true,
    reviewer_feedback: '',
};

const ARTICLE_TYPES = [
    { value: 'how-to', label: 'How-To Guide', description: 'Step-by-step tutorials', icon: '📖' },
    { value: 'faq', label: 'FAQ', description: 'Question & Answer format', icon: '❓' },
    { value: 'getting-started', label: 'Getting Started', description: 'Onboarding guides', icon: '🚀' },
    { value: 'troubleshooting', label: 'Troubleshooting', description: 'Problem-solution articles', icon: '🔧' },
    { value: 'reference', label: 'Internal Reference', description: 'Agent-only documentation', icon: '📋' },
];

const ArticleEditor: React.FC<ArticleEditorProps> = ({ articleId, onClose, onSave }) => {
    const [article, setArticle] = useState<ArticleData>(initialArticle);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'problem' | 'solution' | 'verification' | 'notes'>('problem');
    const [tagInput, setTagInput] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    // Custom modal states
    const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type: 'error' | 'success' | 'warning' }>({ show: false, title: '', message: '', type: 'error' });
    const [confirmModal, setConfirmModal] = useState<{ show: boolean; onConfirm: () => void }>({ show: false, onConfirm: () => { } });

    const showAlert = (title: string, message: string, type: 'error' | 'success' | 'warning' = 'error') => {
        setAlertModal({ show: true, title, message, type });
    };

    useEffect(() => {
        fetchCategories();
        if (articleId) {
            fetchArticle(articleId);
        }
    }, [articleId]);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('kb_categories')
                .select('id, name, parent_id')
                .order('name');

            if (data) {
                // Just pass data through, let the UI filter it
                setCategories(data);
            }
        } catch (err) {
            console.error('Exception fetching categories:', err);
        }
    };

    const fetchArticle = async (id: string) => {
        setLoading(true);
        try {
            const { data: articleData } = await supabase
                .from('kb_articles')
                .select('*')
                .eq('id', id)
                .single();

            if (articleData) {
                // Fetch tags
                const { data: tagsData } = await supabase
                    .from('kb_article_tags')
                    .select('tag')
                    .eq('article_id', id);

                // Parse content JSONB
                const content = articleData.content || {};

                // Determine main category based on article's category_id
                let mainCatId = '';
                if (articleData.category_id) {
                    // Need to check if current category has a parent
                    // We can't use 'categories' state here reliably because it might not be set yet if run in parallel
                    // So we do a quick lookup or rely on pre-fetched categories if possible.
                    // Better approach: fetch category details again or look it up after categories load.
                    // For now, let's just cheat and look at local logic if categories are loaded, 
                    // OR we fetch the category itself to find its parent.

                    const { data: catData } = await supabase
                        .from('kb_categories')
                        .select('parent_id')
                        .eq('id', articleData.category_id)
                        .single();

                    if (catData?.parent_id) {
                        mainCatId = catData.parent_id;
                    } else {
                        mainCatId = articleData.category_id;
                    }
                }

                setSelectedMainCategory(mainCatId);

                setArticle({
                    id: articleData.id,
                    title: articleData.title || '',
                    summary: articleData.summary || '',
                    category_id: articleData.category_id || '',
                    visibility: articleData.visibility || 'internal',
                    status: articleData.status || 'draft',
                    content_problem: content.problem || articleData.content_problem || '', // Fallback for backward compatibility
                    content_solution: content.solution || articleData.content_solution || '',
                    content_verification: content.verification || articleData.content_verification || '',
                    content_notes: content.notes || articleData.content_notes || '',
                    tags: tagsData?.map((t: any) => t.tag) || [],
                    is_ai_enabled: articleData.is_ai_enabled ?? true,
                    reviewer_feedback: articleData.reviewer_feedback || '',
                    article_type: articleData.article_type || 'troubleshooting',
                });
            }
        } catch (error) {
            console.error('Error fetching article:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof ArticleData, value: any) => {
        setArticle(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    // Auto-set AI usage based on visibility
    const handleVisibilityChange = (vis: 'public' | 'internal') => {
        setArticle(prev => ({
            ...prev,
            visibility: vis,
            is_ai_enabled: vis === 'public' // Public = AI Enabled, Internal = AI Disabled
        }));
        setHasChanges(true);
    };

    const addTag = () => {
        if (tagInput.trim() && !article.tags.includes(tagInput.trim())) {
            handleChange('tags', [...article.tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        handleChange('tags', article.tags.filter(t => t !== tag));
    };

    const handleSaveDraft = async () => {
        if (!article.title.trim()) {
            showAlert('Validation Error', 'Title is required', 'warning');
            return;
        }

        if (!article.category_id) {
            showAlert('Validation Error', 'Please select a Category', 'warning');
            return;
        }

        if (article.tags.length === 0) {
            showAlert('Validation Error', 'Please add at least one Tag (helps AI search)', 'warning');
            return;
        }

        setSaving(true);
        try {
            // Construct content JSONB
            const contentJson = {
                problem: article.content_problem,
                solution: article.content_solution,
                verification: article.content_verification,
                notes: article.content_notes
            };

            const articlePayload = {
                title: article.title,
                summary: article.summary,
                category_id: article.category_id || null,
                visibility: article.visibility,
                status: 'draft',
                content: contentJson,
                is_ai_enabled: article.is_ai_enabled,
                article_type: article.article_type,
                updated_at: new Date().toISOString(),
            };

            let savedArticleId = article.id;

            if (article.id) {
                // Update existing
                await supabase
                    .from('kb_articles')
                    .update(articlePayload)
                    .eq('id', article.id);
            } else {
                // Create new
                const { data } = await supabase
                    .from('kb_articles')
                    .insert({ ...articlePayload, created_at: new Date().toISOString() })
                    .select('id')
                    .single();
                savedArticleId = data?.id;
            }

            // Save tags
            if (savedArticleId) {
                await supabase
                    .from('kb_article_tags')
                    .delete()
                    .eq('article_id', savedArticleId);

                if (article.tags.length > 0) {
                    await supabase
                        .from('kb_article_tags')
                        .insert(article.tags.map(tag => ({ article_id: savedArticleId, tag })));
                }
            }

            setHasChanges(false);
            if (onSave) onSave();

            // Premium Toast Notification
            Swal.fire({
                icon: 'success',
                title: 'Draft Saved',
                text: 'Your article has been saved to drafts.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } catch (error) {
            console.error('Error saving article:', error);
            showAlert('Save Failed', 'Failed to save article. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitForReview = async () => {
        if (!article.title.trim()) {
            showAlert('Validation Error', 'Title is required', 'warning');
            return;
        }
        if (!article.content_problem.trim() || !article.content_solution.trim()) {
            showAlert('Validation Error', 'Problem and Solution sections are required before submitting for review', 'warning');
            return;
        }

        setSaving(true);
        try {
            // First save as draft
            await handleSaveDraft();

            // Then update status to review
            if (article.id) {
                await supabase
                    .from('kb_articles')
                    .update({ status: 'review', updated_at: new Date().toISOString() })
                    .eq('id', article.id);
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Error submitting for review:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (hasChanges) {
            setConfirmModal({
                show: true,
                onConfirm: () => {
                    setConfirmModal({ show: false, onConfirm: () => { } });
                    onClose();
                }
            });
        } else {
            onClose();
        }
    };

    const contentTabs = [
        { id: 'problem', label: 'Problem', icon: PenLine, required: true },
        { id: 'solution', label: 'Solution', icon: Lightbulb, required: true },
        { id: 'verification', label: 'Verification', icon: ClipboardCheck, required: false },
        { id: 'notes', label: 'Notes', icon: StickyNote, required: false },
    ];

    const getStatusBadge = () => {
        const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
            draft: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '🟡 Draft' },
            review: { bg: 'bg-blue-100', text: 'text-blue-700', label: '🔵 In Review' },
            published: { bg: 'bg-green-100', text: 'text-green-700', label: '🟢 Published' },
            archived: { bg: 'bg-gray-100', text: 'text-gray-600', label: '⚫ Archived' },
        };
        const config = statusConfig[article.status] || statusConfig.draft;
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
                {config.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-gray-600">Loading article...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#f3f4f6] z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">
                            {articleId ? 'Edit Article' : 'Create New Article'}
                        </h1>
                        <p className="text-xs text-gray-500">
                            {articleId ? 'Modify existing knowledge base article' : 'Add a new article to the knowledge base'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {getStatusBadge()}

                    <button
                        onClick={handleSaveDraft}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Draft
                    </button>

                    <button
                        onClick={handleSubmitForReview}
                        disabled={saving || article.status !== 'draft'}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send size={16} />
                        Submit for Review
                    </button>
                </div>
            </header>

            {/* Reviewer Feedback Banner - Only show for draft status */}
            {article.reviewer_feedback && article.status === 'draft' && (
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 shrink-0">
                    <div className="flex items-start gap-3 max-w-4xl mx-auto">
                        <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                            <MessageSquare size={18} className="text-amber-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-amber-800">Reviewer Feedback</h3>
                            <p className="text-sm text-amber-700 mt-0.5">{article.reviewer_feedback}</p>
                        </div>
                        <button
                            onClick={() => handleChange('reviewer_feedback', '')}
                            className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left Panel - Form */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Basic Info Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <FileText size={18} className="text-indigo-600" />
                                Article Information
                            </h2>

                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={article.title}
                                    onChange={(e) => handleChange('title', e.target.value)}
                                    placeholder="Enter a clear and descriptive title"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>

                            {/* Summary */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Summary</label>
                                <textarea
                                    value={article.summary}
                                    onChange={(e) => handleChange('summary', e.target.value)}
                                    placeholder="Brief description of the article (optional)"
                                    rows={2}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                />
                            </div>

                            {/* Category & Visibility Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Category - Cascading Dropdowns */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <Folder size={14} className="text-gray-400" />
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Main Category Dropdown */}
                                        <SearchableSelect
                                            placeholder="Select Main Category..."
                                            searchPlaceholder="Search category..."
                                            value={selectedMainCategory}
                                            options={categories
                                                .filter(c => !c.parent_id)
                                                .map(c => ({ value: c.id, label: c.name }))
                                            }
                                            onChange={(val) => {
                                                setSelectedMainCategory(val);
                                                // Logika cascading
                                                const children = categories.filter(c => c.parent_id === val);
                                                if (children.length === 0) {
                                                    handleChange('category_id', val);
                                                } else {
                                                    handleChange('category_id', '');
                                                }
                                            }}
                                        />

                                        {/* Sub Category Dropdown */}
                                        <SearchableSelect
                                            placeholder={
                                                categories.filter(c => c.parent_id === selectedMainCategory).length === 0 && selectedMainCategory
                                                    ? "-"
                                                    : "Select Sub Category..."
                                            }
                                            searchPlaceholder="Search sub category..."
                                            value={article.category_id}
                                            options={selectedMainCategory
                                                ? categories
                                                    .filter(c => c.parent_id === selectedMainCategory)
                                                    .map(c => ({ value: c.id, label: c.name }))
                                                : []
                                            }
                                            onChange={(val) => handleChange('category_id', val)}
                                            disabled={!selectedMainCategory || categories.filter(c => c.parent_id === selectedMainCategory).length === 0}
                                        />
                                    </div>
                                </div>

                                {/* Visibility */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700 font-medium">Visibility <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleVisibilityChange('public')}
                                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all ${article.visibility === 'public'
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            <Eye size={16} />
                                            Public
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleVisibilityChange('internal')}
                                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all ${article.visibility === 'internal'
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            <EyeOff size={16} />
                                            Internal
                                        </button>
                                    </div>
                                    {/* Visibility Helper Text */}
                                    <div className="mt-2 min-h-[1.5rem]">
                                        {article.visibility === 'public' ? (
                                            <p className="text-xs text-gray-500 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <Eye size={12} className="text-indigo-500" />
                                                Visible to <span className="font-semibold text-gray-700">Requesters & AI</span>. Use for general self-help guides.
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-500 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <Lock size={12} className="text-amber-500" />
                                                Visible only to <span className="font-semibold text-gray-700">Agents & SPV</span>. AI Disabled.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Article Type */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <FileText size={14} className="text-gray-400" />
                                    Article Type <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {ARTICLE_TYPES.map(type => (
                                        <button
                                            key={type.value}
                                            type="button"
                                            onClick={() => handleChange('article_type', type.value)}
                                            className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm transition-all text-left ${article.article_type === type.value
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            <span className="text-lg">{type.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{type.label}</div>
                                                <div className="text-xs text-gray-500 truncate">{type.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    This determines where the article appears in Help Center
                                </p>
                            </div>
                            {/* Tags */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Tag size={14} className="text-gray-400" />
                                    Tags <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {article.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
                                        >
                                            {tag}
                                            <button
                                                onClick={() => removeTag(tag)}
                                                className="hover:text-red-500 ml-1"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                        placeholder="Add a tag and press Enter"
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={addTag}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Article Content Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Content Tabs */}
                            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-3">
                                <div className="flex gap-1">
                                    {contentTabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                                ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                                                }`}
                                        >
                                            <tab.icon size={16} />
                                            {tab.label}
                                            {tab.required && (
                                                <span className="text-red-500 text-xs">*</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="p-6">
                                {activeTab === 'problem' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                                            <AlertCircle size={16} className="text-amber-500" />
                                            Describe the problem or issue this article addresses
                                        </div>
                                        <RichTextEditor
                                            content={article.content_problem}
                                            onChange={(html) => handleChange('content_problem', html)}
                                            placeholder="What is the problem or issue? Describe symptoms, error messages, or situations..."
                                            minHeight="250px"
                                        />
                                    </div>
                                )}

                                {activeTab === 'solution' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                                            <Lightbulb size={16} className="text-green-500" />
                                            Provide step-by-step solution to resolve the problem
                                        </div>
                                        <RichTextEditor
                                            content={article.content_solution}
                                            onChange={(html) => handleChange('content_solution', html)}
                                            placeholder="Step 1: ...&#10;Step 2: ...&#10;Step 3: ..."
                                            minHeight="250px"
                                        />
                                    </div>
                                )}

                                {activeTab === 'verification' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                                            <ClipboardCheck size={16} className="text-blue-500" />
                                            How to verify the solution worked correctly
                                        </div>
                                        <RichTextEditor
                                            content={article.content_verification}
                                            onChange={(html) => handleChange('content_verification', html)}
                                            placeholder="Describe how to confirm the issue is resolved..."
                                            minHeight="200px"
                                        />
                                    </div>
                                )}

                                {activeTab === 'notes' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                                            <StickyNote size={16} className="text-purple-500" />
                                            Additional notes, screenshots links, or references
                                        </div>
                                        <RichTextEditor
                                            content={article.content_notes}
                                            onChange={(html) => handleChange('content_notes', html)}
                                            placeholder="Add any additional notes, related links, or reference materials..."
                                            minHeight="200px"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - AI Assist (Optional) */}
                <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto hidden lg:block">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Sparkles size={16} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">AI Assistant</h3>
                                <p className="text-xs text-gray-500">Writing suggestions</p>
                            </div>
                        </div>

                        {/* AI Toggle */}
                        <div className="p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700">Enable AI Usage</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Allow AI to suggest this article</p>
                                </div>
                                <div
                                    className={`relative w-11 h-6 rounded-full transition-colors cursor-not-allowed opacity-80 ${article.is_ai_enabled ? 'bg-indigo-600' : 'bg-gray-300'
                                        }`}
                                    title="AI status is automatically managed by Visibility settings"
                                >
                                    <span
                                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${article.is_ai_enabled ? 'translate-x-5' : ''
                                            }`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* AI Suggestions Placeholder */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quick Actions</h4>

                            <button className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <FileText size={14} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Generate Summary</p>
                                    <p className="text-xs text-gray-500">Auto-create summary</p>
                                </div>
                            </button>

                            <button className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left">
                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Tag size={14} className="text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Suggest Tags</p>
                                    <p className="text-xs text-gray-500">AI-powered tags</p>
                                </div>
                            </button>

                            <button className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left">
                                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                                    <CheckCircle2 size={14} className="text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Check Clarity</p>
                                    <p className="text-xs text-gray-500">Readability score</p>
                                </div>
                            </button>
                        </div>

                        {/* Writing Tips */}
                        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Writing Tips</h4>
                            <ul className="text-xs text-indigo-600 space-y-1.5">
                                <li>• Use clear, step-by-step instructions</li>
                                <li>• Include error messages verbatim</li>
                                <li>• Add screenshots when helpful</li>
                                <li>• Keep sentences short and simple</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>


            {/* Alert Modal */}
            {alertModal.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${alertModal.type === 'error' ? 'bg-red-100' :
                                alertModal.type === 'warning' ? 'bg-amber-100' : 'bg-green-100'
                                }`}>
                                <AlertCircle size={24} className={`${alertModal.type === 'error' ? 'text-red-600' :
                                    alertModal.type === 'warning' ? 'text-amber-600' : 'text-green-600'
                                    }`} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{alertModal.title}</h3>
                            </div>
                        </div>
                        <p className="text-gray-600 text-sm mb-6">{alertModal.message}</p>
                        <button
                            onClick={() => setAlertModal({ ...alertModal, show: false })}
                            className={`w-full py-2.5 rounded-xl font-semibold transition-colors ${alertModal.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
                                alertModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                                    'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <AlertCircle size={24} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Unsaved Changes</h3>
                            </div>
                        </div>
                        <p className="text-gray-600 text-sm mb-6">
                            You have unsaved changes. Are you sure you want to close without saving?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal({ show: false, onConfirm: () => { } })}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
                            >
                                Discard Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArticleEditor;
