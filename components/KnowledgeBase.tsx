import React from 'react';
import { Search, Folder, ChevronRight, BookOpen } from 'lucide-react';

const kbCategories = [
  { title: 'SAP', description: 'System Applications and Products', count: 24 },
  { title: 'GCCS', description: 'Global Command and Control System', count: 12 },
  { title: 'MORE 1', description: 'Module Operational Resource 1', count: 8 },
  { title: 'MORE 2', description: 'Module Operational Resource 2', count: 15 },
  { title: 'MES', description: 'Manufacturing Execution System', count: 32 },
  { title: 'SNC', description: 'Supply Network Collaboration', count: 6 },
  { title: 'SFA Mobile', description: 'Sales Force Automation', count: 18 },
  { title: 'VMS', description: 'Vendor Management System', count: 9 },
  { title: 'SMI', description: 'Supplier Managed Inventory', count: 11 },
];

const KnowledgeBase: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-[#f3f4f6] p-8 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Knowledge Base</h2>
          <p className="text-gray-500 text-sm mt-1">Access documentation and guides for internal systems.</p>
        </div>
        
        <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
             <input 
               type="text" 
               placeholder="Search knowledge base..." 
               className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm w-64 md:w-80 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all shadow-sm"
             />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 overflow-y-auto pb-8 custom-scrollbar">
        {kbCategories.map((category, index) => (
          <div 
            key={index} 
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group flex flex-col"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                <BookOpen size={24} />
              </div>
              <span className="bg-gray-50 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full border border-gray-100 group-hover:border-indigo-100 group-hover:text-indigo-600 transition-colors">
                {category.count} Articles
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-indigo-700 transition-colors">{category.title}</h3>
            <p className="text-sm text-gray-500 mb-6 flex-1">{category.description}</p>
            
            <div className="flex items-center text-sm font-semibold text-gray-400 group-hover:text-indigo-600 transition-colors pt-4 border-t border-gray-50">
              View Documentation 
              <ChevronRight size={16} className="ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBase;