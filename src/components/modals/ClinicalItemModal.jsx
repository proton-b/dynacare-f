import React, { useState, useEffect } from 'react';
import { clinicalService } from '../../services/api';

const CATEGORY_CONFIG = {
    medication: {
        title: 'Medication',
        add: (patientId, data) => clinicalService.addMedication(patientId, data),
        update: (id, data) => clinicalService.updateMedication(id, data),
        fields: [
            { name: 'name', label: 'Medication Name', type: 'text', required: true, placeholder: 'e.g. Sertraline, Alprazolam' },
            { name: 'dosage', label: 'Dosage', type: 'text', required: true, placeholder: 'e.g. 50mg, 0.5mg' },
            { name: 'frequency', label: 'Frequency', type: 'text', required: true, placeholder: 'e.g. Once daily, Twice daily' },
            { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Discontinued', 'On Hold'] },
            { name: 'prescribed_by', label: 'Prescribed By', type: 'text', required: false, placeholder: 'Doctor name' },
            { name: 'start_date', label: 'Start Date', type: 'date', required: false },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false, placeholder: 'Additional notes...' },
        ],
    },
    diagnosis: {
        title: 'Diagnosis',
        add: (patientId, data) => clinicalService.addDiagnosis(patientId, data),
        update: (id, data) => clinicalService.updateDiagnosis(id, data),
        fields: [
            { name: 'disorder_name', label: 'Disorder Name', type: 'text', required: true, placeholder: 'e.g. Major Depressive Disorder' },
            { name: 'dsm_code', label: 'DSM Code', type: 'text', required: false, placeholder: 'e.g. F32.1' },
            { name: 'status', label: 'Status', type: 'select', required: true, options: ['Current', 'Previous', 'In Remission'] },
            { name: 'doctor_name', label: 'Diagnosed By', type: 'text', required: false, placeholder: 'Doctor name' },
            { name: 'diagnosed_date', label: 'Diagnosed Date', type: 'date', required: false },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false, placeholder: 'Additional clinical notes...' },
        ],
    },
    treatmentPlan: {
        title: 'Treatment Plan',
        add: (patientId, data) => clinicalService.addTreatmentPlan(patientId, data),
        update: (id, data) => clinicalService.updateTreatmentPlan(id, data),
        fields: [
            { name: 'goal', label: 'Primary Goal', type: 'textarea', required: true, placeholder: 'e.g. Reduce anxiety symptoms by 50% within 3 months' },
            { name: 'intervention', label: 'Interventions', type: 'textarea', required: true, placeholder: 'e.g. CBT sessions twice weekly, mindfulness exercises' },
            { name: 'progress_notes', label: 'Progress Notes', type: 'textarea', required: false, placeholder: 'Current progress...' },
            { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Completed', 'On Hold', 'Discontinued'] },
        ],
    },
};

const ClinicalItemModal = ({ isOpen, onClose, patientId, category, editItem, onSaved }) => {
    const config = CATEGORY_CONFIG[category];
    if (!config) return null;

    const isEditing = !!editItem;

    const getInitialFormData = () => {
        const data = {};
        config.fields.forEach(f => {
            if (f.type === 'select') {
                data[f.name] = f.options[0];
            } else {
                data[f.name] = '';
            }
        });
        return data;
    };

    const [formData, setFormData] = useState(getInitialFormData());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditing && editItem) {
            const data = {};
            config.fields.forEach(f => {
                let val = editItem[f.name] || '';
                if (f.type === 'date' && val) {
                    val = new Date(val).toISOString().split('T')[0];
                }
                data[f.name] = val;
            });
            setFormData(data);
        } else {
            setFormData(getInitialFormData());
        }
        setError('');
    }, [editItem, category, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isEditing) {
                await config.update(editItem.id, formData);
            } else {
                await config.add(patientId, formData);
            }
            onSaved();
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            setError(err.response?.data?.message || 'Failed to save. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {isEditing ? 'Edit' : 'Add'} {config.title}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {isEditing ? 'Update the details below' : 'Fill in the details below'}
                        </p>
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

                    <div className="space-y-5">
                        {config.fields.map((field) => (
                            <div key={field.name}>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    {field.label} {field.required && '*'}
                                </label>
                                {field.type === 'textarea' ? (
                                    <textarea
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={handleChange}
                                        required={field.required}
                                        placeholder={field.placeholder}
                                        rows="3"
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                                    />
                                ) : field.type === 'select' ? (
                                    <select
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={handleChange}
                                        required={field.required}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                                    >
                                        {field.options.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type={field.type}
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={handleChange}
                                        required={field.required}
                                        placeholder={field.placeholder}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex items-center justify-end space-x-4">
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
                                <span>{isEditing ? 'Save Changes' : 'Add'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClinicalItemModal;
