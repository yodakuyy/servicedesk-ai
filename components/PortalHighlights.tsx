import React, { useState, useEffect } from 'react';
import {
    Plus, Edit3, Trash2, X, Check, Image, Type, Monitor,
    GripVertical, ToggleLeft, ToggleRight, RefreshCw, Search,
    ArrowUp, ArrowDown, Eye, Link2, Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PortalHighlight {
    id: string;
    title: string;
    subtitle: string | null;
    image_url: string | null;
    slide_type: 'image' | 'component';
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const PortalHighlights: React.FC = () => {
    const [highlights, setHighlights] = useState<PortalHighlight[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        title: '',
        subtitle: '',
        image_url: '',
        slide_type: 'image' as 'image' | 'component',
        is_active: true,
    });
    const [saving, setSaving] = useState(false);

    // Preview
    const [previewId, setPreviewId] = useState<string | null>(null);

    // Delete
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        fetchHighlights();
    }, []);

    const fetchHighlights = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('portal_highlights')
                .select('*')
                .order('sort_order', { ascending: true });
            if (error) throw error;
            setHighlights(data || []);
        } catch (err) {
            console.error('Error fetching portal highlights:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (editingId) {
                const { error } = await supabase
                    .from('portal_highlights')
                    .update({
                        title: form.title.trim(),
                        subtitle: form.subtitle.trim() || null,
                        image_url: form.slide_type === 'image' ? (form.image_url.trim() || null) : null,
                        slide_type: form.slide_type,
                        is_active: form.is_active,
                    })
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const maxOrder = highlights.length > 0 ? Math.max(...highlights.map(h => h.sort_order)) + 1 : 0;
                const { error } = await supabase
                    .from('portal_highlights')
                    .insert({
                        title: form.title.trim(),
                        subtitle: form.subtitle.trim() || null,
                        image_url: form.slide_type === 'image' ? (form.image_url.trim() || null) : null,
                        slide_type: form.slide_type,
                        sort_order: maxOrder,
                        is_active: form.is_active,
                        created_by: user?.id || null,
                    });
                if (error) throw error;
            }
            closeModal();
            fetchHighlights();
        } catch (err) {
            console.error('Error saving highlight:', err);
        } finally {
            setSaving(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setForm({ title: '', subtitle: '', image_url: '', slide_type: 'image', is_active: true });
    };

    const handleEdit = (h: PortalHighlight) => {
        setEditingId(h.id);
        setForm({
            title: h.title,
            subtitle: h.subtitle || '',
            image_url: h.image_url || '',
            slide_type: h.slide_type,
            is_active: h.is_active,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('portal_highlights').delete().eq('id', id);
            if (error) throw error;
            setDeleteId(null);
            fetchHighlights();
        } catch (err) {
            console.error('Error deleting highlight:', err);
        }
    };

    const handleToggleActive = async (id: string, current: boolean) => {
        try {
            const { error } = await supabase.from('portal_highlights').update({ is_active: !current }).eq('id', id);
            if (error) throw error;
            fetchHighlights();
        } catch (err) {
            console.error('Error toggling:', err);
        }
    };

    const handleMoveOrder = async (id: string, direction: 'up' | 'down') => {
        const idx = highlights.findIndex(h => h.id === id);
        if (idx < 0) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= highlights.length) return;

        const currentOrder = highlights[idx].sort_order;
        const swapOrder = highlights[swapIdx].sort_order;

        try {
            await supabase.from('portal_highlights').update({ sort_order: swapOrder }).eq('id', highlights[idx].id);
            await supabase.from('portal_highlights').update({ sort_order: currentOrder }).eq('id', highlights[swapIdx].id);
            fetchHighlights();
        } catch (err) {
            console.error('Error reordering:', err);
        }
    };

    const previewHighlight = highlights.find(h => h.id === previewId);

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-purple-200">
                        <Layers size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Portal Highlights</h1>
                        <p className="text-sm text-gray-500 font-medium">Manage the login page carousel slides</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setForm({ title: '', subtitle: '', image_url: '', slide_type: 'image', is_active: true });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5"
                >
                    <Plus size={18} /> New Slide
                </button>
            </div>

            {/* Info Banner */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg flex-shrink-0 mt-0.5">
                    <Monitor size={16} />
                </div>
                <div>
                    <p className="text-sm font-bold text-indigo-800">Login Page Carousel</p>
                    <p className="text-xs text-indigo-600/70 mt-0.5">These slides appear on the right side of the login page. Active slides auto-rotate every 5 seconds. You can reorder them using the arrow buttons.</p>
                </div>
            </div>

            {/* Slides List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-sm text-gray-400 font-bold">Loading slides...</p>
                    </div>
                ) : highlights.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
                        <div className="p-4 bg-gray-50 rounded-full mb-4">
                            <Image size={32} className="text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-700 mb-1">No Slides Found</h3>
                        <p className="text-sm text-gray-400">Add slides to display on the login page carousel.</p>
                    </div>
                ) : (
                    highlights.map((h, idx) => (
                        <div
                            key={h.id}
                            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md group ${h.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}
                        >
                            <div className="flex items-stretch">
                                {/* Sort Handle & Order */}
                                <div className="flex flex-col items-center justify-center px-3 bg-gray-50/50 border-r border-gray-100 gap-1">
                                    <button
                                        onClick={() => handleMoveOrder(h.id, 'up')}
                                        disabled={idx === 0}
                                        className="p-1 hover:bg-indigo-50 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <span className="text-[10px] font-black text-gray-400 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-lg">{idx + 1}</span>
                                    <button
                                        onClick={() => handleMoveOrder(h.id, 'down')}
                                        disabled={idx === highlights.length - 1}
                                        className="p-1 hover:bg-indigo-50 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                    >
                                        <ArrowDown size={14} />
                                    </button>
                                </div>

                                {/* Thumbnail */}
                                <div className="w-36 h-24 flex-shrink-0 bg-gray-100 relative overflow-hidden">
                                    {h.slide_type === 'image' && h.image_url ? (
                                        <img src={h.image_url} alt={h.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                                            <Monitor size={28} className="text-white/60" />
                                        </div>
                                    )}
                                    {/* Type badge */}
                                    <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${h.slide_type === 'component' ? 'bg-violet-600 text-white' : 'bg-white/90 text-gray-600'}`}>
                                        {h.slide_type === 'component' ? 'Widget' : 'Image'}
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-4 flex items-center">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-black text-gray-800 text-sm truncate">{h.title}</h3>
                                            {h.is_active ? (
                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 flex-shrink-0">Active</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-gray-100 text-gray-500 flex-shrink-0">Hidden</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 line-clamp-1">{h.subtitle || 'No subtitle'}</p>
                                        {h.slide_type === 'image' && h.image_url && (
                                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-300 font-medium">
                                                <Link2 size={10} />
                                                <span className="truncate max-w-[300px]">{h.image_url}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-4">
                                        <button
                                            onClick={() => setPreviewId(h.id)}
                                            className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all"
                                            title="Preview"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(h.id, h.is_active)}
                                            className={`p-2 rounded-lg transition-all ${h.is_active ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-emerald-50 text-emerald-500'}`}
                                            title={h.is_active ? 'Hide' : 'Show'}
                                        >
                                            {h.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                        </button>
                                        <button onClick={() => handleEdit(h)} className="p-2 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-lg transition-all" title="Edit">
                                            <Edit3 size={16} />
                                        </button>
                                        <button onClick={() => setDeleteId(h.id)} className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-all" title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Stats Footer */}
            <div className="mt-6 flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                <span>{highlights.length} total slides</span>
                <span>{highlights.filter(h => h.is_active).length} active on login</span>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">{editingId ? 'Edit Slide' : 'New Slide'}</h2>
                                    <p className="text-xs text-gray-400">Displayed on login page carousel</p>
                                </div>
                            </div>
                            <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Slide Type */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Slide Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setForm(f => ({ ...f, slide_type: 'image' }))}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.slide_type === 'image' ? 'border-indigo-400 bg-indigo-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                    >
                                        <Image size={20} className={form.slide_type === 'image' ? 'text-indigo-600' : 'text-gray-400'} />
                                        <span className={`text-xs font-bold ${form.slide_type === 'image' ? 'text-indigo-700' : 'text-gray-500'}`}>Image Slide</span>
                                    </button>
                                    <button
                                        onClick={() => setForm(f => ({ ...f, slide_type: 'component' }))}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.slide_type === 'component' ? 'border-violet-400 bg-violet-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                    >
                                        <Monitor size={20} className={form.slide_type === 'component' ? 'text-violet-600' : 'text-gray-400'} />
                                        <span className={`text-xs font-bold ${form.slide_type === 'component' ? 'text-violet-700' : 'text-gray-500'}`}>Widget (Default)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Title</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. New IT Service Available"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all"
                                />
                            </div>

                            {/* Subtitle */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Subtitle</label>
                                <textarea
                                    value={form.subtitle}
                                    onChange={(e) => setForm(f => ({ ...f, subtitle: e.target.value }))}
                                    placeholder="Short description shown below the title..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all resize-none"
                                />
                            </div>

                            {/* Image URL - Only for image type */}
                            {form.slide_type === 'image' && (
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Image URL</label>
                                    <input
                                        type="url"
                                        value={form.image_url}
                                        onChange={(e) => setForm(f => ({ ...f, image_url: e.target.value }))}
                                        placeholder="https://images.unsplash.com/..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all"
                                    />
                                    {/* Image Preview */}
                                    {form.image_url && (
                                        <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 h-32 bg-gray-100">
                                            <img
                                                src={form.image_url}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <p className="text-sm font-bold text-gray-700">Show on Login</p>
                                    <p className="text-xs text-gray-400">Display this slide on the login carousel</p>
                                </div>
                                <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} className={`p-1 rounded-full transition-all ${form.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {form.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                </button>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                            <button onClick={closeModal} className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.title.trim()}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {saving ? <><RefreshCw size={16} className="animate-spin" /> Saving...</> : <><Check size={16} /> {editingId ? 'Update' : 'Create'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewId && previewHighlight && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-gray-700 flex items-center gap-2">
                                <Eye size={16} className="text-indigo-500" /> Slide Preview
                            </h3>
                            <button onClick={() => setPreviewId(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-all">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="aspect-[16/9] relative overflow-hidden bg-indigo-600">
                            {previewHighlight.slide_type === 'image' && previewHighlight.image_url ? (
                                <>
                                    <img src={previewHighlight.image_url} alt={previewHighlight.title} className="w-full h-full object-cover opacity-90" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/95 via-indigo-900/20 to-transparent" />
                                </>
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                                    <Monitor size={64} className="text-white/20" />
                                </div>
                            )}
                            <div className="absolute bottom-8 left-0 right-0 text-center text-white space-y-2 px-8">
                                <h2 className="text-2xl font-bold">{previewHighlight.title}</h2>
                                {previewHighlight.subtitle && (
                                    <p className="text-white/80 text-sm max-w-md mx-auto">{previewHighlight.subtitle}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-8 text-center">
                        <div className="p-4 bg-rose-50 rounded-full w-fit mx-auto mb-4">
                            <Trash2 size={28} className="text-rose-500" />
                        </div>
                        <h3 className="text-lg font-black text-gray-900 mb-2">Delete Slide?</h3>
                        <p className="text-sm text-gray-500 mb-6">This slide will be permanently removed from the login carousel.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
                                Cancel
                            </button>
                            <button onClick={() => deleteId && handleDelete(deleteId)} className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortalHighlights;
