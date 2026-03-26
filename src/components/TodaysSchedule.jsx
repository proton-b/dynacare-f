import React, { useState, useEffect } from 'react'
import { appointmentService } from '../services/api'
import { useNavigate } from 'react-router-dom'

const TodaysSchedule = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await appointmentService.getAll();
                // Get today's date in IST (Asia/Kolkata)
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

                const todaysApps = response.data.filter(app => {
                    const appDate = new Date(app.appointment_date);
                    const appDateString = appDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

                    if (appDateString !== today) return false;

                    const isCompleted = app.status === 'Completed' || app.status === 'Cancelled';
                    const now = new Date(); // Use local system time for comparison as simple approximation, or better yet convert appDate to local

                    // Note: This comparison effectively hides past appointments even if not marked completed which matches user request
                    // "schedule be disappear one the given time completed"
                    const isTimePassed = new Date(app.appointment_date) < new Date();

                    return !isCompleted && !isTimePassed;
                });

                // Sort by time
                todaysApps.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));

                setAppointments(todaysApps);
            } catch (error) {
                console.error("Error fetching appointments:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAppointments();
    }, []);

    const currentTime = new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })

    const todayDate = new Date().toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const handleStartSession = (patientId) => {
        navigate('/recording', { state: { patientId } });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Today's Schedule</h2>
                        <p className="text-sm text-slate-500">{todayDate} (IST)</p>
                    </div>
                </div>
                <div className="flex items-center text-sm text-slate-500">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {currentTime}
                </div>
            </div>

            {loading ? (
                <div className="py-16 text-center animate-pulse">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl mx-auto mb-4"></div>
                    <div className="h-4 w-48 bg-slate-100 mx-auto"></div>
                </div>
            ) : appointments.length > 0 ? (
                <div className="space-y-4">
                    {appointments.map((app, index) => (
                        <div key={index} onClick={() => navigate(`/patients?patientId=${app.patient_id}`)} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all">
                            <div className="flex items-center space-x-4">
                                <div className="text-center bg-white p-2 rounded-lg border border-slate-200 w-24">
                                    <p className="text-xs font-bold text-primary-600 uppercase">
                                        {new Date(app.appointment_date).toLocaleTimeString('en-US', {
                                            timeZone: 'Asia/Kolkata',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{app.patient_name}</p>
                                    <p className="text-sm text-slate-500">{app.type}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                {app.status === 'Scheduled' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleStartSession(app.patient_id); }}
                                        className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                    >
                                        Start Session
                                    </button>
                                )}
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${app.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' :
                                    app.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                        'bg-slate-100 text-slate-700'
                                    }`}>
                                    {app.status}
                                </span>
                                <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-16 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="text-slate-500">No appointments scheduled for today</p>
                </div>
            )}
        </div>
    )
}

export default TodaysSchedule
