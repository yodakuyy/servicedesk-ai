import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Plus, 
    Mail, 
    FileText, 
    Save, 
    Loader2, 
    ChevronRight, 
    Info, 
    Code, 
    Layout, 
    CheckCircle2, 
    AlertTriangle,
    Building2,
    Settings2,
    ArrowLeft,
    RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import RichTextEditor from './RichTextEditor';
// @ts-ignore
import Swal from 'sweetalert2';

interface EmailTemplate {
    id?: string;
    company_id: number | null; // null for global default
    event_key: string;
    subject: string;
    body: string;
    is_active: boolean;
    updated_at?: string;
}

interface Department {
    company_id: number;
    company_name: string;
}

const DEFAULT_TEMPLATES = [
    {
        key: 'ticket_created',
        label: 'Ticket Created Confirmation (Customer)',
        description: 'Sent to requester after submitting a new ticket',
        defaultSubject: 'Ticket Received: {ticket_number} - {ticket_subject}',
        defaultBody: `
            <p>Hello {requester_name},</p>
            <p>We have received your ticket regarding <strong>{ticket_subject}</strong>. Your ticket number is <strong>{ticket_number}</strong>.</p>
            <p>Our team will review your request and get back to you shortly.</p>
            <p>Best regards,<br/>{department_name} Team</p>
        `
    },
    {
        key: 'agent_replied',
        label: 'Agent Replied Notification (Customer)',
        description: 'Sent to requester when an agent replies to their ticket',
        defaultSubject: 'New Update on Ticket {ticket_number}',
        defaultBody: `
            <p>Hello {requester_name},</p>
            <p>An agent has replied to your ticket <strong>{ticket_number}</strong>:</p>
            <div style="padding: 15px; background-color: #f9fafb; border-radius: 8px; margin: 15px 0;">
                {reply_content}
            </div>
            <p>You can view the full ticket details here: <a href="{ticket_url}">View Ticket</a></p>
            <p>Best regards,<br/>{department_name} Team</p>
        `
    },
    {
        key: 'ticket_resolved',
        label: 'Ticket Resolved (Customer)',
        description: 'Sent to requester when their ticket is marked as resolved',
        defaultSubject: 'Your ticket {ticket_number} has been resolved',
        defaultBody: `
            <p>Hello {requester_name},</p>
            <p>Great news! Your ticket <strong>{ticket_number}</strong> regarding <strong>{ticket_subject}</strong> has been marked as <strong>Resolved</strong>.</p>
            <p>If you have any further questions, please feel free to reply to this email.</p>
            <p>Best regards,<br/>{department_name} Team</p>
        `
    },
    {
        key: 'new_ticket_assigned',
        label: 'New Ticket Assigned (Agent)',
        description: 'Sent to an agent when a ticket is assigned to them',
        defaultSubject: 'New Ticket Assigned: {ticket_number}',
        defaultBody: `
            <p>Hello {agent_name},</p>
            <p>A new ticket has been assigned to you:</p>
            <ul>
                <li><strong>Number:</strong> {ticket_number}</li>
                <li><strong>Subject:</strong> {ticket_subject}</li>
                <li><strong>Requester:</strong> {requester_name}</li>
            </ul>
            <p><a href="{ticket_url}">Open Ticket in Dashboard</a></p>
        `
    },
    {
        key: 'customer_reply',
        label: 'Requester Replied (Agent)',
        description: 'Sent to agent when the requester replies to a ticket',
        defaultSubject: 'Requester Update: Ticket {ticket_number}',
        defaultBody: `
            <p>Hello {agent_name},</p>
            <p>The requester <strong>{requester_name}</strong> has replied to ticket <strong>{ticket_number}</strong>.</p>
            <div style="padding: 15px; background-color: #f0fdf4; border-radius: 8px; margin: 15px 0;">
                {reply_content}
            </div>
            <p><a href="{ticket_url}">View in Dashboard</a></p>
        `
    },
    {
        key: 'ticket_escalated',
        label: 'Ticket Escalated (Agent)',
        description: 'Sent when a ticket is escalated to a specific agent',
        defaultSubject: 'ESCALATION: Ticket {ticket_number} requires attention',
        defaultBody: `
            <p>Hello {agent_name},</p>
            <p>A ticket has been <strong>escalated</strong> to you for further action:</p>
            <ul>
                <li><strong>Ticket:</strong> {ticket_number}</li>
                <li><strong>Subject:</strong> {ticket_subject}</li>
            </ul>
            <p>Please review the escalation notes in the dashboard.</p>
            <p><a href="{ticket_url}">Open Ticket</a></p>
        `
    },
    {
        key: 'sla_warning',
        label: 'SLA Warning (Agent/Supervisor)',
        description: 'Sent when a ticket is approaching SLA breach',
        defaultSubject: 'SLA WARNING: Ticket {ticket_number} is approaching deadline',
        defaultBody: `
            <p>Hello,</p>
            <p>This is an automated warning that ticket <strong>{ticket_number}</strong> is approaching its SLA deadline.</p>
            <p><strong>Subject:</strong> {ticket_subject}<br/>
            <strong>Time Remaining:</strong> {time_remaining}</p>
            <p>Please take immediate action to avoid breach.</p>
            <p><a href="{ticket_url}">View Ticket</a></p>
        `
    },
    {
        key: 'mentioned_in_comment',
        label: 'Mentioned in Comment (Agent)',
        description: 'Sent when someone @mentions an agent in a comment',
        defaultSubject: 'You were mentioned in a comment on Ticket {ticket_number}',
        defaultBody: `
            <p>Hello {agent_name},</p>
            <p>You were mentioned in a comment on ticket <strong>{ticket_number}</strong>:</p>
            <div style="padding: 15px; border-left: 4px solid #6366f1; background-color: #f8fafc; margin: 15px 0;">
                {reply_content}
            </div>
            <p><a href="{ticket_url}">Reply to Comment</a></p>
        `
    }
];

const EmailTemplates: React.FC = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<number | 'global'>('global');
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchDepartments();
        fetchTemplates();
    }, []);

    const fetchDepartments = async () => {
        try {
            const { data, error } = await supabase
                .from('company')
                .select('company_id, company_name')
                .eq('is_active', true)
                .order('company_name');
            
            if (error) throw error;
            setDepartments(data || []);
        } catch (err) {
            console.error('Error fetching departments:', err);
        }
    };

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('email_templates')
                .select('*');
            
            if (error) {
                // If table doesn't exist, we'll just use the empty array for now
                // In a real scenario, we'd handle the migration
                console.warn('email_templates table might not exist:', error.message);
                setTemplates([]);
            } else {
                setTemplates(data || []);
            }
        } catch (err) {
            console.error('Error fetching templates:', err);
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    };

    const currentTemplate = useMemo(() => {
        if (!selectedTemplateKey) return null;
        
        // Find existing template for this dept/global
        const existing = templates.find(t => 
            t.event_key === selectedTemplateKey && 
            (selectedDeptId === 'global' ? t.company_id === null : t.company_id === selectedDeptId)
        );

        if (existing) return existing;

        // Otherwise return a new template object with defaults
        const def = DEFAULT_TEMPLATES.find(d => d.key === selectedTemplateKey);
        return {
            company_id: selectedDeptId === 'global' ? null : selectedDeptId as number,
            event_key: selectedTemplateKey,
            subject: def?.defaultSubject || '',
            body: def?.defaultBody || '',
            is_active: true
        };
    }, [selectedTemplateKey, selectedDeptId, templates]);

    useEffect(() => {
        if (currentTemplate) {
            setEditingTemplate({ ...currentTemplate });
        } else {
            setEditingTemplate(null);
        }
    }, [currentTemplate]);

    const handleSave = async () => {
        if (!editingTemplate) return;
        setSaving(true);
        try {
            const payload = {
                ...editingTemplate,
                updated_at: new Date().toISOString()
            };

            // Use ID for conflict resolution if it exists, otherwise use the unique constraint
            const options = editingTemplate.id 
                ? { onConflict: 'id' } 
                : { onConflict: 'company_id,event_key' };

            const { error } = await supabase
                .from('email_templates')
                .upsert(payload, options);

            if (error) throw error;

            await fetchTemplates();
            
            Swal.fire({
                icon: 'success',
                title: 'Template Saved',
                text: 'Email template has been updated successfully.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (err: any) {
            console.error('Error saving template:', err);
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: err.message || 'An error occurred while saving the template.'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleResetToDefault = () => {
        const def = DEFAULT_TEMPLATES.find(d => d.key === selectedTemplateKey);
        if (def && editingTemplate) {
            setEditingTemplate({
                ...editingTemplate,
                subject: def.defaultSubject,
                body: def.defaultBody
            });
        }
    };

    const placeholders = [
        { label: 'Ticket Number', key: '{ticket_number}' },
        { label: 'Ticket Subject', key: '{ticket_subject}' },
        { label: 'Requester Name', key: '{requester_name}' },
        { label: 'Department Name', key: '{department_name}' },
        { label: 'Ticket URL', key: '{ticket_url}' },
        { label: 'Agent Name', key: '{agent_name}' },
        { label: 'Reply Content', key: '{reply_content}' },
        { label: 'Current Date', key: '{current_date}' },
    ];

    if (loading && templates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading templates...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            {/* Context Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                        <Building2 size={22} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-800">Department Scope</h4>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Configure templates per unit</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                        value={selectedDeptId}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSelectedDeptId(val === 'global' ? 'global' : parseInt(val));
                            setSelectedTemplateKey(null);
                        }}
                        className="w-full sm:w-64 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
                    >
                        <option value="global">🌍 Global (Default for all)</option>
                        {departments.map(dept => (
                            <option key={dept.company_id} value={dept.company_id}>
                                🏢 {dept.company_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                {/* Left Panel: Template List */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search templates..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                        />
                    </div>
                    
                    <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {DEFAULT_TEMPLATES.filter(t => 
                            t.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.description.toLowerCase().includes(searchTerm.toLowerCase())
                        ).map(t => {
                            const isActive = selectedTemplateKey === t.key;
                            const isOverridden = templates.some(tmp => 
                                tmp.event_key === t.key && 
                                (selectedDeptId === 'global' ? tmp.company_id === null : tmp.company_id === selectedDeptId)
                            );

                            return (
                                <button
                                    key={t.key}
                                    onClick={() => setSelectedTemplateKey(t.key)}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                                        isActive 
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-1' 
                                            : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                        isActive ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-white group-hover:text-indigo-600'
                                    }`}>
                                        <Mail size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h5 className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-gray-800'}`}>
                                                {t.label}
                                            </h5>
                                            {isOverridden && (
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                    isActive ? 'bg-indigo-400 text-white' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    Customized
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-[11px] mt-0.5 line-clamp-1 ${isActive ? 'text-indigo-100' : 'text-gray-500'}`}>
                                            {t.description}
                                        </p>
                                    </div>
                                    <ChevronRight size={18} className={`transition-transform ${isActive ? 'text-white translate-x-1' : 'text-gray-300 group-hover:text-indigo-400'}`} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Editor */}
                <div className="lg:col-span-8 flex flex-col">
                    {editingTemplate ? (
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden animate-in slide-in-from-right-4 duration-300">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setSelectedTemplateKey(null)}
                                        className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-gray-600 transition-colors sm:hidden"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            {DEFAULT_TEMPLATES.find(t => t.key === selectedTemplateKey)?.label}
                                            <Settings2 size={16} className="text-indigo-400" />
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5 font-medium">
                                            Editing template for {selectedDeptId === 'global' ? 'Global Default' : departments.find(d => d.company_id === selectedDeptId)?.company_name}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleResetToDefault}
                                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all active:scale-95"
                                    >
                                        <RotateCcw size={14} />
                                        Reset to Default
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {saving ? 'Saving...' : 'Save Template'}
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                                {/* Subject Input */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Email Subject</label>
                                        <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded">Required</span>
                                    </div>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={editingTemplate.subject}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                            placeholder="Enter email subject line..."
                                        />
                                    </div>
                                </div>

                                {/* Body Editor */}
                                <div className="space-y-2 flex-1 flex flex-col min-h-[400px]">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Email Content (HTML)</label>
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                            <Code size={10} /> Rich Text & Placeholders Supported
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <RichTextEditor
                                            content={editingTemplate.body}
                                            onChange={(html) => setEditingTemplate({ ...editingTemplate, body: html })}
                                            placeholder="Compose your email template here..."
                                            minHeight="350px"
                                        />
                                    </div>
                                </div>

                                {/* Available Placeholders */}
                                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Layout size={14} /> Available Placeholders
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {placeholders.map(p => (
                                            <button
                                                key={p.key}
                                                onClick={() => {
                                                    // Copy to clipboard or insert? Let's just copy for now
                                                    navigator.clipboard.writeText(p.key);
                                                    Swal.fire({
                                                        icon: 'info',
                                                        title: 'Copied',
                                                        text: `${p.key} copied to clipboard`,
                                                        toast: true,
                                                        position: 'top-end',
                                                        showConfirmButton: false,
                                                        timer: 2000
                                                    });
                                                }}
                                                className="group relative flex flex-col p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all text-left"
                                            >
                                                <span className="text-[10px] text-slate-500 font-bold mb-1 truncate">{p.label}</span>
                                                <code className="text-[11px] font-black text-indigo-600 group-hover:text-indigo-700">{p.key}</code>
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Plus size={12} className="text-indigo-400" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-4 italic flex items-center gap-1">
                                        <Info size={10} /> Click on a placeholder to copy it to your clipboard.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-dashed border-gray-300 flex flex-col items-center justify-center p-20 text-center h-full">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-300 mb-6 animate-pulse">
                                <Mail size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Select a Template</h3>
                            <p className="text-gray-500 mt-2 max-w-sm">
                                Choose a template from the left panel to customize the email content for the current department.
                            </p>
                            <div className="mt-8 flex flex-wrap justify-center gap-3">
                                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100">
                                    <CheckCircle2 size={14} /> Global Default
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-full text-xs font-bold border border-amber-100">
                                    <Building2 size={14} /> Dept. Specific
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100">
                                    <Layout size={14} /> Full Responsive
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Help Alert */}
            <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-amber-900">Email Configuration Notice</h4>
                    <p className="text-sm text-amber-800 mt-1">
                        Ensure your SMTP or Email API settings are correctly configured in the <strong>Global Settings</strong> to allow these templates to be sent. Templates use liquid-style placeholders which are replaced with actual data during dispatch.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EmailTemplates;
