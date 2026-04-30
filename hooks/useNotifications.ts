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
    company_id: number | null;
    is_read: boolean;
    created_at: string;
    read_at: string | null;
}

export function useNotifications(userId: string | null, companyId?: number | null, departmentName?: string | null) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Filter helper for client-side legacy support
    const filterNotification = useCallback((n: Notification) => {
        // 1. If company_id matches exactly, show it
        if (n.company_id && companyId && Number(n.company_id) === Number(companyId)) return true;
        
        // 2. For legacy notifications (null company_id or when we don't have companyId filter), filter by title prefix
        if (!n.company_id || !companyId) {
            const currentDeptName = departmentName || 'DIT';
            
            // If it has a tag like [DIT] or [Legal] but it's not our current dept, hide it
            if (n.title.includes('[') && n.title.includes(']')) {
                return n.title.toLowerCase().includes(`[${currentDeptName.toLowerCase()}]`);
            }
            
            // If no tag and no company_id, show it (global/default)
            return true;
        }
        
        return false;
    }, [companyId, departmentName]);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!userId) return;

        try {
            // Fetch the list of notifications (limited)
            let query = supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId);
            
            // Optional: If we want to filter at DB level for performance, but careful with legacy
            // .or(`company_id.eq.${companyId},company_id.is.null`)
            
            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(100); // Fetch more to allow client-side filtering

            if (error) throw error;

            // Apply client-side filtering for department separation
            const filteredData = (data || []).filter(filterNotification);
            
            setNotifications(filteredData.slice(0, 50));
            
            // Count unread from filtered data
            const unread = filteredData.filter(n => !n.is_read).length;
            setUnreadCount(unread);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, filterNotification]);

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
            // Update all notifications for this user in DB
            // But we should only mark as read the ones that are VISIBLE in this department context
            // To be precise, we filter by IDs of visible unread notifications
            const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
            
            if (unreadIds.length === 0) return;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('id', unreadIds);

            if (error) throw error;

            setNotifications(prev =>
                prev.map(n => unreadIds.includes(n.id) ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }, [userId, notifications]);

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
            const visibleIds = notifications.map(n => n.id);
            if (visibleIds.length === 0) return;

            const { error } = await supabase
                .from('notifications')
                .delete()
                .in('id', visibleIds);

            if (error) throw error;

            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    }, [userId, notifications]);

    // Initial fetch
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Real-time subscription
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`notifications-realtime-${Math.random().toString(36).substring(7)}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const newNotification = payload.new as Notification;
                    
                    // Filter before adding to state
                    if (!filterNotification(newNotification)) {
                        console.log('New notification skipped (different department):', newNotification);
                        return;
                    }

                    console.log('New notification received for this department:', payload);
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

                    // If it was visible or is now visible, update it
                    if (filterNotification(updatedNotification)) {
                        setNotifications(prev =>
                            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
                        );

                        // Update unread count if is_read status changed
                        if (!oldNotification.is_read && updatedNotification.is_read) {
                            setUnreadCount(prev => Math.max(0, prev - 1));
                        } else if (oldNotification.is_read && !updatedNotification.is_read) {
                            setUnreadCount(prev => prev + 1);
                        }
                    } else {
                        // If it's no longer visible (e.g. company changed), remove it
                        setNotifications(prev => prev.filter(n => n.id !== updatedNotification.id));
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
    }, [userId, filterNotification]);

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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
