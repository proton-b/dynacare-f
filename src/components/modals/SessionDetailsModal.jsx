import React from 'react';
import { exportClinicalSummaryToPDF } from '../../utils/pdfExport';

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

const SessionDetailsModal = ({ isOpen, onClose, session }) => {
    if (!isOpen || !session) return null;

    // Parse AI insights from either ai_insights (notes) or summary (recordings)
    let aiSummary = null;
    const rawInsights = session.ai_insights || session.summary;
    if (rawInsights) {
        try {
            aiSummary = typeof rawInsights === 'string'
                ? JSON.parse(rawInsights)
                : rawInsights;
        } catch (e) {
            console.error("Error parsing AI insights", e);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col scale-in-center">
                {/* Header */}
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-2xl">
                            {session.type === 'recording' ? '🎤' : '📓'}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Session Details</h2>
                            <p className="text-sm text-slate-500 font-medium">
                                {new Date(session.created_at).toLocaleDateString('en-IN', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    timeZone: 'Asia/Kolkata'
                                })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors group"
                    >
                        <svg className="w-6 h-6 text-slate-500 group-hover:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Note Content */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Audio Player for recordings */}
                            {session.type === 'recording' && session.audio_url && (
                                <section>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Session Audio</h3>
                                    <div className="bg-gradient-to-br from-primary-50 to-slate-50 rounded-2xl p-6 border border-primary-100">
                                        <div className="flex items-center space-x-4 mb-4">
                                            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                                                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">Session Recording</p>
                                                <div className="flex items-center space-x-3 text-sm text-slate-500">
                                                    {session.duration && (
                                                        <span>{Math.floor(session.duration / 60)}m {session.duration % 60}s</span>
                                                    )}
                                                    {session.file_size && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{session.file_size < 1024 * 1024
                                                                ? (session.file_size / 1024).toFixed(1) + ' KB'
                                                                : (session.file_size / (1024 * 1024)).toFixed(1) + ' MB'
                                                            }</span>
                                                        </>
                                                    )}
                                                    {session.format && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="uppercase">{session.format}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <audio
                                            controls
                                            className="w-full"
                                            src={getAudioUrl(session.audio_url, session.recording_id || session.id)}
                                            preload="metadata"
                                        >
                                            Your browser does not support the audio element.
                                        </audio>
                                        <button
                                            onClick={() => handleDownloadAudio(session.recording_id || session.id, session.format)}
                                            className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            <span>Download Audio</span>
                                        </button>
                                    </div>
                                </section>
                            )}

                            <section>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                                    {session.type === 'recording' ? 'Transcript' : 'Clinical Note'}
                                </h3>
                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 min-h-[300px] whitespace-pre-wrap text-slate-700 leading-relaxed shadow-inner">
                                    {session.type === 'recording'
                                        ? (session.transcript || 'No transcript available for this recording.')
                                        : session.content
                                    }
                                </div>
                            </section>

                            {aiSummary?.transcript && (
                                <section>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Transcript Excerpt</h3>
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 max-h-64 overflow-y-auto text-slate-600 italic text-sm leading-relaxed">
                                        "{aiSummary.transcript}"
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Right Column: AI Insights & Metadata */}
                        <div className="space-y-6">
                            {/* Session Status Card */}
                            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                                <h4 className="text-blue-800 font-bold mb-4 flex items-center space-x-2">
                                    <span>📊</span>
                                    <span>Session Metadata</span>
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-blue-600">Status</span>
                                        <span className="font-bold text-blue-800 px-2 py-0.5 bg-blue-100 rounded-full text-[10px] uppercase">{session.status}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-blue-600">Patient</span>
                                        <span className="font-bold text-blue-900">{session.patient_name}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-blue-600">Local Time</span>
                                        <span className="font-bold text-blue-900">
                                            {new Date(session.created_at).toLocaleTimeString('en-IN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                timeZone: 'Asia/Kolkata'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Summary Section */}
                            {aiSummary && (
                                <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
                                    <h4 className="text-purple-800 font-bold mb-4 flex items-center space-x-2">
                                        <span>🧠</span>
                                        <span>AI Insights</span>
                                    </h4>

                                    {aiSummary.clinicalInsights?.themes && (
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-purple-400 uppercase mb-2">Key Themes</p>
                                            <div className="flex flex-wrap gap-2">
                                                {aiSummary.clinicalInsights.themes.map((theme, i) => (
                                                    <span key={i} className="px-2 py-1 bg-white border border-purple-200 text-purple-700 text-[10px] font-bold rounded-lg shadow-sm">
                                                        {theme}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {aiSummary.clinicalImpression?.summary && (
                                        <div>
                                            <p className="text-xs font-bold text-purple-400 uppercase mb-2">Clinical Impression</p>
                                            <p className="text-sm text-purple-800 leading-relaxed">
                                                {aiSummary.clinicalImpression.summary}
                                            </p>
                                        </div>
                                    )}

                                    {aiSummary.treatmentPlan?.recommendations && (
                                        <div className="mt-4 pt-4 border-t border-purple-200/50">
                                            <p className="text-xs font-bold text-purple-400 uppercase mb-2">Next Steps</p>
                                            <ul className="text-sm text-purple-800 space-y-1">
                                                {aiSummary.treatmentPlan.recommendations.slice(0, 3).map((rec, i) => (
                                                    <li key={i} className="flex items-start space-x-2">
                                                        <span className="mt-1 text-[8px]">●</span>
                                                        <span>{rec}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-4 space-y-3">
                                <button
                                    onClick={() => {
                                        if (aiSummary) {
                                            const summaryForPdf = {
                                                overview: aiSummary.overview || {},
                                                symptoms: aiSummary.symptoms || { reported: [], severity: 'N/A' },
                                                riskAssessment: aiSummary.riskAssessment || { level: 'Low', concerns: [] },
                                                clinicalImpression: aiSummary.clinicalImpression || { possibleDiagnoses: [] },
                                                treatmentPlan: aiSummary.treatmentPlan || { recommendations: [], followUp: 'N/A' },
                                                nextSteps: aiSummary.nextSteps || []
                                            };
                                            exportClinicalSummaryToPDF(summaryForPdf, session.patient_name || 'Patient');
                                        } else {
                                            alert("No AI insights available for this session to export.");
                                        }
                                    }}
                                    className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-100 transition-all text-sm flex items-center justify-center space-x-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Export as PDF</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SessionDetailsModal;
