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
        // Here you would typically call an API to create the ticket
        // For now, we simulate success and go back to list or detail
        // Ideally show a success message or redirect to the new ticket
        setCurrentView('detail');
    };

    // Render Logic
    if (currentView === 'detail') {
        // We could pass selectedTicketId to the View if it supported dynamic data fetching
        return <RequesterTicketView onBack={handleBack} />;
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
