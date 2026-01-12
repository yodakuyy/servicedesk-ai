import React, { useState, useEffect } from 'react';
import {
    Shield,
    Plus,
    Search,
    ChevronRight,
    X,
    Check,
    AlertCircle,
    Users,
    Clock,
    Info,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Types
interface PolicyTarget {
    id?: string;
    type: 'role' | 'group' | 'user';
    targetId: string;
    name: string;
}

interface ScopeCondition {
    id?: string;
    field: string;
    operator: string;
    value: string[];
}

interface PolicyConstraint {
    id?: string;
    constraintType: string;
    value: any;
}

interface AccessPolicy {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive';
    priority: number;
    targets: PolicyTarget[];
    conditions: ScopeCondition[];
    actions: { action: string; allowed: boolean }[];
    constraints: PolicyConstraint[];
    created_at: string;
    updated_at: string;
}

// Static options (category, priority, etc.)
const staticScopeFields = [
    { id: 'category', label: 'Category', options: ['IT', 'HR', 'Finance', 'General'] },
    { id: 'priority', label: 'Priority', options: ['Low', 'Medium', 'High', 'Urgent'] },
    { id: 'ticket_type', label: 'Ticket Type', options: ['Incident', 'Service Request'] },
    { id: 'created_by', label: 'Created By', options: ['Internal User', 'External User', 'System'] },
];

const actionOptions = [
    { id: 'view', label: 'View Ticket', description: 'Can see ticket details', safe: true },
    { id: 'create', label: 'Create Ticket', description: 'Can create new tickets', safe: true },
    { id: 'update', label: 'Update Ticket', description: 'Can edit ticket information', safe: true },
    { id: 'assign', label: 'Assign Ticket', description: 'Can assign tickets to agents', safe: true },
    { id: 'change_priority', label: 'Change Priority', description: 'Can modify ticket priority', safe: false },
    { id: 'close', label: 'Close Ticket', description: 'Can close/resolve tickets', safe: false },
    { id: 'delete', label: 'Delete Ticket', description: 'Can permanently delete tickets', safe: false },
    { id: 'escalate', label: 'Escalate Ticket', description: 'Can escalate to higher level', safe: true },
];

const constraintOptions = [
    { id: 'business_hours', label: 'Only during Business Hours', desc: 'Policy only active during working hours', icon: Clock },
    { id: 'assigned_only', label: 'Only Assigned Tickets', desc: 'Users can only access tickets assigned to them', icon: Users },
    { id: 'sla_status', label: 'Only if SLA Breached', desc: 'Policy activates when SLA is breached', icon: AlertCircle },
];

const sampleTickets = [
    { id: 'TKT-001', title: 'Network issue', category: 'IT', department: 'DIT', priority: 'High' },
    { id: 'TKT-002', title: 'Leave request', category: 'HR', department: 'HRD', priority: 'Low' },
    { id: 'TKT-003', title: 'Software install', category: 'IT', department: 'DIT', priority: 'Medium' },
];

const AccessPolicy: React.FC = () => {
    const [policies, setPolicies] = useState<AccessPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showWizard, setShowWizard] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [editingPolicy, setEditingPolicy] = useState<AccessPolicy | null>(null);

    // Reference data
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
    const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'active' as 'active' | 'inactive',
        priority: 100,
        targets: [] as PolicyTarget[],
        conditions: [] as ScopeCondition[],
        actions: [{ action: 'view', allowed: true }] as { action: string; allowed: boolean }[],
        constraints: [] as PolicyConstraint[],
    });

    // Fetch policies and reference data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            // First load reference data
            const refData = await fetchReferenceData();
            // Then load policies with reference data
            await fetchPolicies(refData);
        } finally {
            setLoading(false);
        }
    };

    const fetchReferenceData = async () => {
        try {
            const [rolesRes, groupsRes, usersRes, deptRes] = await Promise.all([
                supabase.from('roles').select('role_id, role_name'),
                supabase.from('groups').select('id, name'),
                supabase.from('profiles').select('id, full_name').limit(50),
                supabase.from('company').select('company_name').order('company_name'),
            ]);

            const rolesData = rolesRes.data?.map(r => ({ id: String(r.role_id), name: r.role_name })) || [];
            const groupsData = groupsRes.data?.map(g => ({ id: g.id, name: g.name })) || [];
            const usersData = usersRes.data?.map(u => ({ id: u.id, name: u.full_name || 'Unknown' })) || [];
            const deptData = deptRes.data?.map(d => d.company_name) || [];

            setRoles(rolesData);
            setGroups(groupsData);
            setUsers(usersData);
            setDepartments(deptData);

            return { roles: rolesData, groups: groupsData, users: usersData };
        } catch (err) {
            console.error('Error fetching reference data:', err);
            return { roles: [], groups: [], users: [] };
        }
    };

    const fetchPolicies = async (refData?: { roles: typeof roles; groups: typeof groups; users: typeof users }) => {
        try {
            const { data: policiesData, error } = await supabase
                .from('access_policies')
                .select('*')
                .order('priority', { ascending: true });

            if (error) throw error;

            const getTargetNameWithRef = (type: string, id: string) => {
                const r = refData?.roles || roles;
                const g = refData?.groups || groups;
                const u = refData?.users || users;
                if (type === 'role') return r.find(item => item.id === id)?.name || 'Unknown Role';
                if (type === 'group') return g.find(item => item.id === id)?.name || 'Unknown Group';
                if (type === 'user') return u.find(item => item.id === id)?.name || 'Unknown User';
                return 'Unknown';
            };

            // Fetch related data for each policy
            const policiesWithRelations = await Promise.all(
                (policiesData || []).map(async (policy) => {
                    const [targetsRes, conditionsRes, actionsRes, constraintsRes] = await Promise.all([
                        supabase.from('access_policy_targets').select('*').eq('policy_id', policy.id),
                        supabase.from('access_policy_conditions').select('*').eq('policy_id', policy.id),
                        supabase.from('access_policy_actions').select('*').eq('policy_id', policy.id),
                        supabase.from('access_policy_constraints').select('*').eq('policy_id', policy.id),
                    ]);

                    return {
                        ...policy,
                        targets: (targetsRes.data || []).map(t => ({
                            id: t.id,
                            type: t.target_type,
                            targetId: t.target_id,
                            name: getTargetNameWithRef(t.target_type, t.target_id),
                        })),
                        conditions: (conditionsRes.data || []).map(c => ({
                            id: c.id,
                            field: c.field,
                            operator: c.operator,
                            value: Array.isArray(c.value) ? c.value : [c.value],
                        })),
                        actions: (actionsRes.data || []).map(a => ({
                            action: a.action,
                            allowed: a.allowed,
                        })),
                        constraints: (constraintsRes.data || []).map(c => ({
                            id: c.id,
                            constraintType: c.constraint_type,
                            value: c.value,
                        })),
                    };
                })
            );

            setPolicies(policiesWithRelations);
        } catch (err) {
            console.error('Error fetching policies:', err);
        }
    };

    const getTargetName = (type: string, id: string) => {
        if (type === 'role') return roles.find(r => r.id === id)?.name || 'Unknown Role';
        if (type === 'group') return groups.find(g => g.id === id)?.name || 'Unknown Group';
        if (type === 'user') return users.find(u => u.id === id)?.name || 'Unknown User';
        return 'Unknown';
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            status: 'active',
            priority: 100,
            targets: [],
            conditions: [],
            actions: [{ action: 'view', allowed: true }],
            constraints: [],
        });
        setCurrentStep(1);
        setEditingPolicy(null);
    };

    const openWizard = (policy?: AccessPolicy) => {
        if (policy) {
            setEditingPolicy(policy);
            setFormData({
                name: policy.name,
                description: policy.description || '',
                status: policy.status,
                priority: policy.priority,
                targets: [...policy.targets],
                conditions: [...policy.conditions],
                actions: policy.actions.length > 0 ? [...policy.actions] : [{ action: 'view', allowed: true }],
                constraints: [...policy.constraints],
            });
        } else {
            resetForm();
        }
        setShowWizard(true);
    };

    const closeWizard = () => {
        setShowWizard(false);
        resetForm();
    };

    const savePolicy = async () => {
        if (!formData.name.trim()) {
            alert('Please enter a policy name');
            return;
        }

        try {
            setSaving(true);
            let policyId = editingPolicy?.id;

            if (editingPolicy) {
                // Update existing policy
                const { error } = await supabase
                    .from('access_policies')
                    .update({
                        name: formData.name,
                        description: formData.description,
                        status: formData.status,
                        priority: formData.priority,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingPolicy.id);

                if (error) throw error;

                // Delete existing related data
                await Promise.all([
                    supabase.from('access_policy_targets').delete().eq('policy_id', editingPolicy.id),
                    supabase.from('access_policy_conditions').delete().eq('policy_id', editingPolicy.id),
                    supabase.from('access_policy_actions').delete().eq('policy_id', editingPolicy.id),
                    supabase.from('access_policy_constraints').delete().eq('policy_id', editingPolicy.id),
                ]);
            } else {
                // Create new policy
                const { data, error } = await supabase
                    .from('access_policies')
                    .insert({
                        name: formData.name,
                        description: formData.description,
                        status: formData.status,
                        priority: formData.priority,
                    })
                    .select()
                    .single();

                if (error) throw error;
                policyId = data.id;
            }

            // Insert targets
            if (formData.targets.length > 0) {
                const targetsToInsert = formData.targets.map(t => ({
                    policy_id: policyId,
                    target_type: t.type,
                    target_id: t.targetId,
                }));
                await supabase.from('access_policy_targets').insert(targetsToInsert);
            }

            // Insert conditions
            if (formData.conditions.length > 0) {
                const conditionsToInsert = formData.conditions.map(c => ({
                    policy_id: policyId,
                    field: c.field,
                    operator: c.operator,
                    value: c.value,
                }));
                await supabase.from('access_policy_conditions').insert(conditionsToInsert);
            }

            // Insert actions
            if (formData.actions.length > 0) {
                const actionsToInsert = formData.actions.map(a => ({
                    policy_id: policyId,
                    action: a.action,
                    allowed: a.allowed,
                }));
                await supabase.from('access_policy_actions').insert(actionsToInsert);
            }

            // Insert constraints
            if (formData.constraints.length > 0) {
                const constraintsToInsert = formData.constraints.map(c => ({
                    policy_id: policyId,
                    constraint_type: c.constraintType,
                    value: c.value || {},
                }));
                await supabase.from('access_policy_constraints').insert(constraintsToInsert);
            }

            closeWizard();
            fetchPolicies();
        } catch (err: any) {
            console.error('Error saving policy:', err);
            alert('Error saving policy: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const togglePolicyStatus = async (id: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            await supabase.from('access_policies').update({ status: newStatus }).eq('id', id);
            fetchPolicies();
        } catch (err) {
            console.error('Error toggling status:', err);
        }
    };

    const toggleTarget = (type: 'role' | 'group' | 'user', id: string, name: string) => {
        setFormData(prev => {
            const exists = prev.targets.find(t => t.type === type && t.targetId === id);
            if (exists) {
                return { ...prev, targets: prev.targets.filter(t => !(t.type === type && t.targetId === id)) };
            }
            return { ...prev, targets: [...prev.targets, { type, targetId: id, name }] };
        });
    };

    const addCondition = () => {
        setFormData(prev => ({
            ...prev,
            conditions: [...prev.conditions, { field: 'department', operator: 'in', value: [] }],
        }));
    };

    const updateCondition = (index: number, updates: Partial<ScopeCondition>) => {
        setFormData(prev => ({
            ...prev,
            conditions: prev.conditions.map((c, i) => i === index ? { ...c, ...updates } : c),
        }));
    };

    const removeCondition = (index: number) => {
        setFormData(prev => ({
            ...prev,
            conditions: prev.conditions.filter((_, i) => i !== index),
        }));
    };

    const toggleAction = (actionId: string) => {
        setFormData(prev => {
            const exists = prev.actions.find(a => a.action === actionId);
            if (exists) {
                return { ...prev, actions: prev.actions.filter(a => a.action !== actionId) };
            }
            return { ...prev, actions: [...prev.actions, { action: actionId, allowed: true }] };
        });
    };

    const toggleConstraint = (constraintType: string) => {
        setFormData(prev => {
            const exists = prev.constraints.find(c => c.constraintType === constraintType);
            if (exists) {
                return { ...prev, constraints: prev.constraints.filter(c => c.constraintType !== constraintType) };
            }
            return { ...prev, constraints: [...prev.constraints, { constraintType, value: { enabled: true } }] };
        });
    };

    const getTargetsSummary = (targets: PolicyTarget[]) => {
        if (targets.length === 0) return 'No one';
        return targets.slice(0, 3).map(t => t.name).join(', ') + (targets.length > 3 ? ` +${targets.length - 3}` : '');
    };

    const getScopeSummary = (conditions: ScopeCondition[]) => {
        if (conditions.length === 0) return 'All Tickets';
        return conditions.map(c => `${c.field}: ${c.value.join(', ')}`).slice(0, 2).join(' • ');
    };

    const getActionsSummary = (actions: { action: string; allowed: boolean }[]) => {
        return actions.filter(a => a.allowed).map(a => actionOptions.find(o => o.id === a.action)?.label).filter(Boolean).slice(0, 3).join(', ');
    };

    const generateHumanSummary = () => {
        const targets = formData.targets.length > 0 ? formData.targets.map(t => t.name).join(', ') : 'Selected users';
        const actions = formData.actions.filter(a => a.allowed).map(a => actionOptions.find(o => o.id === a.action)?.label?.toLowerCase()).filter(Boolean).join(' and ');
        const scope = formData.conditions.length > 0 ? formData.conditions.map(c => `${c.field} = ${c.value.join('/')}`).join(' AND ') : 'all';

        let constraintText = '';
        if (formData.constraints.length > 0) {
            const texts = formData.constraints.map(c => constraintOptions.find(o => o.id === c.constraintType)?.label?.toLowerCase()).filter(Boolean);
            if (texts.length > 0) constraintText = ` (${texts.join(', ')})`;
        }

        return `${targets} can ${actions || 'access'} ${scope} tickets${constraintText}.`;
    };

    const checkTicketMatch = (ticket: typeof sampleTickets[0]) => {
        if (formData.conditions.length === 0) return true;
        const ticketData: Record<string, string> = { category: ticket.category, department: ticket.department, priority: ticket.priority };
        return formData.conditions.every(c => c.value.includes(ticketData[c.field] || ''));
    };

    const filteredPolicies = policies.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Dynamic scope fields with departments from database
    const scopeFields = [
        { id: 'department', label: 'Department', options: departments },
        ...staticScopeFields
    ];

    const steps = [
        { num: 1, title: 'Applies to', subtitle: 'Select roles, groups, or users' },
        { num: 2, title: 'Ticket Scope', subtitle: 'Define ticket scope' },
        { num: 3, title: 'Allowed Actions', subtitle: 'Select allowed actions' },
        { num: 4, title: 'Constraints', subtitle: 'Optional restrictions' },
        { num: 5, title: 'Summary', subtitle: 'Preview your policy' },
    ];

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
                            <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-800">If a user matches multiple policies, the most restrictive rule applies.</p>
                        </div>

                        {/* Roles */}
                        <div>
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Shield size={16} className="text-indigo-600" /> Roles
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {roles.map(role => (
                                    <label key={role.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${formData.targets.find(t => t.type === 'role' && t.targetId === role.id)
                                        ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                        <input type="checkbox" checked={!!formData.targets.find(t => t.type === 'role' && t.targetId === role.id)}
                                            onChange={() => toggleTarget('role', role.id, role.name)} className="w-4 h-4 text-indigo-600 rounded" />
                                        <span className="text-sm font-medium text-gray-700">{role.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Groups */}
                        <div>
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Users size={16} className="text-indigo-600" /> Groups
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {groups.map(group => (
                                    <label key={group.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${formData.targets.find(t => t.type === 'group' && t.targetId === group.id)
                                        ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                        <input type="checkbox" checked={!!formData.targets.find(t => t.type === 'group' && t.targetId === group.id)}
                                            onChange={() => toggleTarget('group', group.id, group.name)} className="w-4 h-4 text-indigo-600 rounded" />
                                        <span className="text-sm font-medium text-gray-700">{group.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Users */}
                        <div>
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Users size={16} className="text-indigo-600" /> Specific Users
                            </h4>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                {users.map(user => (
                                    <label key={user.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${formData.targets.find(t => t.type === 'user' && t.targetId === user.id)
                                        ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                        <input type="checkbox" checked={!!formData.targets.find(t => t.type === 'user' && t.targetId === user.id)}
                                            onChange={() => toggleTarget('user', user.id, user.name)} className="w-4 h-4 text-indigo-600 rounded" />
                                        <span className="text-sm font-medium text-gray-700">{user.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                            <h4 className="font-semibold text-gray-800 mb-4">Ticket Conditions</h4>

                            {formData.conditions.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">No conditions added. This policy will apply to ALL tickets.</p>
                            ) : (
                                <div className="space-y-3">
                                    {formData.conditions.map((condition, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                                            <select value={condition.field} onChange={(e) => updateCondition(idx, { field: e.target.value, value: [] })}
                                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                                {scopeFields.map(f => (<option key={f.id} value={f.id}>{f.label}</option>))}
                                            </select>
                                            <span className="text-gray-400">=</span>
                                            <div className="flex-1 flex flex-wrap gap-1">
                                                {scopeFields.find(f => f.id === condition.field)?.options.map(opt => (
                                                    <button key={opt} onClick={() => {
                                                        const newVal = condition.value.includes(opt) ? condition.value.filter(v => v !== opt) : [...condition.value, opt];
                                                        updateCondition(idx, { value: newVal });
                                                    }} className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${condition.value.includes(opt) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}>{opt}</button>
                                                ))}
                                            </div>
                                            <button onClick={() => removeCondition(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button onClick={addCondition}
                                className="mt-4 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
                                <Plus size={16} /> Add Condition
                            </button>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">Destructive actions (marked with ⚠️) are disabled by default for safety.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {actionOptions.map(action => (
                                <label key={action.id} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border-2 transition-all ${formData.actions.find(a => a.action === action.id)
                                    ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}>
                                    <input type="checkbox" checked={!!formData.actions.find(a => a.action === action.id)}
                                        onChange={() => toggleAction(action.id)} className="w-5 h-5 text-indigo-600 rounded" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-800">{action.label}</span>
                                            {!action.safe && <span className="text-amber-500">⚠️</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">Add optional constraints to make this policy more specific.</p>

                        {constraintOptions.map(item => (
                            <label key={item.id} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border-2 transition-all ${formData.constraints.find(c => c.constraintType === item.id)
                                ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${formData.constraints.find(c => c.constraintType === item.id) ? 'bg-indigo-100' : 'bg-gray-100'
                                    }`}>
                                    <item.icon size={20} className={formData.constraints.find(c => c.constraintType === item.id) ? 'text-indigo-600' : 'text-gray-500'} />
                                </div>
                                <div className="flex-1">
                                    <span className="font-medium text-gray-800">{item.label}</span>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                                </div>
                                <input type="checkbox" checked={!!formData.constraints.find(c => c.constraintType === item.id)}
                                    onChange={() => toggleConstraint(item.id)} className="w-5 h-5 text-indigo-600 rounded" />
                            </label>
                        ))}
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Policy Name *</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g., IT Agent Ticket Access"
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                                <input type="number" value={formData.priority} onChange={(e) => setFormData(p => ({ ...p, priority: parseInt(e.target.value) || 100 }))}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                            <textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                                placeholder="Optional description..." rows={2}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                        </div>

                        <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-green-600" /> Policy Summary
                            </h4>
                            <p className="text-gray-700 leading-relaxed">{generateHumanSummary()}</p>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-800 mb-3">Preview: Sample Tickets</h4>
                            <div className="space-y-2">
                                {sampleTickets.map(ticket => {
                                    const matches = checkTicketMatch(ticket);
                                    return (
                                        <div key={ticket.id} className={`flex items-center gap-3 p-3 rounded-xl border ${matches ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                            }`}>
                                            {matches ? <CheckCircle2 size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-500" />}
                                            <div className="flex-1">
                                                <span className="font-medium text-gray-800">{ticket.id}</span>
                                                <span className="text-gray-500 text-sm ml-2">({ticket.category} - {ticket.department})</span>
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${matches ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {matches ? 'Allowed' : 'Blocked'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    if (loading) {
        return (
            <div className="p-8 bg-[#f3f4f6] min-h-screen flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-8 bg-[#f3f4f6] min-h-screen">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Shield size={20} className="text-white" />
                            </div>
                            Access Policies
                        </h1>
                        <p className="text-gray-500 mt-1">Define what data users can access and act on</p>
                    </div>
                    <button onClick={() => openWizard()}
                        className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-200">
                        <Plus size={18} /> Create Policy
                    </button>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
                    <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-blue-800 font-medium">Roles vs Access Policies</p>
                        <p className="text-sm text-blue-700 mt-1">
                            <strong>Roles</strong> define what menus users can access. <strong>Access Policies</strong> define what data they can act on.
                        </p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search policies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Policy Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Applies To</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Scope</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredPolicies.map((policy) => (
                            <tr key={policy.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => openWizard(policy)}>
                                <td className="px-6 py-4">
                                    <p className="font-semibold text-gray-800">{policy.name}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{policy.description || 'No description'}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {policy.targets.slice(0, 2).map((t, i) => (
                                            <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg">{t.name}</span>
                                        ))}
                                        {policy.targets.length > 2 && <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg">+{policy.targets.length - 2}</span>}
                                        {policy.targets.length === 0 && <span className="text-gray-400 text-xs">None</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4"><span className="text-sm text-gray-600">{getScopeSummary(policy.conditions)}</span></td>
                                <td className="px-6 py-4"><span className="text-sm text-gray-600">{getActionsSummary(policy.actions)}</span></td>
                                <td className="px-6 py-4 text-center" onClick={(e) => { e.stopPropagation(); togglePolicyStatus(policy.id, policy.status); }}>
                                    <button className={`px-3 py-1.5 rounded-full text-xs font-bold ${policy.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {policy.status === 'active' ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openWizard(policy); }}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                        title="View policy details"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredPolicies.length === 0 && (
                    <div className="text-center py-16">
                        <Shield size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">{searchQuery ? 'No policies match your search' : 'No policies yet'}</p>
                        <button onClick={() => openWizard()} className="mt-4 text-indigo-600 font-medium hover:underline">Create your first policy</button>
                    </div>
                )}
            </div>

            {/* Wizard Modal */}
            {showWizard && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">{editingPolicy ? 'Edit Policy' : 'Create Access Policy'}</h2>
                                <p className="text-sm text-gray-500 mt-1">{steps[currentStep - 1].subtitle}</p>
                            </div>
                            <button onClick={closeWizard} className="p-2 hover:bg-gray-100 rounded-xl"><X size={20} className="text-gray-500" /></button>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                {steps.map((step, idx) => (
                                    <React.Fragment key={step.num}>
                                        <button onClick={() => setCurrentStep(step.num)}
                                            className={`flex items-center gap-2 ${currentStep === step.num ? 'text-indigo-600' : currentStep > step.num ? 'text-green-600' : 'text-gray-400'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep === step.num ? 'bg-indigo-600 text-white' : currentStep > step.num ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
                                                }`}>{currentStep > step.num ? <Check size={16} /> : step.num}</div>
                                            <span className="hidden md:block text-sm font-medium">{step.title}</span>
                                        </button>
                                        {idx < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-2" />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">{renderStepContent()}</div>

                        <div className="p-6 border-t border-gray-100 flex items-center justify-between">
                            <button onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : closeWizard()}
                                className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl">
                                {currentStep === 1 ? 'Cancel' : 'Back'}
                            </button>
                            <button onClick={() => currentStep < 5 ? setCurrentStep(currentStep + 1) : savePolicy()} disabled={saving}
                                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : currentStep === 5 ? (
                                    <><Check size={16} /> {editingPolicy ? 'Update' : 'Create'} Policy</>
                                ) : (<>Continue <ChevronRight size={16} /></>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccessPolicy;
