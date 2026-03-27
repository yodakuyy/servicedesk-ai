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
    target_status_id?: string;
    use_business_hours?: boolean;
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
 * Calculate business minutes elapsed between two dates using schedule + holidays
 */
function calcBusinessMinutesElapsed(startDate: Date, endDate: Date, schedule: any[], holidays: any[]): number {
    if (!schedule || schedule.length === 0) return Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
    let elapsed = 0;
    let cur = new Date(startDate);
    while (cur < endDate) {
        const dateStr = cur.toISOString().split('T')[0];
        const isHoliday = holidays.some((h: any) => h.holiday_date && h.holiday_date.startsWith(dateStr));
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayConfig = schedule.find((d: any) => d.day === dayNames[cur.getDay()]);
        if (!dayConfig || !dayConfig.isActive || isHoliday) {
            cur.setDate(cur.getDate() + 1); cur.setHours(0, 0, 0, 0); continue;
        }
        const [sH, sM] = dayConfig.startTime.split(':').map(Number);
        const [eH, eM] = dayConfig.endTime.split(':').map(Number);
        const ws = new Date(cur); ws.setHours(sH, sM, 0, 0);
        const we = new Date(cur); we.setHours(eH, eM, 0, 0);
        const segS = cur < ws ? ws : cur;
        const segE = endDate < we ? endDate : we;
        if (segS < segE) {
            if (dayConfig.breakActive) {
                const [bSH, bSM] = dayConfig.breakStartTime.split(':').map(Number);
                const [bEH, bEM] = dayConfig.breakEndTime.split(':').map(Number);
                const bS = new Date(segS); bS.setHours(bSH, bSM, 0, 0);
                const bE = new Date(segS); bE.setHours(bEH, bEM, 0, 0);
                if (segS < bS && segE > bE) { elapsed += (bS.getTime() - segS.getTime()) / 60000 + (segE.getTime() - bE.getTime()) / 60000; }
                else if (segE <= bS || segS >= bE) { elapsed += (segE.getTime() - segS.getTime()) / 60000; }
                else if (segS < bS) { elapsed += (bS.getTime() - segS.getTime()) / 60000; }
                else if (segE > bE) { elapsed += (segE.getTime() - bE.getTime()) / 60000; }
            } else { elapsed += (segE.getTime() - segS.getTime()) / 60000; }
        }
        cur.setDate(cur.getDate() + 1); cur.setHours(0, 0, 0, 0);
    }
    return Math.floor(elapsed);
}

/**
 * Get tickets that match a specific rule's conditions
 */
async function getMatchingTickets(rule: AutoCloseRule): Promise<any[]> {
    const ruleMinutes = (rule.after_days * 24 * 60) + (rule.after_hours * 60);

    let cutoffDate: Date;
    if (rule.use_business_hours) {
        const widerCutoff = new Date();
        widerCutoff.setDate(widerCutoff.getDate() - Math.max(rule.after_days * 3, 7));
        widerCutoff.setHours(widerCutoff.getHours() - rule.after_hours);
        cutoffDate = widerCutoff;
    } else {
        cutoffDate = getCutoffDate(rule.after_days, rule.after_hours);
    }

    try {
        // First, get IDs of all "final" statuses to exclude them
        const { data: finalStatuses } = await supabase
            .from('ticket_statuses')
            .select('status_id')
            .eq('is_final', true);
        const finalStatusIds = (finalStatuses || []).map(s => s.status_id);

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
                ticket_statuses:status_id(status_name, status_code, is_final),
                group:groups!assignment_group_id(
                    name,
                    company_id,
                    business_hours(weekly_schedule),
                    company:company_id(company_name)
                )
            `)
            .lte('updated_at', cutoffDate.toISOString());

        // Exclude final/closed statuses
        if (finalStatusIds.length > 0) {
            query = query.not('status_id', 'in', `(${finalStatusIds.join(',')})`);
        }

        // Apply condition based on rule type
        switch (rule.condition_type) {
            case 'status':
                // condition_value is the status NAME (string), look up its UUID
                if (rule.condition_value) {
                    const { data: matchedStatus } = await supabase
                        .from('ticket_statuses')
                        .select('status_id')
                        .ilike('status_name', rule.condition_value.trim())
                        .single();
                    if (matchedStatus) {
                        query = query.eq('status_id', matchedStatus.status_id);
                    } else {
                        console.warn(`Auto-Close: No status found matching "${rule.condition_value}"`);
                        return [];
                    }
                }
                break;

            case 'pending':
                const { data: pendingStatuses } = await supabase
                    .from('ticket_statuses')
                    .select('status_id')
                    .ilike('status_name', '%pending%');
                if (pendingStatuses && pendingStatuses.length > 0) {
                    query = query.in('status_id', pendingStatuses.map(s => s.status_id));
                }
                break;

            case 'no_response':
                break;

            case 'user_confirmed':
                return [];
        }

        const { data: tickets, error } = await query;

        if (error) {
            console.error(`Auto-Close: Error fetching tickets for rule "${rule.name}":`, error);
            return [];
        }

        console.log(`Auto-Close: Rule "${rule.name}" found ${tickets?.length || 0} candidate tickets`);

        // If using business hours, filter by actual business minutes elapsed
        if (rule.use_business_hours && tickets && tickets.length > 0) {
            const { data: holidays } = await supabase.from('holidays').select('holiday_date');
            const holidayList = holidays || [];

            return tickets.filter((t: any) => {
                const rawGroup = t.group;
                const groupObj = Array.isArray(rawGroup) ? rawGroup[0] : rawGroup;
                const rawBH = groupObj?.business_hours;
                const bhObj = Array.isArray(rawBH) ? rawBH[0] : rawBH;
                const schedule = bhObj?.weekly_schedule || [];
                const lastUpdate = new Date(t.updated_at);
                const bizMinutes = calcBusinessMinutesElapsed(lastUpdate, new Date(), schedule, holidayList);
                return bizMinutes >= ruleMinutes;
            });
        }

        return tickets || [];
    } catch (error) {
        console.error(`Auto-Close: Error in getMatchingTickets for rule "${rule.name}":`, error);
        return [];
    }
}

/**
 * Close a single ticket
 */
async function closeTicket(
    ticketId: string,
    rule: AutoCloseRule,
    closedStatusId: string,
    ticket: any
): Promise<{ success: boolean; error?: string }> {
    try {
        // Use target_status_id from rule if set, otherwise default to closed
        const targetStatusId = rule.target_status_id || closedStatusId;
        const isResolve = rule.target_status_id && rule.target_status_id !== closedStatusId;

        // 1. Update ticket status
        const { error: updateError } = await supabase
            .from('tickets')
            .update({
                status_id: targetStatusId,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // 3. Log activity
        await supabase.from('ticket_activity_log').insert({
            ticket_id: ticketId,
            action: isResolve 
                ? `Ticket auto-resolved by rule "${rule.name}"` 
                : `Ticket auto-closed by rule "${rule.name}"`
        });

        // 4. Extract department name (e.g., "DIT")
        const groupObj = Array.isArray(ticket.group) ? ticket.group[0] : ticket.group;
        const companyObj = Array.isArray(groupObj?.company) ? groupObj.company[0] : groupObj?.company;
        const deptName = companyObj?.company_name || groupObj?.name || 'DIT';
        const deptPrefix = deptName ? `[${deptName}] ` : '';

        // 5. Add system note to conversation (visible to user) if configured
        if (rule.add_note && rule.note_text) {
            // Determine best sender: assigned agent → dept admin → requester
            let systemSenderId = ticket.assigned_to || ticket.requester_id;

            // If no assigned agent, try to find a dept admin
            if (!ticket.assigned_to) {
                const { data: deptAdmin } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('is_department_admin', true)
                    .limit(1)
                    .single();
                if (deptAdmin) systemSenderId = deptAdmin.id;
            }

            if (systemSenderId) {
                const { error: noteError } = await supabase
                    .from('ticket_messages')
                    .insert({
                        ticket_id: ticketId,
                        sender_id: systemSenderId,
                        sender_role: 'system',
                        content: `<div class="system-auto-note">${rule.note_text}</div>`,
                        is_internal: false,
                        created_at: new Date().toISOString()
                    });
                if (noteError) {
                    console.error('Auto-Close: Failed to insert note:', noteError);
                }
            }
        }

        // 6. Send notifications if configured
        if ((rule.notify_user || rule.notify_agent) && ticket) {
                const notifications = [];
                const actionWord = isResolve ? 'resolved' : 'closed';
                const ticketCompanyId = (Array.isArray(ticket.group) ? ticket.group[0] : ticket.group)?.company_id;

                if (rule.notify_user && ticket.requester_id) {
                    notifications.push({
                        user_id: ticket.requester_id,
                        company_id: ticketCompanyId,
                        title: `${deptPrefix}${isResolve ? 'Ticket Auto-Resolved' : 'Ticket Auto-Closed'}`,
                        message: `Ticket ${ticket.ticket_number} has been automatically ${actionWord} due to no response. ${isResolve ? 'If you still need help, please reply to reopen the ticket.' : ''}`,
                        type: isResolve ? 'ticket_resolved' : 'ticket_closed',
                        reference_type: 'ticket',
                        reference_id: ticketId,
                        is_read: false
                    });
                }

                if (rule.notify_agent && ticket.assigned_to) {
                    notifications.push({
                        user_id: ticket.assigned_to,
                        company_id: ticketCompanyId,
                        title: `${deptPrefix}${isResolve ? 'Ticket Auto-Resolved' : 'Ticket Auto-Closed'}`,
                        message: `Ticket ${ticket.ticket_number} has been automatically ${actionWord} by rule "${rule.name}".`,
                        type: isResolve ? 'ticket_resolved' : 'ticket_closed',
                        reference_type: 'ticket',
                        reference_id: ticketId,
                        is_read: false
                    });
                }

                if (notifications.length > 0) {
                    await supabase.from('notifications').insert(notifications);
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
            .eq('status_name', 'Closed')
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
                const closeResult = await closeTicket(ticket.id, rule, closedStatusId, ticket);

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
