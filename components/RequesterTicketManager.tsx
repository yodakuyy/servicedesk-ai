import React, { useState } from 'react';
import UserTicketList from './UserTicketList';
import RequesterTicketView from './RequesterTicketView';
import RequesterCreateIncident from './RequesterCreateIncident';

interface RequesterTicketManagerProps {
    userProfile?: any;
}

const RequesterTicketManager: React.FC<RequesterTicketManagerProps> = ({ userProfile }) => {
    // State to manage view (List, Detail, or Create)
    const [currentView, setCurrentView] = useState<'list' | 'detail' | 'create'>('list');
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

    // Event Handlers
    const handleTicketClick = (ticketId: string) => {
        setSelectedTicketId(ticketId);
        setCurrentView('detail');
    };

    const handleCreateTicket = () => {
        setCurrentView('create');
        setSelectedTicketId(null);
    };

    const handleBack = () => {
        setCurrentView('list');
        setSelectedTicketId(null);
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

    if (currentView === 'create') {
        return <RequesterCreateIncident onBack={handleBack} onSubmit={handleSubmitIncident} userProfile={userProfile} />;
    }

    return (
        <UserTicketList
            onViewTicket={handleTicketClick}
            onCreateTicket={handleCreateTicket}
            userName={userProfile?.full_name}
        />
    );
};

export default RequesterTicketManager;
