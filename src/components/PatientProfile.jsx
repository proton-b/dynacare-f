import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { patientService, clinicalService, noteService, recordingService } from '../services/api'
import EditPatientModal from './modals/EditPatientModal'
import SessionDetailsModal from './modals/SessionDetailsModal'

const API_URL = import.meta.env.VITE_BACKEND_URL

const getAudioUrl = (audioUrl) => {
    if (!audioUrl) return ''
    if (audioUrl.startsWith('http')) return audioUrl
    const baseUrl = API_URL.replace('/api', '')
    return `${baseUrl}${audioUrl}`
}

const PatientProfile = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [activeTab, setActiveTab] = useState('medical-history')
    const [patient, setPatient] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState(searchParams.get('filter') || 'all')

    // Clinical states
    const [medicalConditions, setMedicalConditions] = useState([])
    const [allergies, setAllergies] = useState([])
    const [familyHistory, setFamilyHistory] = useState([])
    const [medications, setMedications] = useState([])
    const [diagnoses, setDiagnoses] = useState([])
    const [treatmentPlans, setTreatmentPlans] = useState([])
    const [sessions, setSessions] = useState([])
    const [patientRecordings, setPatientRecordings] = useState([])
    const [isSessionDetailsOpen, setIsSessionDetailsOpen] = useState(false)
    const [selectedSession, setSelectedSession] = useState(null)
    const [expandedAudioId, setExpandedAudioId] = useState(null)

    const [patients, setPatients] = useState([])

    const fetchPatients = useCallback(async () => {
        try {
            setLoading(true)
            const response = await patientService.getAll();
            if (response.data && response.data.length > 0) {
                setPatients(response.data);
            }
        } catch (err) {
            console.error("Error fetching patients:", err);
            setError("Failed to load patients");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPatientAndData = useCallback(async (targetId) => {
        try {
            setLoading(true)
            const allPatients = patients.length > 0 ? patients : (await patientService.getAll()).data || [];
            if (allPatients.length > 0) {
                if (!patients.length) setPatients(allPatients);

                const p = allPatients.find(pt => pt.id.toString() === targetId.toString());

                if (p) {
                    setPatient(p);

                    // Fetch clinical data for this patient
                    const [histRes, medRes, diagRes, treatRes, notesRes, recRes] = await Promise.all([
                        clinicalService.getHistory(p.id),
                        clinicalService.getMedications(p.id),
                        clinicalService.getDiagnoses(p.id),
                        clinicalService.getTreatmentPlans(p.id),
                        noteService.getByPatientId(p.id),
                        recordingService.getByPatientId(p.id)
                    ]);

                    // Map history to specific buckets
                    const history = histRes.data;
                    setMedicalConditions(history.filter(h => h.type === 'Condition').map(h => ({
                        name: h.name,
                        year: h.detail,
                        description: h.notes || ''
                    })));
                    setAllergies(history.filter(h => h.type === 'Allergy').map(h => ({
                        name: h.name,
                        reaction: h.detail
                    })));
                    setFamilyHistory(history.filter(h => h.type === 'FamilyHistory').map(h => ({
                        relation: h.detail,
                        condition: h.name
                    })));

                    setMedications(medRes.data);
                    setDiagnoses(diagRes.data);
                    setTreatmentPlans(treatRes.data);

                    // Merge Notes and Recordings with Deduplication
                    const notes = notesRes.data.map(n => ({ ...n, type: 'note' }));

                    // Create a Set of roughly matching times/IDs to filter out duplicate recordings
                    // If a note exists for a patient within a 30-min window of a recording, assume they are the same event
                    const noteTimestamps = notes.map(n => new Date(n.created_at).getTime());

                    const allRecordings = recRes.data.map(r => ({
                        ...r,
                        type: 'recording',
                        status: 'Completed',
                        content: 'Audio Recording: ' + (r.duration ? `${Math.floor(r.duration / 60)}m ${r.duration % 60}s` : 'Unknown duration')
                    }));
                    setPatientRecordings(allRecordings);

                    const recordings = allRecordings.filter(r => {
                        const recTime = new Date(r.created_at).getTime();
                        // check if any note is within 30 minutes
                        const hasMatchingNote = noteTimestamps.some(t => Math.abs(t - recTime) < 30 * 60 * 1000);
                        return !hasMatchingNote;
                    });

                    // Sort combined list by date desc
                    const combinedSessions = [...notes, ...recordings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    setSessions(combinedSessions);
                }
            }
        } catch (err) {
            console.error("Error fetching patient/data:", err);
            setError("Failed to load patient profile data");
        } finally {
            setLoading(false);
        }
    }, [patients]);

    useEffect(() => {
        const patientId = searchParams.get('patientId');
        if (patientId) {
            fetchPatientAndData(patientId);
        } else {
            fetchPatients();
        }
    }, [searchParams]);

    const handleSelectPatient = (patientId) => {
        fetchPatientAndData(patientId);
    };

    const handleBackToList = () => {
        setPatient(null);
        searchParams.delete('patientId');
        setSearchParams(searchParams);
    };

    const handlePatientChange = (e) => {
        fetchPatientAndData(e.target.value);
    };

    const handleStatusFilterChange = (filter) => {
        setStatusFilter(filter);
        if (filter === 'all') {
            searchParams.delete('filter');
        } else {
            searchParams.set('filter', filter);
        }
        setSearchParams(searchParams);
    };

    const handleToggleStatus = async () => {
        if (!patient) return;
        const newStatus = patient.status === 'Active' ? 'Inactive' : 'Active';
        try {
            const response = await patientService.update(patient.id, { ...patient, status: newStatus });
            const updated = response.data;
            setPatient(updated);
            setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
        } catch (err) {
            console.error("Error updating patient status:", err);
        }
    };

    const handleViewSessionDetails = (session) => {
        setSelectedSession(session);
        setIsSessionDetailsOpen(true);
    };

    const tabIcons = {
        'medical-history': (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        'recordings': (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
        ),
        'medications': (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
        ),
        'diagnoses': (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        ),
        'treatment-plan': (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
    }

    const tabs = [
        { id: 'medical-history', label: 'Medical History' },
        { id: 'recordings', label: 'Recordings', count: patientRecordings.length },
        { id: 'medications', label: 'Medications' },
        { id: 'diagnoses', label: 'Diagnoses' },
        { id: 'treatment-plan', label: 'Treatment Plan' }
    ]

    if (loading) return (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-500 font-medium">Loading patient profile...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Error</h2>
                <p className="text-slate-500 mb-6">{error}</p>
                <button className="btn-primary" onClick={() => window.location.reload()}>Try Again</button>
            </div>
        </div>
    );

    // Patient list view — shown when no patient is selected
    const filteredPatients = statusFilter === 'all'
        ? patients
        : patients.filter(p => p.status?.toLowerCase() === statusFilter.toLowerCase());

    if (!patient) return (
        <div className="flex-1 overflow-y-auto bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-8 py-6">
                <h2 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-1">Clinical Profiles</h2>
                <h1 className="text-3xl font-bold text-slate-800 font-display">Select a Patient</h1>
                <p className="text-slate-500 mt-1">Choose a patient to view their profile and clinical records.</p>
                <div className="flex items-center space-x-2 mt-4">
                    {['all', 'active', 'inactive'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => handleStatusFilterChange(filter)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${statusFilter === filter
                                ? 'bg-primary-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                    ))}
                </div>
            </header>
            <div className="px-8 py-6">
                {filteredPatients.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">No Patients Found</h2>
                        <p className="text-slate-500">
                            {statusFilter !== 'all'
                                ? `No ${statusFilter} patients found.`
                                : 'No patient records are currently available.'}
                        </p>
                        {statusFilter !== 'all' && (
                            <button
                                onClick={() => handleStatusFilterChange('all')}
                                className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700"
                            >
                                Show all patients
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPatients.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleSelectPatient(p.id)}
                                className="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-xl hover:border-primary-200 hover:translate-y-[-2px] transition-all duration-300 text-left group"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0">
                                        {p.full_name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-primary-700 transition-colors truncate">{p.full_name}</h3>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {p.status}
                                            </span>
                                            <span className="text-xs text-slate-400">PT-ID-{p.id}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-sm text-slate-500">
                                    {p.gender && (
                                        <div className="flex items-center space-x-1.5">
                                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <span>{p.gender}</span>
                                        </div>
                                    )}
                                    {p.dob && (
                                        <div className="flex items-center space-x-1.5">
                                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>{new Date().getFullYear() - new Date(p.dob).getFullYear()} yrs</span>
                                        </div>
                                    )}
                                    {p.phone && (
                                        <div className="flex items-center space-x-1.5 col-span-2 truncate">
                                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <span className="truncate">{p.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50">
            {/* Header with Patient Info */}
            <header className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <button
                            onClick={handleBackToList}
                            className="flex items-center space-x-1.5 text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors mb-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>Back to Patients</span>
                        </button>
                        <h2 className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-1">Clinical Profile</h2>
                        <div className="flex items-center space-x-4">
                            <h1 className="text-3xl font-bold text-slate-800 font-display">Patient Records</h1>
                            <select
                                value={patient?.id || ''}
                                onChange={handlePatientChange}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20"
                            >
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.full_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        {/* Patient Photo */}
                        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                            {patient.full_name.split(' ').map(n => n[0]).join('')}
                        </div>

                        {/* Patient Details */}
                        <div>
                            <div className="flex items-center space-x-3">
                                <h1 className="text-3xl font-bold text-slate-800 font-display">{patient.full_name}</h1>
                                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${patient.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {patient.status}
                                </span>
                            </div>
                            <div className="flex items-center space-x-4 mt-2 text-slate-600">
                                <span className="flex items-center space-x-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                    </svg>
                                    <span className="text-sm">PT-ID-{patient.id}</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-sm">{new Date().getFullYear() - new Date(patient.dob).getFullYear()} yrs</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="text-sm">{patient.gender}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleToggleStatus}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-2 border-2 ${patient.status === 'Active'
                                ? 'bg-white border-red-400 text-red-600 hover:bg-red-50'
                                : 'bg-white border-green-500 text-green-600 hover:bg-green-50'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {patient.status === 'Active' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                )}
                            </svg>
                            <span>{patient.status === 'Active' ? 'Mark Inactive' : 'Mark Active'}</span>
                        </button>
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="px-4 py-2 bg-white border-2 border-primary-600 text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center space-x-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Edit Profile</span>
                        </button>
                        <button className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Schedule</span>
                        </button>
                        <button className="btn-primary flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Start Session</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content - Left Side (2/3) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Tabs */}
                        <div className="bg-white rounded-xl border border-slate-200">
                            <div className="border-b border-slate-200">
                                <div className="flex space-x-1 p-2">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === tab.id
                                                ? 'bg-primary-50 text-primary-700'
                                                : 'text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {tabIcons[tab.id]}
                                            <span>{tab.label}</span>
                                            {tab.count > 0 && (
                                                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-primary-100 text-primary-700 rounded-full">{tab.count}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="p-6">
                                {activeTab === 'medical-history' && (
                                    <div className="space-y-6">
                                        {/* Past Medical Conditions */}
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 mb-4">Past Medical Conditions</h3>
                                            <div className="space-y-4">
                                                {medicalConditions.map((condition, index) => (
                                                    <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <h4 className="font-semibold text-slate-800">{condition.name}</h4>
                                                            <span className="text-sm text-slate-500">{condition.year}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-600">{condition.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Allergies */}
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 mb-4">Allergies</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                {allergies.map((allergy, index) => (
                                                    <div key={index} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                        <div className="flex items-start space-x-2">
                                                            <svg className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                            </svg>
                                                            <div>
                                                                <h4 className="font-semibold text-slate-800">{allergy.name}</h4>
                                                                <p className="text-sm text-slate-600 mt-1">{allergy.reaction}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Family History */}
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 mb-4">Family History</h3>
                                            <div className="space-y-3">
                                                {familyHistory.map((item, index) => (
                                                    <div key={index} className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        </svg>
                                                        <div>
                                                            <span className="font-semibold text-slate-800">{item.relation}:</span>
                                                            <span className="text-slate-600 ml-2">{item.condition}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Session History */}
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-bold text-slate-800">Session History</h3>
                                                <span className="text-sm text-primary-600 font-medium">{sessions.length} sessions</span>
                                            </div>
                                            <div className="space-y-3">
                                                {sessions.length === 0 ? (
                                                    <div className="py-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                        No previous sessions recorded.
                                                    </div>
                                                ) : sessions.map((session, index) => (
                                                    <div key={index} className="p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${session.type === 'recording' ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                    {session.type === 'recording' ? (
                                                                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-semibold text-slate-800">
                                                                        {session.type === 'recording' ? 'Session Recording' :
                                                                            (session.content.length > 40 ? session.content.substring(0, 40) + '...' : 'Clinical Note')}
                                                                    </h4>
                                                                    <div className="flex items-center space-x-3 mt-1 text-sm text-slate-500">
                                                                        <span className="font-medium text-primary-600">{session.status}</span>
                                                                        <span>•</span>
                                                                        <span>{session.patient_name}</span>
                                                                        {session.type === 'recording' && session.duration && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span>{Math.floor(session.duration / 60)}m {session.duration % 60}s</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center space-x-3">
                                                                {/* Audio Play Button for recordings */}
                                                                {session.type === 'recording' && session.audio_url && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setExpandedAudioId(expandedAudioId === session.id ? null : session.id)
                                                                        }}
                                                                        className={`p-2.5 rounded-xl transition-all flex items-center space-x-1.5 text-xs font-bold ${expandedAudioId === session.id
                                                                            ? 'bg-primary-100 text-primary-700'
                                                                            : 'bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-600'
                                                                            }`}
                                                                        title="Play audio"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            {expandedAudioId === session.id ? (
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                            ) : (
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                            )}
                                                                        </svg>
                                                                        <span>{expandedAudioId === session.id ? 'Hide' : 'Play'}</span>
                                                                    </button>
                                                                )}
                                                                <div className="text-right">
                                                                    <div className="text-sm text-slate-600">
                                                                        {new Date(session.created_at).toLocaleDateString('en-IN', {
                                                                            day: 'numeric',
                                                                            month: 'short',
                                                                            year: 'numeric',
                                                                            timeZone: 'Asia/Kolkata'
                                                                        })}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleViewSessionDetails(session)}
                                                                        className="text-xs text-primary-600 font-bold hover:text-primary-700 mt-1 flex items-center justify-end space-x-1"
                                                                    >
                                                                        <span>View Details</span>
                                                                        <span>→</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Expanded Audio Player */}
                                                        {session.type === 'recording' && session.audio_url && expandedAudioId === session.id && (
                                                            <div className="mt-4 pt-4 border-t border-slate-100">
                                                                <audio
                                                                    controls
                                                                    className="w-full h-10"
                                                                    src={getAudioUrl(session.audio_url)}
                                                                    preload="metadata"
                                                                >
                                                                    Your browser does not support the audio element.
                                                                </audio>
                                                                {session.transcript && (
                                                                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 max-h-32 overflow-y-auto">
                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transcript</p>
                                                                        <p className="text-sm text-slate-600 leading-relaxed">{session.transcript}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'recordings' && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">Session Recordings</h3>
                                                <p className="text-sm text-slate-500 mt-1">All audio recordings for this patient</p>
                                            </div>
                                            <span className="text-sm font-bold text-primary-600">{patientRecordings.length} recording{patientRecordings.length !== 1 ? 's' : ''}</span>
                                        </div>

                                        {patientRecordings.length === 0 ? (
                                            <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                    </svg>
                                                </div>
                                                <p className="text-slate-500 font-medium">No recordings yet</p>
                                                <p className="text-sm text-slate-400 mt-1">Upload or record a session to see it here</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {patientRecordings.map((rec) => (
                                                    <div key={rec.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                                        <div className="p-5">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                                                                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                                        </svg>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-bold text-slate-800">
                                                                            Session Recording
                                                                        </h4>
                                                                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-slate-500">
                                                                            <span>
                                                                                {new Date(rec.created_at).toLocaleDateString('en-IN', {
                                                                                    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
                                                                                })}
                                                                                {' '}
                                                                                {new Date(rec.created_at).toLocaleTimeString('en-IN', {
                                                                                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
                                                                                })}
                                                                            </span>
                                                                            {rec.duration && (
                                                                                <>
                                                                                    <span>•</span>
                                                                                    <span>{Math.floor(rec.duration / 60)}m {rec.duration % 60}s</span>
                                                                                </>
                                                                            )}
                                                                            {rec.file_size && (
                                                                                <>
                                                                                    <span>•</span>
                                                                                    <span>
                                                                                        {rec.file_size < 1024 * 1024
                                                                                            ? (rec.file_size / 1024).toFixed(1) + ' KB'
                                                                                            : (rec.file_size / (1024 * 1024)).toFixed(1) + ' MB'
                                                                                        }
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                            {rec.format && (
                                                                                <>
                                                                                    <span>•</span>
                                                                                    <span className="uppercase text-xs font-semibold bg-slate-100 px-1.5 py-0.5 rounded">{rec.format}</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    <button
                                                                        onClick={() => setExpandedAudioId(expandedAudioId === rec.id ? null : rec.id)}
                                                                        className={`p-2.5 rounded-xl transition-all flex items-center space-x-1.5 text-xs font-bold ${expandedAudioId === rec.id
                                                                            ? 'bg-primary-600 text-white'
                                                                            : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                                                                            }`}
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            {expandedAudioId === rec.id ? (
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                            ) : (
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                            )}
                                                                        </svg>
                                                                        <span>{expandedAudioId === rec.id ? 'Hide' : 'Play'}</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleViewSessionDetails(rec)}
                                                                        className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all text-xs font-bold flex items-center space-x-1.5"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                        <span>Details</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Expanded Audio Player + Transcript */}
                                                            {expandedAudioId === rec.id && (
                                                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                                                                    {rec.audio_url ? (
                                                                        <audio
                                                                            controls
                                                                            autoPlay
                                                                            className="w-full"
                                                                            src={getAudioUrl(rec.audio_url)}
                                                                            preload="metadata"
                                                                        >
                                                                            Your browser does not support the audio element.
                                                                        </audio>
                                                                    ) : (
                                                                        <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-700">
                                                                            Audio file not available for this recording.
                                                                        </div>
                                                                    )}
                                                                    {rec.transcript && (
                                                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Transcript</p>
                                                                            <p className="text-sm text-slate-600 leading-relaxed max-h-40 overflow-y-auto">{rec.transcript}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'medications' && (
                                    <div className="space-y-4">
                                        {medications.length === 0 ? (
                                            <div className="text-center py-12 text-slate-500">
                                                No active medications for {patient.full_name}.
                                            </div>
                                        ) : medications.map(med => (
                                            <div key={med.id} className="p-4 bg-white border border-slate-200 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-bold text-slate-800">{med.name}</h4>
                                                    <span className={`px - 2 py - 0.5 rounded text - xs font - bold ${med.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'} `}>
                                                        {med.status}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
                                                    <div><span className="font-medium text-slate-700">Dosage:</span> {med.dosage}</div>
                                                    <div><span className="font-medium text-slate-700">Frequency:</span> {med.frequency}</div>
                                                    <div><span className="font-medium text-slate-700">Prescribed By:</span> {med.prescribed_by}</div>
                                                    <div><span className="font-medium text-slate-700">Start Date:</span> {med.start_date ? new Date(med.start_date).toLocaleDateString() : 'N/A'}</div>
                                                </div>
                                                {med.notes && <p className="mt-3 text-sm text-slate-600 italic border-t border-slate-100 pt-2">{med.notes}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'diagnoses' && (
                                    <div className="space-y-4">
                                        {diagnoses.length === 0 ? (
                                            <div className="text-center py-12 text-slate-500">
                                                No clinical diagnoses recorded yet.
                                            </div>
                                        ) : diagnoses.map(diag => (
                                            <div key={diag.id} className="p-4 bg-white border border-slate-200 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{diag.disorder_name}</h4>
                                                        <span className="text-xs text-slate-500 font-mono">{diag.dsm_code}</span>
                                                    </div>
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                                                        {diag.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
                                                    <span>Diagnosed by {diag.doctor_name}</span>
                                                    <span>{diag.diagnosed_date ? new Date(diag.diagnosed_date).toLocaleDateString() : 'N/A'}</span>
                                                </div>
                                                {diag.notes && <p className="mt-3 text-sm text-slate-600 border-t border-slate-100 pt-2">{diag.notes}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'treatment-plan' && (
                                    <div className="space-y-6">
                                        {treatmentPlans.length === 0 ? (
                                            <div className="text-center py-12 text-slate-500">
                                                No active treatment plan documented.
                                            </div>
                                        ) : treatmentPlans.map(plan => (
                                            <div key={plan.id} className="space-y-4">
                                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                                    <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider">Primary Goal</h4>
                                                    <p className="text-slate-700 font-medium">{plan.goal}</p>
                                                </div>
                                                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                                                    <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider">Interventions</h4>
                                                    <p className="text-slate-600 line-height-relaxed">{plan.intervention}</p>
                                                </div>
                                                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                                                    <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider">Progress Notes</h4>
                                                    <p className="text-slate-600 line-height-relaxed">{plan.progress_notes || "No progress notes recorded yet."}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Treatment Progress Chart */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center space-x-2">
                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                <span>Treatment Progress</span>
                            </h3>

                            {/* Chart Placeholder */}
                            <div className="h-64 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center mb-6">
                                <p className="text-slate-400">Chart visualization linked to patient telemetry</p>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-6">
                                <div className="text-center">
                                    <div className="flex items-center justify-center space-x-2 mb-2">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                        <span className="text-sm text-slate-600">Symptom Severity</span>
                                    </div>
                                    <div className="text-3xl font-bold text-slate-800">--</div>
                                    <div className="text-sm text-slate-400">No data available</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center space-x-2 mb-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <span className="text-sm text-slate-600">Daily Functionality</span>
                                    </div>
                                    <div className="text-3xl font-bold text-slate-800">--</div>
                                    <div className="text-sm text-slate-400">No data available</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center space-x-2 mb-2">
                                        <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                                        <span className="text-sm text-slate-600">Medication Adherence</span>
                                    </div>
                                    <div className="text-3xl font-bold text-slate-800">--</div>
                                    <div className="text-sm text-slate-400">No data available</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar - Right Side (1/3) */}
                    <div className="space-y-6">
                        {/* Contact Information */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Contact Information</h3>
                                <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span>Edit</span>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                                    <div className="flex items-center space-x-2 text-sm text-slate-700">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-primary-600">{patient.email || "No email recorded"}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                                    <div className="flex items-center space-x-2 text-sm text-slate-700">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        <span>{patient.phone || "No phone recorded"}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Address</label>
                                    <div className="flex items-start space-x-2 text-sm text-slate-700">
                                        <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>{patient.address || "No address recorded"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Insurance Information */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Insurance Information</h3>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">Provider</label>
                                        <p className="text-sm font-semibold text-slate-700">{patient.insurance_provider || "N/A"}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">Policy ID</label>
                                        <p className="text-sm font-semibold text-slate-700">{patient.insurance_id || "N/A"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <EditPatientModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                patient={patient}
                onPatientUpdated={(updated) => {
                    setPatient(updated);
                    // Also refresh other data if needed
                }}
            />
            <SessionDetailsModal
                isOpen={isSessionDetailsOpen}
                onClose={() => setIsSessionDetailsOpen(false)}
                session={selectedSession}
            />
        </div>
    )
}

export default PatientProfile

