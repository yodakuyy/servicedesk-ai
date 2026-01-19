import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, FileText, Eye, EyeOff, Tag, Folder, Loader2,
    CheckCircle2, XCircle, RotateCcw, User, Clock, AlertTriangle,
    Sparkles, ThumbsUp, ThumbsDown, MessageSquare, Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface ArticleReviewProps {
    articleId: string;
    onClose?: () => void;
    onUpdate?: () => void;
}

interface ArticleData {
    id: string;
    title: string;
    summary: string;
    category_id: string;
    category_name?: string;
    visibility: 'public' | 'internal';
    status: string;
    content: any; // JSONB
    content_problem?: string;
    content_solution?: string;
    content_verification?: string;
    content_notes?: string;
    tags: string[];
    is_ai_enabled: boolean;
    author_id?: string;
    author_name?: string;
    created_at: string;
    updated_at: string;
}

const ArticleReview: React.FC<ArticleReviewProps> = ({ articleId, onClose, onUpdate }) => {
    const [article, setArticle] = useState<ArticleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState<'problem' | 'solution' | 'verification' | 'notes'>('problem');

    // Review actions
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishNow, setPublishNow] = useState(true);
    const [scheduleDate, setScheduleDate] = useState('');

    // Checklist state
    const [checklist, setChecklist] = useState({
        accurate: false,
        clear: false,
        safe: false
    });

    const isChecklistComplete = checklist.accurate && checklist.clear && checklist.safe;

    useEffect(() => {
        fetchArticle();
    }, [articleId]);

    const fetchArticle = async () => {
        setLoading(true);
        try {
            // Fetch article
            const { data: articleData } = await supabase
                .from('kb_articles')
                .select('*')
                .eq('id', articleId)
                .single();

            if (articleData) {
                // Auto-correct AI Usage based on Visibility (Self-healing for legacy data)
                const shouldBeEnabled = articleData.visibility === 'public';
                if (articleData.is_ai_enabled !== shouldBeEnabled) {
                    console.log(`Auto-correcting AI Usage: ${articleData.is_ai_enabled} -> ${shouldBeEnabled}`);
                    articleData.is_ai_enabled = shouldBeEnabled;

                    // Update DB in background
                    supabase
                        .from('kb_articles')
                        .update({ is_ai_enabled: shouldBeEnabled })
                        .eq('id', articleId)
                        .then(({ error }) => {
                            if (error) console.error('Failed to auto-correct AI usage', error);
                        });
                }

                // Fetch category
                const { data: categoryData } = await supabase
                    .from('kb_categories')
                    .select('name')
                    .eq('id', articleData.category_id)
                    .single();

                // Fetch tags
                const { data: tagsData } = await supabase
                    .from('kb_article_tags')
                    .select('tag')
                    .eq('article_id', articleId);

                // Fetch author
                let authorName = 'Unknown';
                if (articleData.author_id) {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', articleData.author_id)
                        .single();
                    authorName = profileData?.full_name || 'Unknown';
                }

                // Parse content if it's JSONB, or use legacy columns
                const content = articleData.content || {};

                setArticle({
                    ...articleData,
                    content_problem: content.problem || articleData.content_problem || '',
                    content_solution: content.solution || articleData.content_solution || '',
                    content_verification: content.verification || articleData.content_verification || '',
                    content_notes: content.notes || articleData.content_notes || '',
                    category_name: categoryData?.name || 'Uncategorized',
                    tags: tagsData?.map((t: any) => t.tag) || [],
                    author_name: authorName,
                });
            }
        } catch (error) {
            console.error('Error fetching article:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAI = async () => {
        if (!article) return;
        const newValue = !article.is_ai_enabled;

        // Optimistic update
        setArticle(prev => prev ? { ...prev, is_ai_enabled: newValue } : null);

        try {
            const { error } = await supabase
                .from('kb_articles')
                .update({ is_ai_enabled: newValue })
                .eq('id', articleId);

            if (error) throw error;
        } catch (error) {
            console.error('Error toggling AI:', error);
            // Revert on error
            setArticle(prev => prev ? { ...prev, is_ai_enabled: !newValue } : null);
            alert('Failed to update AI setting');
        }
    };

    const handleApproveAndPublish = async () => {
        setProcessing(true);
        try {
            const updateData: any = {
                status: 'published',
                updated_at: new Date().toISOString(),
            };

            if (publishNow) {
                updateData.published_at = new Date().toISOString();
            } else if (scheduleDate) {
                updateData.published_at = new Date(scheduleDate).toISOString();
            }

            await supabase
                .from('kb_articles')
                .update(updateData)
                .eq('id', articleId);

            setShowPublishModal(false);
            onUpdate?.();
            onClose?.();
        } catch (error) {
            console.error('Error publishing article:', error);
        } finally {
            setProcessing(false);
        }
    };

    const handleRequestChanges = async () => {
        if (!rejectComment.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Feedback Required',
                text: 'Please provide feedback for the author',
                confirmButtonColor: '#6366f1'
            });
            return;
        }

        setProcessing(true);
        try {
            // Update status back to draft
            await supabase
                .from('kb_articles')
                .update({
                    status: 'draft',
                    reviewer_feedback: rejectComment, // Store feedback in article
                    updated_at: new Date().toISOString(),
                })
                .eq('id', articleId);

            // Add internal note with the feedback
            await supabase
                .from('kb_article_internal_notes')
                .insert({
                    article_id: articleId,
                    note: `Review feedback: ${rejectComment}`,
                    note_type: 'review_feedback',
                    created_at: new Date().toISOString(),
                });

            setShowRejectModal(false);
            setRejectComment('');

            // Success notification
            await Swal.fire({
                icon: 'success',
                title: 'Changes Requested',
                text: 'Feedback has been sent to the author. The article is now back to Draft status.',
                confirmButtonColor: '#6366f1'
            });

            onUpdate?.();
            onClose?.();
        } catch (error) {
            console.error('Error requesting changes:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to request changes. Please try again.',
                confirmButtonColor: '#6366f1'
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!rejectComment.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        setProcessing(true);
        try {
            await supabase
                .from('kb_articles')
                .update({
                    status: 'archived',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', articleId);

            await supabase
                .from('kb_article_internal_notes')
                .insert({
                    article_id: articleId,
                    note: `Rejected: ${rejectComment}`,
                    note_type: 'rejection',
                    created_at: new Date().toISOString(),
                });

            setShowRejectModal(false);
            setRejectComment('');
            onUpdate?.();
            onClose?.();
        } catch (error) {
            console.error('Error rejecting article:', error);
        } finally {
            setProcessing(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const contentTabs = [
        { id: 'problem', label: 'Problem' },
        { id: 'solution', label: 'Solution' },
        { id: 'verification', label: 'Verification' },
        { id: 'notes', label: 'Notes' },
    ];

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-gray-600">Loading article for review...</p>
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-8 text-center">
                    <p className="text-gray-600">Article not found</p>
                    <button onClick={onClose} className="mt-4 text-indigo-600 font-medium">Go Back</button>
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
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Review Article</h1>
                        <p className="text-xs text-gray-500">Approve, request changes, or reject this submission</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        🔵 In Review
                    </span>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left Panel - Article Content (Read-only) */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Article Header */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">{article.title}</h2>

                            {article.summary && (
                                <p className="text-gray-600 mb-4">{article.summary}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Folder size={14} />
                                    <span>{article.category_name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                    {article.visibility === 'public' ? <Eye size={14} /> : <EyeOff size={14} />}
                                    <span>{article.visibility === 'public' ? 'Public' : 'Internal Only'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                    <User size={14} />
                                    <span>By {article.author_name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Clock size={14} />
                                    <span>{formatDate(article.updated_at)}</span>
                                </div>
                            </div>

                            {article.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                                    {article.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Content Sections */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Tabs */}
                            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-3">
                                <div className="flex gap-1">
                                    {contentTabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                                ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <div className="prose prose-sm max-w-none">
                                    {activeTab === 'problem' && (
                                        article.content_problem ? (
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100"
                                                dangerouslySetInnerHTML={{ __html: article.content_problem }}
                                            />
                                        ) : (
                                            <div className="text-gray-400 italic p-4 bg-gray-50 rounded-xl border border-gray-100">No content</div>
                                        )
                                    )}
                                    {activeTab === 'solution' && (
                                        article.content_solution ? (
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100"
                                                dangerouslySetInnerHTML={{ __html: article.content_solution }}
                                            />
                                        ) : (
                                            <div className="text-gray-400 italic p-4 bg-gray-50 rounded-xl border border-gray-100">No content</div>
                                        )
                                    )}
                                    {activeTab === 'verification' && (
                                        article.content_verification ? (
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100"
                                                dangerouslySetInnerHTML={{ __html: article.content_verification }}
                                            />
                                        ) : (
                                            <div className="text-gray-400 italic p-4 bg-gray-50 rounded-xl border border-gray-100">No content</div>
                                        )
                                    )}
                                    {activeTab === 'notes' && (
                                        article.content_notes ? (
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100"
                                                dangerouslySetInnerHTML={{ __html: article.content_notes }}
                                            />
                                        ) : (
                                            <div className="text-gray-400 italic p-4 bg-gray-50 rounded-xl border border-gray-100">No content</div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Review Actions */}
                <div className="w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto flex flex-col">
                    <div className="flex-1 space-y-6">
                        {/* AI Insights (Placeholder) */}
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles size={18} className="text-indigo-600" />
                                <h3 className="font-bold text-gray-900 text-sm">AI Review Insights</h3>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600">Readability Score</span>
                                    <span className="text-xs font-bold text-green-600">Good (85%)</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600">Completeness</span>
                                    <span className="text-xs font-bold text-green-600">Complete</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600">Similar Articles</span>
                                    <span className="text-xs font-bold text-gray-600">0 found</span>
                                </div>
                            </div>
                        </div>

                        {/* AI Toggle Status */}
                        <div className="p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700">AI Usage</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Can AI reference this article?</p>
                                </div>
                                <div
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-not-allowed opacity-80 ${article.is_ai_enabled ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    title="AI status is automatically managed by Visibility settings"
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${article.is_ai_enabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Review Checklist */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Review Checklist <span className="text-red-500">*</span></h4>

                            <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={checklist.accurate}
                                    onChange={(e) => setChecklist({ ...checklist, accurate: e.target.checked })}
                                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Content is accurate</p>
                                    <p className="text-xs text-gray-500">Information is correct and up-to-date</p>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={checklist.clear}
                                    onChange={(e) => setChecklist({ ...checklist, clear: e.target.checked })}
                                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Steps are clear</p>
                                    <p className="text-xs text-gray-500">Instructions are easy to follow</p>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={checklist.safe}
                                    onChange={(e) => setChecklist({ ...checklist, safe: e.target.checked })}
                                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-700">No sensitive data</p>
                                    <p className="text-xs text-gray-500">No passwords or confidential info</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-6 border-t border-gray-100 mt-auto">
                        <button
                            onClick={() => setShowPublishModal(true)}
                            disabled={!isChecklistComplete}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            <CheckCircle2 size={18} />
                            Approve & Publish
                        </button>

                        <button
                            onClick={() => setShowRejectModal(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
                        >
                            <RotateCcw size={18} />
                            Request Changes
                        </button>

                        <button
                            onClick={() => {
                                setShowRejectModal(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-red-600 border border-red-200 rounded-xl font-semibold hover:bg-red-50 transition-colors"
                        >
                            <XCircle size={18} />
                            Reject
                        </button>
                    </div>
                </div>
            </div>

            {/* Publish Modal */}
            {showPublishModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={24} className="text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Publish Article</h3>
                                <p className="text-sm text-gray-500">Choose publishing options</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="radio"
                                    name="publishType"
                                    checked={publishNow}
                                    onChange={() => setPublishNow(true)}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                <div>
                                    <p className="font-semibold text-gray-900">Publish Now</p>
                                    <p className="text-xs text-gray-500">Article will be available immediately</p>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="radio"
                                    name="publishType"
                                    checked={!publishNow}
                                    onChange={() => setPublishNow(false)}
                                    className="w-4 h-4 text-indigo-600 mt-1"
                                />
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900">Schedule Publish</p>
                                    <p className="text-xs text-gray-500 mb-2">Set a future publish date</p>
                                    {!publishNow && (
                                        <input
                                            type="datetime-local"
                                            value={scheduleDate}
                                            onChange={(e) => setScheduleDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    )}
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowPublishModal(false)}
                                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApproveAndPublish}
                                disabled={processing || (!publishNow && !scheduleDate)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                Publish
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Request Changes / Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <MessageSquare size={24} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Provide Feedback</h3>
                                <p className="text-sm text-gray-500">Explain what needs to be changed</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Feedback <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={rejectComment}
                                onChange={(e) => setRejectComment(e.target.value)}
                                placeholder="Describe what needs improvement or why this is being rejected..."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectComment('');
                                }}
                                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRequestChanges}
                                disabled={processing || !rejectComment.trim()}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                            >
                                {processing ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                Request Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Styles for rendered HTML content */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .prose img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                    margin: 12px 0;
                    border: 1px solid #e5e7eb;
                }
                .prose p {
                    margin-bottom: 0.75rem;
                }
                .prose ul, .prose ol {
                    padding-left: 1.5rem;
                    margin-bottom: 0.75rem;
                }
                .prose blockquote {
                    border-left: 3px solid #e5e7eb;
                    padding-left: 1rem;
                    margin-left: 0;
                    color: #6b7280;
                    font-style: italic;
                }
            `}} />
        </div>
    );
};

export default ArticleReview;
