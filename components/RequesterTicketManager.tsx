import React, { useState } from 'react';
import UserTicketList from './UserTicketList';
import RequesterTicketView from './RequesterTicketView';
import RequesterCreateIncident from './RequesterCreateIncident';
import RequesterCreateServiceRequest from './RequesterCreateServiceRequest';

interface RequesterTicketManagerProps {
    userProfile?: any;
    initialTicketId?: string | null;
    initialView?: 'list' | 'detail' | 'create_incident' | 'create_service_request' | 'create_change_request';
    ticketTypeFilter?: 'incident' | 'service_request' | 'change_request';
}

const RequesterTicketManager: React.FC<RequesterTicketManagerProps> = ({ userProfile, initialTicketId, initialView, ticketTypeFilter }) => {
    // State to manage view (List, Detail, or Create)
    const [currentView, setCurrentView] = useState<'list' | 'detail' | 'create_incident' | 'create_service_request' | 'create_change_request'>(
        initialView || (initialTicketId ? 'detail' : 'list')
    );
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId || null);

    // Update view if initialTicketId changes
    React.useEffect(() => {
        if (initialTicketId) {
            setSelectedTicketId(initialTicketId);
            setCurrentView('detail');
        }
    }, [initialTicketId]);

    // Event Handlers
    const handleTicketClick = (ticketId: string) => {
        setSelectedTicketId(ticketId);
        setCurrentView('detail');
    };

    const handleCreateTicket = (type: 'incident' | 'service_request' | 'change_request' = 'incident') => {
        if (type === 'service_request') setCurrentView('create_service_request');
        else if (type === 'change_request') setCurrentView('create_change_request');
        else setCurrentView('create_incident');
        setSelectedTicketId(null);
    };

    const handleBack = () => {
        setCurrentView('list');
        setSelectedTicketId(null);
    };

    const handleSubmitSuccess = () => {
        setCurrentView('list');
    };

    const handleSubmitIncident = (data: any) => {
        console.log("Submitted Incident Data:", data);
        // Go back to list view after successful submission
        setCurrentView('list');
    };

    // Render Logic
    if (currentView === 'detail') {
        return <RequesterTicketView ticketId={selectedTicketId} onBack={handleBack} />;
    }

    if (currentView === 'create_incident') {
        return <RequesterCreateIncident onBack={handleBack} onSubmit={handleSubmitIncident} userProfile={userProfile} />;
    }

    if (currentView === 'create_service_request') {
        return (
            <RequesterCreateServiceRequest
                onBack={handleBack}
                onSubmitSuccess={handleSubmitSuccess}
                userProfile={userProfile}
                ticketType="Service Request"
            />
        );
    }

    if (currentView === 'create_change_request') {
        return (
            <RequesterCreateServiceRequest
                onBack={handleBack}
                onSubmitSuccess={handleSubmitSuccess}
                userProfile={userProfile}
                ticketType="Change Request"
            />
        );
    }

    return (
        <UserTicketList
            onViewTicket={handleTicketClick}
            onCreateTicket={handleCreateTicket}
            userName={userProfile?.full_name}
            ticketTypeFilter={ticketTypeFilter}
        />
    );
};

export default RequesterTicketManager;
