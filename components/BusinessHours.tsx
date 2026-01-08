import { supabase } from '../lib/supabase';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import './BusinessHours.css';
// @ts-ignore
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

interface GroupInfo {
    id: string;
    name: string;
}

interface BusinessHour {
    id: string;
    name: string;
    timezone: string;
    usedByGroups: number;
    groups: GroupInfo[];
    status: 'Active' | 'Inactive';
    weekly_schedule?: DaySchedule[];
}

interface DaySchedule {
    day: string;
    startTime: string;
    endTime: string;
    hasBreak: boolean;
    isActive: boolean;
    isClosed?: boolean;
    breakActive?: boolean;
    breakStartTime?: string;
    breakEndTime?: string;
}

interface Holiday {
    id: string;
    holiday_date: string;
    name: string;
    scope?: string;
}

const BusinessHours: React.FC = () => {
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedBusinessHour, setSelectedBusinessHour] = useState<BusinessHour | null>(null);
    const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);

    // Group List Modal State
    const [showGroupListModal, setShowGroupListModal] = useState(false);
    const [selectedGroupList, setSelectedGroupList] = useState<GroupInfo[]>([]);
    const [selectedBusinessHourName, setSelectedBusinessHourName] = useState('');
    const [groupListPage, setGroupListPage] = useState(1);
    const groupsPerPage = 5;

    // Sample data
    const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);

    useEffect(() => {
        fetchBusinessHours();
    }, []);

    const fetchBusinessHours = async () => {
        let loadedBusinessHours: any[] = [];

        try {
            // Fetch business hours
            const { data: bhData, error: bhError } = await supabase
                .from('business_hours')
                .select('*')
                .order('name');

            if (bhError) {
                console.error('Error fetching business_hours:', bhError);
                // If table doesn't exist, we can't do anything
                return;
            }

            loadedBusinessHours = bhData || [];
        } catch (error) {
            console.error('Critical error fetching business hours:', error);
            return;
        }

        // Calculate usage counts and collect group info (separate try-catch to not block main display)
        const groupsMap: Record<string, GroupInfo[]> = {};

        try {
            // Fetch groups to calculate usage
            const { data: groupsData, error: groupsError } = await supabase
                .from('groups')
                .select('id, name, business_hour_id');

            if (!groupsError && groupsData) {
                groupsData.forEach((g: any) => {
                    if (g.business_hour_id) {
                        if (!groupsMap[g.business_hour_id]) {
                            groupsMap[g.business_hour_id] = [];
                        }
                        groupsMap[g.business_hour_id].push({
                            id: g.id,
                            name: g.name
                        });
                    }
                });
            } else {
                console.warn('Error fetching group usage (ignoring):', groupsError);
            }
        } catch (error) {
            console.warn('Failed to fetch group usage (column might be missing):', error);
        }

        const formatted: BusinessHour[] = loadedBusinessHours.map((bh: any) => ({
            id: bh.id,
            name: bh.name,
            timezone: bh.timezone,
            usedByGroups: groupsMap[bh.id]?.length || 0,
            groups: groupsMap[bh.id] || [],
            status: bh.is_active ? 'Active' : 'Inactive',
            weekly_schedule: bh.weekly_schedule
        }));

        setBusinessHours(formatted);
    };

    const handleViewGroupList = (businessHour: BusinessHour) => {
        setSelectedGroupList(businessHour.groups);
        setSelectedBusinessHourName(businessHour.name);
        setGroupListPage(1);
        setShowGroupListModal(true);
    };

    const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([
        { day: 'Monday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
        { day: 'Tuesday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
        { day: 'Wednesday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
        { day: 'Thursday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
        { day: 'Friday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
        { day: 'Saturday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: false, isClosed: true, breakStartTime: '12:00', breakEndTime: '13:00' },
        { day: 'Sunday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: false, isClosed: true, breakStartTime: '12:00', breakEndTime: '13:00' },
    ]);

    const [holidays, setHolidays] = useState<Holiday[]>([]);

    // Calendar state
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        fetchHolidays();
    }, [currentMonth]);

    const fetchHolidays = async () => {
        // Fetch ALL holidays to debug visibility issues
        console.log('Fetching all holidays...');
        try {
            const { data, error } = await supabase
                .from('holidays')
                .select('*')
                .order('holiday_date', { ascending: true });

            if (error) {
                console.error('Supabase error fetching holidays:', error);
                throw error;
            }

            console.log('All holidays fetched:', data);

            if (data) {
                setHolidays(data);
            }
        } catch (error) {
            console.error('Error fetching holidays:', error);
        }
    };

    const [newHoliday, setNewHoliday] = useState({
        date: '',
        name: '',
        scope: 'GLOBAL'
    });

    const handleViewDetail = (businessHour: BusinessHour) => {
        setSelectedBusinessHour(businessHour);
        if (businessHour.weekly_schedule) {
            // Map over the schedule to ensure break times exist if hasBreak is true
            const enrichedSchedule = businessHour.weekly_schedule.map(day => ({
                ...day,
                breakActive: day.hasBreak, // Force breakActive if hasBreak is true
                breakStartTime: day.breakStartTime || '12:00',
                breakEndTime: day.breakEndTime || '13:00'
            }));
            setWeeklySchedule(enrichedSchedule);
        } else {
            // Reset to default if no schedule
            setWeeklySchedule([
                { day: 'Monday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
                { day: 'Tuesday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
                { day: 'Wednesday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
                { day: 'Thursday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
                { day: 'Friday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
                { day: 'Saturday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: false, isClosed: true, breakActive: false, breakStartTime: '12:00', breakEndTime: '13:00' },
                { day: 'Sunday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: false, isClosed: true, breakActive: false, breakStartTime: '12:00', breakEndTime: '13:00' },
            ]);
        }
        setView('detail');
    };

    const handleToggleDay = (index: number) => {
        const updated = [...weeklySchedule];
        const newStatus = !updated[index].isActive;
        updated[index].isActive = newStatus;

        if (newStatus) {
            // Activate with default hours if missing or closed
            updated[index].startTime = '08:00';
            updated[index].endTime = '17:00';
            updated[index].isClosed = false;
        } else {
            updated[index].isClosed = true;
        }

        setWeeklySchedule(updated);
    };

    const handleAddHoliday = async () => {
        if (!newHoliday.date || !newHoliday.name) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please fill in all fields',
                confirmButtonColor: '#4c40e6',
            });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('holidays')
                .insert([
                    {
                        holiday_date: newHoliday.date,
                        name: newHoliday.name,
                        scope: newHoliday.scope
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                // Refresh holidays list
                fetchHolidays();
                setShowAddHolidayModal(false);
                setNewHoliday({ date: '', name: '', scope: 'GLOBAL' });
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Holiday added successfully',
                    confirmButtonColor: '#4c40e6',
                });
            }
        } catch (error: any) {
            console.error('Error adding holiday:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to add holiday',
                confirmButtonColor: '#4c40e6',
            });
        }
    };

    const handleDeleteHoliday = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to delete this holiday?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4c40e6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result: any) => {
            if (result.isConfirmed) {
                try {
                    const { error } = await supabase
                        .from('holidays')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;

                    // Refresh holidays list
                    fetchHolidays();
                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted!',
                        text: 'Holiday has been deleted.',
                        confirmButtonColor: '#4c40e6',
                    });
                } catch (error: any) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'Failed to delete holiday',
                        confirmButtonColor: '#4c40e6',
                    });
                }
            }
        });
    };

    // Calendar functions
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        return { daysInMonth, startingDayOfWeek, year, month };
    };

    const getHolidaysForDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // console.log(`Checking date: ${dateStr}, total holidays: ${holidays.length}`);
        return holidays.filter(h => h.holiday_date && h.holiday_date.startsWith(dateStr));
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const previousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const goToToday = () => {
        setCurrentMonth(new Date());
    };

    const handleDateClick = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        setNewHoliday({
            ...newHoliday,
            date: dateStr,
            scope: 'GLOBAL'
        });
        setShowAddHolidayModal(true);
    };

    const handleAddBusinessHours = () => {
        setSelectedBusinessHour({
            id: '',
            name: '',
            timezone: 'Asia/Jakarta',
            usedByGroups: 0,
            status: 'Active'
        });

        // Reset to default schedule
        setWeeklySchedule([
            { day: 'Monday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
            { day: 'Tuesday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
            { day: 'Wednesday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
            { day: 'Thursday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
            { day: 'Friday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: true, breakActive: true, breakStartTime: '12:00', breakEndTime: '13:00' },
            { day: 'Saturday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: false, isClosed: true, breakActive: false, breakStartTime: '12:00', breakEndTime: '13:00' },
            { day: 'Sunday', startTime: '08:00', endTime: '17:00', hasBreak: true, isActive: false, isClosed: true, breakActive: false, breakStartTime: '12:00', breakEndTime: '13:00' },
        ]);

        setView('detail');
    };

    const renderCalendar = () => {
        const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
        const days = [];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayHolidays = getHolidaysForDate(date);
            const isCurrentDay = isToday(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            days.push(
                <div
                    key={day}
                    className={`calendar-day ${isCurrentDay ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
                    onClick={() => handleDateClick(date)}
                >
                    <div className="day-header">
                        <span className="day-number">{day}</span>
                    </div>
                    <div className="day-content">
                        {dayHolidays.map((holiday) => (
                            <div
                                key={holiday.id}
                                className={`holiday-item ${holiday.scope?.toLowerCase() || 'global'}`}
                                title={holiday.name}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <span className="holiday-name">{holiday.name}</span>
                                <button
                                    className="delete-holiday-btn"
                                    onClick={(e) => handleDeleteHoliday(holiday.id, e)}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="calendar-container">
                <div className="calendar-header">
                    <div className="calendar-nav">
                        <button onClick={previousMonth} className="nav-btn">
                            <ChevronLeft size={20} />
                        </button>
                        <h3 className="calendar-month">{monthNames[month]} {year}</h3>
                        <button onClick={nextMonth} className="nav-btn">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <div className="calendar-actions">
                        <button onClick={goToToday} className="today-btn">Today</button>
                        <button className="btn-add-holiday-calendar" onClick={() => setShowAddHolidayModal(true)}>
                            <Plus size={16} />
                            Add Holiday
                        </button>
                    </div>
                </div>

                <div className="calendar-weekdays">
                    <div className="weekday">Sun</div>
                    <div className="weekday">Mon</div>
                    <div className="weekday">Tue</div>
                    <div className="weekday">Wed</div>
                    <div className="weekday">Thu</div>
                    <div className="weekday">Fri</div>
                    <div className="weekday">Sat</div>
                </div>

                <div className="calendar-grid">
                    {days}
                </div>
            </div>
        );
    };

    // List View
    if (view === 'list') {
        return (
            <div className="business-hours-container">
                <div className="business-hours-header">
                    <h2>Business Hours</h2>
                    <button className="btn-add-business-hours" onClick={handleAddBusinessHours}>
                        <Plus size={16} />
                        Add Business Hours
                    </button>
                </div>

                <div className="business-hours-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Timezone</th>
                                <th>Used By Groups</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {businessHours.length > 0 ? (
                                businessHours.map((bh) => (
                                    <tr key={bh.id}>
                                        <td className="name-cell">{bh.name}</td>
                                        <td>{bh.timezone}</td>
                                        <td>
                                            {bh.usedByGroups > 0 ? (
                                                <button
                                                    className="used-by-groups-link text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                                                    onClick={() => handleViewGroupList(bh)}
                                                >
                                                    {bh.usedByGroups} {bh.usedByGroups === 1 ? 'Group' : 'Groups'}
                                                </button>
                                            ) : (
                                                <span className="text-gray-500">0 Groups</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${bh.status.toLowerCase()}`}>
                                                {bh.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => handleViewDetail(bh)}
                                                className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">
                                        No business hours found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Holiday Calendar Section */}
                <div className="holiday-calendar-section">
                    <div className="holiday-calendar-header-wrapper">
                        <div className="header-left">
                            <Calendar size={20} />
                            <h3>Holiday Calendar <span style={{ fontSize: '12px', color: '#666' }}>({holidays.length} loaded)</span></h3>
                        </div>
                    </div>

                    {renderCalendar()}
                </div>

                {/* Add Holiday Modal */}
                {showAddHolidayModal && (
                    <div className="modal-overlay" onClick={() => setShowAddHolidayModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Add Holiday</h3>
                                <button className="btn-close" onClick={() => setShowAddHolidayModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={newHoliday.date}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Holiday Name</label>
                                    <input
                                        type="text"
                                        value={newHoliday.name}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                        placeholder="e.g. Company Anniversary"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Scope</label>
                                    <select
                                        value={newHoliday.scope}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, scope: e.target.value })}
                                    >
                                        <option value="GLOBAL">GLOBAL</option>
                                        <option value="DEPARTEMENT">DEPARTEMENT</option>
                                        <option value="GROUP">GROUP</option>
                                    </select>
                                </div>
                                <div className="info-note">
                                    <span>ℹ️</span> Tickets will not count SLA on this date
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={() => setShowAddHolidayModal(false)}>
                                    Cancel
                                </button>
                                <button className="btn-save" onClick={handleAddHoliday}>
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Group List Modal */}
                {showGroupListModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4" onClick={() => setShowGroupListModal(false)}>
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Associated Groups</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        For: <span className="font-medium text-gray-700">{selectedBusinessHourName}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowGroupListModal(false)}
                                    className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-0 max-h-[60vh] overflow-y-auto min-h-[300px]">
                                {selectedGroupList.length > 0 ? (
                                    <ul className="divide-y divide-gray-100">
                                        {selectedGroupList
                                            .slice((groupListPage - 1) * groupsPerPage, groupListPage * groupsPerPage)
                                            .map((group) => (
                                                <li key={group.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center">
                                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm mr-3">
                                                        {group.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-gray-700 font-medium">{group.name}</span>
                                                </li>
                                            ))}
                                    </ul>
                                ) : (
                                    <div className="p-8 text-center text-gray-500">
                                        No groups associated.
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                                {selectedGroupList.length > groupsPerPage ? (
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setGroupListPage(Math.max(1, groupListPage - 1))}
                                            disabled={groupListPage === 1}
                                            className={`p-1.5 rounded-md ${groupListPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <span className="text-sm text-gray-600 font-medium">
                                            Page {groupListPage} of {Math.ceil(selectedGroupList.length / groupsPerPage)}
                                        </span>
                                        <button
                                            onClick={() => setGroupListPage(Math.min(Math.ceil(selectedGroupList.length / groupsPerPage), groupListPage + 1))}
                                            disabled={groupListPage >= Math.ceil(selectedGroupList.length / groupsPerPage)}
                                            className={`p-1.5 rounded-md ${groupListPage >= Math.ceil(selectedGroupList.length / groupsPerPage) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <div></div>
                                )}
                                <button
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                    onClick={() => setShowGroupListModal(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const handleAddBreak = (index: number) => {
        const updated = [...weeklySchedule];
        updated[index].breakActive = true;
        updated[index].breakStartTime = '12:00';
        updated[index].breakEndTime = '13:00';
        setWeeklySchedule(updated);
    };

    const handleRemoveBreak = (index: number) => {
        const updated = [...weeklySchedule];
        updated[index].breakActive = false;
        updated[index].breakStartTime = undefined;
        updated[index].breakEndTime = undefined;
        setWeeklySchedule(updated);
    };

    const handleTimeChange = (index: number, field: 'startTime' | 'endTime' | 'breakStartTime' | 'breakEndTime', value: string) => {
        const updated = [...weeklySchedule];
        // @ts-ignore
        updated[index] = { ...updated[index], [field]: value };
        setWeeklySchedule(updated);
    };

    const calculateSummary = () => {
        const activeDays = weeklySchedule.filter(d => d.isActive);
        const dayNames = activeDays.map(d => d.day);

        // Calculate Working Days String
        let workingDaysStr = "No active days";
        if (dayNames.length > 0) {
            const first = dayNames[0];
            const last = dayNames[dayNames.length - 1];
            // Check if days are consecutive in the original week array
            const firstIndex = weeklySchedule.findIndex(d => d.day === first);
            const lastIndex = weeklySchedule.findIndex(d => d.day === last);
            const isConsecutive = activeDays.length === (lastIndex - firstIndex + 1);

            if (isConsecutive && activeDays.length > 1) {
                workingDaysStr = `${first} - ${last}`;
            } else {
                workingDaysStr = dayNames.join(', ');
            }
        }

        // Calculate Hours
        let totalMinutes = 0;
        activeDays.forEach(day => {
            const start = day.startTime.split(':').map(Number);
            const end = day.endTime.split(':').map(Number);
            const startMins = start[0] * 60 + start[1];
            const endMins = end[0] * 60 + end[1];
            let diff = endMins - startMins;
            if (diff < 0) diff += 24 * 60;

            // Deduct break if active
            if (day.breakActive && day.breakStartTime && day.breakEndTime) {
                const bStart = day.breakStartTime.split(':').map(Number);
                const bEnd = day.breakEndTime.split(':').map(Number);
                const bStartMins = bStart[0] * 60 + bStart[1];
                const bEndMins = bEnd[0] * 60 + bEnd[1];
                let bDiff = bEndMins - bStartMins;
                if (bDiff > 0) {
                    diff -= bDiff;
                }
            }

            totalMinutes += diff;
        });

        const totalHours = totalMinutes / 60;
        const avgDaily = activeDays.length > 0 ? (totalHours / activeDays.length) : 0;

        return {
            workingDays: workingDaysStr,
            dailyHours: Number.isInteger(avgDaily) ? `${avgDaily} hours` : `${avgDaily.toFixed(1)} hours`,
            weeklyHours: Number.isInteger(totalHours) ? `${totalHours} hours` : `${totalHours.toFixed(1)} hours`
        };
    };

    const summary = calculateSummary();

    // Map View
    if (view === 'detail' && selectedBusinessHour) {
        return (
            <div className="business-hours-detail">
                <div className="detail-header">
                    <button className="btn-back" onClick={() => setView('list')}>
                        <ArrowLeft size={20} />
                        <span className="back-text">Back to List</span>
                    </button>
                    <h2>{selectedBusinessHour.id ? 'Edit Business Hours' : 'Add Business Hours'}</h2>
                </div>

                <div className="detail-content">
                    <div className="detail-left">
                        <h3 className="detail-title">{selectedBusinessHour.name || 'New Business Hours'}</h3>

                        <div className="info-section">
                            <h4>Business Hours Information</h4>

                            <div className="form-group">
                                <label>Business Hours Name</label>
                                <input
                                    type="text"
                                    value={selectedBusinessHour.name}
                                    onChange={(e) => setSelectedBusinessHour({ ...selectedBusinessHour, name: e.target.value })}
                                    placeholder="Enter business hours name"
                                />
                            </div>

                            <div className="form-group">
                                <label>Timezone</label>
                                <select value={selectedBusinessHour.timezone}>
                                    <option value="Asia/Jakarta">Asia/Jakarta</option>
                                </select>
                            </div>
                        </div>

                        <div className="schedule-section">
                            <h4>Weekly Schedule</h4>

                            {weeklySchedule.map((schedule, index) => (
                                <div key={schedule.day} className="schedule-row">
                                    <div className="day-name">{schedule.day}</div>

                                    {!schedule.isActive ? (
                                        <div className="closed-badge" style={{ gridColumn: '2 / 4', width: '100%' }}>
                                            Closed
                                        </div>
                                    ) : (
                                        <>
                                            <div className="time-inputs">
                                                <input
                                                    type="time"
                                                    value={schedule.startTime}
                                                    onChange={(e) => handleTimeChange(index, 'startTime', e.target.value)}
                                                />
                                                <span className="time-separator">—</span>
                                                <input
                                                    type="time"
                                                    value={schedule.endTime}
                                                    onChange={(e) => handleTimeChange(index, 'endTime', e.target.value)}
                                                />
                                            </div>

                                            {schedule.breakActive ? (
                                                <div className="time-inputs break-inputs">
                                                    <span className="break-label">Break:</span>
                                                    <input
                                                        type="time"
                                                        value={schedule.breakStartTime}
                                                        onChange={(e) => handleTimeChange(index, 'breakStartTime', e.target.value)}
                                                    />
                                                    <span className="time-separator">—</span>
                                                    <input
                                                        type="time"
                                                        value={schedule.breakEndTime}
                                                        onChange={(e) => handleTimeChange(index, 'breakEndTime', e.target.value)}
                                                    />
                                                    <button className="btn-icon-edit" onClick={() => handleRemoveBreak(index)} title="Remove Break">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                schedule.hasBreak ? (
                                                    <button className="btn-break" onClick={() => handleAddBreak(index)}>+ Break</button>
                                                ) : (
                                                    <div /> /* Placeholder for grid alignment */
                                                )
                                            )}
                                        </>
                                    )}

                                    <label className="toggle-switch" style={{ gridColumn: '-1' }}>
                                        <input
                                            type="checkbox"
                                            checked={schedule.isActive}
                                            onChange={() => handleToggleDay(index)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="detail-right">
                        <div className="summary-card">
                            <h4>Summary</h4>
                            <div className="summary-item">
                                <span className="summary-label">Working Days:</span>
                                <span className="summary-value">{summary.workingDays}</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Daily Hours:</span>
                                <span className="summary-value">{summary.dailyHours} (Avg)</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Weekly Hours:</span>
                                <span className="summary-value">{summary.weeklyHours}</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">SLA Calculation:</span>
                                <span className="summary-value">Enabled only within working hours</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="detail-footer">
                    <button className="btn-cancel" onClick={() => setView('list')}>Cancel</button>
                    <button className="btn-save">Save Changes</button>
                </div>
            </div>
        );
    }

    return null;
};

export default BusinessHours;
