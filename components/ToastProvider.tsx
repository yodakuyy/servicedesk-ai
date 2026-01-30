import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Bell, Ticket, MessageSquare, AlertTriangle, CheckCircle, XCircle, X, ExternalLink } from 'lucide-react';

export interface Toast {
    id: string;
    title: string;
    message?: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'ticket_new' | 'ticket_reply' | 'ticket_assigned' | 'sla_warning' | 'escalation';
    duration?: number; // ms, default 5000
    referenceType?: string;
    referenceId?: string;
    onClick?: () => void;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const duration = toast.duration || 5000;

        setToasts(prev => [...prev, { ...toast, id }]);

        // Auto remove after duration
        setTimeout(() => {
            removeToast(id);
        }, duration);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

// Toast Container Component
const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            {toasts.map((toast, index) => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onRemove={() => onRemove(toast.id)}
                    index={index}
                />
            ))}
        </div>
    );
};

// Individual Toast Item
const ToastItem: React.FC<{ toast: Toast; onRemove: () => void; index: number }> = ({ toast, onRemove, index }) => {
    const getIcon = () => {
        const iconProps = { size: 20 };
        switch (toast.type) {
            case 'ticket_new':
            case 'ticket_assigned':
                return <Ticket {...iconProps} />;
            case 'ticket_reply':
                return <MessageSquare {...iconProps} />;
            case 'sla_warning':
            case 'escalation':
            case 'warning':
                return <AlertTriangle {...iconProps} />;
            case 'success':
                return <CheckCircle {...iconProps} />;
            case 'error':
                return <XCircle {...iconProps} />;
            default:
                return <Bell {...iconProps} />;
        }
    };

    const getColors = () => {
        switch (toast.type) {
            case 'ticket_new':
            case 'ticket_assigned':
                return {
                    bg: 'bg-gradient-to-r from-indigo-500 to-purple-600',
                    iconBg: 'bg-white/20',
                    text: 'text-white',
                    subtext: 'text-white/80'
                };
            case 'ticket_reply':
                return {
                    bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
                    iconBg: 'bg-white/20',
                    text: 'text-white',
                    subtext: 'text-white/80'
                };
            case 'sla_warning':
            case 'escalation':
            case 'warning':
                return {
                    bg: 'bg-gradient-to-r from-orange-500 to-amber-500',
                    iconBg: 'bg-white/20',
                    text: 'text-white',
                    subtext: 'text-white/80'
                };
            case 'success':
                return {
                    bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
                    iconBg: 'bg-white/20',
                    text: 'text-white',
                    subtext: 'text-white/80'
                };
            case 'error':
                return {
                    bg: 'bg-gradient-to-r from-red-500 to-rose-600',
                    iconBg: 'bg-white/20',
                    text: 'text-white',
                    subtext: 'text-white/80'
                };
            default:
                return {
                    bg: 'bg-gradient-to-r from-gray-700 to-gray-900',
                    iconBg: 'bg-white/20',
                    text: 'text-white',
                    subtext: 'text-white/80'
                };
        }
    };

    const colors = getColors();

    return (
        <div
            className={`
                ${colors.bg} 
                rounded-2xl shadow-2xl p-4 pointer-events-auto
                transform transition-all duration-500 ease-out
                animate-slide-in-right
                hover:scale-[1.02] hover:shadow-3xl
                cursor-pointer
                backdrop-blur-sm
                border border-white/10
            `}
            style={{
                animationDelay: `${index * 100}ms`
            }}
            onClick={() => {
                if (toast.onClick) toast.onClick();
                onRemove();
            }}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 ${colors.iconBg} backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <span className={colors.text}>{getIcon()}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${colors.text} truncate`}>
                        {toast.title}
                    </p>
                    {toast.message && (
                        <p className={`text-xs ${colors.subtext} mt-0.5 line-clamp-2`}>
                            {toast.message}
                        </p>
                    )}
                    {toast.referenceType === 'ticket' && (
                        <p className={`text-xs ${colors.subtext} mt-1.5 flex items-center gap-1`}>
                            <ExternalLink size={12} /> Klik untuk membuka tiket
                        </p>
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className={`p-1 ${colors.iconBg} rounded-lg ${colors.text} hover:bg-white/30 transition-colors flex-shrink-0`}
                >
                    <X size={16} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                    className="h-full bg-white/60 rounded-full animate-progress"
                    style={{
                        animationDuration: `${toast.duration || 5000}ms`
                    }}
                />
            </div>
        </div>
    );
};

// Add these styles to your global CSS or index.css
export const toastStyles = `
@keyframes slide-in-right {
    from {
        transform: translateX(100%) scale(0.95);
        opacity: 0;
    }
    to {
        transform: translateX(0) scale(1);
        opacity: 1;
    }
}

@keyframes progress {
    from {
        width: 100%;
    }
    to {
        width: 0%;
    }
}

.animate-slide-in-right {
    animation: slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-progress {
    animation: progress linear forwards;
}
`;

export default ToastProvider;
