import React, { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, Paperclip, Sparkles, Send, ChevronRight, X, Info, AlertCircle, Monitor, Wifi, Box, MoreHorizontal, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { applyAutoAssignment, getRoundRobinAgent } from '../lib/autoAssignment';
import RichTextEditor from './RichTextEditor';

interface RequesterCreateIncidentProps {
    onBack?: () => void;
    onSubmit?: (data: any) => void;
    userProfile?: any;
}

const generateAutoTags = (text: string): string[] => {
    const stopWords = new Set([
        'the', 'and', 'is', 'to', 'in', 'of', 'for', 'a', 'an', 'on', 'with', 'at', 'by',
        'dan', 'yang', 'di', 'ke', 'dari', 'ini', 'itu', 'saya', 'tidak', 'bisa', 'ada', 'karena', 'jika', 'atau', 'dengan', 'untuk', 'pada', 'adalah', 'sebagai', 'sudah', 'telah'
    ]);

    const words = text
        .toLowerCase()
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^\w\s-]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

    return Array.from(new Set(words)).slice(0, 8);
};

const RequesterCreateIncident: React.FC<RequesterCreateIncidentProps> = ({ onBack, onSubmit, userProfile }) => {
    // States
    const [affectedUser, setAffectedUser] = useState<'myself' | 'someone_else'>('myself');
    const [someoneElseDetails, setSomeoneElseDetails] = useState({ fullName: '', email: '', department: '' });
    const [myDepartment, setMyDepartment] = useState('');
    const [affectedUserId, setAffectedUserId] = useState<string | null>(null);
    const [searchingUser, setSearchingUser] = useState(false);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [showAINotice, setShowAINotice] = useState(false);
    const [issueType, setIssueType] = useState<string>('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [openStatusId, setOpenStatusId] = useState<string | null>(null);
    const [aiInsight, setAiInsight] = useState<any | null>(null);
    const [groupIds, setGroupIds] = useState<{ [key: string]: string }>({});
    const [categories, setCategories] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [suggestedArticles, setSuggestedArticles] = useState<any[]>([]);
    const [viewingArticle, setViewingArticle] = useState<any | null>(null);

    // Initial Data Fetch
    useEffect(() => {
        const initData = async () => {
            const { data: statusData } = await supabase.from('ticket_statuses').select('status_id').eq('status_name', 'Open').single();
            if (statusData) setOpenStatusId(statusData.status_id);

            const { data: groupsData } = await supabase.from('groups').select('id, name');
            if (groupsData) {
                const mapping: { [key: string]: string } = {};
                groupsData.forEach((g: any) => {
                    const name = g.name.toLowerCase();
                    if (name.includes('software') || name.includes('application')) mapping['SOFTWARE'] = g.id;
                    if (name.includes('endpoint') || name.includes('hardware') || name.includes('network')) mapping['ENDPOINT'] = g.id;
                });
                setGroupIds(mapping);
            }

            const { data: catData } = await supabase.from('ticket_categories').select('id, name').eq('category_type', 'incident');
            if (catData) setCategories(catData);

            const { data: svcData } = await supabase.from('services').select('id, name').eq('is_active', true);
            if (svcData) setServices(svcData);
        };
        initData();
    }, []);

    // User Search Logic
    useEffect(() => {
        if (affectedUser === 'myself') {
            setAffectedUserId(userProfile?.id || null);
            return;
        }
        const searchUser = async () => {
            if (!someoneElseDetails.email.includes('@')) return;
            setSearchingUser(true);
            try {
                const { data } = await supabase.from('profiles').select('id, full_name').eq('email', someoneElseDetails.email).single();
                if (data) {
                    setAffectedUserId(data.id);
                    if (!someoneElseDetails.fullName) setSomeoneElseDetails(prev => ({ ...prev, fullName: data.full_name }));
                } else {
                    setAffectedUserId(null);
                }
            } catch (err) {
                setAffectedUserId(null);
            } finally {
                setSearchingUser(false);
            }
        };
        const timer = setTimeout(searchUser, 1000);
        return () => clearTimeout(timer);
    }, [someoneElseDetails.email, affectedUser, userProfile?.id]);

    // Helpers
    const getSystemClassification = (type: string, subj: string, desc: string) => {
        const text = `${subj} ${desc}`.toLowerCase();
        let bestCategory = categories[0];
        let highestScore = -1;

        categories.forEach(cat => {
            const name = cat.name.toLowerCase();
            let score = text.includes(name) ? 10 : 0;
            if (type === 'hardware' && (name.includes('hardware') || name.includes('device'))) score += 20;
            if (score > highestScore) { highestScore = score; bestCategory = cat; }
        });

        const bestService = services.find(s => text.includes(s.name.toLowerCase())) || services[0];
        return { category_id: bestCategory?.id, service_id: bestService?.id };
    };

    const calculatePriority = (subj: string, desc: string) => {
        const text = `${subj} ${desc}`.toLowerCase();
        if (text.includes('urgent') || text.includes('critical') || text.includes('down')) return 'urgent';
        if (text.includes('error') || text.includes('unable') || text.includes('slow')) return 'high';
        return 'medium';
    };

    // AI Insight Simulation
    useEffect(() => {
        if (description.length < 10) return;
        const timer = setTimeout(() => {
            const text = description.toLowerCase();
            let summary = "User reported an issue.";
            if (text.includes('software')) summary = "Likely a software issue.";
            else if (text.includes('hardware')) summary = "Likely a hardware issue.";
            setAiInsight({ summary, confidence_level: 'medium' });
            setShowAINotice(text.includes('password'));
        }, 1000);
        return () => clearTimeout(timer);
    }, [description, subject]);

    // KB Search
    useEffect(() => {
        if (subject.length < 3) { setSuggestedArticles([]); return; }
        const timer = setTimeout(async () => {
            const words = subject.toLowerCase().split(' ').filter(w => w.length > 3);
            if (words.length === 0) return;
            const query = words.map(w => `title.ilike.%${w}%`).join(',');
            const { data } = await supabase.from('kb_articles').select('id, title, summary, content, updated_at').or(query).limit(5);
            if (data) setSuggestedArticles(data);
        }, 500);
        return () => clearTimeout(timer);
    }, [subject]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage(null);

        if (!openStatusId) { setErrorMessage("System error: Status missing."); setIsSubmitting(false); return; }

        let category_id = null;
        let service_id = null;
        let calculatedPriority = 'medium';
        let assignedGroupId = null;
        let assignedAgentId = null;

        try {
            const classification = getSystemClassification(issueType, subject, description);
            category_id = classification.category_id;
            service_id = classification.service_id;
            calculatedPriority = calculatePriority(subject, description);

            const autoAssignResult = await applyAutoAssignment({ category: issueType, priority: calculatedPriority, subject, source: 'portal' });

            if (autoAssignResult.assigned) {
                assignedGroupId = autoAssignResult.groupId;
                assignedAgentId = autoAssignResult.agentId;
            } else {
                let targetGroupId = null;
                let strategy = 'manual';
                let currentCatId: string | null = category_id;
                let depth = 0;

                while (currentCatId && !targetGroupId && depth < 5) {
                    const { data: catData } = await supabase.from('ticket_categories').select('default_group_id, parent_id, assignment_strategy').eq('id', currentCatId).single();
                    if (catData?.default_group_id) {
                        targetGroupId = catData.default_group_id;
                        strategy = catData.assignment_strategy || 'manual';
                    } else { currentCatId = catData?.parent_id || null; depth++; }
                }

                if (targetGroupId) {
                    assignedGroupId = targetGroupId;
                    if (strategy === 'round_robin') {
                        assignedAgentId = await getRoundRobinAgent(targetGroupId);
                    } else {
                        const { data: groupData } = await supabase.from('groups').select('assign_tasks_first, supervisor_id').eq('id', targetGroupId).single();
                        if (groupData?.assign_tasks_first && groupData.supervisor_id) assignedAgentId = groupData.supervisor_id;
                    }
                }
            }

            if (!assignedGroupId) {
                if (issueType === 'software') assignedGroupId = groupIds['SOFTWARE'];
                else assignedGroupId = groupIds['ENDPOINT'];
            }

            const autoTags = generateAutoTags(subject + ' ' + description);
            let finalDescription = description;
            if (affectedUser === 'someone_else') {
                finalDescription = `<div style="background:#fefce8; border:1px solid #fef08a; padding:16px; border-radius:12px; margin-bottom:20px;">
                    <b>Reported for:</b> ${someoneElseDetails.fullName} (${someoneElseDetails.email})
                </div>` + description;
            }

            const { data: ticketData, error: ticketError } = await supabase.from('tickets').insert({
                subject, description: finalDescription, tags: autoTags, status_id: openStatusId,
                ticket_number: `INC-${Math.floor(Math.random() * 90000) + 10000}`,
                priority: calculatedPriority, requester_id: affectedUserId || userProfile?.id,
                created_by: userProfile?.id, ticket_type: 'incident', assignment_group_id: assignedGroupId,
                assigned_to: assignedAgentId, category_id, service_id
            }).select().single();

            if (ticketError) throw ticketError;

            if (attachment && ticketData) {
                const path = `tickets/${ticketData.id}/${Date.now()}_${attachment.name}`;
                await supabase.storage.from('ticket-attachments').upload(path, attachment);
                await supabase.from('ticket_attachments').insert({ ticket_id: ticketData.id, file_name: attachment.name, file_path: path, mime_type: attachment.type, uploaded_by: userProfile?.id });
            }

            setIsSuccess(true);
            setTimeout(() => onSubmit && onSubmit({ ticketId: ticketData.id }), 1500);

        } catch (err: any) {
            setErrorMessage(err.message);
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle2 size={48} />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black text-gray-900">Ticket Created!</h2>
                    <p className="text-gray-500">Your request has been submitted successfully.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-center pb-6 border-b border-gray-100">
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
                    <ArrowLeft size={16} /> Back to List
                </button>
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <Sparkles size={16} /> AI-Powered Support
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
                {/* Section 1: User */}
                <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Monitor size={20} /></div>
                        <h2 className="text-xl font-black text-gray-900">Requested For</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setAffectedUser('myself')} className={`p-4 rounded-2xl border-2 transition-all text-left ${affectedUser === 'myself' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                            <div className="font-bold text-gray-900">Reporting for Myself</div>
                            <div className="text-xs text-gray-500">{userProfile?.full_name || 'Current User'}</div>
                        </button>
                        <button type="button" onClick={() => setAffectedUser('someone_else')} className={`p-4 rounded-2xl border-2 transition-all text-left ${affectedUser === 'someone_else' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                            <div className="font-bold text-gray-900">Someone Else</div>
                            <div className="text-xs text-gray-500">Report for a colleague</div>
                        </button>
                    </div>

                    {affectedUser === 'someone_else' && (
                        <div className="grid grid-cols-2 gap-4 pt-4 animate-in slide-in-from-top-2">
                            <input placeholder="Email Address" type="email" required value={someoneElseDetails.email} onChange={e => setSomeoneElseDetails(p => ({ ...p, email: e.target.value }))} className="p-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500" />
                            <input placeholder="Full Name" type="text" required value={someoneElseDetails.fullName} onChange={e => setSomeoneElseDetails(p => ({ ...p, fullName: e.target.value }))} className="p-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    )}
                </section>

                {/* Section 2: Problem */}
                <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><Info size={20} /></div>
                        <h2 className="text-xl font-black text-gray-900">Problem Details</h2>
                    </div>
                    <div className="space-y-4">
                        <input placeholder="Short summary of the issue..." required value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-2xl text-lg font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500" />

                        {suggestedArticles.length > 0 && (
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
                                <div className="text-xs font-black text-blue-600 uppercase flex items-center gap-2"><HelpCircle size={14} /> Suggested Solutions</div>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedArticles.map(art => (
                                        <button key={art.id} type="button" onClick={() => setViewingArticle(art)} className="text-xs bg-white px-3 py-2 rounded-lg border border-blue-100 hover:border-blue-300 transition-all font-medium text-blue-800">
                                            {art.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Full Description</label>
                            <RichTextEditor content={description} onChange={setDescription} placeholder="Tell us more about what happened..." />
                        </div>
                    </div>
                </section>

                {/* Section 3: Extra */}
                <div className="grid grid-cols-2 gap-6">
                    <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Issue Area</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['software', 'hardware', 'network'].map(t => (
                                <button key={t} type="button" onClick={() => setIssueType(t)} className={`p-3 rounded-xl border-2 capitalize font-bold text-sm transition-all ${issueType === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-50 text-gray-400 hover:border-gray-100'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Attachments</label>
                        <div className="relative">
                            <input type="file" onChange={e => setAttachment(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <div className="p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-center flex items-center justify-center gap-2 text-sm text-gray-500 font-medium">
                                <Paperclip size={16} /> {attachment ? attachment.name : 'Upload Screenshots'}
                            </div>
                        </div>
                    </section>
                </div>

                {errorMessage && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm font-bold flex items-center gap-3">
                        <AlertCircle size={20} /> {errorMessage}
                    </div>
                )}

                <button type="submit" disabled={isSubmitting || !subject || !description} className="w-full p-5 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400 transition-all flex items-center justify-center gap-3">
                    {isSubmitting ? 'Submitting...' : 'Submit Ticket'} <Send size={24} />
                </button>
            </form>

            {/* KB Article Modal */}
            {viewingArticle && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">{viewingArticle.title}</h3>
                            <button onClick={() => setViewingArticle(null)} className="p-2 hover:bg-indigo-500 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto prose prose-indigo max-w-none">
                            <div dangerouslySetInnerHTML={{ __html: typeof viewingArticle.content === 'string' ? viewingArticle.content : viewingArticle.content.solution }} />
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                            <button onClick={() => setViewingArticle(null)} className="px-6 py-2 font-bold text-gray-500 hover:text-gray-700">Close</button>
                            <button onClick={onBack} className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors">This Solved It!</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequesterCreateIncident;
