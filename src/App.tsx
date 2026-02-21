/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Calendar as CalendarIcon,
  Search,
  Bell,
  Plus,
  History,
  CircleDollarSign,
  UserCircle,
  MapPin,
  Sun,
  Moon,
  Sunset,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowLeftRight,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useRef, useEffect, UIEvent } from 'react';

type ShiftType = 'my' | 'available';
type ShiftTimeSlot = 'day' | 'evening' | 'night';
type ShiftSource = 'manager' | 'friend' | null; // null for "my" shifts

interface Shift {
  id: string;
  title: string;
  type: ShiftType;
  timeSlot: ShiftTimeSlot;
  time: string;
  location: string;
  date: number; // Day of month
  source?: ShiftSource; // Only for available shifts
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Current date (February 10, 2026)
const TODAY = 10;

// Helper function to generate calendar days for a given month/year
function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: { day: number; currentMonth: boolean }[] = [];

  // Add previous month's days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({ day: prevMonthLastDay - i, currentMonth: false });
  }

  // Add current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, currentMonth: true });
  }

  // Add next month's days to complete the grid (up to 35 or 42 days)
  const remainingDays = 35 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ day: i, currentMonth: false });
  }

  return days;
}

const SHIFTS_DATA: Shift[] = [
  { id: '1', title: 'Senior Nurse Practitioner', type: 'my', timeSlot: 'day', time: '08:00 - 16:30', location: 'North Wing, Floor 3', date: 15 },
  { id: '2', title: 'General Duty Staff', type: 'available', timeSlot: 'night', time: '19:00 - 03:00', location: 'Emergency ER', date: 15, source: 'manager' },
  { id: '3', title: 'Triage Specialist', type: 'my', timeSlot: 'day', time: '07:00 - 15:00', location: 'Main Entrance', date: 5 },
  { id: '4', title: 'Night Shift Supervisor', type: 'available', timeSlot: 'night', time: '22:00 - 06:00', location: 'ICU Ward', date: 5, source: 'friend' },
  { id: '5', title: 'Pediatric Nurse', type: 'my', timeSlot: 'day', time: '08:00 - 16:00', location: 'Children\'s Wing', date: 11 },
  { id: '6', title: 'Emergency Responder', type: 'available', timeSlot: 'day', time: '12:00 - 20:00', location: 'Ambulance Bay', date: 13, source: 'manager' },
  { id: '7', title: 'Lab Technician', type: 'available', timeSlot: 'evening', time: '14:00 - 22:00', location: 'Diagnostics Lab', date: 13, source: 'friend' },
  { id: '8', title: 'On-Call Surgeon', type: 'my', timeSlot: 'evening', time: '16:00 - 00:00', location: 'Surgery Block B', date: 18 },
  { id: '9', title: 'Pharmacy Assistant', type: 'available', timeSlot: 'day', time: '09:00 - 17:00', location: 'Hospital Pharmacy', date: 21, source: 'friend' },
  { id: '10', title: 'Radiology Tech', type: 'my', timeSlot: 'day', time: '08:00 - 16:00', location: 'X-Ray Dept', date: 25 },
  { id: '11', title: 'Night Nurse', type: 'available', timeSlot: 'night', time: '20:00 - 04:00', location: 'Ward 4C', date: 28, source: 'manager' },
  { id: '12', title: 'ICU Specialist', type: 'available', timeSlot: 'day', time: '07:00 - 19:00', location: 'Intensive Care', date: 1, source: 'friend' },
  { id: '13', title: 'Staff Nurse', type: 'available', timeSlot: 'day', time: '08:00 - 16:00', location: 'General Ward', date: 7, source: 'manager' },
  { id: '14', title: 'ER Coordinator', type: 'my', timeSlot: 'evening', time: '15:00 - 23:00', location: 'Emergency Dept', date: 4 },
  { id: '15', title: 'Critical Care Nurse', type: 'my', timeSlot: 'night', time: '22:00 - 06:00', location: 'ICU Wing A', date: 12 },
  { id: '16', title: 'Overnight Monitor', type: 'my', timeSlot: 'night', time: '23:00 - 07:00', location: 'Cardiac Care Unit', date: 20 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedDay, setSelectedDay] = useState(10); // Changed to TODAY (10)
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(1); // February (0-indexed)
  const [currentYear, setCurrentYear] = useState(2026);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [swapReason, setSwapReason] = useState('');
  const [calendarHeight, setCalendarHeight] = useState(320); // Default calendar height in pixels
  const [isDragging, setIsDragging] = useState(false);
  const lastScrollY = useRef(0);
  const isAutoScrolling = useRef(false);
  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Generate calendar days based on current month/year
  const calendarDays = useMemo(() => {
    return generateCalendarDays(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const handleScroll = (e: UIEvent<HTMLElement>) => {
    // Prevent collapse if the scroll was triggered by a calendar click
    if (isAutoScrolling.current) {
      lastScrollY.current = e.currentTarget.scrollTop;
      return;
    }

    const currentScrollY = e.currentTarget.scrollTop;

    // Collapse on scroll down, expand on scroll up
    if (currentScrollY > 100 && currentScrollY > lastScrollY.current) {
      setIsCalendarCollapsed(true);
    } else if (currentScrollY < lastScrollY.current - 10 || currentScrollY <= 0) {
      setIsCalendarCollapsed(false);
    }

    lastScrollY.current = currentScrollY;
  };

  const isShiftInPast = (shiftDate: number) => {
    // Compare shift date with TODAY in the current month/year context
    if (currentYear === 2026 && currentMonth === 1) { // February 2026
      return shiftDate < TODAY;
    }
    return false;
  };

  const shiftsByDay = useMemo(() => {
    const grouped: { [key: number]: Shift[] } = {};
    SHIFTS_DATA.forEach(shift => {
      if (!grouped[shift.date]) grouped[shift.date] = [];
      grouped[shift.date].push(shift);
    });

    // Sort days: chronological
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(day => ({
        day,
        shifts: grouped[day].filter(shift => {
          // Filter out past opportunities
          if (shift.type === 'available' && isShiftInPast(shift.date)) {
            return false;
          }

          if (activeTab === 'All') return true;
          if (activeTab === 'My Shifts') return shift.type === 'my';
          if (activeTab === 'Opportunities') return shift.type === 'available';
          return true;
        })
      }))
      .filter(group => group.shifts.length > 0);
  }, [activeTab, currentMonth, currentYear]);

  const dayRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    const element = dayRefs.current[selectedDay];
    if (element) {
      // Flag that we are auto-scrolling to prevent calendar collapse
      isAutoScrolling.current = true;
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Clear existing timer
      if (autoScrollTimer.current) clearTimeout(autoScrollTimer.current);
      
      // Reset flag after the smooth scroll animation completes
      autoScrollTimer.current = setTimeout(() => {
        isAutoScrolling.current = false;
      }, 800);
    }
  }, [selectedDay]);

  const getDayStatus = (day: number, currentMonth: boolean) => {
    if (!currentMonth) return { mySlots: [], hasManagerShift: false, hasFriendShift: false };

    const dayShifts = SHIFTS_DATA.filter(s => s.date === day);
    const isPast = isShiftInPast(day);

    const mySlots = dayShifts
      .filter(s => s.type === 'my')
      .map(s => s.timeSlot);

    // Only show opportunities for today and future dates
    const hasManagerShift = !isPast && dayShifts.some(s => s.type === 'available' && s.source === 'manager');
    const hasFriendShift = !isPast && dayShifts.some(s => s.type === 'available' && s.source === 'friend');

    return { mySlots, hasManagerShift, hasFriendShift };
  };

  const getTimeSlotIcon = (slot: ShiftTimeSlot, size: string = "w-3.5 h-3.5") => {
    switch (slot) {
      case 'day': return <Sun className={size} />;
      case 'evening': return <Sunset className={size} />;
      case 'night': return <Moon className={size} />;
    }
  };

  const getTimeSlotLabel = (slot: ShiftTimeSlot) => {
    return slot.charAt(0).toUpperCase() + slot.slice(1);
  };

  const getFormattedDay = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const handleShiftClick = (shift: Shift) => {
    setSelectedShift(shift);
    if (shift.type === 'my') {
      setIsSwapModalOpen(true);
      setSwapReason('');
    } else if (shift.type === 'available') {
      setIsOpportunityModalOpen(true);
    }
  };

  const handleSwapRequest = () => {
    if (!swapReason.trim()) {
      alert('Please provide a reason for the swap request');
      return;
    }
    // Here you would typically send the swap request to your backend
    console.log('Swap request submitted:', {
      shift: selectedShift,
      reason: swapReason
    });
    alert('Swap request submitted successfully!');
    setIsSwapModalOpen(false);
    setSelectedShift(null);
    setSwapReason('');
  };

  const handleClaimShift = () => {
    // Here you would typically send the claim request to your backend
    console.log('Claim shift request:', selectedShift);
    alert('Shift claimed successfully!');
    setIsOpportunityModalOpen(false);
    setSelectedShift(null);
  };

  const handleDeclineShift = () => {
    // Here you would typically send the decline notification to your backend
    console.log('Decline shift notification:', selectedShift);
    alert('You have declined this shift. The manager has been notified.');
    setIsOpportunityModalOpen(false);
    setSelectedShift(null);
  };

  const handleDragStart = (e: any) => {
    setIsDragging(true);
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = calendarHeight;
    e.preventDefault();
  };

  const handleDragMove = (e: any) => {
    if (!isDragging) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - dragStartY.current;
    const newHeight = Math.max(180, Math.min(600, dragStartHeight.current + deltaY));
    setCalendarHeight(newHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging]);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-bg-light shadow-2xl relative overflow-hidden">
      {/* Header */}
      <header className="bg-white px-4 pt-6 pb-2 sticky top-0 z-20 border-b border-primary/5">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setIsMonthPickerOpen(true)}
            className="flex items-center gap-2 hover:bg-primary/5 px-3 py-2 rounded-lg transition-colors -ml-3"
          >
            <CalendarIcon className="text-primary w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-primary">
              {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h1>
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full hover:bg-primary/5 text-slate-600">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-primary/5 text-slate-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 ml-1">
              <img 
                src="https://picsum.photos/seed/nurse/100/100" 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-2">
          {['All', 'My Shifts', 'Opportunities'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === tab 
                  ? 'bg-white shadow-sm text-primary' 
                  : 'text-slate-500 hover:text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Calendar Grid - Resizable */}
      <div
        style={{ height: `${calendarHeight}px` }}
        className="bg-white border-b border-primary/5 shadow-sm z-10 overflow-y-auto transition-all"
      >
        <div className="grid grid-cols-7 border-b border-primary/5">
          {DAYS.map((day, i) => (
            <div key={i} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((item, i) => {
            const { mySlots, hasManagerShift, hasFriendShift } = getDayStatus(item.day, item.currentMonth);
            const isSelected = item.currentMonth && item.day === selectedDay;
            const isToday = item.currentMonth && item.day === TODAY;
            const isPastDay = item.currentMonth && isShiftInPast(item.day);

            // Filter visibility based on active tab
            const showMy = activeTab === 'All' || activeTab === 'My Shifts';
            const showAvailable = activeTab === 'All' || activeTab === 'Opportunities';

            return (
              <button
                key={i}
                disabled={!item.currentMonth}
                onClick={() => setSelectedDay(item.day)}
                className={`h-16 border-r border-b border-primary/5 flex flex-col items-center pt-2 relative transition-all ${
                  !item.currentMonth ? 'opacity-30 cursor-default' : 'hover:bg-slate-50 cursor-pointer'
                } ${isSelected ? 'bg-primary/5 ring-2 ring-primary ring-inset' : ''} ${
                  showMy && mySlots.length > 0 ? (isPastDay ? 'bg-primary/10 opacity-60' : 'bg-primary/20') : ''
                }`}
              >
                {isToday && (
                  <span className="absolute top-0.5 text-[8px] font-black text-blue-600 uppercase tracking-wide">
                    Today
                  </span>
                )}
                <span className={`text-xs font-semibold transition-all ${
                  isToday ? 'mt-2' : ''
                } ${
                  isSelected ? 'text-primary font-bold scale-110' : isToday ? 'text-blue-600 font-bold' : 'text-slate-700'
                }`}>
                  {item.day}
                </span>
                <div className="flex flex-wrap justify-center gap-1 mt-auto pb-1.5 px-1">
                  {showMy && mySlots.map((slot, idx) => (
                    <div
                      key={`my-${idx}`}
                      className="text-primary"
                      title={getTimeSlotLabel(slot)}
                    >
                      {getTimeSlotIcon(slot, "w-5 h-5 stroke-[2.5]")}
                    </div>
                  ))}
                  {showAvailable && hasManagerShift && (
                    <div
                      className="text-purple-600 bg-purple-100 rounded-md p-0.5 shadow-sm"
                      title="Manager Shift"
                    >
                      <Star className="w-3 h-3 fill-purple-200" />
                    </div>
                  )}
                  {showAvailable && hasFriendShift && (
                    <div
                      className="text-purple-600 bg-purple-100 rounded-md p-0.5 shadow-sm"
                      title="Friend Replacement"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Draggable Handle / Grabber */}
      <div
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className={`bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors cursor-row-resize flex items-center justify-center py-2 z-20 select-none ${
          isDragging ? 'bg-slate-300' : ''
        }`}
      >
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-12 h-1 bg-slate-400 rounded-full"></div>
          <div className="w-12 h-1 bg-slate-400 rounded-full"></div>
        </div>
      </div>

      <main
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto pb-24 scroll-smooth"
      >

        {/* Shift List */}
        <section className="p-4 min-h-[300px]">
          <div className="space-y-8">
            <AnimatePresence mode="popLayout">
              {shiftsByDay.length > 0 ? (
                shiftsByDay.map((group) => (
                  <motion.div 
                    key={group.day} 
                    ref={el => dayRefs.current[group.day] = el}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className={`scroll-mt-4 transition-all duration-500 ${group.day === selectedDay ? 'scale-[1.02]' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className={`text-lg font-bold transition-colors ${group.day === selectedDay ? 'text-primary' : 'text-slate-800'}`}>
                        {getFormattedDay(group.day)}
                      </h3>
                      {group.day === TODAY && (
                        <span className="text-[10px] font-black text-white bg-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {group.shifts.map((shift) => {
                        const isPast = isShiftInPast(shift.date);
                        return (
                        <motion.div
                          key={shift.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => handleShiftClick(shift)}
                          className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 transition-all ${
                            shift.type === 'my'
                              ? isPast
                                ? 'border-primary/30 opacity-60 cursor-pointer'
                                : 'border-primary cursor-pointer hover:shadow-lg'
                              : 'border-secondary cursor-pointer hover:shadow-lg'
                          } ${group.day === selectedDay ? 'ring-1 ring-primary/20 shadow-md' : ''}`}
                        >

                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                  shift.type === 'my' ? 'text-primary' : 'text-secondary'
                                }`}>
                                  {shift.type === 'my' ? 'My Shift' : 'Opportunity'}
                                </p>
                                {shift.type === 'available' && shift.source === 'manager' && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full uppercase">
                                    <Star className="w-3 h-3 fill-purple-200" />
                                    Manager
                                  </span>
                                )}
                                {shift.type === 'available' && shift.source === 'friend' && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full uppercase">
                                    <ArrowLeftRight className="w-3 h-3" />
                                    Replace
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-base text-slate-900 mb-2 leading-tight">
                                {shift.title}
                              </h4>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                                <div className="flex items-center gap-1.5">
                                  {getTimeSlotIcon(shift.timeSlot)}
                                  <span>
                                    {shift.time}
                                    {shift.type === 'available' && ` (${getTimeSlotLabel(shift.timeSlot)})`}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {shift.type === 'my' ? (
                              <div className="p-2 bg-primary/5 rounded-xl text-primary flex flex-col items-center gap-0.5">
                                {getTimeSlotIcon(shift.timeSlot, "w-5 h-5")}
                                <span className="text-[8px] font-bold uppercase">{shift.timeSlot}</span>
                              </div>
                            ) : (
                              <button className="bg-secondary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-secondary/20 active:scale-95 transition-transform whitespace-nowrap">
                                {shift.source === 'manager' ? 'Claim / Decline' : 'Claim'}
                              </button>
                            )}
                          </div>
                        </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <CalendarIcon className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No shifts found for this month</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform z-30">
        <Plus className="w-7 h-7" />
      </button>

      {/* Month Picker Modal */}
      <AnimatePresence>
        {isMonthPickerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMonthPickerOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-[90%] max-w-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-800">Select Month</h2>
                <button
                  onClick={() => setIsMonthPickerOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Year Selector */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <button
                  onClick={() => setCurrentYear(currentYear - 1)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xl font-bold text-slate-800">{currentYear}</span>
                <button
                  onClick={() => setCurrentYear(currentYear + 1)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-3 gap-2 p-4">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                  <button
                    key={month}
                    onClick={() => {
                      setCurrentMonth(index);
                      setIsMonthPickerOpen(false);
                    }}
                    className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                      currentMonth === index
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Swap Request Modal */}
      <AnimatePresence>
        {isSwapModalOpen && selectedShift && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSwapModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />

            {/* Bottom Sheet Modal */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              <div className="bg-white rounded-t-xl shadow-2xl max-w-md mx-auto overflow-hidden border-t border-slate-200">
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                </div>

                {/* Modal Header */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">My Shift Details</h2>
                  <button
                    onClick={() => setIsSwapModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 pb-8 space-y-6">
                  {/* Shift Summary Card */}
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary text-white p-2 rounded-lg">
                        <CalendarIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-primary font-bold text-lg">{selectedShift.title}</p>
                        <div className="flex items-center gap-2 text-slate-600 text-sm mt-1 flex-wrap">
                          <div className="flex items-center gap-1">
                            {getTimeSlotIcon(selectedShift.timeSlot, "w-4 h-4")}
                            <span>{selectedShift.time}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{selectedShift.location}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-primary/10">
                          <p className="text-slate-600 text-xs font-semibold mb-1">Scheduled Date</p>
                          <p className="text-slate-900 text-base font-bold">
                            {getFormattedDay(selectedShift.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Request Swap Section - Only show for future shifts */}
                  {!isShiftInPast(selectedShift.date) && (
                    <>
                      <div>
                        <h3 className="text-base font-bold text-slate-800 mb-4">Request Swap</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              Reason for swap <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-slate-500 mb-2 italic">Only visible for management</p>
                            <textarea
                              value={swapReason}
                              onChange={(e) => setSwapReason(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none resize-none"
                              placeholder="Please provide a reason for your shift swap request..."
                              rows={3}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Footer */}
                      <div className="pt-2">
                        <button
                          onClick={handleSwapRequest}
                          className="w-full px-6 py-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                        >
                          <ArrowLeftRight className="w-5 h-5" />
                          Request Swap
                        </button>
                      </div>

                      {/* Accessibility/Disclaimer */}
                      <p className="text-center text-xs text-slate-400">
                        Your request will be sent to the department manager for approval.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Opportunity Details Modal */}
      <AnimatePresence>
        {isOpportunityModalOpen && selectedShift && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpportunityModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />

            {/* Bottom Sheet Modal */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              <div className="bg-white rounded-t-xl shadow-2xl max-w-md mx-auto overflow-hidden border-t border-slate-200">
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                </div>

                {/* Modal Header */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">Opportunity Details</h2>
                  <button
                    onClick={() => setIsOpportunityModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 pb-8 space-y-6">
                  {/* Shift Summary Card */}
                  <div className="bg-secondary/5 rounded-xl p-4 border border-secondary/10">
                    <div className="flex items-start gap-4">
                      <div className="bg-secondary text-white p-2 rounded-lg">
                        <CalendarIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-secondary font-bold text-lg">{selectedShift.title}</p>
                          {selectedShift.source === 'manager' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full uppercase">
                              <Star className="w-3 h-3 fill-purple-200" />
                              Manager
                            </span>
                          )}
                          {selectedShift.source === 'friend' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full uppercase">
                              <ArrowLeftRight className="w-3 h-3" />
                              Replace
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 text-sm mt-1 flex-wrap">
                          <div className="flex items-center gap-1">
                            {getTimeSlotIcon(selectedShift.timeSlot, "w-4 h-4")}
                            <span>{selectedShift.time}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{selectedShift.location}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-secondary/10">
                          <p className="text-slate-600 text-xs font-semibold mb-1">Scheduled Date</p>
                          <p className="text-slate-900 text-base font-bold">
                            {getFormattedDay(selectedShift.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-2">
                    {selectedShift.source === 'manager' ? (
                      <div className="flex gap-3">
                        <button
                          onClick={handleDeclineShift}
                          className="flex-1 px-6 py-4 rounded-xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                          <X className="w-5 h-5" />
                          Decline
                        </button>
                        <button
                          onClick={handleClaimShift}
                          className="flex-1 px-6 py-4 rounded-xl bg-secondary text-white font-bold shadow-lg shadow-secondary/20 hover:bg-secondary/90 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-5 h-5" />
                          Claim
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleClaimShift}
                        className="w-full px-6 py-4 rounded-xl bg-secondary text-white font-bold shadow-lg shadow-secondary/20 hover:bg-secondary/90 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Claim Shift
                      </button>
                    )}
                  </div>

                  {/* Accessibility/Disclaimer */}
                  <p className="text-center text-xs text-slate-400">
                    {selectedShift.source === 'manager'
                      ? 'By claiming, you agree to work this shift. Declining will notify the manager.'
                      : 'By claiming this shift, you agree to work at the scheduled time and location.'}
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-primary/10 flex justify-around items-center px-4 py-3 pb-8 sticky bottom-0 z-20">
        <button className="flex flex-col items-center gap-1 text-primary">
          <CalendarIcon className="w-6 h-6 fill-primary/10" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Schedule</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <History className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Shifts</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <CircleDollarSign className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Earnings</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <UserCircle className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Profile</span>
        </button>
      </nav>
    </div>
  );
}
