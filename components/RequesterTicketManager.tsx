import React, { useState } from 'react';
import UserTicketList from './UserTicketList';
import RequesterTicketView from './RequesterTicketView';

interface RequesterTicketManagerProps {
    userName?: string;
}

const RequesterTicketManager: React.FC<RequesterTicketManagerProps> = ({ userName }) => {
    // State to manage view (List or Detail)
    const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

    // Event Handlers
    const handleTicketClick = (ticketId: string) => {
        setSelectedTicketId(ticketId);
        setCurrentView('detail');
    };

    const handleBack = () => {
        setCurrentView('list');
        setSelectedTicketId(null);
    };

    // Render Logic
    if (currentView === 'detail') {
        // We could pass selectedTicketId to the View if it supported dynamic data fetching
        return <RequesterTicketView onBack={handleBack} />;
    }

    return (
        <UserTicketList
            onViewTicket={handleTicketClick}
            userName={userName}
        />
    );
};

export default RequesterTicketManager;
