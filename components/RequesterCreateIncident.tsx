import React, { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, Paperclip, Sparkles, Send, ChevronRight, X, Info, AlertCircle, Monitor, Wifi, Box, MoreHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import RichTextEditor from './RichTextEditor';

interface RequesterCreateIncidentProps {
    onBack?: () => void;
    onSubmit?: (data: any) => void;
    userProfile?: any;
}

const RequesterCreateIncident: React.FC<RequesterCreateIncidentProps> = ({ onBack, onSubmit, userProfile }) => {
    // Section 1: Who is affected? (Requested For)
    const [affectedUser, setAffectedUser] = useState<'myself' | 'someone_else'>('myself');
    const [someoneElseDetails, setSomeoneElseDetails] = useState({
        fullName: '',
        email: '',
        department: ''
    });

    // User's department (Free text now)
    const [myDepartment, setMyDepartment] = useState('');

    // Section 2: What's the problem?
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [showAINotice, setShowAINotice] = useState(false);

    // Section 3: Classification (Issue Type)
    // Mapping keys: 'software', 'hardware', 'network', 'other'
    const [issueType, setIssueType] = useState<string>('');
    const [attachment, setAttachment] = useState<File | null>(null);

    // Submission State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [openStatusId, setOpenStatusId] = useState<string | null>(null);

    // AI & Categorization State
    const [aiInsight, setAiInsight] = useState<{
        suggested_category_id: string; // Still useful for metrics/AI
        confidence_level: 'high' | 'medium' | 'low';
        summary: string;
    } | null>(null);

    // Dynamic Group IDs fetched from DB
    const [groupIds, setGroupIds] = useState<{ [key: string]: string }>({});

    // Fetch 'Open' Status ID AND Assignment Groups
    useEffect(() => {
        const initData = async () => {
            // 1. Fetch Status ID
            const { data: statusData, error: statusError } = await supabase
                .from('ticket_statuses')
                .select('status_id')
                .eq('status_name', 'Open')
                .single();

            if (statusData) {
                setOpenStatusId(statusData.status_id);
            } else {
                console.error("Critical: 'Open' status not found in DB", statusError);
                setErrorMessage("System configuration error: Could not find 'Open' status.");
            }

            // 2. Fetch Assignment Groups (Dynamic)
            const { data: groupsData } = await supabase
                .from('groups')
                .select('id, name');

            if (groupsData) {
                const mapping: { [key: string]: string } = {};
                groupsData.forEach((g: any) => {
                    // Flexible matching
                    const name = g.name.toLowerCase();
                    if (name.includes('software') || name.includes('application')) mapping['SOFTWARE'] = g.id;
                    if (name.includes('endpoint') || name.includes('hardware') || name.includes('network')) mapping['ENDPOINT'] = g.id;
                });
                setGroupIds(mapping);
            }
        };
        initData();
    }, []);

    // AI Analysis Simulation (Runs when description changes) - used for Insights
    useEffect(() => {
        const analyzeTicket = () => {
            if (description.length < 10) return;

            // Simple Keyword Matching just to provide initial AI context in DB
            // This does NOT control routing anymore (Routing is User Selected via Issue Type)
            const text = `${subject} ${description}`.toLowerCase();
            let summary = "User reported an issue.";
            let confidence = 'medium';

            if (text.includes('software') || text.includes('app') || text.includes('error')) {
                summary = "Likely a software issue based on keywords.";
            } else if (text.includes('laptop') || text.includes('monitor') || text.includes('mouse')) {
                summary = "Likely a hardware issue based on keywords.";
            } else if (text.includes('wifi') || text.includes('internet') || text.includes('connect')) {
                summary = "Likely a network issue based on keywords.";
            }

            setAiInsight({
                suggested_category_id: '', // We don't force category ID here anymore
                confidence_level: confidence as any,
                summary: summary
            });

            // Trigger UI notice based on simplistic AI result
            if (text.includes('password') || text.includes('login')) {
                setShowAINotice(true);
            } else {
                setShowAINotice(false);
            }
        };

        const timer = setTimeout(analyzeTicket, 1000); // Debounce 1s
        return () => clearTimeout(timer);
    }, [description, subject]);


    // Handlers
    const handleSomeoneElseChange = (field: string, value: string) => {
        setSomeoneElseDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage(null);

        if (!openStatusId) {
            setErrorMessage("Cannot submit: System status configuration missing.");
            setIsSubmitting(false);
            return;
        }

        try {
            // Determine Assignment Group based on Issue Type
            let assignedGroupId = null;

            // Use IDs fetched from Real DB
            if (issueType === 'software') {
                assignedGroupId = groupIds['SOFTWARE'] || null;
            } else if (issueType === 'hardware' || issueType === 'network') {
                assignedGroupId = groupIds['ENDPOINT'] || null;
            }
            // If group not found, it stays null (Dispatcher will handle)

            // Prepare Description with "On Behalf Of" details if applicable
            let finalDescription = description;
            if (affectedUser === 'someone_else') {
                finalDescription = `**Reported on behalf of:** ${someoneElseDetails.fullName} (${someoneElseDetails.email})\n` +
                    (someoneElseDetails.department ? `**Department:** ${someoneElseDetails.department}\n` : '') +
                    `\n----------------------------------------\n\n` +
                    description;
            }

            // 1. Create Ticket in DB
            const ticketPayload = {
                subject: subject,
                description: finalDescription,
                status_id: openStatusId, // FK Reference
                ticket_number: `INC-${Math.floor(Math.random() * 100000)}`, // Random Number
                priority: 'medium', // Default, AI can update later
                requester_id: userProfile?.id, // FK
                created_by: userProfile?.id, // FK
                ticket_type: 'incident',
                assignment_group_id: assignedGroupId, // Re-enabled after RLS fix
            };

            const { data: ticketData, error: ticketError } = await supabase
                .from('tickets')
                .insert(ticketPayload)
                .select()
                .single();

            if (ticketError) {
                console.error("Supabase Ticket Insert Error:", ticketError);
                throw ticketError;
            }

            // 2. Insert AI Insights (Still valuable for Agent)
            if (aiInsight && ticketData) {
                await supabase
                    .from('ticket_ai_insights')
                    .insert({
                        ticket_id: ticketData.id,
                        summary: aiInsight.summary,
                        confidence_level: aiInsight.confidence_level,
                        // suggested_priority: 'medium' // Might be Enum or wrong column
                    });
            }

            setIsSuccess(true);

            // Wait for success animation
            setTimeout(() => {
                if (onSubmit) {
                    const affectedUserDetails = affectedUser === 'myself' ? { ...userProfile, department: myDepartment } : someoneElseDetails;
                    onSubmit({
                        ticketId: ticketData?.id,
                        affectedUser,
                        affectedUserDetails,
                        subject,
                        description,
                        // service, // Removing service state usage if not needed
                        attachment
                    });
                }
            }, 1500);

        } catch (error: any) {
            console.error("Error submitting incident:", error);
            setIsSubmitting(false);
            setErrorMessage(error.message || "Failed to submit ticket. Please try again.");
        }
    };

    // Validation
    const isSubjectValid = subject.trim().length > 0;
    // Description validation checks if string is not empty or just standard HTML tags
    const isDescriptionValid = description.trim().length > 0 && description !== '<p></p>';

    const isSomeoneElseValid = affectedUser === 'myself' ||
        (someoneElseDetails.fullName.trim().length > 0 && someoneElseDetails.email.trim().length > 0);
    // Issue Type IS NOW MANDATORY
    const isIssueTypeValid = issueType !== '';

    const isSubmitDisabled = !isSubjectValid || !isDescriptionValid || !isSomeoneElseValid || !isIssueTypeValid || isSubmitting;

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <Send className="w-12 h-12 text-green-600 ml-1" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Incident Submitted!</h2>
                <p className="text-gray-500 text-lg max-w-md text-center">
                    We have received your report and routed it to the correct team.
                </p>
                <p className="text-sm text-gray-400 mt-4">Redirecting you to ticket details...</p>
            </div>
        );
    }

    const myselfClassName = affectedUser === 'myself'
        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/20'
        : 'bg-white border-gray-200 hover:bg-gray-50';

    const someoneElseClassName = affectedUser === 'someone_else'
        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/20'
        : 'bg-white border-gray-200 hover:bg-gray-50';

    return (
        <div className="max-w-3xl mx-auto p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Navigation */}
            <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Incidents List
                </button>
                <button className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                    <HelpCircle size={16} />
                    Help Center
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">

                {/* 1. Requested For */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900">Requested For</h2>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${myselfClassName}`}>
                            <input
                                type="radio"
                                name="affectedUser"
                                value="myself"
                                checked={affectedUser === 'myself'}
                                onChange={() => setAffectedUser('myself')}
                                className="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-gray-900">Me</span>
                        </label>
                        <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${someoneElseClassName}`}>
                            <input
                                type="radio"
                                name="affectedUser"
                                value="someone_else"
                                checked={affectedUser === 'someone_else'}
                                onChange={() => setAffectedUser('someone_else')}
                                className="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-gray-900">Requested For</span>
                        </label>
                    </div>

                    {/* Show User Details if Myself */}
                    {affectedUser === 'myself' && (
                        <div className="p-6 bg-gray-50 border border-gray-100 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Full Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none"
                                        value={userProfile?.full_name || ''}
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Email Address</label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none"
                                        value={userProfile?.email || ''}
                                        readOnly
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Department <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                    value={myDepartment}
                                    onChange={(e) => setMyDepartment(e.target.value)}
                                    placeholder="e.g. Finance"
                                />
                            </div>
                        </div>
                    )}

                    {/* Show Inputs if Other User */}
                    {affectedUser === 'someone_else' && (
                        <div className="p-6 bg-gray-50 border border-indigo-100 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 ring-1 ring-indigo-500/20">
                            <div className="flex items-center gap-2 text-indigo-800 bg-indigo-50 p-3 rounded-lg text-sm mb-2">
                                <Info size={16} />
                                <span>Please provide details of the person you are requesting for.</span>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                        placeholder="e.g. John Doe"
                                        value={someoneElseDetails.fullName}
                                        onChange={(e) => handleSomeoneElseChange('fullName', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Email Address <span className="text-red-500">*</span></label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                        placeholder="john.doe@company.com"
                                        value={someoneElseDetails.email}
                                        onChange={(e) => handleSomeoneElseChange('email', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Department <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                    placeholder="e.g. Finance"
                                    value={someoneElseDetails.department}
                                    onChange={(e) => handleSomeoneElseChange('department', e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </section>

                {/* 2. Issue Type (NEW & REQUIRED) */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900">What type of issue is this? <span className="text-red-500">*</span></h2>
                    <div className="grid gap-3">
                        <label className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${issueType === 'software' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/20' : 'border-gray-200'}`}>
                            <input
                                type="radio"
                                name="issueType"
                                value="software"
                                checked={issueType === 'software'}
                                onChange={(e) => setIssueType(e.target.value)}
                                className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500 flex-shrink-0"
                            />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Monitor size={18} className="text-indigo-600" />
                                    <span className="font-semibold text-gray-900">Software / Application Issue</span>
                                </div>
                                <p className="text-sm text-gray-500">Problems with apps, systems, software errors, or installation.</p>
                            </div>
                        </label>

                        <label className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${issueType === 'hardware' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/20' : 'border-gray-200'}`}>
                            <input
                                type="radio"
                                name="issueType"
                                value="hardware"
                                checked={issueType === 'hardware'}
                                onChange={(e) => setIssueType(e.target.value)}
                                className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500 flex-shrink-0"
                            />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Box size={18} className="text-orange-600" />
                                    <span className="font-semibold text-gray-900">Hardware / Device Problem</span>
                                </div>
                                <p className="text-sm text-gray-500">Issues with laptop, monitor, keyboard, printer, or other physical devices.</p>
                            </div>
                        </label>

                        <label className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${issueType === 'network' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/20' : 'border-gray-200'}`}>
                            <input
                                type="radio"
                                name="issueType"
                                value="network"
                                checked={issueType === 'network'}
                                onChange={(e) => setIssueType(e.target.value)}
                                className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500 flex-shrink-0"
                            />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Wifi size={18} className="text-blue-500" />
                                    <span className="font-semibold text-gray-900">Network / Connectivity</span>
                                </div>
                                <p className="text-sm text-gray-500">WiFi, VPN, internet connection, or slowness problems.</p>
                            </div>
                        </label>

                        <label className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${issueType === 'other' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/20' : 'border-gray-200'}`}>
                            <input
                                type="radio"
                                name="issueType"
                                value="other"
                                checked={issueType === 'other'}
                                onChange={(e) => setIssueType(e.target.value)}
                                className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500 flex-shrink-0"
                            />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <MoreHorizontal size={18} className="text-gray-500" />
                                    <span className="font-semibold text-gray-900">Other</span>
                                </div>
                                <p className="text-sm text-gray-500">Not sure or doesn't fit above categories.</p>
                            </div>
                        </label>
                    </div>
                </section>


                {/* 3. What's the problem? */}
                <section className="space-y-6">
                    <div className="space-y-3">
                        <label htmlFor="subject" className="block text-xl font-bold text-gray-900">
                            Subject <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="subject"
                            type="text"
                            placeholder="e.g. Cannot login to Finance System"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder:text-gray-300 shadow-sm text-lg"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3 relative">
                        <label className="block text-xl font-bold text-gray-900">
                            Description <span className="text-red-500">*</span>
                        </label>

                        <RichTextEditor
                            content={description}
                            onChange={setDescription}
                            placeholder="Describe what happened...
• What were you trying to do?
• What went wrong?
• When did this start?"
                            minHeight="250px"
                        />

                        {/* Inline AI Notice */}
                        {showAINotice && (
                            <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm shrink-0">
                                    <Sparkles size={18} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900 mb-1">
                                        Tip: Don't forget to include screenshots if possible.
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        This helps our team solve your issue faster.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAINotice(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Attachment UI (Simplified inline) */}
                    {/* Note: Rich Text Editor handles images inline, so this is mostly for docs now */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-900">
                            Additional File <span className="text-gray-400 font-normal ml-1">(PDF, Excel, etc)</span>
                        </label>
                        <label className="flex items-center gap-2 w-fit px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 hover:text-gray-900 transition-all group">
                            <div className="p-1.5 bg-white rounded border border-gray-200 text-gray-400 group-hover:text-indigo-500 transition-colors">
                                <Paperclip size={14} />
                            </div>
                            Add document
                            <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)} />
                        </label>
                        {attachment && (
                            <div className="text-sm text-indigo-600 font-medium flex items-center gap-2 bg-indigo-50 w-fit px-3 py-1.5 rounded-lg border border-indigo-100">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 block"></span>
                                {attachment.name}
                                <button
                                    type="button"
                                    className="ml-2 text-indigo-400 hover:text-indigo-700"
                                    onClick={(e) => { e.preventDefault(); setAttachment(null); }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* 5. Error Message & Submit Action */}
                <div className="pt-2 space-y-4">
                    {/* Notice about Auto-Routing */}
                    {issueType && (
                        <div className="text-center text-sm text-gray-500 animate-in fade-in">
                            Ticket will be routed to the
                            <span className="font-bold text-indigo-600 mx-1">
                                {issueType === 'software' ? 'Application Support Team' :
                                    issueType === 'hardware' ? 'Endpoint Hardware Team' :
                                        issueType === 'network' ? 'Endpoint Network Team' : 'Service Desk Dispatcher'}
                            </span>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-2">
                            <AlertCircle size={16} />
                            {errorMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 group mx-auto md:mx-0"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                Submit Incident
                                <ArrowLeft size={20} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>

            </form>
        </div>
    );
};

export default RequesterCreateIncident;
