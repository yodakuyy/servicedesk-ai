import React from 'react';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    showLabel?: boolean;
    activeColor?: string;
    inactiveColor?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    checked,
    onChange,
    disabled = false,
    size = 'md',
    label,
    showLabel = true,
    activeColor = 'bg-green-500 hover:bg-green-600',
    inactiveColor = 'bg-gray-300 hover:bg-gray-400'
}) => {
    const sizeClasses = {
        sm: { track: 'h-5 w-9', knob: 'h-3 w-3', translate: 'translate-x-5', labelSize: 'text-[9px]' },
        md: { track: 'h-6 w-11', knob: 'h-4 w-4', translate: 'translate-x-6', labelSize: 'text-[10px]' },
        lg: { track: 'h-7 w-14', knob: 'h-5 w-5', translate: 'translate-x-8', labelSize: 'text-xs' }
    };

    const { track, knob, translate, labelSize } = sizeClasses[size];

    return (
        <div className="flex flex-col items-center">
            <button
                type="button"
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                className={`
                    relative inline-flex ${track} items-center rounded-full transition-colors 
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${checked ? activeColor : inactiveColor}
                `}
                title={checked ? 'Click to deactivate' : 'Click to activate'}
            >
                <span
                    className={`
                        inline-block ${knob} transform rounded-full bg-white shadow-md transition-transform
                        ${checked ? translate : 'translate-x-1'}
                    `}
                />
            </button>
            {showLabel && (
                <span className={`${labelSize} text-gray-400 mt-1`}>
                    {label || (checked ? 'Active' : 'Inactive')}
                </span>
            )}
        </div>
    );
};

export default ToggleSwitch;
