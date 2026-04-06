import React from 'react';
import {
    Bell,
    CheckCircle2,
    Trash2,
    Calendar,
    Filter,
    ArrowLeft,
    Inbox,
    ExternalLink,
    Clock,
    Search,
    Check
} from 'lucide-react';
import { useNotifications, Notification, formatRelativeTime, getNotificationColor, getNotificationIcon } from '../hooks/useNotifications';
import {
    MessageSquare,
    AlertTriangle,
    CheckCircle,
    XCircle,
    PartyPopper,
    Ticket
} from 'lucide-react';

interface AllNotificationsProps {
    userId: string | null;
    onBack: () => void;
    onNavigateTicket: (id: string, companyId?: number | null) => void;
}

const AllNotifications: React.FC<AllNotificationsProps> = ({ userId, onBack, onNavigateTicket }) => {
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll
    } = useNotifications(userId);

    const [filter, setFilter] = React.useState<'all' | 'unread'>('all');
    const [searchQuery, setSearchQuery] = React.useState('');

    const filteredNotifications = notifications.filter(n => {
        const matchesFilter = filter === 'all' || !n.is_read;
        const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (n.message || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getIcon = (type: Notification['type']) => {
        const iconProps = { size: 20 };
        switch (type) {
            case 'ticket_new':
            case 'ticket_assigned':
                return <Ticket {...iconProps} />;
            case 'ticket_reply':
                return <MessageSquare {...iconProps} />;
            case 'sla_warning':
            case 'escalation':
                return <AlertTriangle {...iconProps} />;
            case 'success':
                return <CheckCircle {...iconProps} />;
            case 'error':
                return <XCircle {...iconProps} />;
            case 'user_confirmed':
                return <PartyPopper {...iconProps} />;
            default:
                return <Bell {...iconProps} />;
        }
    };

    if (loading) {
        return (
            <div className="p-8 max-w-5xl mx-auto h-full flex flex-col items-center justify-center">
                <div className="animate-spin text-indigo-600 mb-4">
                    <Bell size={40} />
                </div>
                <p className="text-gray-500 font-medium">Loading your notifications...</p>
            </div>
        );
    }

    return (
        <div className="px-8 pb-8 pt-4 max-w-5xl mx-auto h-[calc(100vh-100px)] flex flex-col bg-[#f3f4f6]">
            {/* Header Area */}
            <div className="mb-6 flex-shrink-0">
                <div className="flex items-center gap-4 mb-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-white rounded-xl transition-colors text-gray-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-3 uppercase">
                            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <Inbox size={22} />
                            </div>
                            Inbox Notifications
                        </h1>
                        <p className="text-gray-500 text-sm font-medium mt-1">Review and manage your system updates and ticket alerts.</p>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All Updates
                            </button>
                            <button
                                onClick={() => setFilter('unread')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'unread' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Unread {unreadCount > 0 && `(${unreadCount})`}
                            </button>
                        </div>
                        <div className="h-6 w-px bg-gray-100 mx-2" />
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Search notifications..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-1.5 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-medium w-64 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={markAllAsRead}
                            disabled={unreadCount === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                        >
                            <Check size={14} /> Mark all as read
                        </button>
                        <button
                            onClick={clearAll}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                        >
                            <Trash2 size={14} /> Clear list
                        </button>
                    </div>
                </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 min-h-0 overflow-auto bg-white rounded-3xl shadow-sm border border-gray-100 custom-scrollbar">
                {filteredNotifications.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Bell size={32} className="text-gray-200" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-700">No notifications found</h3>
                        <p className="text-gray-400 max-w-xs mt-2">
                            {searchQuery ? `No updates match "${searchQuery}"` : "You're all caught up! New updates will appear here."}
                        </p>
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="mt-4 text-indigo-600 font-bold text-sm hover:underline"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {filteredNotifications.map((notif) => (
                            <div 
                                key={notif.id}
                                onClick={() => {
                                    if (!notif.is_read) markAsRead(notif.id);
                                    if (notif.reference_type === 'ticket' && notif.reference_id) {
                                        onNavigateTicket(notif.reference_id, notif.company_id);
                                    }
                                }}
                                className={`p-6 flex gap-5 hover:bg-gray-50/80 transition-all cursor-pointer group border-l-4 ${!notif.is_read ? 'bg-indigo-50/30 border-indigo-600' : 'border-transparent'}`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${getNotificationColor(notif.type)}`}>
                                    {getIcon(notif.type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4 mb-1">
                                        <div>
                                            <h4 className={`text-base ${!notif.is_read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                                                {notif.title}
                                            </h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                                    <Clock size={12} /> {formatRelativeTime(notif.created_at)}
                                                </span>
                                                <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                                    {notif.type.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {!notif.is_read && (
                                                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-gray-600 text-sm leading-relaxed mb-4 max-w-3xl">
                                        {notif.message}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {notif.reference_type === 'ticket' && (
                                                <button className="px-4 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 uppercase tracking-widest">
                                                    <ExternalLink size={14} /> Open Ticket
                                                </button>
                                            )}
                                        </div>

                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                            {!notif.is_read && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                                    className="p-2 text-indigo-600 hover:bg-white rounded-lg transition-all"
                                                    title="Mark as read"
                                                >
                                                    <Check size={18} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                                                className="p-2 text-rose-500 hover:bg-white rounded-lg transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Footer Tip */}
            <div className="mt-6 flex items-center gap-2 text-gray-400 text-xs font-medium justify-center italic">
                <CheckCircle2 size={14} className="text-indigo-400" />
                Notifications older than 30 days are automatically cleaned up to keep your inbox snappy.
            </div>
        </div>
    );
};

export default AllNotifications;
