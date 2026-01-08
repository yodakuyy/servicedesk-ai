import React from 'react';
import { Search, FileText, HelpCircle, Monitor, Shield, Phone, Settings } from 'lucide-react';

const HelpCenter: React.FC = () => {
    const helpCategories = [
        {
            icon: FileText,
            title: 'Getting Started',
            description: 'Learn how to use the system',
            color: 'text-indigo-500',
            bgColor: 'bg-indigo-50'
        },
        {
            icon: HelpCircle,
            title: 'FAQ',
            description: 'Find answers to common questions',
            color: 'text-purple-500',
            bgColor: 'bg-purple-50'
        },
        {
            icon: Monitor,
            title: 'System How-To',
            description: 'Step-by-step guides and tutorials',
            color: 'text-blue-500',
            bgColor: 'bg-blue-50'
        },
        {
            icon: Shield,
            title: 'Policies & SLA',
            description: 'Learn about our policies and SLAs',
            color: 'text-green-500',
            bgColor: 'bg-green-50'
        },
        {
            icon: Phone,
            title: 'Contact Support',
            description: 'Get in touch with our support team',
            color: 'text-pink-500',
            bgColor: 'bg-pink-50'
        },
        {
            icon: Settings,
            title: 'Maintenance & Updates',
            description: 'Stay up-to-date with the latest news',
            color: 'text-orange-500',
            bgColor: 'bg-orange-50'
        },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Help Center</h1>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search help..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {helpCategories.map((category, index) => (
                    <div
                        key={index}
                        className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group flex flex-col items-center text-center h-64 justify-center"
                    >
                        <div className={`w-16 h-16 ${category.bgColor} ${category.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                            <category.icon size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-indigo-700 transition-colors">
                            {category.title}
                        </h3>
                        <p className="text-gray-500">
                            {category.description}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HelpCenter;
