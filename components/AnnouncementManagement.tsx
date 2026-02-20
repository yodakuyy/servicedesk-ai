import React, { useState, useEffect } from 'react';
import {
    Plus, Edit3, Trash2, X, Check, AlertCircle, Info, AlertTriangle,
    Megaphone, ToggleLeft, ToggleRight, Clock, Search, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'alert';
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    creator?: { full_name: string } | null;
}

const AnnouncementManagement: React.FC = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'info' | 'warning' | 'alert'>('all');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ title: '', content: '', type: 'info' as 'info' | 'warning' | 'alert', is_active: true });
    const [saving, setSaving] = useState(false);

    // Delete confirmation
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*, creator:profiles!created_by(full_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAnnouncements(data || []);
        } catch (err) {
            console.error('Error fetching announcements:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.content.trim()) return;
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (editingId) {
                const { error } = await supabase
                    .from('announcements')
                    .update({
                        title: form.title.trim(),
                        content: form.content.trim(),
                        type: form.type,
                        is_active: form.is_active,
                    })
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('announcements')
                    .insert({
                        title: form.title.trim(),
                        content: form.content.trim(),
                        type: form.type,
                        is_active: form.is_active,
                        created_by: user?.id || null,
                    });
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
            setForm({ title: '', content: '', type: 'info', is_active: true });
            fetchAnnouncements();
        } catch (err) {
            console.error('Error saving announcement:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (a: Announcement) => {
        setEditingId(a.id);
        setForm({ title: a.title, content: a.content, type: a.type, is_active: a.is_active });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('announcements').delete().eq('id', id);
            if (error) throw error;
            setDeleteId(null);
            fetchAnnouncements();
        } catch (err) {
            console.error('Error deleting announcement:', err);
        }
    };

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        try {
            const { error } = await supabase
                .from('announcements')
                .update({ is_active: !currentActive })
                .eq('id', id);
            if (error) throw error;
            fetchAnnouncements();
        } catch (err) {
            console.error('Error toggling announcement:', err);
        }
    };

    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'warning':
                return { icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', badge: 'bg-amber-100 text-amber-700', label: 'Warning' };
            case 'alert':
                return { icon: AlertCircle, bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', badge: 'bg-rose-100 text-rose-700', label: 'Alert' };
            default:
                return { icon: Info, bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', badge: 'bg-blue-100 text-blue-700', label: 'Info' };
        }
    };

    const filteredAnnouncements = announcements.filter(a => {
        const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
        const matchType = filterType === 'all' || a.type === filterType;
        const matchActive = filterActive === 'all' || (filterActive === 'active' ? a.is_active : !a.is_active);
        return matchSearch && matchType && matchActive;
    });

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200">
                        <Megaphone size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Announcement Management</h1>
                        <p className="text-sm text-gray-500 font-medium">Manage announcements displayed on the user dashboard</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setForm({ title: '', content: '', type: 'info', is_active: true });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5"
                >
                    <Plus size={18} /> New Announcement
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search announcements..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {(['all', 'info', 'warning', 'alert'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setFilterType(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${filterType === t
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                        >
                            {t === 'all' ? 'All Types' : t}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {(['all', 'active', 'inactive'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterActive(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${filterActive === s
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                        >
                            {s === 'all' ? 'All Status' : s}
                        </button>
                    ))}
                </div>
                <button onClick={fetchAnnouncements} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-all">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Announcements List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-sm text-gray-400 font-bold">Loading announcements...</p>
                    </div>
                ) : filteredAnnouncements.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
                        <div className="p-4 bg-gray-50 rounded-full mb-4">
                            <Megaphone size={32} className="text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-700 mb-1">No Announcements Found</h3>
                        <p className="text-sm text-gray-400 max-w-md">Create your first announcement to display on the user dashboard.</p>
                    </div>
                ) : (
                    filteredAnnouncements.map(a => {
                        const typeConfig = getTypeConfig(a.type);
                        const TypeIcon = typeConfig.icon;
                        return (
                            <div
                                key={a.id}
                                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md group ${a.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}
                            >
                                <div className="flex items-stretch">
                                    {/* Type Indicator */}
                                    <div className={`w-1.5 ${a.type === 'warning' ? 'bg-amber-400' : a.type === 'alert' ? 'bg-rose-400' : 'bg-blue-400'}`}></div>

                                    <div className="flex-1 p-5 flex items-center gap-5">
                                        {/* Icon */}
                                        <div className={`p-3 rounded-xl ${typeConfig.bg} ${typeConfig.text} flex-shrink-0`}>
                                            <TypeIcon size={22} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-black text-gray-800 text-base truncate">{a.title}</h3>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${typeConfig.badge}`}>
                                                    {typeConfig.label}
                                                </span>
                                                {a.is_active ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">Active</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-500">Inactive</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 line-clamp-1">{a.content}</p>
                                            <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {new Date(a.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {a.creator?.full_name && (
                                                    <span>by {a.creator.full_name}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <button
                                                onClick={() => handleToggleActive(a.id, a.is_active)}
                                                className={`p-2 rounded-lg transition-all ${a.is_active
                                                    ? 'hover:bg-amber-50 text-amber-500 hover:text-amber-600'
                                                    : 'hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600'
                                                    }`}
                                                title={a.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                {a.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(a)}
                                                className="p-2 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-lg transition-all"
                                                title="Edit"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteId(a.id)}
                                                className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Stats Footer */}
            <div className="mt-6 flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                <span>{filteredAnnouncements.length} of {announcements.length} announcements</span>
                <span>{announcements.filter(a => a.is_active).length} active</span>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Megaphone size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
                                    <p className="text-xs text-gray-400 font-medium">This will be displayed on the user dashboard</p>
                                </div>
                            </div>
                            <button onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Title */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Title</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Scheduled Maintenance Tonight"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Message</label>
                                <textarea
                                    value={form.content}
                                    onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                                    placeholder="Write the announcement message..."
                                    rows={4}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all resize-none"
                                />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Type</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {([
                                        { value: 'info', label: 'Info', icon: Info, color: 'blue' },
                                        { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'amber' },
                                        { value: 'alert', label: 'Alert', icon: AlertCircle, color: 'rose' },
                                    ] as const).map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setForm(f => ({ ...f, type: t.value }))}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.type === t.value
                                                ? `border-${t.color}-400 bg-${t.color}-50 shadow-md`
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                                }`}
                                        >
                                            <t.icon size={20} className={form.type === t.value ? `text-${t.color}-600` : 'text-gray-400'} />
                                            <span className={`text-xs font-bold ${form.type === t.value ? `text-${t.color}-700` : 'text-gray-500'}`}>{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <p className="text-sm font-bold text-gray-700">Active Status</p>
                                    <p className="text-xs text-gray-400">Show this announcement on the dashboard</p>
                                </div>
                                <button
                                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                                    className={`p-1 rounded-full transition-all ${form.is_active ? 'text-emerald-600' : 'text-gray-400'}`}
                                >
                                    {form.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                            <button
                                onClick={() => { setIsModalOpen(false); setEditingId(null); }}
                                className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.title.trim() || !form.content.trim()}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {saving ? (
                                    <><RefreshCw size={16} className="animate-spin" /> Saving...</>
                                ) : (
                                    <><Check size={16} /> {editingId ? 'Update' : 'Create'}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-8 text-center">
                        <div className="p-4 bg-rose-50 rounded-full w-fit mx-auto mb-4">
                            <Trash2 size={28} className="text-rose-500" />
                        </div>
                        <h3 className="text-lg font-black text-gray-900 mb-2">Delete Announcement?</h3>
                        <p className="text-sm text-gray-500 mb-6">This action cannot be undone. The announcement will be permanently removed.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteId && handleDelete(deleteId)}
                                className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
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

export default AnnouncementManagement;
