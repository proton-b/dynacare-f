import React, { useState, useEffect } from 'react';
import { patientService } from '../../services/api';

const EditPatientModal = ({ isOpen, onClose, patient, onPatientUpdated }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        dob: '',
        gender: '',
        address: '',
        insurance_provider: '',
        insurance_id: '',
        status: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (patient) {
            setFormData({
                full_name: patient.full_name || '',
                email: patient.email || '',
                phone: patient.phone || '',
                dob: patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : '',
                gender: patient.gender || 'Male',
                address: patient.address || '',
                insurance_provider: patient.insurance_provider || '',
                insurance_id: patient.insurance_id || '',
                status: patient.status || 'Active'
            });
        }
    }, [patient]);

    if (!isOpen || !patient) return null;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await patientService.update(patient.id, formData);
            onPatientUpdated(response.data);
            onClose();
        } catch (err) {
            console.error('Error updating patient:', err);
            setError(err.response?.data?.message || 'Failed to update patient.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Edit Patient Profile</h2>
                        <p className="text-sm text-slate-500 mt-1">Update clinical information for {patient.full_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Full Name *</label>
                            <input
                                required
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            >
                                <option>Active</option>
                                <option>Inactive</option>
                                <option>Discharged</option>
                                <option>On Hold</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Date of Birth</label>
                            <input
                                type="date"
                                name="dob"
                                value={formData.dob}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                            <input
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Residential Address</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows="2"
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            ></textarea>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Insurance Provider</label>
                            <input
                                name="insurance_provider"
                                value={formData.insurance_provider}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Policy ID</label>
                            <input
                                name="insurance_id"
                                value={formData.insurance_id}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                            />
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
                            disabled={loading}
                            className="px-10 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all disabled:opacity-50 flex items-center space-x-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span>Save Changes</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPatientModal;
