import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { patientService, clinicalService, noteService, recordingService } from '../services/api'
import EditPatientModal from './modals/EditPatientModal'
import ScheduleAppointmentModal from './modals/ScheduleAppointmentModal'
import SessionDetailsModal from './modals/SessionDetailsModal'
import MedicalHistoryModal from './modals/MedicalHistoryModal'
import ClinicalItemModal from './modals/ClinicalItemModal'
import { exportClinicalSummaryToPDF } from '../utils/pdfExport'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const API_URL = import.meta.env.VITE_BACKEND_URL

const getAudioUrl = (audioUrl, recordingId) => {
    if (!audioUrl) return ''
    if (recordingId) {
        const token = localStorage.getItem('token')
        return `${API_URL}/recordings/${recordingId}/stream?token=${token}`
    }
    if (audioUrl.startsWith('http')) return audioUrl
    const baseUrl = API_URL.replace('/api', '')
    return `${baseUrl}${audioUrl}`
}

const handleDownloadAudio = (recordingId, format) => {
    const token = localStorage.getItem('token')
    const url = `${API_URL}/recordings/${recordingId}/stream?download=true&token=${token}`
    const a = document.createElement('a')
    a.href = url
    a.download = `recording_${recordingId}.${format || 'mp3'}`
    a.click()
}

const PatientProfile = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [activeTab, setActiveTab] = useState('medical-history')
    const [patient, setPatient] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
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
    const [sessionPage, setSessionPage] = useState(1)
    const sessionsPerPage = 5

    // Medical history modal state
    const [isMedHistoryModalOpen, setIsMedHistoryModalOpen] = useState(false)
    const [medHistoryCategory, setMedHistoryCategory] = useState('Condition')
    const [medHistoryEditItem, setMedHistoryEditItem] = useState(null)

    // Clinical item modal state (medications, diagnoses, treatment plans)
    const [isClinicalModalOpen, setIsClinicalModalOpen] = useState(false)
    const [clinicalModalCategory, setClinicalModalCategory] = useState('medication')
    const [clinicalModalEditItem, setClinicalModalEditItem] = useState(null)

    // Recordings tab state
    const [expandedReportId, setExpandedReportId] = useState(null)
    const [expandedTranscriptId, setExpandedTranscriptId] = useState(null)
    const [openExportMenuId, setOpenExportMenuId] = useState(null)
    const [recordingsSubTab, setRecordingsSubTab] = useState('all')

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

                    // Map history to specific buckets (preserve id, detail, notes for edit/delete)
                    const history = histRes.data;
                    setMedicalConditions(history.filter(h => h.type === 'Condition').map(h => ({
                        id: h.id,
                        name: h.name,
                        year: h.detail,
                        detail: h.detail,
                        notes: h.notes || '',
                        description: h.notes || ''
                    })));
                    setAllergies(history.filter(h => h.type === 'Allergy').map(h => ({
                        id: h.id,
                        name: h.name,
                        detail: h.detail,
                        notes: h.notes || '',
                        reaction: h.detail
                    })));
                    setFamilyHistory(history.filter(h => h.type === 'FamilyHistory').map(h => ({
                        id: h.id,
                        name: h.name,
                        detail: h.detail,
                        notes: h.notes || '',
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

    const handleOpenMedHistoryModal = (category, item = null) => {
        setMedHistoryCategory(category)
        setMedHistoryEditItem(item)
        setIsMedHistoryModalOpen(true)
    }

    const handleDeleteMedHistory = async (itemId) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return
        try {
            await clinicalService.deleteHistory(itemId)
            // Refresh the data
            if (patient) fetchPatientAndData(patient.id)
        } catch (err) {
            console.error('Error deleting medical history item:', err)
        }
    }

    const handleMedHistorySaved = () => {
        if (patient) fetchPatientAndData(patient.id)
    }

    const handleOpenClinicalModal = (category, item = null) => {
        setClinicalModalCategory(category)
        setClinicalModalEditItem(item)
        setIsClinicalModalOpen(true)
    }

    const handleDeleteClinicalItem = async (category, itemId) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return
        try {
            if (category === 'medication') await clinicalService.deleteMedication(itemId)
            else if (category === 'diagnosis') await clinicalService.deleteDiagnosis(itemId)
            else if (category === 'treatmentPlan') await clinicalService.deleteTreatmentPlan(itemId)
            if (patient) fetchPatientAndData(patient.id)
        } catch (err) {
            console.error('Error deleting item:', err)
        }
    }

    const handleClinicalItemSaved = () => {
        if (patient) fetchPatientAndData(patient.id)
    }

    const parseRecordingSummary = (rec) => {
        if (!rec.summary) return null
        try {
            return typeof rec.summary === 'string' ? JSON.parse(rec.summary) : rec.summary
        } catch { return null }
    }

    const handleExportPdf = (rec) => {
        const summary = parseRecordingSummary(rec)
        if (!summary) return alert('No report available for this recording.')
        const summaryForPdf = {
            overview: summary.overview || {},
            symptoms: summary.symptoms || { reported: [], severity: 'N/A' },
            riskAssessment: summary.riskAssessment || { level: 'Low', concerns: [] },
            clinicalImpression: summary.clinicalImpression || { possibleDiagnoses: [] },
            treatmentPlan: summary.treatmentPlan || { recommendations: [], followUp: 'N/A' },
            nextSteps: summary.nextSteps || []
        }
        // Check for harrison summary (stored alongside dsm5 in some cases)
        let harrisonData = null
        if (rec.harrison_summary) {
            try { harrisonData = typeof rec.harrison_summary === 'string' ? JSON.parse(rec.harrison_summary) : rec.harrison_summary } catch {}
        }
        exportClinicalSummaryToPDF(summaryForPdf, patient?.full_name || 'Patient', harrisonData)
        setOpenExportMenuId(null)
    }

    const handleExportTranscript = (rec) => {
        if (!rec.transcript) return alert('No transcript available.')
        const text = `DynaCare - Session Transcript\nPatient: ${patient?.full_name || 'Unknown'}\nDate: ${new Date(rec.created_at).toLocaleDateString()}\nDuration: ${rec.duration ? Math.floor(rec.duration / 60) + 'm ' + (rec.duration % 60) + 's' : 'N/A'}\n${'='.repeat(50)}\n\n${rec.transcript}`
        const blob = new Blob([text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Transcript_${patient?.full_name?.replace(/\s+/g, '_') || 'Patient'}_${new Date(rec.created_at).toISOString().split('T')[0]}.txt`
        a.click()
        URL.revokeObjectURL(url)
        setOpenExportMenuId(null)
    }

    const handleDownloadAudioRec = (rec) => {
        if (!rec.audio_url) return alert('No audio file available.')
        handleDownloadAudio(rec.id, rec.format)
        setOpenExportMenuId(null)
    }

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
        { id: 'recordings', label: 'Reports & Recordings', count: patientRecordings.length },
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
                        <button
                            onClick={() => setIsScheduleModalOpen(true)}
                            className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center space-x-2"
                        >
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
                                                ) : sessions.slice((sessionPage - 1) * sessionsPerPage, sessionPage * sessionsPerPage).map((session, index) => (
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
                                                                    src={getAudioUrl(session.audio_url, session.recording_id || session.id)}
                                                                    preload="metadata"
                                                                >
                                                                    Your browser does not support the audio element.
                                                                </audio>
                                                                <button
                                                                    onClick={() => handleDownloadAudio(session.recording_id || session.id, session.format)}
                                                                    className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                    <span>Download Audio</span>
                                                                </button>
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
                                            {/* Pagination */}
                                            {sessions.length > sessionsPerPage && (
                                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                                                    <p className="text-sm text-slate-500">
                                                        Showing {(sessionPage - 1) * sessionsPerPage + 1}-{Math.min(sessionPage * sessionsPerPage, sessions.length)} of {sessions.length}
                                                    </p>
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => setSessionPage(p => Math.max(1, p - 1))}
                                                            disabled={sessionPage === 1}
                                                            className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            Previous
                                                        </button>
                                                        {Array.from({ length: Math.ceil(sessions.length / sessionsPerPage) }, (_, i) => i + 1).map(page => (
                                                            <button
                                                                key={page}
                                                                onClick={() => setSessionPage(page)}
                                                                className={`w-8 h-8 text-sm font-bold rounded-lg transition-colors ${sessionPage === page ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                                            >
                                                                {page}
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => setSessionPage(p => Math.min(Math.ceil(sessions.length / sessionsPerPage), p + 1))}
                                                            disabled={sessionPage >= Math.ceil(sessions.length / sessionsPerPage)}
                                                            className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'recordings' && (
                                    <div className="space-y-6">
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">Reports & Recordings</h3>
                                                <p className="text-sm text-slate-500 mt-1">Session recordings, transcripts, and clinical reports</p>
                                            </div>
                                            <span className="text-sm font-bold text-primary-600">{patientRecordings.length} recording{patientRecordings.length !== 1 ? 's' : ''}</span>
                                        </div>

                                        {/* Sub-tabs */}
                                        <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
                                            {[
                                                { id: 'all', label: 'All', count: patientRecordings.length },
                                                { id: 'reports', label: 'With Reports', count: patientRecordings.filter(r => r.summary).length },
                                                { id: 'transcripts', label: 'With Transcripts', count: patientRecordings.filter(r => r.transcript).length },
                                            ].map(sub => (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => setRecordingsSubTab(sub.id)}
                                                    className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${recordingsSubTab === sub.id
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    {sub.label} ({sub.count})
                                                </button>
                                            ))}
                                        </div>

                                        {(() => {
                                            const filtered = recordingsSubTab === 'reports'
                                                ? patientRecordings.filter(r => r.summary)
                                                : recordingsSubTab === 'transcripts'
                                                    ? patientRecordings.filter(r => r.transcript)
                                                    : patientRecordings;

                                            if (filtered.length === 0) return (
                                                <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-slate-500 font-medium">
                                                        {recordingsSubTab === 'reports' ? 'No recordings with reports yet' :
                                                         recordingsSubTab === 'transcripts' ? 'No recordings with transcripts yet' :
                                                         'No recordings yet'}
                                                    </p>
                                                    <p className="text-sm text-slate-400 mt-1">Upload or record a session to see it here</p>
                                                </div>
                                            );

                                            return (
                                                <div className="space-y-4">
                                                    {filtered.map((rec) => {
                                                        const report = parseRecordingSummary(rec);
                                                        const hasReport = !!report;
                                                        const hasTranscript = !!rec.transcript;

                                                        return (
                                                            <div key={rec.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                                                <div className="p-5">
                                                                    {/* Top row: info + actions */}
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center space-x-4">
                                                                            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                                                                                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                                                </svg>
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="font-bold text-slate-800">Session Recording</h4>
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
                                                                                {/* Status badges */}
                                                                                <div className="flex items-center gap-2 mt-2">
                                                                                    {hasReport && (
                                                                                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200">
                                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                                            <span>Report Available</span>
                                                                                        </span>
                                                                                    )}
                                                                                    {hasTranscript && (
                                                                                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">
                                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                                            <span>Transcript</span>
                                                                                        </span>
                                                                                    )}
                                                                                    {rec.audio_url && (
                                                                                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200">
                                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                                                                            <span>Audio</span>
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Action buttons */}
                                                                        <div className="flex items-center space-x-2">
                                                                            {/* Play audio */}
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

                                                                            {/* View details */}
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

                                                                            {/* Export dropdown */}
                                                                            <div className="relative">
                                                                                <button
                                                                                    onClick={() => setOpenExportMenuId(openExportMenuId === rec.id ? null : rec.id)}
                                                                                    className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all text-xs font-bold flex items-center space-x-1.5"
                                                                                >
                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                    </svg>
                                                                                    <span>Export</span>
                                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                                    </svg>
                                                                                </button>
                                                                                {openExportMenuId === rec.id && (
                                                                                    <>
                                                                                        <div className="fixed inset-0 z-10" onClick={() => setOpenExportMenuId(null)} />
                                                                                        <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-2">
                                                                                            <button
                                                                                                onClick={() => handleExportPdf(rec)}
                                                                                                disabled={!hasReport}
                                                                                                className="w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                                            >
                                                                                                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                                                                </svg>
                                                                                                <div>
                                                                                                    <p className="font-semibold text-slate-800">Export Report as PDF</p>
                                                                                                    <p className="text-xs text-slate-400">Clinical summary report</p>
                                                                                                </div>
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleExportTranscript(rec)}
                                                                                                disabled={!hasTranscript}
                                                                                                className="w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                                            >
                                                                                                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                                </svg>
                                                                                                <div>
                                                                                                    <p className="font-semibold text-slate-800">Download Transcript</p>
                                                                                                    <p className="text-xs text-slate-400">Plain text (.txt)</p>
                                                                                                </div>
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleDownloadAudioRec(rec)}
                                                                                                disabled={!rec.audio_url}
                                                                                                className="w-full px-4 py-2.5 text-left text-sm flex items-center space-x-3 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                                            >
                                                                                                <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                                                                </svg>
                                                                                                <div>
                                                                                                    <p className="font-semibold text-slate-800">Download Audio</p>
                                                                                                    <p className="text-xs text-slate-400">{rec.format?.toUpperCase() || 'MP3'} file</p>
                                                                                                </div>
                                                                                            </button>
                                                                                        </div>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded Audio Player */}
                                                                    {expandedAudioId === rec.id && (
                                                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                                                            {rec.audio_url ? (
                                                                                <div>
                                                                                    <audio
                                                                                        controls
                                                                                        autoPlay
                                                                                        className="w-full"
                                                                                        src={getAudioUrl(rec.audio_url, rec.id)}
                                                                                        preload="metadata"
                                                                                    >
                                                                                        Your browser does not support the audio element.
                                                                                    </audio>
                                                                                    <button
                                                                                        onClick={() => handleDownloadAudio(rec.id, rec.format)}
                                                                                        className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                                                                                    >
                                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                                        <span>Download Audio</span>
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-700">
                                                                                    Audio file not available for this recording.
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Expandable Transcript Section */}
                                                                    {hasTranscript && (
                                                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                                                            <button
                                                                                onClick={() => setExpandedTranscriptId(expandedTranscriptId === rec.id ? null : rec.id)}
                                                                                className="flex items-center justify-between w-full text-left"
                                                                            >
                                                                                <div className="flex items-center space-x-2">
                                                                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                    </svg>
                                                                                    <span className="text-sm font-bold text-slate-700">Transcript</span>
                                                                                </div>
                                                                                <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedTranscriptId === rec.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                                </svg>
                                                                            </button>
                                                                            {expandedTranscriptId === rec.id && (
                                                                                <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-100 max-h-60 overflow-y-auto">
                                                                                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{rec.transcript}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Expandable Report Section */}
                                                                    {hasReport && (
                                                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                                                            <button
                                                                                onClick={() => setExpandedReportId(expandedReportId === rec.id ? null : rec.id)}
                                                                                className="flex items-center justify-between w-full text-left"
                                                                            >
                                                                                <div className="flex items-center space-x-2">
                                                                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                    </svg>
                                                                                    <span className="text-sm font-bold text-slate-700">Clinical Report</span>
                                                                                </div>
                                                                                <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedReportId === rec.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                                </svg>
                                                                            </button>
                                                                            {expandedReportId === rec.id && (
                                                                                <div className="mt-3 space-y-4">
                                                                                    {/* Overview */}
                                                                                    {report.overview && (
                                                                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                                                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Session Overview</h5>
                                                                                            <div className="grid grid-cols-2 gap-3">
                                                                                                {report.overview.mood && (
                                                                                                    <div className="flex justify-between">
                                                                                                        <span className="text-sm text-slate-500">Mood</span>
                                                                                                        <span className="text-sm font-semibold text-slate-800">{report.overview.mood}</span>
                                                                                                    </div>
                                                                                                )}
                                                                                                {report.overview.moodScore && (
                                                                                                    <div className="flex justify-between">
                                                                                                        <span className="text-sm text-slate-500">Score</span>
                                                                                                        <span className="text-sm font-semibold text-slate-800">{report.overview.moodScore}/10</span>
                                                                                                    </div>
                                                                                                )}
                                                                                                {report.overview.affect && (
                                                                                                    <div className="flex justify-between">
                                                                                                        <span className="text-sm text-slate-500">Affect</span>
                                                                                                        <span className="text-sm font-semibold text-slate-800">{report.overview.affect}</span>
                                                                                                    </div>
                                                                                                )}
                                                                                                {report.overview.engagement && (
                                                                                                    <div className="flex justify-between">
                                                                                                        <span className="text-sm text-slate-500">Engagement</span>
                                                                                                        <span className="text-sm font-semibold text-slate-800">{report.overview.engagement}</span>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Symptoms */}
                                                                                    {report.symptoms?.reported?.length > 0 && (
                                                                                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                                                                                            <h5 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">Reported Symptoms</h5>
                                                                                            <div className="flex flex-wrap gap-2">
                                                                                                {report.symptoms.reported.map((s, i) => (
                                                                                                    <span key={i} className="px-2.5 py-1 bg-white text-orange-700 text-xs font-semibold rounded-lg border border-orange-200">{s}</span>
                                                                                                ))}
                                                                                            </div>
                                                                                            {report.symptoms.severity && (
                                                                                                <p className="text-xs text-orange-600 mt-2">Severity: <span className="font-bold">{report.symptoms.severity}</span></p>
                                                                                            )}
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Risk Assessment */}
                                                                                    {report.riskAssessment && (
                                                                                        <div className={`p-4 rounded-lg border ${
                                                                                            report.riskAssessment.level === 'High' ? 'bg-red-50 border-red-200' :
                                                                                            report.riskAssessment.level === 'Moderate' ? 'bg-yellow-50 border-yellow-200' :
                                                                                            'bg-green-50 border-green-200'
                                                                                        }`}>
                                                                                            <h5 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: report.riskAssessment.level === 'High' ? '#dc2626' : report.riskAssessment.level === 'Moderate' ? '#ca8a04' : '#16a34a' }}>
                                                                                                Risk Assessment
                                                                                            </h5>
                                                                                            <p className="text-sm font-bold text-slate-800">Level: {report.riskAssessment.level}</p>
                                                                                            {report.riskAssessment.concerns?.length > 0 && (
                                                                                                <ul className="mt-2 space-y-1">
                                                                                                    {report.riskAssessment.concerns.map((c, i) => (
                                                                                                        <li key={i} className="text-xs text-slate-600 flex items-start space-x-1.5">
                                                                                                            <span className="mt-1 text-[8px]">&#9679;</span>
                                                                                                            <span>{c}</span>
                                                                                                        </li>
                                                                                                    ))}
                                                                                                </ul>
                                                                                            )}
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Clinical Impression - DSM-5 */}
                                                                                    {report.clinicalImpression?.possibleDiagnoses?.length > 0 && (
                                                                                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                                                                            <h5 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">DSM-5 Indications</h5>
                                                                                            <div className="space-y-2">
                                                                                                {report.clinicalImpression.possibleDiagnoses.map((d, i) => (
                                                                                                    <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-purple-100">
                                                                                                        <div>
                                                                                                            <span className="text-xs font-mono text-purple-500 mr-2">{d.code}</span>
                                                                                                            <span className="text-sm font-semibold text-slate-800">{d.name}</span>
                                                                                                        </div>
                                                                                                        {d.confidence && (
                                                                                                            <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{d.confidence}</span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Key Themes */}
                                                                                    {report.clinicalInsights?.themes?.length > 0 && (
                                                                                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                                                                            <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Key Themes</h5>
                                                                                            <div className="flex flex-wrap gap-2">
                                                                                                {report.clinicalInsights.themes.map((t, i) => (
                                                                                                    <span key={i} className="px-2.5 py-1 bg-white text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200">{t}</span>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Treatment Recommendations */}
                                                                                    {report.treatmentPlan?.recommendations?.length > 0 && (
                                                                                        <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                                                                                            <h5 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-3">Treatment Recommendations</h5>
                                                                                            <ul className="space-y-2">
                                                                                                {report.treatmentPlan.recommendations.map((r, i) => (
                                                                                                    <li key={i} className="flex items-start space-x-2 text-sm text-slate-700">
                                                                                                        <span className="w-5 h-5 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                                                                                                        <span>{r}</span>
                                                                                                    </li>
                                                                                                ))}
                                                                                            </ul>
                                                                                            {report.treatmentPlan.followUp && (
                                                                                                <p className="mt-3 pt-3 border-t border-teal-200 text-xs text-teal-700">
                                                                                                    <span className="font-bold">Follow-up:</span> {report.treatmentPlan.followUp}
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {activeTab === 'medications' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-lg font-bold text-slate-800">Medications</h3>
                                            <button
                                                onClick={() => handleOpenClinicalModal('medication')}
                                                className="flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                </svg>
                                                <span>Add</span>
                                            </button>
                                        </div>
                                        {medications.length === 0 ? (
                                            <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                No medications recorded for {patient.full_name}.
                                            </div>
                                        ) : medications.map(med => (
                                            <div key={med.id} className="p-4 bg-white border border-slate-200 rounded-lg group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-bold text-slate-800">{med.name}</h4>
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${med.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {med.status}
                                                        </span>
                                                        <button
                                                            onClick={() => handleOpenClinicalModal('medication', med)}
                                                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Edit"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClinicalItem('medication', med.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Delete"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
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
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-lg font-bold text-slate-800">Diagnoses</h3>
                                            <button
                                                onClick={() => handleOpenClinicalModal('diagnosis')}
                                                className="flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                </svg>
                                                <span>Add</span>
                                            </button>
                                        </div>
                                        {diagnoses.length === 0 ? (
                                            <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                No clinical diagnoses recorded yet.
                                            </div>
                                        ) : diagnoses.map(diag => (
                                            <div key={diag.id} className="p-4 bg-white border border-slate-200 rounded-lg group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{diag.disorder_name}</h4>
                                                        <span className="text-xs text-slate-500 font-mono">{diag.dsm_code}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                                                            {diag.status}
                                                        </span>
                                                        <button
                                                            onClick={() => handleOpenClinicalModal('diagnosis', diag)}
                                                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Edit"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClinicalItem('diagnosis', diag.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Delete"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
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
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-lg font-bold text-slate-800">Treatment Plans</h3>
                                            <button
                                                onClick={() => handleOpenClinicalModal('treatmentPlan')}
                                                className="flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                </svg>
                                                <span>Add</span>
                                            </button>
                                        </div>
                                        {treatmentPlans.length === 0 ? (
                                            <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                No active treatment plan documented.
                                            </div>
                                        ) : treatmentPlans.map(plan => (
                                            <div key={plan.id} className="space-y-4 p-4 bg-white border border-slate-200 rounded-xl group">
                                                <div className="flex items-center justify-between">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${plan.status === 'Active' ? 'bg-green-100 text-green-700' : plan.status === 'Completed' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {plan.status}
                                                    </span>
                                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleOpenClinicalModal('treatmentPlan', plan)}
                                                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClinicalItem('treatmentPlan', plan.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                                    <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider">Primary Goal</h4>
                                                    <p className="text-slate-700 font-medium">{plan.goal}</p>
                                                </div>
                                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                                    <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider">Interventions</h4>
                                                    <p className="text-slate-600 leading-relaxed">{plan.intervention}</p>
                                                </div>
                                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                                    <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider">Progress Notes</h4>
                                                    <p className="text-slate-600 leading-relaxed">{plan.progress_notes || "No progress notes recorded yet."}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {(() => {
                            // Parse computed scores from all recordings, sorted oldest first
                            const recsWithScores = patientRecordings
                                .map(rec => {
                                    if (!rec.summary) return null
                                    try {
                                        const s = typeof rec.summary === 'string' ? JSON.parse(rec.summary) : rec.summary
                                        const dsm5 = s.computedScores ? s : s.dsm5
                                        if (!dsm5?.computedScores) return null
                                        return { date: new Date(rec.created_at), scores: dsm5.computedScores }
                                    } catch { return null }
                                })
                                .filter(Boolean)
                                .sort((a, b) => a.date - b.date)

                            const allScores = recsWithScores.map(r => r.scores)

                            const avgSeverity = allScores.length > 0
                                ? Math.round(allScores.reduce((sum, s) => sum + s.symptomSeverity, 0) / allScores.length * 10) / 10
                                : null
                            const avgEmotional = allScores.length > 0
                                ? Math.round(allScores.reduce((sum, s) => sum + s.emotionalAdherenceScore, 0) / allScores.length * 10) / 10
                                : null

                            // Build chart data: one point per report
                            const chartData = recsWithScores.map((r, i) => ({
                                report: i + 1,
                                'Mood Score': r.scores.moodScore,
                                'Symptom Score': r.scores.symptomScore,
                                'Symptom Severity': r.scores.symptomSeverity,
                                'Emotional Adherence': r.scores.emotionalAdherenceScore,
                            }))

                            return (
                                <div className="bg-white rounded-xl border border-slate-200 p-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        <span>Treatment Progress</span>
                                    </h3>

                                    {/* Line Chart */}
                                    {chartData.length > 0 ? (
                                        <div className="mb-6">
                                            <ResponsiveContainer width="100%" height={250}>
                                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis
                                                        dataKey="report"
                                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                                        label={{ value: 'Report', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#94a3b8' }}
                                                    />
                                                    <YAxis domain={[0, 10]} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                                        labelFormatter={v => `Report #${v}`}
                                                        formatter={(value, name) => [`${value} / 10`, name]}
                                                    />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="Mood Score" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
                                                    <Line type="monotone" dataKey="Symptom Score" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 6 }} />
                                                    <Line type="monotone" dataKey="Symptom Severity" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} strokeDasharray="5 5" />
                                                    <Line type="monotone" dataKey="Emotional Adherence" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 4, fill: '#14b8a6' }} activeDot={{ r: 6 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                            <p className="text-xs text-slate-400 text-center mt-1">Scores per report generated (scale 0-10)</p>
                                        </div>
                                    ) : (
                                        <div className="h-48 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center mb-6">
                                            <p className="text-slate-400">No report data available yet</p>
                                        </div>
                                    )}

                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center space-x-2 mb-2">
                                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                                <span className="text-sm text-slate-600">Avg Symptom Severity</span>
                                            </div>
                                            <div className={`text-3xl font-bold ${avgSeverity !== null ? (avgSeverity <= 3 ? 'text-green-600' : avgSeverity <= 6 ? 'text-yellow-600' : 'text-red-600') : 'text-slate-800'}`}>
                                                {avgSeverity !== null ? avgSeverity : '--'}
                                            </div>
                                            <div className="text-sm text-slate-400">
                                                {avgSeverity !== null ? `${allScores.length} report${allScores.length > 1 ? 's' : ''} / 10` : 'No data'}
                                            </div>
                                            {avgSeverity !== null && (
                                                <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                                                    <div className={`h-2 rounded-full ${avgSeverity <= 3 ? 'bg-green-500' : avgSeverity <= 6 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${(avgSeverity / 10) * 100}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center space-x-2 mb-2">
                                                <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                                                <span className="text-sm text-slate-600">Avg Emotional Adherence</span>
                                            </div>
                                            <div className={`text-3xl font-bold ${avgEmotional !== null ? (avgEmotional >= 7 ? 'text-green-600' : avgEmotional >= 4 ? 'text-yellow-600' : 'text-red-600') : 'text-slate-800'}`}>
                                                {avgEmotional !== null ? avgEmotional : '--'}
                                            </div>
                                            <div className="text-sm text-slate-400">
                                                {avgEmotional !== null ? `${allScores.length} report${allScores.length > 1 ? 's' : ''} / 10` : 'No data'}
                                            </div>
                                            {avgEmotional !== null && (
                                                <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                                                    <div className={`h-2 rounded-full ${avgEmotional >= 7 ? 'bg-green-500' : avgEmotional >= 4 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${(avgEmotional / 10) * 100}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    {/* Sidebar - Right Side (1/3) */}
                    <div className="space-y-6">
                        {/* Contact Information */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Contact Information</h3>
                                <button onClick={() => setIsEditModalOpen(true)} className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1">
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

                        {/* Past Medical Conditions */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Medical Conditions</h3>
                                <button onClick={() => handleOpenMedHistoryModal('Condition')} className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    <span>Add</span>
                                </button>
                            </div>
                            <div className="space-y-2">
                                {medicalConditions.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-3">No conditions recorded</p>
                                ) : medicalConditions.map((condition) => (
                                    <div key={condition.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{condition.name}</p>
                                                {condition.year && <p className="text-xs text-slate-500">{condition.year}</p>}
                                            </div>
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenMedHistoryModal('Condition', condition)} className="p-1 text-slate-400 hover:text-primary-600 rounded" title="Edit">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteMedHistory(condition.id)} className="p-1 text-slate-400 hover:text-red-600 rounded" title="Delete">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        {condition.description && <p className="text-xs text-slate-500 mt-1">{condition.description}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Allergies */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Allergies</h3>
                                <button onClick={() => handleOpenMedHistoryModal('Allergy')} className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    <span>Add</span>
                                </button>
                            </div>
                            <div className="space-y-2">
                                {allergies.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-3">No allergies recorded</p>
                                ) : allergies.map((allergy) => (
                                    <div key={allergy.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 group">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start space-x-2">
                                                <svg className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{allergy.name}</p>
                                                    <p className="text-xs text-slate-500">{allergy.reaction}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenMedHistoryModal('Allergy', allergy)} className="p-1 text-slate-400 hover:text-primary-600 rounded" title="Edit">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteMedHistory(allergy.id)} className="p-1 text-slate-400 hover:text-red-600 rounded" title="Delete">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Family History */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Family History</h3>
                                <button onClick={() => handleOpenMedHistoryModal('FamilyHistory')} className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    <span>Add</span>
                                </button>
                            </div>
                            <div className="space-y-2">
                                {familyHistory.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-3">No family history recorded</p>
                                ) : familyHistory.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 group">
                                        <div className="flex items-center space-x-2">
                                            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                            <div>
                                                <span className="text-sm font-semibold text-slate-800">{item.relation}:</span>
                                                <span className="text-sm text-slate-600 ml-1">{item.condition}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenMedHistoryModal('FamilyHistory', item)} className="p-1 text-slate-400 hover:text-primary-600 rounded" title="Edit">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteMedHistory(item.id)} className="p-1 text-slate-400 hover:text-red-600 rounded" title="Delete">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
            <ScheduleAppointmentModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                onAppointmentScheduled={() => setIsScheduleModalOpen(false)}
            />
            <SessionDetailsModal
                isOpen={isSessionDetailsOpen}
                onClose={() => setIsSessionDetailsOpen(false)}
                session={selectedSession}
            />
            <MedicalHistoryModal
                isOpen={isMedHistoryModalOpen}
                onClose={() => { setIsMedHistoryModalOpen(false); setMedHistoryEditItem(null); }}
                patientId={patient?.id}
                category={medHistoryCategory}
                editItem={medHistoryEditItem}
                onSaved={handleMedHistorySaved}
            />
            <ClinicalItemModal
                isOpen={isClinicalModalOpen}
                onClose={() => { setIsClinicalModalOpen(false); setClinicalModalEditItem(null); }}
                patientId={patient?.id}
                category={clinicalModalCategory}
                editItem={clinicalModalEditItem}
                onSaved={handleClinicalItemSaved}
            />
        </div>
    )
}

export default PatientProfile

