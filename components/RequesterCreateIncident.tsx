import React, { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, Paperclip, Sparkles, Send, ChevronRight, X, Info, AlertCircle, Monitor, Wifi, Box, MoreHorizontal, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
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

    // Simple frequency or extraction logic
    const words = text
        .toLowerCase()
        .replace(/<[^>]*>/g, ' ') // Strip HTML tags
        .replace(/[^\w\s-]/g, '')  // Strip punctuation but keep hyphens (e.g. wi-fi)
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

    // Remove duplicates
    return Array.from(new Set(words)).slice(0, 8);
};

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
    const [affectedUserId, setAffectedUserId] = useState<string | null>(null);
    const [searchingUser, setSearchingUser] = useState(false);

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

    // Data Lists
    const [categories, setCategories] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);

    // Fetch 'Open' Status ID, Groups, Categories, and Services
    useEffect(() => {
        const initData = async () => {
            // 1. Fetch Status ID
            const { data: statusData } = await supabase
                .from('ticket_statuses')
                .select('status_id')
                .eq('status_name', 'Open')
                .single();

            if (statusData) setOpenStatusId(statusData.status_id);

            // 2. Fetch Assignment Groups
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

            // 3. Fetch Categories (Incident Only)
            const { data: catData } = await supabase
                .from('ticket_categories')
                .select('id, name')
                .eq('category_type', 'incident'); // Filter by input type
            if (catData) setCategories(catData);

            // 4. Fetch Services
            const { data: svcData } = await supabase
                .from('services')
                .select('id, name')
                .eq('is_active', true);
            if (svcData) setServices(svcData);
        };
        initData();
    }, []);

    // Search for Affected User by Email
    useEffect(() => {
        if (affectedUser === 'myself') {
            setAffectedUserId(userProfile?.id || null);
            return;
        }

        const searchUser = async () => {
            if (!someoneElseDetails.email.includes('@')) return;

            setSearchingUser(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, department_id')
                    .eq('email', someoneElseDetails.email)
                    .single();

                if (data) {
                    setAffectedUserId(data.id);
                    // Also auto-fill name if empty
                    if (!someoneElseDetails.fullName) {
                        setSomeoneElseDetails(prev => ({ ...prev, fullName: data.full_name }));
                    }
                } else {
                    setAffectedUserId(null); // Not found, will be stored as guest/text info only
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

    // Helper to determine Category & Service based on Content (Improved AI Simulation)
    const getSystemClassification = (type: string, subject: string, description: string) => {
        const text = `${subject} ${description}`.toLowerCase();
        let catKeyword = '';
        let svcKeyword = '';

        // Broad type handling (still useful as a base filter)
        switch (type) {
            case 'software': catKeyword = 'software'; svcKeyword = 'application'; break;
            case 'hardware': catKeyword = 'hardware'; svcKeyword = 'computing'; break;
            case 'network': catKeyword = 'network'; svcKeyword = 'network'; break;
            default: catKeyword = 'access'; svcKeyword = 'general';
        }

        // 1. IMPROVED CATEGORY MATCHING (Scoring System)
        // We look for the most specific match in the master categories table
        let bestCategory = null;
        let highestScore = -1;

        categories.forEach(cat => {
            const catNameLower = cat.name.toLowerCase();
            let score = 0;

            // Broad Type Match (Base)
            if (catNameLower.includes(catKeyword)) score += 5;

            // Specific Keyword Match
            // Split category name into words and check if they exist in user text
            const catWords = catNameLower.split(/[\s-/]+/).filter(w => w.length > 2);
            catWords.forEach(word => {
                if (text.includes(word)) {
                    score += 10;
                    // Bonus for exact word match
                    if (text.split(' ').includes(word)) score += 5;
                }
            });

            if (score > highestScore) {
                highestScore = score;
                bestCategory = cat;
            }
        });

        // 2. SERVICE MATCHING
        const bestService = services.find(s => {
            const svcNameLower = s.name.toLowerCase();
            return text.includes(svcNameLower) || svcNameLower.includes(svcKeyword);
        }) || services[0];

        return {
            category_id: bestCategory?.id || categories[0]?.id || null,
            service_id: bestService?.id || services[0]?.id || null
        };
    };

    // Helper to determine Priority based on keywords (AI Simulation)
    // Note: Values must match database enum: {low, medium, high, urgent}
    const calculatePriority = (subject: string, description: string) => {
        const text = `${subject} ${description}`.toLowerCase();

        // Urgent Priority Keywords
        if (text.includes('urgent') || text.includes('critical') || text.includes('system down') ||
            text.includes('mati total') || text.includes('emergency') || text.includes('dead')) {
            return 'urgent';
        }

        // High Priority Keywords
        if (text.includes('error') || text.includes('unable') || text.includes('fail') ||
            text.includes('cant') || text.includes('cannot') || text.includes('slow') || text.includes('lambat')) {
            return 'high';
        }

        // Default to medium for general issues
        return 'medium';
    };

    // AI Analysis Simulation (Runs when description changes) - used for Insights
    useEffect(() => {
        const analyzeTicket = () => {
            if (description.length < 10) return;
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
                suggested_category_id: '',
                confidence_level: confidence as any,
                summary: summary
            });

            if (text.includes('password') || text.includes('login')) {
                setShowAINotice(true);
            } else {
                setShowAINotice(false);
            }
        };

        const timer = setTimeout(analyzeTicket, 1000);
        return () => clearTimeout(timer);
    }, [description, subject]);


    // KB Suggestions
    const [suggestedArticles, setSuggestedArticles] = useState<any[]>([]);

    // Search KB when Subject changes
    useEffect(() => {
        const searchKB = async () => {
            if (subject.length < 3) {
                setSuggestedArticles([]);
                return;
            }

            // A. Prepare Keywords
            const rawKeywords = subject.toLowerCase().split(' ').filter(w => w.length > 2);
            // Remove common stop words for cleaner search
            const stopWords = ['tidak', 'bisa', 'mau', 'ada', 'yang', 'dan', 'ini', 'itu', 'cannot', 'cant', 'not'];
            const keywords = rawKeywords.filter(w => !stopWords.includes(w));

            if (keywords.length === 0) return;

            // B. Hybrid Search: Broad Fetch -> Smart Rank
            const queryParts = keywords.map(w => `title.ilike.%${w}%,summary.ilike.%${w}%`).join(',');

            const { data: candidates, error } = await supabase
                .from('kb_articles')
                .select('id, title, summary')
                .eq('status', 'published')
                .eq('visibility', 'public') // Only show public articles to requesters
                .or(queryParts)
                .limit(20); // Fetch more candidates to rank them

            if (error) {
                console.error('KB Search Error:', error);
                setSuggestedArticles([]);
                return;
            }

            if (!candidates || candidates.length === 0) {
                setSuggestedArticles([]);
                return;
            }

            // C. Scoring Algorithm
            const scoredResults = candidates.map(article => {
                let score = 0;
                const titleLower = article.title.toLowerCase();
                const summaryLower = (article.summary || '').toLowerCase();

                keywords.forEach(word => {
                    // Title Match (High Priority)
                    if (titleLower.includes(word)) score += 10;
                    // Exact Title Word Match (Bonus)
                    if (titleLower.split(' ').includes(word)) score += 5;

                    // Summary Match (Medium)
                    if (summaryLower.includes(word)) score += 5;
                });

                return { ...article, score };
            });

            // D. Sort & Filter
            const filteredResults = scoredResults
                .sort((a, b) => b.score - a.score)
                .slice(0, 5); // Take top 5

            setSuggestedArticles(filteredResults);
        };

        const timer = setTimeout(searchKB, 500);
        return () => clearTimeout(timer);
    }, [subject]);

    // Article Viewing State
    const [viewingArticle, setViewingArticle] = useState<any | null>(null);

    const handleViewArticle = async (id: string) => {
        const { data, error } = await supabase
            .from('kb_articles')
            .select('*')
            .eq('id', id)
            .single();

        if (data) setViewingArticle(data);
    };

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
            // Determine Assignment Group
            let assignedGroupId = null;
            if (issueType === 'software') {
                assignedGroupId = groupIds['SOFTWARE'] || null;
            } else if (issueType === 'hardware' || issueType === 'network') {
                assignedGroupId = groupIds['ENDPOINT'] || null;
            }

            // Determine Classification (Category & Service)
            const { category_id, service_id } = getSystemClassification(issueType, subject, description);

            // Determine Priority (AI Simulation)
            const calculatedPriority = calculatePriority(subject, description);

            // Generate Auto Tags from Content
            const autoTags = generateAutoTags(subject + ' ' + description);

            // Prepare Description with beautiful Alert-style info for Requested For
            let finalDescription = description;
            if (affectedUser === 'someone_else') {
                const infoBox = `
<div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-family: sans-serif;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="background-color: #eab308; color: white; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Reported on Behalf of</span>
    </div>
    <div style="font-size: 14px; font-weight: 700; color: #854d0e;">${someoneElseDetails.fullName}</div>
    <div style="font-size: 12px; color: #a16207; opacity: 0.8;">${someoneElseDetails.email}</div>
    ${someoneElseDetails.department ? `<div style="font-size: 11px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #fef08a; color: #a16207;">Dept: <b>${someoneElseDetails.department}</b></div>` : ''}
</div>
`;
                finalDescription = infoBox + description;
            }

            // 1. Create Ticket in DB
            const ticketPayload = {
                subject: subject,
                description: finalDescription,
                tags: autoTags, // Auto-generated keywords for AI similarity search
                status_id: openStatusId,
                ticket_number: `INC-${Math.floor(Math.random() * 100000)}`,
                priority: calculatedPriority,
                requester_id: affectedUserId || userProfile?.id, // THE AFFECTED USER
                created_by: userProfile?.id, // THE REPORTER
                ticket_type: 'incident',
                assignment_group_id: assignedGroupId,
                category_id: category_id,
                service_id: service_id,
                is_category_verified: false,
            };

            console.log("Submitting Ticket Payload:", ticketPayload); // Debug

            const { data: ticketData, error: ticketError } = await supabase
                .from('tickets')
                .insert(ticketPayload)
                .select()
                .single();

            if (ticketError) {
                console.error("Supabase Ticket Insert Error:", ticketError);
                throw ticketError;
            }

            // ... Rest of Logic (AI Insight, Attachments)

            // 2. Insert AI Insights
            if (aiInsight && ticketData) {
                await supabase
                    .from('ticket_ai_insights')
                    .insert({
                        ticket_id: ticketData.id,
                        summary: aiInsight.summary,
                        confidence_level: aiInsight.confidence_level,
                    });
            }

            // 3. Handle Attachment Upload
            if (attachment && ticketData) {
                try {
                    const filePath = `tickets/${ticketData.id}/${Math.floor(Date.now() / 1000)}_${attachment.name}`;
                    const { error: uploadError } = await supabase.storage
                        .from('ticket-attachments')
                        .upload(filePath, attachment);

                    if (uploadError) {
                        console.error("Upload Error:", uploadError);
                    } else {
                        const { data: { publicUrl } } = supabase.storage
                            .from('ticket-attachments')
                            .getPublicUrl(filePath);

                        // Insert into ticket_attachments table
                        const { error: dbError } = await supabase
                            .from('ticket_attachments')
                            .insert({
                                ticket_id: ticketData.id,
                                file_name: attachment.name,
                                file_path: filePath,
                                mime_type: attachment.type,
                                uploaded_by: userProfile?.id
                            });

                        if (dbError) {
                            console.error("Failed to link attachment to ticket:", dbError);
                        }
                    }
                } catch (uploadErr) {
                    console.error("Attachment handling failed:", uploadErr);
                }
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

                    {suggestedArticles.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm mb-3">
                                <Sparkles size={16} />
                                <span>Suggested Solutions from Knowledge Base</span>
                            </div>
                            <div className="space-y-2">
                                {suggestedArticles.map(article => (
                                    <div key={article.id} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm hover:shadow-md transition-all">
                                        <h4 className="font-semibold text-gray-800 text-sm mb-1">{article.title}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-1 mb-2">{article.summary || 'No summary available.'}</p>
                                        <button
                                            type="button"
                                            onClick={() => handleViewArticle(article.id)}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                        >
                                            Read Article <ChevronRight size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 text-xs text-center text-indigo-600/70">
                                Did this solve your issue? <button type="button" onClick={onBack} className="font-bold hover:underline">Yes, cancel ticket</button>
                            </div>
                        </div>
                    )}


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
                            <input
                                type="file"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files ? e.target.files[0] : null;
                                    if (file) {
                                        if (file.size > 5 * 1024 * 1024) { // 5MB Limit
                                            // @ts-ignore
                                            const Swal = (await import('sweetalert2')).default;
                                            Swal.fire({
                                                icon: 'warning',
                                                title: 'File Too Large',
                                                text: 'The attachment size must be less than 5MB.',
                                                confirmButtonColor: '#6366f1'
                                            });
                                            setAttachment(null);
                                            e.target.value = ''; // Reset input
                                        } else {
                                            setAttachment(file);
                                        }
                                    }
                                }}
                            />
                        </label>
                        <p className="text-[10px] text-gray-400 font-medium">Max size: 5MB</p>

                        {attachment && (
                            <div className="text-sm text-indigo-600 font-medium flex items-center gap-2 bg-indigo-50 w-fit px-3 py-1.5 rounded-lg border border-indigo-100 mt-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 block"></span>
                                {attachment.name}
                                <span className="text-gray-400 text-xs ml-1">({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span>
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

            {/* KB Article Modal */}
            {viewingArticle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{viewingArticle.title}</h3>
                                <div className="flex gap-2 mt-2">
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold uppercase tracking-wider">
                                        Trusted Solution
                                    </span>
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Clock size={12} /> Updated {new Date(viewingArticle.updated_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingArticle(null)}
                                className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all shadow-sm border border-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {typeof viewingArticle.content === 'string' ? (
                                <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: viewingArticle.content }} />
                            ) : (
                                <div className="space-y-6">
                                    {/* Problem Section */}
                                    {viewingArticle.content.problem && viewingArticle.content.problem !== '<p></p>' && (
                                        <div className="bg-red-50/50 rounded-xl p-4 border border-red-50">
                                            <h4 className="text-xs font-black text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <AlertCircle size={14} /> Problem Description
                                            </h4>
                                            <div className="prose prose-sm prose-red max-w-none" dangerouslySetInnerHTML={{ __html: viewingArticle.content.problem }} />
                                        </div>
                                    )}

                                    {/* Solution Section - MAIN */}
                                    {viewingArticle.content.solution && viewingArticle.content.solution !== '<p></p>' && (
                                        <div className="bg-white rounded-xl p-1">
                                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 border-b border-indigo-50 pb-2 flex items-center gap-2">
                                                <Sparkles size={14} /> Solution Steps
                                            </h4>
                                            <div className="prose prose-sm prose-indigo max-w-none" dangerouslySetInnerHTML={{ __html: viewingArticle.content.solution }} />
                                        </div>
                                    )}

                                    {/* Verification Section */}
                                    {viewingArticle.content.verification && viewingArticle.content.verification !== '<p></p>' && (
                                        <div className="bg-green-50/50 rounded-xl p-4 border border-green-50">
                                            <h4 className="text-xs font-black text-green-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <CheckCircle2 size={14} /> Verification
                                            </h4>
                                            <div className="prose prose-sm prose-green max-w-none" dangerouslySetInnerHTML={{ __html: viewingArticle.content.verification }} />
                                        </div>
                                    )}

                                    {/* Notes Section */}
                                    {viewingArticle.content.notes && viewingArticle.content.notes !== '<p></p>' && (
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 italic">
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Additional Notes</h4>
                                            <div className="prose prose-sm prose-gray max-w-none text-gray-500" dangerouslySetInnerHTML={{ __html: viewingArticle.content.notes }} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                            <span className="text-xs text-gray-500">Did this article help?</span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setViewingArticle(null)}
                                    className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    No, I still need help
                                </button>
                                <button
                                    onClick={onBack}
                                    className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-lg shadow-green-200 transition-all flex items-center gap-2"
                                >
                                    <CheckCircle2 size={16} /> Yes, Solve Information
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequesterCreateIncident;
