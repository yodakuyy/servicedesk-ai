import React, { useState, useEffect } from 'react';
import {
    Plus, Edit3, Trash2, X, Check, Calendar as CalendarIcon,
    Search, RefreshCw, Clock, Globe, Lock, AlertCircle, Trash
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

interface CalendarEvent {
    id: string;
    title: string;
    description: string;
    event_date: string;
    category_name: string;
    company_id: number | null;
    is_public: boolean;
    created_at: string;
    company?: { company_name: string } | null;
}

const CalendarManagement: React.FC = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [companies, setCompanies] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        title: '',
        description: '',
        event_date: new Date().toISOString().split('T')[0],
        category_name: 'Internal Event',
        company_id: null as number | null,
        is_public: true
    });

    useEffect(() => {
        fetchEvents();
        fetchCompanies();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('ticket_categories')
            .select('id, name')
            .eq('show_on_calendar', true)
            .order('name');
        if (data) setCategories(data);
    };

    const fetchCompanies = async () => {
        const { data } = await supabase.from('company').select('company_id, company_name').order('company_name');
        if (data) setCompanies(data);
    };

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('calendar_events')
                .select('*, company:company!company_id(company_name)')
                .order('event_date', { ascending: false });

            if (error) throw error;
            setEvents(data || []);
        } catch (err) {
            console.error('Error fetching calendar events:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.event_date) {
            Swal.fire('Error', 'Title and Date are required!', 'error');
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // --- AVAILABILITY CHECK ---
            const targetDate = form.event_date; // YYYY-MM-DD

            // 1. Check for conflicting approved tickets using the same parser logic as dashboard
            const { data: allTickets } = await supabase
                .from('tickets')
                .select('id, subject, description, ticket_statuses!status_id!inner(status_name)');
            
            if (allTickets) {
                const conflict = allTickets.find(t => {
                    if ((t.ticket_statuses as any)?.status_name?.toLowerCase() !== 'approved') return false;
                    
                    const desc = t.description || '';
                    const dateCellRegex = /<td[^>]*>Event Date.*?<\/td>\s*<td[^>]*>(.*?)<\/td>/i;
                    const dateCellMatch = desc.match(dateCellRegex);
                    let rawDate = "";
                    
                    if (dateCellMatch) {
                        rawDate = dateCellMatch[1].replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, '').trim();
                    } else {
                        const generalDateRegex = /(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/;
                        const generalMatch = desc.match(generalDateRegex);
                        if (generalMatch) rawDate = generalMatch[0];
                    }
                    
                    if (!rawDate) return false;

                    let eventDate: Date;
                    const namedMonthRegex = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/;
                    const namedMatch = rawDate.match(namedMonthRegex);
                    
                    if (namedMatch) {
                        const day = parseInt(namedMatch[1]);
                        const monthStr = namedMatch[2].toLowerCase();
                        const year = parseInt(namedMatch[3]);
                        const months: { [key: string]: number } = {
                            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'may': 4, 'jun': 5,
                            'jul': 6, 'agu': 7, 'ags': 7, 'aug': 7, 'sep': 8, 'okt': 9, 'oct': 9,
                            'nov': 10, 'des': 11, 'dec': 11
                        };
                        const month = months[monthStr.substring(0, 3)] ?? 0;
                        eventDate = new Date(year, month, day);
                    } else {
                        eventDate = new Date(rawDate);
                    }

                    if (isNaN(eventDate.getTime())) return false;
                    const isoDate = eventDate.toISOString().split('T')[0];
                    return isoDate === targetDate;
                });

                if (conflict) {
                    let eventName = conflict.subject;
                    const eventNameRegex = /<td[^>]*>Event Name<\/td>\s*<td[^>]*>(.*?)<\/td>/i;
                    const nameMatch = conflict.description?.match(eventNameRegex);
                    if (nameMatch && nameMatch[1]) {
                        eventName = nameMatch[1].replace(/<[^>]*>/g, '').trim();
                    }
                    throw new Error(`The date ${targetDate} is already BOOKED by: "${eventName}".`);
                }
            }

            // 2. Check for conflicting manual events
            const { data: manualConflict } = await supabase
                .from('calendar_events')
                .select('id, title')
                .eq('event_date', targetDate)
                .eq('category_name', form.category_name)
                .neq('id', editingId || '00000000-0000-0000-0000-000000000000'); // Exclude current if editing

            if (manualConflict && manualConflict.length > 0) {
                throw new Error(`The date ${targetDate} is already taken by another manual event: "${manualConflict[0].title}".`);
            }

            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                event_date: form.event_date,
                category_name: form.category_name,
                company_id: form.company_id,
                is_public: form.is_public,
                created_by: user?.id
            };

            if (editingId) {
                const { error } = await supabase
                    .from('calendar_events')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
                Swal.fire('Success', 'Event updated successfully!', 'success');
            } else {
                const { error } = await supabase
                    .from('calendar_events')
                    .insert(payload);
                if (error) throw error;
                Swal.fire('Success', 'Event created successfully!', 'success');
            }

            setIsModalOpen(false);
            setEditingId(null);
            resetForm();
            fetchEvents();
        } catch (err: any) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setForm({
            title: '',
            description: '',
            event_date: new Date().toISOString().split('T')[0],
            category_name: 'Internal Event',
            company_id: null,
            is_public: true
        });
    };

    const handleEdit = (ev: CalendarEvent) => {
        setEditingId(ev.id);
        setForm({
            title: ev.title,
            description: ev.description || '',
            event_date: ev.event_date,
            category_name: ev.category_name || 'Internal Event',
            company_id: ev.company_id,
            is_public: ev.is_public
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: 'Delete Event?',
            text: "This will remove the event from all calendars.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                const { error } = await supabase.from('calendar_events').delete().eq('id', id);
                if (error) throw error;
                setEvents(events.filter(e => e.id !== id));
                Swal.fire('Deleted!', 'Event has been removed.', 'success');
            } catch (err: any) {
                Swal.fire('Error', err.message, 'error');
            }
        }
    };

    const filteredEvents = events.filter(e =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (e.category_name && e.category_name.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200">
                        <CalendarIcon size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Calendar Management</h1>
                        <p className="text-sm text-gray-500 font-medium">Create and manage manual entries for the public calendar</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5"
                >
                    <Plus size={18} /> Add Event
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all"
                    />
                </div>
                <button onClick={fetchEvents} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-all">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                    <div className="col-span-full bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-sm text-gray-400 font-bold">Loading entries...</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
                        <div className="p-4 bg-gray-50 rounded-full mb-4">
                            <CalendarIcon size={32} className="text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-700 mb-1">No Entries Found</h3>
                        <p className="text-sm text-gray-400 max-w-md">Add a manual entry to show it on the Public Events calendar.</p>
                    </div>
                ) : (
                    filteredEvents.map(ev => (
                        <div
                            key={ev.id}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between group hover:border-indigo-200 transition-all"
                        >
                            <div className="flex gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl flex-shrink-0">
                                    <CalendarIcon size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-900 truncate">{ev.title}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1 text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                                            {ev.category_name}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-gray-400 font-bold uppercase tracking-wider">
                                            <Clock size={12} />
                                            {new Date(ev.event_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{ev.description || 'No description provided.'}</p>
                                    <div className="flex items-center gap-3 mt-3">
                                        {ev.is_public ? (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest"><Globe size={10} /> Public</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase tracking-widest"><Lock size={10} /> Private</span>
                                        )}
                                        {ev.company?.company_name && (
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-l pl-3">{ev.company.company_name}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                                <button
                                    onClick={() => handleEdit(ev)}
                                    className="p-2 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-lg transition-all"
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(ev.id)}
                                    className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <CalendarIcon size={20} />
                                </div>
                                <h2 className="text-lg font-black text-gray-900">{editingId ? 'Edit Event' : 'Add New Event'}</h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Title</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="e.g. Office Annual Meeting"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Event Date</label>
                                    <input
                                        type="date"
                                        value={form.event_date}
                                        onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Category</label>
                                    <select
                                        value={form.category_name}
                                        onChange={(e) => setForm({ ...form, category_name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                                    >
                                        <option value="Internal Event">Internal Event</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Event details..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Department Isolation</label>
                                    <select
                                        value={form.company_id || ''}
                                        onChange={(e) => setForm({ ...form, company_id: e.target.value ? Number(e.target.value) : null })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer"
                                    >
                                        <option value="">Global / All Departments</option>
                                        {companies.map(c => (
                                            <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Visibility</label>
                                    <div className="flex items-center gap-2 h-[42px] px-2">
                                        <button
                                            onClick={() => setForm({ ...form, is_public: !form.is_public })}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${form.is_public
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                : 'bg-amber-50 text-amber-600 border-amber-200'
                                                }`}
                                        >
                                            {form.is_public ? <><Globe size={12} /> Public</> : <><Lock size={12} /> Admin Only</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? <><RefreshCw size={16} className="animate-spin" /> Saving...</> : <><Check size={16} /> {editingId ? 'Update' : 'Create'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarManagement;
