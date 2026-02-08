/**
 * Auto Assignment Rules Engine
 * 
 * This module handles automatic ticket assignment based on configured rules.
 * Rules are evaluated in priority order (lower number = higher priority).
 * The first matching rule is applied.
 */

import { supabase } from './supabase';

interface AssignmentResult {
    assigned: boolean;
    groupId: string | null;
    agentId: string | null;
    ruleName: string | null;
    ruleId: string | null;
}

interface TicketData {
    category?: string;
    priority?: string;
    department?: string;
    user_type?: string;
    subject?: string;
    source?: string;
    issue_type?: string;
    ticket_type?: string;
}

interface RuleCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'in';
    value: string | string[];
}

interface AssignmentRule {
    id: string;
    name: string;
    conditions: RuleCondition[];
    assign_to_type: 'group' | 'agent' | 'round_robin';
    assign_to_id: string | null;
    priority: number;
    is_active: boolean;
}

/**
 * Check if a single condition matches the ticket data
 */
function checkCondition(condition: RuleCondition, ticketData: TicketData): boolean {
    const fieldValue = getFieldValue(condition.field, ticketData);

    if (fieldValue === null || fieldValue === undefined) {
        return false;
    }

    const ticketValue = String(fieldValue).toLowerCase().trim();
    const conditionValue = String(condition.value).toLowerCase().trim();

    switch (condition.operator) {
        case 'equals':
            return ticketValue === conditionValue;

        case 'not_equals':
            return ticketValue !== conditionValue;

        case 'contains':
            return ticketValue.includes(conditionValue);

        case 'in':
            // Value can be comma-separated list or array
            const values = Array.isArray(condition.value)
                ? condition.value
                : conditionValue.split(',').map(v => v.trim());
            return values.some(v => v.toLowerCase() === ticketValue);

        default:
            return false;
    }
}

/**
 * Get the value of a field from ticket data
 * Maps condition field names to actual ticket properties
 */
function getFieldValue(field: string, ticketData: TicketData): string | null {
    switch (field) {
        case 'category':
            // Check both category and issue_type since they may be used interchangeably
            return ticketData.category || ticketData.issue_type || null;
        case 'priority':
            return ticketData.priority || null;
        case 'department':
            return ticketData.department || null;
        case 'user_type':
            return ticketData.user_type || null;
        case 'subject':
            return ticketData.subject || null;
        case 'source':
            return ticketData.source || null;
        case 'ticket_type':
            return ticketData.ticket_type || null;
        default:
            return null;
    }
}

/**
 * Check if all conditions of a rule match the ticket data
 */
function checkAllConditions(rule: AssignmentRule, ticketData: TicketData): boolean {
    if (!rule.conditions || rule.conditions.length === 0) {
        return false; // Rules without conditions should not match
    }

    return rule.conditions.every(condition => checkCondition(condition, ticketData));
}

/**
 * Get agent for round-robin assignment within a group
 * Distributes tickets evenly among agents in the group
 */
export async function getRoundRobinAgent(groupId: string): Promise<string | null> {
    try {
        // Get all agents in the group
        const { data: members, error } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId)
            .eq('is_active', true);

        if (error || !members || members.length === 0) {
            return null;
        }

        // Get ticket counts for each agent (assigned today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const agentIds = members.map(m => m.user_id);

        const { data: ticketCounts } = await supabase
            .from('tickets')
            .select('assigned_to')
            .in('assigned_to', agentIds)
            .gte('created_at', today.toISOString());

        // Count tickets per agent
        const counts: Record<string, number> = {};
        agentIds.forEach(id => counts[id] = 0);

        if (ticketCounts) {
            ticketCounts.forEach(t => {
                if (t.assigned_to && counts[t.assigned_to] !== undefined) {
                    counts[t.assigned_to]++;
                }
            });
        }

        // Find agent with least tickets
        let minAgent = agentIds[0];
        let minCount = counts[minAgent];

        for (const agentId of agentIds) {
            if (counts[agentId] < minCount) {
                minCount = counts[agentId];
                minAgent = agentId;
            }
        }

        return minAgent;
    } catch (error) {
        console.error('Error in round-robin assignment:', error);
        return null;
    }
}

/**
 * Main function to apply auto-assignment rules to a ticket
 * 
 * @param ticketData - The ticket data to match against rules
 * @returns AssignmentResult with the assignment details
 */
export async function applyAutoAssignment(ticketData: TicketData): Promise<AssignmentResult> {
    const defaultResult: AssignmentResult = {
        assigned: false,
        groupId: null,
        agentId: null,
        ruleName: null,
        ruleId: null
    };

    try {
        // Fetch all active rules ordered by priority
        const { data: rules, error } = await supabase
            .from('auto_assignment_rules')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: true });

        if (error) {
            console.error('Error fetching auto-assignment rules:', error);
            return defaultResult;
        }

        if (!rules || rules.length === 0) {
            console.log('No active auto-assignment rules found');
            return defaultResult;
        }

        console.log(`Checking ${rules.length} auto-assignment rules for ticket:`, ticketData);

        // Check each rule in priority order
        for (const rule of rules) {
            const matches = checkAllConditions(rule, ticketData);

            console.log(`Rule "${rule.name}" (priority ${rule.priority}): ${matches ? 'MATCHED' : 'no match'}`);

            if (matches) {
                const result: AssignmentResult = {
                    assigned: true,
                    groupId: null,
                    agentId: null,
                    ruleName: rule.name,
                    ruleId: rule.id
                };

                switch (rule.assign_to_type) {
                    case 'agent':
                        result.agentId = rule.assign_to_id;
                        break;

                    case 'group':
                        result.groupId = rule.assign_to_id;
                        break;

                    case 'round_robin':
                        // Round-robin assigns to an agent within the group
                        result.groupId = rule.assign_to_id;
                        if (rule.assign_to_id) {
                            result.agentId = await getRoundRobinAgent(rule.assign_to_id);
                        }
                        break;
                }

                console.log(`Auto-assignment applied: Rule "${rule.name}" -> Group: ${result.groupId}, Agent: ${result.agentId}`);

                // Update rule statistics (tickets_routed)
                await supabase
                    .from('auto_assignment_rules')
                    .update({
                        tickets_routed: (rule.tickets_routed || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', rule.id);

                return result;
            }
        }

        console.log('No matching auto-assignment rule found');
        return defaultResult;

    } catch (error) {
        console.error('Error in applyAutoAssignment:', error);
        return defaultResult;
    }
}

/**
 * Helper to get group IDs by name for fallback logic
 */
export async function getGroupIdByName(name: string): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('groups')
            .select('id')
            .ilike('name', `%${name}%`)
            .eq('is_active', true)
            .limit(1)
            .single();

        if (error || !data) return null;
        return data.id;
    } catch {
        return null;
    }
}
