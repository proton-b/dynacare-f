import React, { useState, useEffect } from 'react';
import { clinicalService } from '../../services/api';

const CATEGORY_CONFIG = {
    Condition: {
        title: 'Past Medical Condition',
        fields: [
            { name: 'name', label: 'Condition Name', type: 'text', required: true, placeholder: 'e.g. Hypertension, Diabetes' },
            { name: 'detail', label: 'Year Diagnosed', type: 'text', required: false, placeholder: 'e.g. 2018' },
            { name: 'notes', label: 'Description / Notes', type: 'textarea', required: false, placeholder: 'Additional details about the condition...' },
        ],
    },
    Allergy: {
        title: 'Allergy',
        fields: [
            { name: 'name', label: 'Allergen', type: 'text', required: true, placeholder: 'e.g. Penicillin, Peanuts' },
            { name: 'detail', label: 'Reaction', type: 'text', required: true, placeholder: 'e.g. Rash, Anaphylaxis' },
        ],
    },
    FamilyHistory: {
        title: 'Family History',
        fields: [
            { name: 'name', label: 'Condition', type: 'text', required: true, placeholder: 'e.g. Heart Disease, Depression' },
            { name: 'detail', label: 'Relation', type: 'text', required: true, placeholder: 'e.g. Father, Mother, Sibling' },
        ],
    },
};

const MedicalHistoryModal = ({ isOpen, onClose, patientId, category, editItem, onSaved }) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Condition;
    const isEditing = !!editItem;

    const getInitialFormData = () => {
        const data = { type: category };
        config.fields.forEach(f => { data[f.name] = ''; });
        return data;
    };

    const [formData, setFormData] = useState(getInitialFormData());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditing && editItem) {
            setFormData({
                type: category,
                name: editItem.name || '',
                detail: editItem.detail || '',
                notes: editItem.notes || '',
            });
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
                await clinicalService.updateHistory(editItem.id, formData);
            } else {
                await clinicalService.addHistory(patientId, formData);
            }
            onSaved();
            onClose();
        } catch (err) {
            console.error('Error saving medical history:', err);
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

                <form onSubmit={handleSubmit} className="p-8">
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

export default MedicalHistoryModal;
