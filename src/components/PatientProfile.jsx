import React, { useState, useEffect, useCallback } from 'react'
import { patientService, clinicalService, noteService, recordingService } from '../services/api'
import EditPatientModal from './modals/EditPatientModal'
import SessionDetailsModal from './modals/SessionDetailsModal'

const PatientProfile = () => {
    const [activeTab, setActiveTab] = useState('medical-history')
    const [patient, setPatient] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    // Clinical states
    const [medicalConditions, setMedicalConditions] = useState([])
    const [allergies, setAllergies] = useState([])
    const [familyHistory, setFamilyHistory] = useState([])
    const [medications, setMedications] = useState([])
    const [diagnoses, setDiagnoses] = useState([])
    const [treatmentPlans, setTreatmentPlans] = useState([])
    const [sessions, setSessions] = useState([])
    const [isSessionDetailsOpen, setIsSessionDetailsOpen] = useState(false)
    const [selectedSession, setSelectedSession] = useState(null)

    const [patients, setPatients] = useState([])

    const fetchPatientAndData = useCallback(async (targetId = null) => {
        try {
            setLoading(true)
            const response = await patientService.getAll();
            if (response.data && response.data.length > 0) {
                setPatients(response.data);

                // If no targetId, use the first patient or the one already selected
                const p = targetId
                    ? response.data.find(pt => pt.id.toString() === targetId.toString())
                    : (patient || response.data[0]);

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

                    const recordings = recRes.data.map(r => ({
                        ...r,
                        type: 'recording',
                        status: 'Completed',
                        content: 'Audio Recording: ' + (r.duration ? `${Math.floor(r.duration / 60)}m ${r.duration % 60}s` : 'Unknown duration')
                    })).filter(r => {
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
    }, [patient]);

    useEffect(() => {
        fetchPatientAndData();
    }, []); // Only on mount

    const handlePatientChange = (e) => {
        fetchPatientAndData(e.target.value);
    };

    const handleViewSessionDetails = (session) => {
        setSelectedSession(session);
        setIsSessionDetailsOpen(true);
    };

    const tabs = [
        { id: 'medical-history', label: 'Medical History', icon: '📋' },
        { id: 'medications', label: 'Medications', icon: '💊' },
        { id: 'diagnoses', label: 'Diagnoses', icon: '🔍' },
        { id: 'treatment-plan', label: 'Treatment Plan', icon: '📊' }
    ]

    if (loading) return (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-500 font-medium">Loading patient profile...</p>
            </div>
        </div>
    );

    if (error || !patient) return (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="text-4xl mb-4">🏥</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Patient Not Found</h2>
                <p className="text-slate-500 mb-6">{error || "No patient records are currently available."}</p>
                <button className="btn-primary" onClick={() => window.location.reload()}>Try Again</button>
            </div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50">
            {/* Header with Patient Info */}
            <header className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
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
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
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
                                            className={`flex items - center space - x - 2 px - 4 py - 3 rounded - lg font - medium transition - colors ${activeTab === tab.id
                                                ? 'bg-primary-50 text-primary-700'
                                                : 'text-slate-600 hover:bg-slate-50'
                                                } `}
                                        >
                                            <span>{tab.icon}</span>
                                            <span>{tab.label}</span>
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
                                                            <span className="text-yellow-600">⚠️</span>
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
                                                                <span className="text-2xl">
                                                                    {session.type === 'recording' ? '🎤' : '📓'}
                                                                </span>
                                                                <div>
                                                                    <h4 className="font-semibold text-slate-800">
                                                                        {session.type === 'recording' ? 'Session Recording' :
                                                                            (session.content.length > 40 ? session.content.substring(0, 40) + '...' : 'Clinical Note')}
                                                                    </h4>
                                                                    <div className="flex items-center space-x-3 mt-1 text-sm text-slate-500">
                                                                        <span className="font-medium text-primary-600">{session.status}</span>
                                                                        <span>•</span>
                                                                        <span>{session.patient_name}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
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
                                                ))}
                                            </div>
                                        </div>
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
                                <span>📈</span>
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
                                <button className="text-sm text-primary-600 hover:text-primary-700">✏️ Edit</button>
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

