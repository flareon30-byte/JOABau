import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Users, MapPin } from 'lucide-react';

const CalendarView = ({ appointments, onSlotClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Helper to get start of week (Monday)
    const getStartOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(d.setDate(diff));
    };

    const startOfWeek = getStartOfWeek(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 to 20:00

    const nextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const prevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const getAppointmentsForSlot = (day, hour) => {
        if (!Array.isArray(appointments)) return [];
        return appointments.filter(app => {
            if (!app.assignedDate) return false;
            const appDate = new Date(app.assignedDate);
            return (
                appDate.getDate() === day.getDate() &&
                appDate.getMonth() === day.getMonth() &&
                appDate.getFullYear() === day.getFullYear() &&
                appDate.getHours() === hour
            );
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800 capitalize">
                    {startOfWeek.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={prevWeek} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-medium hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
                        Hoy
                    </button>
                    <button onClick={nextWeek} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Grid Header (Days) */}
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
                <div className="p-3 text-xs font-bold text-slate-400 text-center border-r border-slate-200">Hora</div>
                {weekDays.map((day, i) => (
                    <div key={i} className={`p-3 text-center border-r border-slate-100 ${day.toDateString() === new Date().toDateString() ? 'bg-blue-50' : ''}`}>
                        <p className="text-xs font-bold text-slate-500 uppercase">{day.toLocaleDateString('es-ES', { weekday: 'short' })}</p>
                        <p className={`text-lg font-bold ${day.toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-slate-800'}`}>
                            {day.getDate()}
                        </p>
                    </div>
                ))}
            </div>

            {/* Grid Body (Time Slots) */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-8">
                    {hours.map(hour => (
                        <React.Fragment key={hour}>
                            {/* Time Label */}
                            <div className="p-2 text-xs font-medium text-slate-400 text-center border-r border-b border-slate-100 sticky left-0 bg-white">
                                {hour}:00
                            </div>

                            {/* Days Columns */}
                            {weekDays.map((day, i) => {
                                const slotApps = getAppointmentsForSlot(day, hour);
                                const isPast = day < new Date().setHours(0, 0, 0, 0);

                                return (
                                    <div
                                        key={i}
                                        className={`min-h-[80px] border-r border-b border-slate-100 p-1 relative group transition-colors ${isPast ? 'bg-slate-50/50' : 'hover:bg-blue-50/30'}`}
                                        onClick={() => onSlotClick && onSlotClick(day, hour)}
                                    >
                                        {slotApps.map(app => (
                                            <div
                                                key={app.id}
                                                className="bg-blue-100 border-l-2 border-blue-500 p-1 mb-1 rounded text-[10px] overflow-hidden cursor-pointer hover:bg-blue-200 transition-colors"
                                                title={`${app.address.street} - ${app.assignedTeam?.name}`}
                                            >
                                                <div className="font-bold text-blue-800 truncate">{app.address.street}</div>
                                                <div className="text-blue-600 truncate flex items-center gap-1">
                                                    <Users size={8} /> {app.assignedTeam?.name || 'Sin asignar'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
