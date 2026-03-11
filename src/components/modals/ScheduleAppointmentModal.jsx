import React, { useState, useEffect } from 'react';
import { patientService, appointmentService } from '../../services/api';

const ScheduleAppointmentModal = ({ isOpen, onClose, onAppointmentScheduled }) => {
    const [patients, setPatients] = useState([]);
    const [formData, setFormData] = useState({
        patient_id: '',
        appointment_date: '',
        duration: 60,
        type: 'Initial Consultation',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [fetchingPatients, setFetchingPatients] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchPatients();
        }
    }, [isOpen]);

    const fetchPatients = async () => {
        try {
            setFetchingPatients(true);
            const response = await patientService.getAll();
            setPatients(response.data);
            if (response.data.length > 0) {
                setFormData(prev => ({ ...prev, patient_id: response.data[0].id }));
            }
        } catch (err) {
            console.error('Error fetching patients:', err);
        } finally {
            setFetchingPatients(false);
        }
    };

    if (!isOpen) return null;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // Send the datetime-local value directly — PostgreSQL TIMESTAMP WITH TIME ZONE
            // handles it correctly, and avoids UTC conversion shifting the time/date
            const submissionData = { ...formData };
            console.log('Scheduling appointment with data:', submissionData);
            await appointmentService.create(submissionData);
            onAppointmentScheduled();
            onClose();
        } catch (err) {
            console.error('Error scheduling appointment:', err);
            setError(err.response?.data?.message || 'Failed to schedule appointment.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Schedule Appointment</h2>
                        <p className="text-sm text-slate-500 mt-1">Book a new session for a patient</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Select Patient *</label>
                            <select
                                required
                                name="patient_id"
                                value={formData.patient_id}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            >
                                {fetchingPatients ? (
                                    <option>Loading patients...</option>
                                ) : patients.length === 0 ? (
                                    <option>No patients found</option>
                                ) : (
                                    patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.full_name}</option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Date & Time *</label>
                                <input
                                    required
                                    type="datetime-local"
                                    name="appointment_date"
                                    value={formData.appointment_date}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Duration (min)</label>
                                <select
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                                >
                                    <option value={30}>30 minutes</option>
                                    <option value={45}>45 minutes</option>
                                    <option value={60}>60 minutes</option>
                                    <option value={90}>90 minutes</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Appointment Type</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            >
                                <option>Initial Consultation</option>
                                <option>Follow-up Session</option>
                                <option>Therapy Session</option>
                                <option>Medication Review</option>
                                <option>Crisis Intervention</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Notes (Optional)</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="3"
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                                placeholder="Any specific instructions or context..."
                            ></textarea>
                        </div>
                    </div>

                    <div className="mt-10 flex items-center justify-end space-x-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || patients.length === 0}
                            className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center space-x-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span>Schedule</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScheduleAppointmentModal;
