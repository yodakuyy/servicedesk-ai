/**
 * Auto Close Rules Engine
 * 
 * This module handles automatic ticket closure based on configured rules.
 * Rules are evaluated based on condition type:
 * - status: Close tickets in specific status after X time
 * - pending: Close pending tickets after X time
 * - no_response: Close tickets with no user response after X time
 * - user_confirmed: Close when user confirms resolution
 */

import { supabase } from './supabase';

interface AutoCloseResult {
    processed: number;
    closed: number;
    errors: string[];
    details: Array<{
        ticketId: string;
        ticketNumber: string;
        ruleName: string;
        success: boolean;
        error?: string;
    }>;
}

interface AutoCloseRule {
    id: string;
    name: string;
    condition_type: 'status' | 'pending' | 'no_response' | 'user_confirmed';
    condition_value: string;
    after_days: number;
    after_hours: number;
    notify_user: boolean;
    notify_agent: boolean;
    add_note: boolean;
    note_text?: string;
    is_active: boolean;
}

/**
 * Calculate the cutoff date based on days and hours
 */
function getCutoffDate(days: number, hours: number): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(cutoff.getHours() - hours);
    return cutoff;
}

/**
 * Get tickets that match a specific rule's conditions
 */
async function getMatchingTickets(rule: AutoCloseRule): Promise<any[]> {
    const cutoffDate = getCutoffDate(rule.after_days, rule.after_hours);

    try {
        let query = supabase
            .from('tickets')
            .select(`
                id,
                ticket_number,
                subject,
                status_id,
                requester_id,
                assigned_to,
                assignment_group_id,
                updated_at,
                ticket_statuses:status_id(status_name, status_code, is_final)
            `)
            .eq('ticket_statuses.is_final', false) // Only non-closed tickets
            .lte('updated_at', cutoffDate.toISOString());

        // Apply condition based on rule type
        switch (rule.condition_type) {
            case 'status':
                // Close tickets in a specific status
                if (rule.condition_value) {
                    // condition_value should be status_id
                    query = query.eq('status_id', parseInt(rule.condition_value));
                }
                break;

            case 'pending':
                // Close tickets in any "pending" status
                // We need to find pending statuses first
                const { data: pendingStatuses } = await supabase
                    .from('ticket_statuses')
                    .select('status_id')
                    .ilike('status_name', '%pending%');

                if (pendingStatuses && pendingStatuses.length > 0) {
                    query = query.in('status_id', pendingStatuses.map(s => s.status_id));
                }
                break;

            case 'no_response':
                // Close tickets where last activity was not from requester
                // This is more complex - we check tickets with no recent requester replies
                // For simplicity, we'll use updated_at as proxy
                break;

            case 'user_confirmed':
                // This is typically handled separately when user clicks "confirm"
                // Skip for automated processing
                return [];
        }

        const { data: tickets, error } = await query;

        if (error) {
            console.error(`Error fetching tickets for rule "${rule.name}":`, error);
            return [];
        }

        return tickets || [];
    } catch (error) {
        console.error(`Error in getMatchingTickets for rule "${rule.name}":`, error);
        return [];
    }
}

/**
 * Close a single ticket
 */
async function closeTicket(
    ticketId: string,
    rule: AutoCloseRule,
    closedStatusId: number
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Update ticket status to closed
        const { error: updateError } = await supabase
            .from('tickets')
            .update({
                status_id: closedStatusId,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // 2. Add system note if configured
        if (rule.add_note && rule.note_text) {
            await supabase
                .from('ticket_replies')
                .insert({
                    ticket_id: ticketId,
                    content: rule.note_text,
                    is_internal: true,
                    reply_type: 'system',
                    created_at: new Date().toISOString()
                });
        }

        // 3. Send notifications if configured
        if (rule.notify_user || rule.notify_agent) {
            // Get ticket details for notification
            const { data: ticket } = await supabase
                .from('tickets')
                .select('requester_id, assigned_to, ticket_number, subject')
                .eq('id', ticketId)
                .single();

            if (ticket) {
                const notifications = [];

                if (rule.notify_user && ticket.requester_id) {
                    notifications.push({
                        user_id: ticket.requester_id,
                        title: 'Ticket Auto-Closed',
                        message: `Ticket ${ticket.ticket_number} has been automatically closed due to inactivity.`,
                        type: 'ticket_closed',
                        reference_type: 'ticket',
                        reference_id: ticketId,
                        is_read: false
                    });
                }

                if (rule.notify_agent && ticket.assigned_to) {
                    notifications.push({
                        user_id: ticket.assigned_to,
                        title: 'Ticket Auto-Closed',
                        message: `Ticket ${ticket.ticket_number} has been automatically closed by rule "${rule.name}".`,
                        type: 'ticket_closed',
                        reference_type: 'ticket',
                        reference_id: ticketId,
                        is_read: false
                    });
                }

                if (notifications.length > 0) {
                    await supabase.from('notifications').insert(notifications);
                }
            }
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Main function to process all auto-close rules
 * This should be called periodically (e.g., every hour via cron)
 */
export async function processAutoCloseRules(): Promise<AutoCloseResult> {
    const result: AutoCloseResult = {
        processed: 0,
        closed: 0,
        errors: [],
        details: []
    };

    try {
        // 1. Get the "Closed" status ID
        const { data: closedStatus, error: statusError } = await supabase
            .from('ticket_statuses')
            .select('status_id')
            .eq('is_final', true)
            .limit(1)
            .single();

        if (statusError || !closedStatus) {
            result.errors.push('Could not find closed status in database');
            return result;
        }

        const closedStatusId = closedStatus.status_id;

        // 2. Fetch all active auto-close rules
        const { data: rules, error: rulesError } = await supabase
            .from('auto_close_rules')
            .select('*')
            .eq('is_active', true);

        if (rulesError) {
            result.errors.push(`Error fetching rules: ${rulesError.message}`);
            return result;
        }

        if (!rules || rules.length === 0) {
            console.log('No active auto-close rules found');
            return result;
        }

        console.log(`Processing ${rules.length} auto-close rules...`);

        // 3. Process each rule
        for (const rule of rules) {
            console.log(`Processing rule: ${rule.name}`);

            const tickets = await getMatchingTickets(rule);
            result.processed += tickets.length;

            console.log(`Found ${tickets.length} tickets matching rule "${rule.name}"`);

            for (const ticket of tickets) {
                const closeResult = await closeTicket(ticket.id, rule, closedStatusId);

                result.details.push({
                    ticketId: ticket.id,
                    ticketNumber: ticket.ticket_number,
                    ruleName: rule.name,
                    success: closeResult.success,
                    error: closeResult.error
                });

                if (closeResult.success) {
                    result.closed++;
                } else {
                    result.errors.push(`Failed to close ${ticket.ticket_number}: ${closeResult.error}`);
                }
            }

            // 4. Update rule statistics
            if (tickets.length > 0) {
                await supabase
                    .from('auto_close_rules')
                    .update({
                        tickets_closed: (rule.tickets_closed || 0) + tickets.length,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', rule.id);
            }
        }

        console.log(`Auto-close complete: Processed ${result.processed}, Closed ${result.closed}`);
        return result;

    } catch (error: any) {
        result.errors.push(`Unexpected error: ${error.message}`);
        return result;
    }
}

/**
 * Get a preview of tickets that would be closed by rules
 * Useful for admins to review before manual trigger
 */
export async function previewAutoClose(): Promise<{
    rules: Array<{ ruleName: string; ticketCount: number; tickets: any[] }>;
    totalTickets: number;
}> {
    const preview = {
        rules: [] as Array<{ ruleName: string; ticketCount: number; tickets: any[] }>,
        totalTickets: 0
    };

    try {
        const { data: rules } = await supabase
            .from('auto_close_rules')
            .select('*')
            .eq('is_active', true);

        if (!rules) return preview;

        for (const rule of rules) {
            const tickets = await getMatchingTickets(rule);
            preview.rules.push({
                ruleName: rule.name,
                ticketCount: tickets.length,
                tickets: tickets.slice(0, 10) // Limit to first 10 for preview
            });
            preview.totalTickets += tickets.length;
        }

        return preview;
    } catch (error) {
        console.error('Error in previewAutoClose:', error);
        return preview;
    }
}
