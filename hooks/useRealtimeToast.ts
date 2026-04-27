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
    companyId?: number | null,
    departmentName?: string | null,
    onNavigateToTicket?: (ticketId: string) => void
) {
    const { addToast } = useToast();
    const hasSetup = useRef(false);

    useEffect(() => {
        if (!userId || hasSetup.current) return;

        hasSetup.current = true;

        const channel = supabase
            .channel(`toast-notifications-${Math.random().toString(36).substring(7)}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const newNotification = payload.new as any;

                    // Filtering for department/company context
                    if (newNotification.company_id && companyId && Number(newNotification.company_id) !== Number(companyId)) {
                        console.log('Realtime toast skipped: Different company_id');
                        return;
                    }

                    if (!newNotification.company_id || !companyId) {
                        const currentDeptName = departmentName || 'DIT';
                        if (newNotification.title.includes('[') && newNotification.title.includes(']')) {
                            if (!newNotification.title.toLowerCase().includes(`[${currentDeptName.toLowerCase()}]`)) {
                                console.log('Realtime toast skipped: Different department prefix');
                                return;
                            }
                        }
                    }

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
    }, [userId, companyId, departmentName, addToast, onNavigateToTicket]);
}

export default useRealtimeToast;
