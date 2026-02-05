import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, PieChart, AlertCircle, Clock, CheckCircle, Package, Plus, Eye, Filter, X, Timer, ArrowUpDown } from 'lucide-react';

const initialIncidentData = [
  {
    id: 'INC4568',
    subject: "Can't sign into finance app",
    user: 'Marso.27',
    category: 'Software',
    agent: 'Wesley.47',
    group: 'Service Desk',
    status: 'Open',
    slaStatus: 'Running',
    urgency: 'High',
    eta: '07 Hours',
    date: '04/12/23',
    time: '08:24AM'
  },
  {
    id: 'RITM4321',
    subject: 'Assistance moving desktop computer',
    user: 'Deppert.5',
    category: 'Hardware',
    agent: 'Levinson.2',
    group: 'Field Support',
    status: 'Open',
    slaStatus: 'Stopped',
    urgency: 'Medium',
    eta: '1 Day',
    date: '04/11/23',
    time: '10:07AM'
  },
  {
    id: 'RITM4268',
    subject: "I'd like to order a new webcam",
    user: 'Miller.409',
    category: 'Hardware',
    agent: 'Levinson.2',
    group: 'Procurement',
    status: 'Pending',
    slaStatus: 'Stopped',
    urgency: 'Low',
    eta: '1 Day',
    date: '04/10/23',
    time: '02:34PM'
  },
  {
    id: 'RITM4599',
    subject: 'Need access to shared drive',
    user: 'Fry.36',
    category: 'Access',
    agent: 'West.56',
    group: 'Identity Mgmt',
    status: 'Open',
    slaStatus: 'Running',
    urgency: 'Medium',
    eta: '2 Days',
    date: '04/10/23',
    time: '09:15AM'
  },
  {
    id: 'INC4567',
    subject: 'Error when starting Microsoft Word',
    user: 'Shulz.45',
    category: 'Software',
    agent: 'Adair.8',
    group: 'Service Desk',
    status: 'Pending',
    slaStatus: 'Stopped',
    urgency: 'High',
    eta: '2 Days',
    date: '04/08/23',
    time: '-'
  },
  {
    id: 'INC4568',
    subject: "Can't sign into finance app",
    user: 'Marso.27',
    category: 'Software',
    agent: 'Wesley.47',
    group: 'Service Desk',
    status: 'Resolved',
    slaStatus: 'Stopped',
    urgency: 'Urgent',
    eta: '2 Days',
    date: '04/12/23',
    time: '08:24AM'
  },
  {
    id: 'RITM4321',
    subject: 'Assistance moving desktop computer',
    user: 'Deppert.5',
    category: 'Hardware',
    agent: 'Levinson.2',
    group: 'Field Support',
    status: 'Closed',
    slaStatus: 'Stopped',
    urgency: 'Low',
    eta: '2 Days',
    date: '04/11/23',
    time: '10:07AM'
  },
  {
    id: 'RITM4268',
    subject: "I'd like to order a new webcam",
    user: 'Miller.409',
    category: 'Hardware',
    agent: 'Levinson.2',
    group: 'Procurement',
    status: 'Pending',
    slaStatus: 'Stopped',
    urgency: 'Medium',
    eta: '2 Days',
    date: '04/10/23',
    time: '02:34PM'
  },
];

const getSlaBadgeStyles = (status: string) => {
  switch (status.toLowerCase()) {
    case 'running': return 'bg-green-100 text-green-700';
    case 'stopped': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-500';
  }
}

const getUrgencyBadgeStyles = (urgency: string) => {
  switch (urgency.toLowerCase()) {
    case 'high': return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-orange-100 text-orange-700';
    case 'low': return 'bg-green-100 text-green-700';
    case 'urgent': return 'bg-red-200 text-red-800';
    default: return 'bg-gray-100 text-gray-500';
  }
}

const getStatusBadgeStyles = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'open') return 'bg-blue-100 text-blue-700';
  if (s.includes('pending')) return 'bg-yellow-100 text-yellow-800';
  if (s === 'resolved') return 'bg-green-100 text-green-700';
  if (s === 'closed') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-500';
}

type SortKey = 'slaStatus' | 'urgency' | 'eta';
type SortDirection = 'asc' | 'desc';

interface IncidentListProps {
  onViewTicket?: (id: string) => void;
}

const IncidentList: React.FC<IncidentListProps> = ({ onViewTicket }) => {
  const [data, setData] = useState(initialIncidentData);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSla, setSelectedSla] = useState<string[]>([]);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Close filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter and Sort Logic
  useEffect(() => {
    let result = [...initialIncidentData];

    // Main Search Bar Query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.id.toLowerCase().includes(lowerQuery) ||
        item.subject.toLowerCase().includes(lowerQuery) ||
        item.user.toLowerCase().includes(lowerQuery) ||
        item.agent.toLowerCase().includes(lowerQuery)
      );
    }

    // Status Filter
    if (selectedStatuses.length > 0) {
      result = result.filter(item => selectedStatuses.includes(item.status));
    }

    // SLA Filter
    if (selectedSla.length > 0) {
      result = result.filter(item => selectedSla.includes(item.slaStatus));
    }

    // Keyword Filter (General Search inside Filters)
    if (keywordFilter) {
      const lowerKeyword = keywordFilter.toLowerCase();
      result = result.filter(item =>
        item.id.toLowerCase().includes(lowerKeyword) ||
        item.subject.toLowerCase().includes(lowerKeyword) ||
        item.user.toLowerCase().includes(lowerKeyword) ||
        item.agent.toLowerCase().includes(lowerKeyword) ||
        item.group.toLowerCase().includes(lowerKeyword)
      );
    }

    // Date Range Filter
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate <= end;
      });
    }

    // Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let comparison = 0;

        if (sortConfig.key === 'urgency') {
          const urgencyRank: Record<string, number> = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          const valA = urgencyRank[a.urgency.toLowerCase()] || 0;
          const valB = urgencyRank[b.urgency.toLowerCase()] || 0;
          comparison = valA - valB;
        } else if (sortConfig.key === 'eta') {
          const parseEta = (eta: string) => {
            const match = eta.match(/(\d+)\s*(Hour|Day)/i);
            if (!match) return 0;
            const val = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();
            return unit.startsWith('d') ? val * 24 : val;
          };
          comparison = parseEta(a.eta) - parseEta(b.eta);
        } else {
          // Default string comparison for SLA Status
          if (a[sortConfig.key] < b[sortConfig.key]) comparison = -1;
          if (a[sortConfig.key] > b[sortConfig.key]) comparison = 1;
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    setData(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, selectedStatuses, selectedSla, keywordFilter, sortConfig, startDate, endDate]);

  const toggleFilter = (list: string[], item: string, setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedSla([]);
    setKeywordFilter('');
    setStartDate('');
    setEndDate('');
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Pagination calculations
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = data.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex flex-col h-full bg-[#f3f4f6] p-8 overflow-hidden">
      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

        {/* Total Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden">
          <div className="flex justify-between items-start z-10">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL: 512</span>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <PieChart size={16} className="text-gray-400" />
            </div>
          </div>
          <div className="z-10">
            <h3 className="text-3xl font-bold text-gray-900 mb-1">512</h3>
            <div className="text-[10px] text-gray-400 leading-tight font-medium">
              <div>160 Active</div>
              <div>214 Closed</div>
            </div>
          </div>
        </div>

        {/* Open Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">OPEN</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <AlertCircle size={16} className="text-blue-500" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-blue-600 mb-1">53</h3>
            <p className="text-[10px] text-gray-400 font-medium">+19 from yesterday</p>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PENDING</span>
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
              <Clock size={16} className="text-orange-500" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-orange-500 mb-1">32</h3>
            <p className="text-[10px] text-gray-400 font-medium">+19 from yesterday</p>
          </div>
        </div>

        {/* Resolved Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">RESOLVED</span>
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle size={16} className="text-green-500" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-green-600 mb-1">12</h3>
            <p className="text-[10px] text-gray-400 font-medium">+19 from yesterday</p>
          </div>
        </div>

        {/* Closed Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">CLOSED</span>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <Package size={16} className="text-gray-500" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-700 mb-1">76</h3>
            <p className="text-[10px] text-gray-400 font-medium">+23 from yesterday</p>
          </div>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex justify-end gap-3 mb-6">
        <button className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-100 px-4 py-2.5 rounded-xl shadow-sm hover:bg-indigo-50 transition-colors">
          Export Data
        </button>
        <button className="flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 px-4 py-2.5 rounded-xl shadow-sm hover:bg-indigo-700 transition-colors">
          <Plus size={16} /> Create Incident
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Incident List</h3>
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-bold text-indigo-600">53 Open</span>
              <span className="text-gray-400 ml-1">(15 assigned to you)</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ticket number, subject, requester, or agent..."
                className="pl-9 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs w-full focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Button */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`text-xs font-medium border rounded-lg px-3 py-2 flex items-center gap-1 transition-colors ${showFilter ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              >
                <Filter size={12} /> Filter
              </button>

              {/* Filter Dropdown */}
              {showFilter && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-20 p-5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-gray-800 text-sm">Filters</h4>
                    <button onClick={() => setShowFilter(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                    {/* Keywords / General Search */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600 uppercase">Keywords</label>
                      <input
                        type="text"
                        value={keywordFilter}
                        onChange={(e) => setKeywordFilter(e.target.value)}
                        placeholder="Search by ticket, requester, agent..."
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-300"
                      />
                    </div>

                    {/* Date Range */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600 uppercase">Date Range</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-300 text-gray-600"
                          />
                        </div>
                        <span className="text-gray-400 text-xs">-</span>
                        <div className="flex-1 relative">
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-300 text-gray-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600 uppercase">Status</label>
                      <div className="flex flex-col gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                        {['Open', 'Pending', 'Resolved', 'Closed'].map(status => (
                          <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded-md transition-colors">
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedStatuses.includes(status)}
                                onChange={() => toggleFilter(selectedStatuses, status, setSelectedStatuses)}
                                className="peer h-4 w-4 appearance-none rounded border border-gray-300 bg-white checked:bg-indigo-600 checked:border-indigo-600 focus:outline-none transition-all"
                              />
                              <CheckCircle size={10} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                            </div>
                            <span className="text-sm text-gray-700">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* SLA Status */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600 uppercase">SLA Status</label>
                      <div className="flex flex-col gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                        {['Running', 'Stopped'].map(status => (
                          <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded-md transition-colors">
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedSla.includes(status)}
                                onChange={() => toggleFilter(selectedSla, status, setSelectedSla)}
                                className="peer h-4 w-4 appearance-none rounded border border-gray-300 bg-white checked:bg-indigo-600 checked:border-indigo-600 focus:outline-none transition-all"
                              />
                              <CheckCircle size={10} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                            </div>
                            <span className="text-sm text-gray-700">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between">
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 hover:text-gray-800 font-medium underline decoration-gray-300 underline-offset-2"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => setShowFilter(false)}
                      className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider">Ticket Number</th>
                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider">Requested For</th>

                {/* Reordered Columns */}
                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider">Status</th>

                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-600 transition-colors" onClick={() => handleSort('slaStatus')}>
                  <div className="flex items-center gap-1">
                    SLA Status
                    <ArrowUpDown size={12} className={sortConfig?.key === 'slaStatus' ? 'text-indigo-600' : 'text-gray-300'} />
                  </div>
                </th>

                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-600 transition-colors" onClick={() => handleSort('urgency')}>
                  <div className="flex items-center gap-1">
                    Urgency
                    <ArrowUpDown size={12} className={sortConfig?.key === 'urgency' ? 'text-indigo-600' : 'text-gray-300'} />
                  </div>
                </th>

                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 hover:text-gray-600 transition-colors" onClick={() => handleSort('eta')}>
                  <div className="flex items-center justify-center gap-1">
                    ETA
                    <ArrowUpDown size={12} className={sortConfig?.key === 'eta' ? 'text-indigo-600' : 'text-gray-300'} />
                  </div>
                </th>

                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider">Group</th>
                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 font-normal text-xs text-gray-400 uppercase tracking-wider text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedData.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 text-gray-500 font-medium text-xs">{item.id}</td>
                  <td className="px-6 py-4 text-gray-800 font-bold text-xs max-w-[200px] truncate" title={item.subject}>{item.subject}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{item.user}</td>

                  {/* Reordered Body Cells */}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusBadgeStyles(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getSlaBadgeStyles(item.slaStatus)}`}>
                      {item.slaStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getUrgencyBadgeStyles(item.urgency)}`}>
                      {item.urgency}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                      <Timer size={12} className="text-gray-500" />
                      <span className="text-[10px] font-medium text-gray-600">{item.eta}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-gray-500 text-xs">{item.agent}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{item.group}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{item.category}</td>

                  <td className="px-6 py-4">
                    <div className="text-gray-900 font-bold text-xs">{item.date}</div>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <button
                      onClick={() => onViewTicket && onViewTicket(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-400 text-sm">
                    No incidents found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/30">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium text-gray-700">{Math.min((currentPage - 1) * itemsPerPage + 1, data.length)}</span> to <span className="font-medium text-gray-700">{Math.min(currentPage * itemsPerPage, data.length)}</span> of <span className="font-medium text-gray-700">{data.length}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${currentPage === page
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentList;