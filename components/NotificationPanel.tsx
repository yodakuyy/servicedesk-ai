import React from 'react';
import {
    Bell,
    Ticket,
    MessageSquare,
    AlertTriangle,
    CheckCircle,
    XCircle,
    AlertCircle,
    X,
    Check,
    Trash2,
    ExternalLink,
    PartyPopper
} from 'lucide-react';
import { Notification, formatRelativeTime, getNotificationColor } from '../hooks/useNotifications';

interface NotificationPanelProps {
    notifications: Notification[];
    unreadCount: number;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onDelete: (id: string) => void;
    onClearAll: () => void;
    onClose: () => void;
    onNavigate?: (referenceType: string, referenceId: string) => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
    notifications,
    unreadCount,
    onMarkAsRead,
    onMarkAllAsRead,
    onDelete,
    onClearAll,
    onClose,
    onNavigate
}) => {
    const getIcon = (type: Notification['type']) => {
        const iconProps = { size: 18 };
        switch (type) {
            case 'ticket_new':
            case 'ticket_assigned':
                return <Ticket {...iconProps} />;
            case 'ticket_reply':
                return <MessageSquare {...iconProps} />;
            case 'sla_warning':
            case 'escalation':
            case 'warning':
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

    const handleNotificationClick = (notif: Notification) => {
        if (!notif.is_read) {
            onMarkAsRead(notif.id);
        }
        if (notif.reference_type && notif.reference_id && onNavigate) {
            onNavigate(notif.reference_type, notif.reference_id);
            onClose();
        }
    };

    return (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <Bell size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">Notifikasi</h3>
                        <p className="text-white/70 text-xs">
                            {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                    <X size={18} className="text-white" />
                </button>
            </div>

            {/* Actions Bar */}
            {notifications.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <button
                        onClick={onMarkAllAsRead}
                        disabled={unreadCount === 0}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        <Check size={14} /> Tandai semua dibaca
                    </button>
                    <button
                        onClick={onClearAll}
                        className="text-xs font-medium text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                    >
                        <Trash2 size={14} /> Hapus semua
                    </button>
                </div>
            )}

            {/* Notification List */}
            <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="py-12 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bell size={28} className="text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-medium">Tidak ada notifikasi</p>
                        <p className="text-gray-400 text-sm mt-1">Anda akan melihat notifikasi di sini</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`px-4 py-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer group relative border-l-2 ${!notif.is_read ? 'bg-blue-50 border-indigo-500' : 'bg-white border-transparent'
                                    }`}
                                onClick={() => handleNotificationClick(notif)}
                            >
                                <div className="flex gap-3">
                                    {/* Icon */}
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${getNotificationColor(notif.type)}`}>
                                        {getIcon(notif.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                {notif.title}
                                            </p>
                                            {!notif.is_read && (
                                                <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1.5 animate-pulse" />
                                            )}
                                        </div>
                                        {notif.message && (
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {formatRelativeTime(notif.created_at)}
                                            </span>
                                            {notif.reference_type === 'ticket' && (
                                                <span className="text-[10px] text-indigo-500 flex items-center gap-0.5">
                                                    <ExternalLink size={10} /> Buka tiket
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Hover Actions */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    {!notif.is_read && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMarkAsRead(notif.id);
                                            }}
                                            className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                                            title="Tandai sudah dibaca"
                                        >
                                            <Check size={14} className="text-indigo-600" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(notif.id);
                                        }}
                                        className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                                        title="Hapus notifikasi"
                                    >
                                        <Trash2 size={14} className="text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {notifications.length > 10 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-center">
                    <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                        Lihat semua notifikasi
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationPanel;
