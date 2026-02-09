import React, { useState, useEffect } from 'react';
import {
  Search, Plus, ChevronDown, BookOpen, Loader2, Eye,
  FileText, Clock, User, Filter, MoreHorizontal, Edit2,
  Trash2, Send, CheckCircle2, Archive, AlertCircle, Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ArticleEditor from './ArticleEditor';
import ArticleReview from './ArticleReview';
import KBCategoryManagement from './KBCategoryManagement';
import SearchableSelect from './SearchableSelect';

interface Category {
  id: string;
  name: string;
}

interface Article {
  id: string;
  title: string;
  summary: string;
  category_id: string;
  category_name?: string;
  visibility: 'public' | 'internal';
  status: 'draft' | 'review' | 'published' | 'archived';
  author_id?: string;
  author_name?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  is_ai_enabled: boolean;
}

type StatusFilter = 'all' | 'draft' | 'review' | 'published' | 'archived';
type ViewMode = 'list' | 'card';

const KnowledgeBase: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);

  // Review state
  const [showReview, setShowReview] = useState(false);
  const [reviewingArticleId, setReviewingArticleId] = useState<string | null>(null);

  // Category Manager state
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Delete confirmation state
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; articleId: string; title: string }>({ show: false, articleId: '', title: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('kb_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setCategories(categoriesData || []);

      // Fetch articles
      const { data: articlesData } = await supabase
        .from('kb_articles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (articlesData) {
        // Map with category names
        const articlesWithCategory = articlesData.map((article: any) => {
          const category = categoriesData?.find((c: Category) => c.id === article.category_id);
          return {
            ...article,
            category_name: category?.name || 'Uncategorized',
          };
        });
        setArticles(articlesWithCategory);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArticle = () => {
    setEditingArticleId(null);
    setShowEditor(true);
  };

  const handleViewArticle = (article: Article) => {
    // If article is in review status, open review panel
    // Otherwise open editor
    if (article.status === 'review') {
      setReviewingArticleId(article.id);
      setShowReview(true);
    } else {
      setEditingArticleId(article.id);
      setShowEditor(true);
    }
  };

  const handleEditArticle = (articleId: string) => {
    setEditingArticleId(articleId);
    setShowEditor(true);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingArticleId(null);
  };

  const handleEditorSave = () => {
    fetchData();
  };

  const handleReviewClose = () => {
    setShowReview(false);
    setReviewingArticleId(null);
  };

  const handleReviewUpdate = () => {
    fetchData();
  };

  const handleDeleteArticle = (articleId: string, title: string) => {
    setDeleteModal({ show: true, articleId, title });
  };

  const confirmDelete = async () => {
    try {
      await supabase.from('kb_article_tags').delete().eq('article_id', deleteModal.articleId);
      await supabase.from('kb_articles').delete().eq('id', deleteModal.articleId);
      fetchData();
    } catch (error) {
      console.error('Error deleting article:', error);
    } finally {
      setDeleteModal({ show: false, articleId: '', title: '' });
    }
  };

  // Filter articles
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (article.summary || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || article.category_id === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Stats
  const stats = {
    total: articles.length,
    draft: articles.filter(a => a.status === 'draft').length,
    review: articles.filter(a => a.status === 'review').length,
    published: articles.filter(a => a.status === 'published').length,
    archived: articles.filter(a => a.status === 'archived').length,
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      draft: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: FileText, label: 'Draft' },
      review: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'In Review' },
      published: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Published' },
      archived: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Archive, label: 'Archived' },
    };
    const c = config[status] || config.draft;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
        <c.icon size={12} />
        {c.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-8 bg-[#f3f4f6] min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading knowledge base...</p>
        </div>
      </div>
    );
  }


  if (showCategoryManager) {
    return (
      <KBCategoryManagement onClose={() => { setShowCategoryManager(false); fetchData(); }} />
    );
  }

  if (showEditor) {
    return (
      <ArticleEditor
        articleId={editingArticleId}
        onClose={() => {
          setShowEditor(false);
          setEditingArticleId(null);
          fetchData();
        }}
        onSave={() => {
          fetchData();
        }}
      />
    );
  }

  if (showReview) {
    return (
      <ArticleReview
        articleId={reviewingArticleId!}
        onClose={() => {
          setShowReview(false);
          setReviewingArticleId(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f3f4f6] p-8 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <BookOpen size={20} className="text-white" />
            </div>
            Knowledge Base
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage articles for your service desk</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Settings size={18} />
            Manage Categories
          </button>
          <button
            onClick={handleCreateArticle}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={18} />
            Create Article
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'indigo', filter: 'all' as StatusFilter },
          { label: 'Draft', value: stats.draft, color: 'yellow', filter: 'draft' as StatusFilter },
          { label: 'In Review', value: stats.review, color: 'blue', filter: 'review' as StatusFilter },
          { label: 'Published', value: stats.published, color: 'green', filter: 'published' as StatusFilter },
          { label: 'Archived', value: stats.archived, color: 'gray', filter: 'archived' as StatusFilter },
        ].map((stat) => (
          <button
            key={stat.filter}
            onClick={() => setStatusFilter(stat.filter)}
            className={`bg-white rounded-xl p-4 border transition-all ${statusFilter === stat.filter
              ? 'border-indigo-300 ring-2 ring-indigo-100'
              : 'border-gray-100 hover:border-gray-200'
              }`}
          >
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="p-4 flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search articles by title or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="min-w-[200px]">
            <SearchableSelect
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map(cat => ({ value: cat.id, label: cat.name }))
              ]}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="All Categories"
              searchPlaceholder="Search category..."
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Articles Table */}
      <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Visibility</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredArticles.length > 0 ? (
                filteredArticles.map((article) => (
                  <tr
                    key={article.id}
                    className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                    onClick={() => handleViewArticle(article)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0 group-hover:bg-indigo-100 transition-colors">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate max-w-md group-hover:text-indigo-700 transition-colors">
                            {article.title}
                          </p>
                          {article.summary && (
                            <p className="text-xs text-gray-500 truncate max-w-md mt-0.5">
                              {article.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                        {article.category_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${article.visibility === 'public' ? 'text-green-600' : 'text-gray-600'
                        }`}>
                        {article.visibility === 'public' ? <Eye size={12} /> : <AlertCircle size={12} />}
                        {article.visibility === 'public' ? 'Public' : 'Internal'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(article.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(article.updated_at)}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewArticle(article)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={article.status === 'review' ? 'Review' : 'Edit'}
                        >
                          {article.status === 'review' ? <Eye size={16} /> : <Edit2 size={16} />}
                        </button>
                        <button
                          onClick={() => handleDeleteArticle(article.id, article.title)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <FileText size={24} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">No articles found</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Create your first knowledge base article'}
                        </p>
                      </div>
                      {!searchQuery && statusFilter === 'all' && categoryFilter === 'all' && (
                        <button
                          onClick={handleCreateArticle}
                          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                          Create Article
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{filteredArticles.length}</span> of{' '}
            <span className="font-semibold text-gray-700">{articles.length}</span> articles
          </p>
        </div>
      </div>

      {/* Article Editor Modal */}
      {showEditor && (
        <ArticleEditor
          articleId={editingArticleId}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
        />
      )}

      {/* Article Review Modal */}
      {showReview && reviewingArticleId && (
        <ArticleReview
          articleId={reviewingArticleId}
          onClose={handleReviewClose}
          onUpdate={handleReviewUpdate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Article</h3>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-2">
              Are you sure you want to delete this article?
            </p>
            <p className="text-gray-900 font-medium text-sm mb-4 p-3 bg-gray-50 rounded-lg truncate">
              "{deleteModal.title}"
            </p>
            <p className="text-red-600 text-xs mb-6 flex items-center gap-1">
              <AlertCircle size={12} />
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ show: false, articleId: '', title: '' })}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;