import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { activityService } from '../services/api'
import AddPatientModal from './modals/AddPatientModal'
import ScheduleAppointmentModal from './modals/ScheduleAppointmentModal'

const RecentActivity = () => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const response = await activityService.getLogs();
            setActivities(response.data);
        } catch (error) {
            console.error("Error fetching activity logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setIsAddPatientOpen(true)}
                        className="btn-primary flex items-center space-x-2 text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>New Patient</span>
                    </button>
                    <Link
                        to="/recording"
                        className="bg-white text-primary-600 font-semibold py-2 px-4 rounded-lg border-2 border-primary-600 hover:bg-primary-50 transition-colors text-sm"
                    >
                        Start Session
                    </Link>
                    <button
                        onClick={() => setIsScheduleOpen(true)}
                        className="bg-slate-100 text-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 transition-colors text-sm flex items-center space-x-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Schedule</span>
                    </button>
                </div>
            </div>

            {/* Activity Items */}

            {/* Activity Items */}
            <div className="space-y-4">
                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg"></div>)}
                    </div>
                ) : activities.length > 0 ? (
                    activities.map((activity, index) => (
                        <div
                            key={index}
                            className="flex items-center space-x-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100"
                        >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">{activity.action}</p>
                                <p className="text-xs text-slate-500">{activity.target_type} ID: {activity.target_id}</p>
                            </div>
                            <span className="text-xs text-slate-400">{formatTime(activity.timestamp)}</span>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        No recent activity found
                    </div>
                )}
            </div>
            <AddPatientModal
                isOpen={isAddPatientOpen}
                onClose={() => setIsAddPatientOpen(false)}
                onPatientAdded={() => {
                    fetchLogs();
                    // Optionally show a success toast here
                }}
            />
            <ScheduleAppointmentModal
                isOpen={isScheduleOpen}
                onClose={() => setIsScheduleOpen(false)}
                onAppointmentScheduled={() => {
                    fetchLogs();
                }}
            />
        </div>
    )
}

export default RecentActivity

