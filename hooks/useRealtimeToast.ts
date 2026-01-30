import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast, Toast } from '../components/ToastProvider';

interface RealtimeNotification {
    id: string;
    user_id: string;
    title: string;
    message: string | null;
    type: Toast['type'];
    reference_type: string | null;
    reference_id: string | null;
    is_read: boolean;
    created_at: string;
}

/**
 * Hook to show toast notifications when new notifications arrive in realtime.
 * This should be used in a component that's always mounted (like Dashboard or App).
 */
export function useRealtimeToast(
    userId: string | null,
    onNavigateToTicket?: (ticketId: string) => void
) {
    const { addToast } = useToast();
    const hasSetup = useRef(false);

    useEffect(() => {
        if (!userId || hasSetup.current) return;

        hasSetup.current = true;

        const channel = supabase
            .channel('toast-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const newNotification = payload.new as RealtimeNotification;

                    // Show toast
                    addToast({
                        title: newNotification.title,
                        message: newNotification.message || undefined,
                        type: newNotification.type,
                        referenceType: newNotification.reference_type || undefined,
                        referenceId: newNotification.reference_id || undefined,
                        duration: 6000, // 6 seconds
                        onClick: () => {
                            if (newNotification.reference_type === 'ticket' && newNotification.reference_id && onNavigateToTicket) {
                                onNavigateToTicket(newNotification.reference_id);
                            }
                        }
                    });

                    // Play notification sound
                    try {
                        const audio = new Audio('/notification.mp3');
                        audio.volume = 0.3;
                        audio.play().catch(() => { }); // Ignore if autoplay blocked
                    } catch (e) {
                        // Ignore audio errors
                    }
                }
            )
            .subscribe();

        return () => {
            hasSetup.current = false;
            supabase.removeChannel(channel);
        };
    }, [userId, addToast, onNavigateToTicket]);
}

export default useRealtimeToast;
