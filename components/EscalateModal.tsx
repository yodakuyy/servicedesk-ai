
import React, { useState, useRef, useEffect } from 'react';
import { X, Bold, Italic, Underline, Link, List, Type, Search, ChevronDown, Check } from 'lucide-react';
import StatusBadge from './StatusBadge';
interface EscalateModalProps {
  onClose: () => void;
}

const mockUsers = [
  { name: 'Jane Walker', email: 'jane.walker@modena.com', status: 'Available' },
  { name: 'Evelyn Milton', email: 'evelyn.milton@modena.com', status: 'OOO' },
  { name: 'Mike Ross', email: 'mike.ross@modena.com', status: 'Available' },
  { name: 'Sarah Connor', email: 'sarah.connor@modena.com', status: 'Available' },
];

const EscalateModal: React.FC<EscalateModalProps> = ({ onClose }) => {
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleEmail = (email: string) => {
    setSelectedEmails(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const filteredUsers = mockUsers.filter(user =>
    (user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
    user.status !== 'OOO'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-gray-800 text-lg">Escalate to Second-Level Support</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Helper Email (Synchronized from HRIS Sunfish)</label>

            <div className="relative" ref={dropdownRef}>
              {/* Trigger */}
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm cursor-pointer flex items-center justify-between ${isDropdownOpen ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-300 hover:border-gray-400'}`}
              >
                <div className="flex-1 truncate text-gray-600">
                  {selectedEmails.length > 0
                    ? selectedEmails.join(', ')
                    : <span className="text-gray-400">Select...</span>
                  }
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Custom Dropdown Content */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search email..."
                        className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 text-gray-600 placeholder:text-gray-400"
                        autoFocus
                      />
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <div
                          key={user.email}
                          onClick={() => toggleEmail(user.email)}
                          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedEmails.includes(user.email) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                            {selectedEmails.includes(user.email) && <Check size={10} className="text-white" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm ${selectedEmails.includes(user.email) ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                              {user.name}
                            </span>
                            <span className="text-[10px] text-gray-400 truncate">{user.email}</span>
                          </div>
                          <div className="ml-auto">
                            <StatusBadge status={user.status as any} showLabel={false} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-400 text-center italic">
                        No emails found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-sm font-bold text-gray-700">Message to Helper <span className="text-gray-400 font-normal italic">(max. 2,000 characters)</span></label>
            </div>
            <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all">
              {/* Toolbar */}
              <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex gap-1 flex-wrap">
                <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors text-xs font-medium px-2">Normal</button>
                <div className="w-px h-5 bg-gray-300 mx-1 self-center"></div>
                <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors" title="Bold"><Bold size={16} /></button>
                <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors" title="Italic"><Italic size={16} /></button>
                <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors" title="Underline"><Underline size={16} /></button>
                <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors" title="Link"><Link size={16} /></button>
                <div className="w-px h-5 bg-gray-300 mx-1 self-center hidden sm:block"></div>
                <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors" title="Bullet List"><List size={16} /></button>
                <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors" title="Text Color"><Type size={16} /></button>
              </div>
              <textarea
                rows={6}
                className="w-full p-4 text-sm text-gray-700 focus:outline-none resize-none"
                placeholder="Type your message here..."
              ></textarea>
            </div>
          </div>

          <p className="text-xs text-gray-500 italic">
            * Only email addresses listed in the dropdown can be selected.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-[#4b5563] hover:bg-[#374151] text-white font-bold py-3 px-6 rounded-lg shadow-sm transition-colors text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default EscalateModal;
