import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface AccessAction {
    action: string;
    allowed: boolean;
}

export interface AccessConstraint {
    constraint_type: string;
    value: any;
}

export interface AccessPolicy {
    id: string;
    name: string;
    priority: number;
    conditions: any[];
    actions: AccessAction[];
    constraints: AccessConstraint[];
}

export interface PermissionResult {
    allowed: boolean;
    reason?: string;
}

export const useAccessControl = (userProfile: any): {
    checkPermission: (action: string, ticket?: any) => PermissionResult;
    isLoaded: boolean;
    refreshAccessControl: () => Promise<void>;
} => {
    const [policies, setPolicies] = useState<AccessPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [userGroups, setUserGroups] = useState<string[]>([]);
    const [businessHours, setBusinessHours] = useState<any[]>([]);

    const fetchAccessControlData = useCallback(async () => {
        if (!userProfile?.id) return;

        try {
            setLoading(true);

            // 1. Fetch User's Groups
            const { data: groupData } = await supabase
                .from('user_groups')
                .select('group_id')
                .eq('user_id', userProfile.id);

            const groupIds = groupData?.map(g => g.group_id) || [];
            setUserGroups(groupIds);

            // 2. Fetch Relevant Policies
            // A policy is relevant if it targets the user's role, one of their groups, or their user ID directly.
            const { data: targetData } = await supabase
                .from('access_policy_targets')
                .select('policy_id')
                .or(`and(target_type.eq.role,target_id.eq.${userProfile.role_id}),and(target_type.eq.user,target_id.eq.${userProfile.id})${groupIds.length > 0 ? `,and(target_type.eq.group,target_id.in.(${groupIds.join(',')}))` : ''}`);

            const relevantPolicyIds = Array.from(new Set(targetData?.map(t => t.policy_id) || []));

            if (relevantPolicyIds.length > 0) {
                // Fetch detailed policy info
                const { data: policyData } = await supabase
                    .from('access_policies')
                    .select(`
            id, name, priority,
            access_policy_conditions(field, operator, value),
            access_policy_actions(action, allowed),
            access_policy_constraints(constraint_type, value)
          `)
                    .in('id', relevantPolicyIds)
                    .eq('status', 'active')
                    .order('priority', { ascending: false });

                const formattedPolicies = policyData?.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    priority: p.priority,
                    conditions: p.access_policy_conditions || [],
                    actions: p.access_policy_actions || [],
                    constraints: p.access_policy_constraints || []
                })) || [];

                setPolicies(formattedPolicies);
            }

            // 3. Fetch Business Hours for constraints
            const { data: bhData } = await supabase.from('business_hours').select('*').eq('is_active', true);
            setBusinessHours(bhData || []);

        } catch (error) {
            console.error('Error fetching access control data:', error);
        } finally {
            setLoading(false);
        }
    }, [userProfile?.id, userProfile?.role_id]);

    useEffect(() => {
        fetchAccessControlData();
    }, [fetchAccessControlData]);

    const isWithinBusinessHours = (schedule: any[]) => {
        if (!schedule || schedule.length === 0) return true;

        const now = new Date();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayName = dayNames[now.getDay()];

        const daySchedule = schedule.find(d => d.day === currentDayName);
        if (!daySchedule || !daySchedule.isActive) return false;

        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startH, startM] = daySchedule.startTime.split(':').map(Number);
        const [endH, endM] = daySchedule.endTime.split(':').map(Number);
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        // Check lunch break
        if (daySchedule.hasBreak && daySchedule.breakStartTime && daySchedule.breakEndTime) {
            const [bStartH, bStartM] = daySchedule.breakStartTime.split(':').map(Number);
            const [bEndH, bEndM] = daySchedule.breakEndTime.split(':').map(Number);
            const bStartTime = bStartH * 60 + bStartM;
            const bEndTime = bEndH * 60 + bEndM;
            if (currentTime >= bStartTime && currentTime <= bEndTime) return false;
        }

        return currentTime >= startTime && currentTime <= endTime;
    };

    const checkPermission = (action: string, ticket?: any): { allowed: boolean; reason?: string } => {
        // Super-admin always has permission (role_id 0)
        // role_id might be string or number
        if (String(userProfile?.role_id) === '0') return { allowed: true };

        // Find matching policies
        const matchingPolicies = policies.filter(policy => {
            // If ticket is provided, check conditions (Scope)
            if (ticket && policy.conditions && policy.conditions.length > 0) {
                return policy.conditions.every(cond => {
                    const field = cond.field.toLowerCase();
                    let ticketValue = '';

                    if (field === 'category') {
                        ticketValue = String(ticket.category_id || ticket.ticket_categories?.id || '');
                    } else if (field === 'priority') {
                        ticketValue = String(ticket.priority || '').toLowerCase();
                    } else if (field === 'status') {
                        ticketValue = String(ticket.status_id || ticket.ticket_statuses?.status_id || '');
                    } else if (field === 'department' || field === 'company') {
                        ticketValue = String(ticket.group?.company_id || ticket.company_id || '');
                    } else {
                        ticketValue = String(ticket[cond.field] || '').toLowerCase();
                    }

                    const condValues = Array.isArray(cond.value)
                        ? cond.value.map(v => String(v).toLowerCase())
                        : String(cond.value).toLowerCase().split(',').map(v => v.trim());

                    if (cond.operator === 'in' || cond.operator === '=') {
                        return condValues.includes(ticketValue.toLowerCase());
                    }
                    if (cond.operator === 'not_in' || cond.operator === '!=') {
                        return !condValues.includes(ticketValue.toLowerCase());
                    }
                    return true;
                });
            }
            return true;
        });

        // Check if any matching policy explicitly permits or denies the action
        // Priority: Highest priority policy wins.
        for (const policy of matchingPolicies) {
            const actionRule = policy.actions.find(a => a.action === action);
            if (actionRule) {
                if (!actionRule.allowed) {
                    return { allowed: false, reason: `Policy "${policy.name}" explicitly denies this action.` };
                }

                // If allowed by action rule, check constraints
                for (const constraint of policy.constraints) {
                    if (constraint.constraint_type === 'business_hours') {
                        const bhId = ticket?.group?.business_hour_id || userProfile?.business_hour_id;
                        const bh = businessHours.find(b => b.id === bhId);
                        if (bh && !isWithinBusinessHours(bh.weekly_schedule)) {
                            return { allowed: false, reason: "Action only allowed during business hours." };
                        }
                    }

                    if (constraint.constraint_type === 'assigned_only' && ticket) {
                        if (ticket.assigned_to !== userProfile.id) {
                            return { allowed: false, reason: "You can only perform this action on tickets assigned to you." };
                        }
                    }

                    if (constraint.constraint_type === 'team_only' && ticket) {
                        const ticketGroupId = ticket.assignment_group_id || ticket.group_id;
                        if (!userGroups.includes(ticketGroupId)) {
                            return { allowed: false, reason: "You can only perform this action on tickets within your team's groups." };
                        }
                    }

                    if (constraint.constraint_type === 'exclude_closed' && ticket) {
                        const status = ticket.ticket_statuses?.status_name || ticket.status;
                        if (['Closed', 'Resolved', 'Canceled', 'Cancelled'].includes(status)) {
                            return { allowed: false, reason: "Action not allowed on tickets with terminal status (Closed/Resolved)." };
                        }
                    }

                    if (constraint.constraint_type === 'sla_status' && ticket) {
                        // is_sla_breached should be calculated or passed in ticket
                        if (!ticket.is_sla_breached) {
                            return { allowed: false, reason: "Action only allowed if SLA is breached." };
                        }
                    }
                }

                return { allowed: true }; // Explicitly allowed and passed constraints
            }
        }

        // Default allowed if no specific policy matches or mentions the action
        return { allowed: true };
    };

    return {
        checkPermission,
        isLoaded: !loading,
        refreshAccessControl: fetchAccessControlData
    };
};
