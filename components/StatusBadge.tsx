import React from 'react';

export type UserStatus = 'Available' | 'OOO' | 'Busy' | 'Inactive';

interface StatusBadgeProps {
    status: UserStatus | string;
    showLabel?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showLabel = true }) => {
    const getStatusConfig = (s: string) => {
        switch (s.toLowerCase()) {
            case 'active':
                return { color: 'bg-green-500', label: 'Active', icon: '🟢' };
            case 'available':
                return { color: 'bg-green-500', label: 'Available', icon: '🟢' };
            case 'ooo':
            case 'out of office':
                return { color: 'bg-red-500', label: 'Out of Office', icon: '🔴' };
            case 'busy':
                return { color: 'bg-yellow-500', label: 'Busy', icon: '🟡' };
            case 'inactive':
                return { color: 'bg-gray-500', label: 'Inactive', icon: '⚫' };
            default:
                return { color: 'bg-gray-400', label: s, icon: '⚪' };
        }
    };

    const config = getStatusConfig(status);

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] leading-none mb-0.5">{config.icon}</span>
            {showLabel && (
                <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                    {config.label}
                </span>
            )}
        </div>
    );
};

export default StatusBadge;
