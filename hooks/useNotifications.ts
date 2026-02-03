import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string | null;
    type: 'info' | 'warning' | 'success' | 'error' | 'ticket_new' | 'ticket_reply' | 'ticket_assigned' | 'sla_warning' | 'escalation' | 'user_confirmed';
    reference_type: string | null;
    reference_id: string | null;
    is_read: boolean;
    created_at: string;
    read_at: string | null;
}

export function useNotifications(userId: string | null) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Reset read notifications from previous days
    const resetDailyNotifications = useCallback(async () => {
        if (!userId) return;

        try {
            // Call the database function to reset notifications read on previous days
            const { error } = await supabase.rpc('reset_daily_read_notifications');
            if (error) {
                // If function doesn't exist yet, silently ignore
                if (!error.message.includes('does not exist')) {
                    console.warn('Daily reset function not available:', error.message);
                }
            }
        } catch (error) {
            // Silently ignore if function not available
            console.warn('Could not reset daily notifications:', error);
        }
    }, [userId]);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!userId) return;

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            setNotifications(data || []);
            setUnreadCount(data?.filter(n => !n.is_read).length || 0);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (error) throw error;

            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, []);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        if (!userId) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) throw error;

            setNotifications(prev =>
                prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }, [userId]);

    // Delete notification
    const deleteNotification = useCallback(async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) throw error;

            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            // Update unread count if deleted notification was unread
            const deletedNotif = notifications.find(n => n.id === notificationId);
            if (deletedNotif && !deletedNotif.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }, [notifications]);

    // Clear all notifications
    const clearAll = useCallback(async () => {
        if (!userId) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', userId);

            if (error) throw error;

            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    }, [userId]);

    // Initial fetch with daily reset
    useEffect(() => {
        const initializeNotifications = async () => {
            // First, reset notifications read on previous days
            await resetDailyNotifications();
            // Then fetch current notifications
            await fetchNotifications();
        };
        initializeNotifications();
    }, [fetchNotifications, resetDailyNotifications]);

    // Real-time subscription
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('New notification received:', payload);
                    const newNotification = payload.new as Notification;
                    setNotifications(prev => [newNotification, ...prev]);
                    setUnreadCount(prev => prev + 1);

                    // Optional: Play notification sound
                    try {
                        const audio = new Audio('/notification.mp3');
                        audio.volume = 0.3;
                        audio.play().catch(() => { }); // Ignore if autoplay blocked
                    } catch (e) {
                        // Ignore audio errors
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const updatedNotification = payload.new as Notification;
                    const oldNotification = payload.old as Notification;

                    setNotifications(prev =>
                        prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
                    );

                    // Update unread count if is_read status changed
                    if (!oldNotification.is_read && updatedNotification.is_read) {
                        // Was unread, now read -> decrease count
                        setUnreadCount(prev => Math.max(0, prev - 1));
                    } else if (oldNotification.is_read && !updatedNotification.is_read) {
                        // Was read, now unread -> increase count
                        setUnreadCount(prev => prev + 1);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const deletedNotif = payload.old as Notification;
                    setNotifications(prev => prev.filter(n => n.id !== deletedNotif.id));

                    // Update unread count if deleted notification was unread
                    if (!deletedNotif.is_read) {
                        setUnreadCount(prev => Math.max(0, prev - 1));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        refetch: fetchNotifications
    };
}

// Helper function to get notification icon based on type
export function getNotificationIcon(type: Notification['type']) {
    switch (type) {
        case 'ticket_new':
        case 'ticket_assigned':
            return 'Ticket';
        case 'ticket_reply':
            return 'MessageSquare';
        case 'sla_warning':
        case 'escalation':
            return 'AlertTriangle';
        case 'success':
            return 'CheckCircle';
        case 'error':
            return 'XCircle';
        case 'warning':
            return 'AlertCircle';
        case 'user_confirmed':
            return 'PartyPopper'; // Special icon for user confirmation
        default:
            return 'Bell';
    }
}

// Helper function to get notification color based on type
export function getNotificationColor(type: Notification['type']) {
    switch (type) {
        case 'ticket_new':
        case 'ticket_assigned':
            return 'text-indigo-600 bg-indigo-100';
        case 'ticket_reply':
            return 'text-blue-600 bg-blue-100';
        case 'sla_warning':
        case 'escalation':
        case 'warning':
            return 'text-orange-600 bg-orange-100';
        case 'success':
            return 'text-green-600 bg-green-100';
        case 'error':
            return 'text-red-600 bg-red-100';
        case 'user_confirmed':
            return 'text-emerald-600 bg-emerald-100 ring-2 ring-emerald-300'; // Prominent green with ring
        default:
            return 'text-gray-600 bg-gray-100';
    }
}

// Helper to format relative time
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
