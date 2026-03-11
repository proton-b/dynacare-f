import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { noteService, aiService } from '../services/api'

const SessionNotes = () => {
    const location = useLocation()
    const [activeTab, setActiveTab] = useState('editor')
    const [noteContent, setNoteContent] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [transcriptData, setTranscriptData] = useState(null)
    const [aiSummary, setAiSummary] = useState(null)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
    const [isSymptomReportLoading, setIsSymptomReportLoading] = useState(false)
    const [symptomReport, setSymptomReport] = useState(null)

    const textareaRef = React.useRef(null)

    const handleFormat = (type) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = noteContent
        const selectedText = text.substring(start, end)

        let formattedText = selectedText
        switch (type) {
            case 'bold': formattedText = `**${selectedText}**`; break;
            case 'italic': formattedText = `*${selectedText}*`; break;
            case 'underline': formattedText = `<u>${selectedText}</u>`; break;
            case 'list': formattedText = `\n- ${selectedText}`; break;
            default: break;
        }

        const newText = text.substring(0, start) + formattedText + text.substring(end)
        setNoteContent(newText)

        // Re-focus and set selection
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start, start + formattedText.length)
        }, 0)
    }

    useEffect(() => {
        if (location.state) {
            if (location.state.transcript) {
                setTranscriptData(location.state.transcript);
                setActiveTab('transcript');
            }
            if (location.state.summary) {
                setAiSummary(location.state.summary);
            }
        }
    }, [location.state]);

    const templates = {
        intake: `# Initial Assessment\n\n**Chief Complaint:** \n\n**History of Present Illness:** \n\n**Past Psychiatric History:** \n\n**Mental Status Exam:** \n- Appearance: \n- Mood: \n- Affect: \n- Thought Process: \n\n**Diagnosis:** \n\n**Treatment Plan:** `,
        followup: `# Follow-up Session\n\n**Subjective:** \n\n**Objective:** \n\n**Assessment:** \n\n**Plan:** `,
        progress: `# Progress Review\n\n**Review of Goals:** \n\n**Interventions Used:** \n\n**Response to Treatment:** \n\n**Next Steps:** `,
        crisis: `# Crisis Intervention\n\n**Nature of Crisis:** \n\n**Safety Assessment:** \n- Ideation: \n- Plan: \n- Intent: \n\n**Interventions:** \n\n**Safety Plan Established:** [Yes/No]\n\n**Follow-up Plan:** `,
        termination: `# Termination Session\n\n**Summary of Treatment:** \n\n**Goals Achieved:** \n\n**Maintenance Plan:** \n\n**Referrals Provided:** `
    }

    const handleApplyTemplate = (id) => {
        console.log('Applying template:', id);
        const templateContent = templates[id];
        if (!templateContent) {
            console.error('Template not found for ID:', id);
            return;
        }

        if (noteContent && noteContent.length > 10 && !window.confirm("This will overwrite your current note. Continue?")) {
            return;
        }
        setNoteContent(templateContent);
        setSelectedTemplate(id);
        setActiveTab('editor');
        setIsTemplatesOpen(false);
    }

    const handleSaveNote = async () => {
        if (!noteContent.trim()) {
            alert("Please enter some content before saving.");
            return;
        }

        setIsSaving(true);
        try {
            const noteData = {
                patient_id: location.state?.patientId || 1,
                appointment_id: location.state?.appointmentId || null,
                content: noteContent,
                status: 'Finalized',
                ai_insights: aiSummary ? JSON.stringify(aiSummary) : null
            };

            await noteService.create(noteData);
            alert("Note saved and finalized successfully!");
        } catch (error) {
            console.error("Error saving note:", error);
            alert("Failed to save note: " + (error.response?.data?.message || error.message));
        } finally {
            setIsSaving(false);
        }
    }

    const handleGetSymptomReport = async () => {
        const sourceData = noteContent || transcriptData;

        if (!sourceData || sourceData.trim().length < 10) {
            alert("Please paste the session transcript or notes into the editor first to analyze symptoms.");
            return;
        }

        setIsSymptomReportLoading(true);
        try {
            const response = await aiService.getSymptomReport(sourceData);
            setSymptomReport(response.data);
            setActiveTab('ai-insights');
        } catch (error) {
            console.error("Error getting symptom report:", error);
            alert("Failed to generate symptom report. Please try again.");
        } finally {
            setIsSymptomReportLoading(false);
        }
    }

    const tabs = [
        { id: 'editor', label: 'Editor', icon: '✏️' },
        { id: 'ai-insights', label: 'AI Insights', icon: '🤖' },
        { id: 'transcript', label: 'Transcript', icon: '📝' },
        { id: 'assessments', label: 'Assessments', icon: '📊' },
        { id: 'history', label: 'History', icon: '🕐' },
        { id: 'export', label: 'Export', icon: '📥' }
    ]

    const templateOptions = [
        { id: 'intake', name: 'Initial Assessment', icon: '⭐' },
        { id: 'followup', name: 'Follow-up Session', icon: '🔄' },
        { id: 'progress', name: 'Progress Review', icon: '📈' },
        { id: 'crisis', name: 'Crisis Intervention', icon: '🚨' },
        { id: 'termination', name: 'Termination Session', icon: '✓' }
    ]

    const sessionInfo = {
        date: new Date().toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        }),
        duration: location.state?.duration || '45 min',
        type: 'Follow-up',
        status: 'In Progress'
    }

    const quickActions = [
        { label: 'Save Draft', icon: '💾', onClick: handleSaveNote },
        { label: 'Export Report', icon: '📄' },
        { label: 'Schedule Follow-up', icon: '📅' }
    ]

    return (
        <div className={`flex-1 overflow-y-auto bg-slate-50 ${isFullScreen ? 'fixed inset-0 z-[100] h-screen w-screen' : ''}`}>
            {/* Header */}
            {!isFullScreen && (
                <header className="bg-white border-b border-slate-200 px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 font-display">Session Notes</h1>
                            <p className="text-slate-500 mt-1">Create comprehensive clinical documentation with AI-assisted analysis</p>
                        </div>
                        <button className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Schedule Follow-up</span>
                        </button>
                    </div>
                </header>
            )}

            {/* Content */}
            <div className={`${isFullScreen ? 'h-full p-4' : 'px-8 py-6'}`}>
                <div className={`grid grid-cols-1 ${isFullScreen ? '' : 'lg:grid-cols-4'} gap-6 h-full`}>
                    {/* Main Editor Area - Left (3/4) */}
                    <div className={`${isFullScreen ? '' : 'lg:col-span-3'} space-y-6 flex flex-col h-full`}>
                        {/* Tabs */}
                        {!isFullScreen && (
                            <div className="bg-white rounded-xl border border-slate-200">
                                <div className="border-b border-slate-200 p-2 flex items-center justify-between">
                                    <div className="flex space-x-1">
                                        {tabs.map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${activeTab === tab.id
                                                    ? 'bg-primary-600 text-white'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <span>{tab.icon}</span>
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Editor Content Area */}
                        <div className={`bg-white rounded-xl border border-slate-200 flex-1 flex flex-col ${isFullScreen ? 'shadow-2xl' : ''}`}>
                            {activeTab === 'editor' && (
                                <div className="p-6 flex flex-col h-full">
                                    {/* Toolbar */}
                                    <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-slate-800">Clinical Notes</h3>
                                            <div className="flex items-center space-x-3">
                                                <button
                                                    onClick={() => setIsFullScreen(!isFullScreen)}
                                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1 hover:bg-primary-50 rounded-lg transition-colors"
                                                >
                                                    {isFullScreen ? 'Exit Full-screen' : 'Full-screen'}
                                                </button>
                                                <div className="relative group">
                                                    <button
                                                        onClick={() => setIsTemplatesOpen(!isTemplatesOpen)}
                                                        className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1 px-3 py-1 hover:bg-primary-50 rounded-lg transition-colors border border-primary-100"
                                                    >
                                                        <span>📋</span>
                                                        <span>Templates</span>
                                                        <span className="text-[10px] ml-1">{isTemplatesOpen ? '▲' : '▼'}</span>
                                                    </button>
                                                    <div className={`absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl transition-all z-20 overflow-hidden ${isTemplatesOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto'}`}>
                                                        {templateOptions.map(t => (
                                                            <button
                                                                key={t.id}
                                                                onClick={() => {
                                                                    handleApplyTemplate(t.id);
                                                                }}
                                                                className="w-full text-left p-3 hover:bg-slate-50 flex items-center space-x-3 text-sm text-slate-700 border-b border-slate-100 last:border-0"
                                                            >
                                                                <span>{t.icon}</span>
                                                                <span>{t.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleGetSymptomReport}
                                                    disabled={isSymptomReportLoading || (!noteContent && !transcriptData)}
                                                    className={`px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all flex items-center space-x-2 shadow-lg shadow-indigo-200 ${(isSymptomReportLoading || (!noteContent && !transcriptData)) ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {isSymptomReportLoading ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : '🔍'}
                                                    <span>{isSymptomReportLoading ? 'Analyzing...' : 'Symptoms Report'}</span>
                                                </button>
                                                <button
                                                    onClick={handleSaveNote}
                                                    disabled={isSaving}
                                                    className={`btn-primary text-sm flex items-center space-x-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {isSaving ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : '💾'}
                                                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Formatting Toolbar */}
                                        <div className="flex items-center space-x-4 pb-4 border-b border-slate-200">
                                            <div className="flex items-center space-x-1 border-r border-slate-200 pr-4">
                                                <button
                                                    onClick={() => handleFormat('bold')}
                                                    className="p-2 hover:bg-slate-200 rounded transition-colors" title="Bold"
                                                >
                                                    <span className="font-bold text-slate-700">B</span>
                                                </button>
                                                <button
                                                    onClick={() => handleFormat('italic')}
                                                    className="p-2 hover:bg-slate-200 rounded transition-colors" title="Italic"
                                                >
                                                    <span className="italic text-slate-700">I</span>
                                                </button>
                                                <button
                                                    onClick={() => handleFormat('underline')}
                                                    className="p-2 hover:bg-slate-200 rounded transition-colors" title="Underline"
                                                >
                                                    <span className="underline text-slate-700">U</span>
                                                </button>
                                            </div>
                                            <div className="flex items-center space-x-1 border-r border-slate-200 pr-4">
                                                <button
                                                    onClick={() => handleFormat('list')}
                                                    className="p-2 hover:bg-slate-200 rounded transition-colors" title="Bullet List"
                                                >
                                                    <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Text Editor */}
                                    <div className="mb-6 flex-1 flex flex-col min-h-0">
                                        <textarea
                                            ref={textareaRef}
                                            value={noteContent}
                                            onChange={(e) => setNoteContent(e.target.value)}
                                            placeholder="Begin typing your clinical notes here... Use the toolbar above for formatting or select a template to get started."
                                            className="w-full flex-1 p-4 border-2 border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none resize-none text-slate-700 leading-relaxed font-mono"
                                        />
                                        <div className="flex items-center justify-between mt-2 text-sm text-slate-500">
                                            <span>{noteContent.length} characters</span>
                                            <span>Auto-saved 2 minutes ago</span>
                                        </div>
                                    </div>

                                    {/* AI Writing Assistant */}
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                                <span className="text-white">✨</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-slate-800 mb-1">AI Writing Assistant</h4>
                                                <p className="text-sm text-slate-600 mb-3">
                                                    Get AI-powered suggestions to enhance your clinical documentation and ensure comprehensive coverage.
                                                </p>
                                                <div className="flex items-center space-x-3">
                                                    <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
                                                        Improve Grammar
                                                    </button>
                                                    <span className="text-slate-300">•</span>
                                                    <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
                                                        Add Clinical Details
                                                    </button>
                                                    <span className="text-slate-300">•</span>
                                                    <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
                                                        Summarize Key Points
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Insights Tab */}
                            {activeTab === 'ai-insights' && (
                                <div className="p-6">
                                    {aiSummary ? (
                                        <div className="space-y-6">
                                            <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                                                <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                    <span>🤖</span>
                                                    <span>AI-Generated Clinical Summary</span>
                                                </h3>
                                                <div className="space-y-4">
                                                    <p className="text-slate-700 leading-relaxed">
                                                        <strong>Mood & Affect:</strong> {aiSummary.overview.mood} / {aiSummary.overview.affect}
                                                    </p>
                                                    <p className="text-slate-700 leading-relaxed">
                                                        <strong>Engagement:</strong> {aiSummary.overview.engagement}
                                                    </p>
                                                    <div className="bg-white/50 p-4 rounded-lg border border-blue-100">
                                                        <h4 className="font-bold text-slate-800 mb-2">Key Themes:</h4>
                                                        <p className="text-slate-700">{aiSummary.clinicalInsights?.themes?.join(', ') || 'General therapy session'}</p>
                                                    </div>

                                                    {/* DSM-5 Diagnoses from Summary */}
                                                    {aiSummary.clinicalImpression?.possibleDiagnoses?.length > 0 && (
                                                        <div className="bg-white/50 p-4 rounded-lg border border-blue-100">
                                                            <h4 className="font-bold text-slate-800 mb-2">Preliminary DSM-5 Indications:</h4>
                                                            <ul className="space-y-2">
                                                                {aiSummary.clinicalImpression.possibleDiagnoses.map((dx, i) => (
                                                                    <li key={i} className="text-sm text-slate-700 border-l-2 border-indigo-400 pl-3">
                                                                        <span className="font-bold">{dx.name} ({dx.code})</span>
                                                                        <span className="block text-xs mt-0.5 opacity-80">{dx.criteria_met}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-3 mt-6">
                                                    <button
                                                        onClick={() => setNoteContent(prev => prev + `\n\n--- AI Summary ---\nMood: ${aiSummary.overview.mood}\nAffect: ${aiSummary.overview.affect}\nThemes: ${aiSummary.clinicalInsights?.themes?.join(', ') || 'N/A'}`)}
                                                        className="text-sm font-bold text-primary-600 hover:text-primary-700 px-4 py-2 bg-white rounded-lg border border-primary-200"
                                                    >
                                                        Copy to Notes
                                                    </button>
                                                </div>
                                            </div>

                                            {symptomReport && (
                                                <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-lg animate-in fade-in slide-in-from-top-4 duration-500">
                                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                        <span>🔍</span>
                                                        <span>AI-Detected Symptoms Report</span>
                                                    </h3>
                                                    <div className="mb-4 p-4 bg-white/60 rounded-lg border border-indigo-100 italic text-slate-700">
                                                        {symptomReport.overall_impression}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {symptomReport.symptoms.map((s, idx) => (
                                                            <div key={idx} className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <h4 className="font-bold text-slate-800">{s.symptom}</h4>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${s.severity === 'Severe' ? 'bg-red-100 text-red-600' : s.severity === 'Moderate' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                                                        {s.severity}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 mb-2 italic">"{s.evidence}"</p>
                                                                <div className="flex items-center space-x-1 mt-2 pt-2 border-t border-slate-50">
                                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                                        {s.dsm5_mapping}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {symptomReport.risk_factors && symptomReport.risk_factors.length > 0 && (
                                                        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg">
                                                            <h4 className="text-sm font-bold text-red-700 mb-2 flex items-center space-x-2">
                                                                <span>⚠️</span>
                                                                <span>Identified Risk Factors</span>
                                                            </h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {symptomReport.risk_factors.map((risk, i) => (
                                                                    <span key={i} className="px-3 py-1 bg-white text-red-600 text-xs font-semibold rounded-full border border-red-200">
                                                                        {risk}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            const reportText = `\n\n--- Symptom Report ---\nImpression: ${symptomReport.overall_impression}\nSymptoms Found: ${symptomReport.symptoms.map(s => `${s.symptom} (${s.severity})`).join(', ')}`;
                                                            setNoteContent(prev => prev + reportText);
                                                        }}
                                                        className="mt-6 w-full py-3 bg-white border-2 border-indigo-200 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center space-x-2"
                                                    >
                                                        <span>📋</span>
                                                        <span>Append Report to Notes</span>
                                                    </button>
                                                </div>
                                            )}

                                            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                    <span>💡</span>
                                                    <span>Suggested Follow-up Items</span>
                                                </h3>
                                                <ul className="space-y-3">
                                                    {aiSummary.nextSteps?.map((step, index) => (
                                                        <li key={index} className="flex items-start space-x-2 text-sm text-slate-700">
                                                            <span className="text-green-500 mt-1">✓</span>
                                                            <span>{step}</span>
                                                        </li>
                                                    ))}
                                                    <li className="flex items-start space-x-2 text-sm text-slate-700">
                                                        <span className="text-green-500 mt-1">✓</span>
                                                        <span>Follow-up: {aiSummary.treatmentPlan?.followUp || 'As scheduled'}</span>
                                                    </li>
                                                </ul>
                                            </div>

                                            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                                                <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                    <span>🎯</span>
                                                    <span>Treatment Goals</span>
                                                </h3>
                                                <div className="space-y-4">
                                                    {aiSummary.treatmentPlan?.goals?.map((goal, index) => (
                                                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
                                                            <span className="text-sm font-medium text-slate-700">{goal}</span>
                                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">New</span>
                                                        </div>
                                                    )) || aiSummary.treatmentPlan?.recommendations?.map((goal, index) => (
                                                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
                                                            <span className="text-sm font-medium text-slate-700">{goal}</span>
                                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">Rec</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16">
                                            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                <span className="text-4xl text-slate-400">🤖</span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-700 mb-2">No AI Insights Available</h3>
                                            <p className="text-slate-500">Insights are generated automatically after a session recording is completed.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Transcript Tab */}
                            {activeTab === 'transcript' && (
                                <div className="p-6">
                                    {transcriptData ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-bold text-slate-800 flex items-center space-x-2">
                                                    <span>🎤</span>
                                                    <span>Session Transcript</span>
                                                </h3>
                                                <button
                                                    onClick={() => setNoteContent(prev => prev + "\n\n--- Transcript ---\n" + transcriptData)}
                                                    className="px-4 py-2 bg-primary-50 text-primary-600 rounded-lg font-bold hover:bg-primary-100 transition-all flex items-center space-x-2"
                                                >
                                                    <span>📋</span>
                                                    <span>Copy to Notes</span>
                                                </button>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-h-[600px] overflow-y-auto">
                                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-sans text-lg">
                                                    {transcriptData}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <p className="text-sm text-yellow-800">
                                                    <strong>💡 Tip:</strong> You can select portions of this transcript to refine your clinical notes or use the "Copy to Notes" button to append the entire text.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16">
                                            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-700 mb-2">No Transcript Available</h3>
                                            <p className="text-slate-500 mb-6">Upload a session recording to generate an AI transcript</p>
                                            <button className="btn-primary">
                                                Upload Recording
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Other tabs placeholder */}
                            {activeTab === 'assessments' && (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        {/* Assessment Overview */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-2xl">📊</span>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-blue-200 text-blue-700 rounded-full">Latest</span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">PHQ-9 Score</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-blue-600">8</span>
                                                    <span className="text-sm text-slate-600">/ 27</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-2">No data recorded</p>
                                                <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-2xl">🧠</span>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-purple-200 text-purple-700 rounded-full">N/A</span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">GAD-7 Score</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-purple-600">--</span>
                                                    <span className="text-sm text-slate-600">/ 21</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-2">No data recorded</p>
                                                <div className="mt-3 w-full bg-purple-200 rounded-full h-2">
                                                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-2xl">💪</span>
                                                    <span className="text-xs font-semibold px-2 py-1 bg-green-200 text-green-700 rounded-full">N/A</span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-1">WHODAS 2.0</h4>
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-3xl font-bold text-green-600">--</span>
                                                    <span className="text-sm text-slate-600">/ 100</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-2">No data recorded</p>
                                                <div className="mt-3 w-full bg-green-200 rounded-full h-2">
                                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Available Assessments */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>📋</span>
                                                <span>Available Assessments</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[
                                                    { name: 'PHQ-9', description: 'Patient Health Questionnaire - Depression', time: '3 min', color: 'blue' },
                                                    { name: 'GAD-7', description: 'Generalized Anxiety Disorder Scale', time: '2 min', color: 'purple' },
                                                    { name: 'PCL-5', description: 'PTSD Checklist for DSM-5', time: '5 min', color: 'red' },
                                                    { name: 'AUDIT', description: 'Alcohol Use Disorders Identification', time: '3 min', color: 'orange' },
                                                    { name: 'CAGE', description: 'Substance Abuse Screening', time: '1 min', color: 'yellow' },
                                                    { name: 'MDQ', description: 'Mood Disorder Questionnaire', time: '3 min', color: 'teal' }
                                                ].map((assessment, index) => (
                                                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-slate-200 transition-all cursor-pointer group">
                                                        <div className="flex items-center space-x-4">
                                                            <div className={`w-12 h-12 bg-${assessment.color}-100 rounded-xl flex items-center justify-center`}>
                                                                <span className={`text-lg font-bold text-${assessment.color}-600`}>{assessment.name.charAt(0)}</span>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-slate-800">{assessment.name}</h4>
                                                                <p className="text-sm text-slate-500">{assessment.description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-3">
                                                            <span className="text-xs font-medium text-slate-400">{assessment.time}</span>
                                                            <button className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                                Start
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Assessment History */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>📈</span>
                                                <span>Score Trends</span>
                                            </h3>
                                            <div className="space-y-4">
                                                {[].map((record, index) => (
                                                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                                        <div className="flex items-center space-x-4">
                                                            <div className={`w-10 h-10 bg-${record.color}-100 rounded-lg flex items-center justify-center`}>
                                                                <span className={`font-bold text-${record.color}-600`}>{record.assessment.charAt(0)}</span>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-slate-800">{record.assessment}</h4>
                                                                <p className="text-sm text-slate-500">{record.date}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-6">
                                                            <div className="text-right">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="text-lg font-bold text-slate-800">{record.score}</span>
                                                                    <span className={`text-sm ${record.score < record.prevScore ? 'text-green-600' : 'text-red-600'}`}>
                                                                        {record.score < record.prevScore ? '↓' : '↑'} {Math.abs(record.score - record.prevScore)}
                                                                    </span>
                                                                </div>
                                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${record.color}-100 text-${record.color}-700`}>
                                                                    {record.severity}
                                                                </span>
                                                            </div>
                                                            <button className="text-primary-600 hover:text-primary-700">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        {/* Search and Filter */}
                                        <div className="flex items-center justify-between">
                                            <div className="relative flex-1 max-w-md">
                                                <input
                                                    type="text"
                                                    placeholder="Search past notes..."
                                                    className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
                                                />
                                                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <select className="px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 outline-none text-sm">
                                                    <option>All Types</option>
                                                    <option>Follow-up</option>
                                                    <option>Initial</option>
                                                    <option>Crisis</option>
                                                </select>
                                                <select className="px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 outline-none text-sm">
                                                    <option>Last 30 days</option>
                                                    <option>Last 90 days</option>
                                                    <option>Last 6 months</option>
                                                    <option>All time</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Timeline */}
                                        <div className="relative">
                                            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                                            <div className="space-y-6">
                                                {[]
                                                    .map((session, index) => (
                                                        <div key={index} className="relative pl-16">
                                                            <div className={`absolute left-4 w-5 h-5 rounded-full border-4 border-white ${session.type === 'Crisis' ? 'bg-red-500' : session.type === 'Initial' ? 'bg-purple-500' : 'bg-primary-500'}`}></div>
                                                            <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                                                                <div className="flex items-start justify-between mb-4">
                                                                    <div>
                                                                        <div className="flex items-center space-x-3 mb-1">
                                                                            <span className="font-bold text-slate-800">{session.date}</span>
                                                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${session.type === 'Crisis' ? 'bg-red-100 text-red-700' : session.type === 'Initial' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                                {session.type}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-sm text-slate-500">{session.duration}</span>
                                                                    </div>
                                                                    <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                                                                        View Full Note
                                                                    </button>
                                                                </div>
                                                                <p className="text-slate-600 mb-4 leading-relaxed">{session.summary}</p>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {session.topics.map((topic, i) => (
                                                                            <span key={i} className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                                                                                {topic}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${session.mood === 'Positive' ? 'bg-green-100 text-green-700' : session.mood === 'Distressed' ? 'bg-red-100 text-red-700' : session.mood === 'Anxious' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                        Mood: {session.mood}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>

                                        {/* Load More */}
                                        <div className="text-center">
                                            <button className="px-6 py-2.5 border-2 border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                                                Load More Sessions
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'export' && (
                                <div className="p-6">
                                    <div className="space-y-6">
                                        {/* Export Format Selection */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>📄</span>
                                                <span>Export Format</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {[
                                                    { format: 'PDF', icon: '📕', description: 'Professional clinical report format', recommended: true },
                                                    { format: 'Word', icon: '📘', description: 'Editable document format (.docx)', recommended: false },
                                                    { format: 'CSV', icon: '📗', description: 'Data export for analysis', recommended: false }
                                                ].map((option, index) => (
                                                    <button key={index} className={`relative p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${option.recommended ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                        {option.recommended && (
                                                            <span className="absolute -top-2 right-4 text-xs font-semibold px-2 py-0.5 bg-primary-600 text-white rounded-full">
                                                                Recommended
                                                            </span>
                                                        )}
                                                        <span className="text-3xl mb-3 block">{option.icon}</span>
                                                        <h4 className="font-bold text-slate-800 mb-1">{option.format}</h4>
                                                        <p className="text-sm text-slate-500">{option.description}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Content Selection */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>📋</span>
                                                <span>Include in Export</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[
                                                    { label: 'Session Notes', checked: true },
                                                    { label: 'AI-Generated Insights', checked: true },
                                                    { label: 'Assessment Scores', checked: true },
                                                    { label: 'Treatment Goals', checked: true },
                                                    { label: 'Session Transcript', checked: false },
                                                    { label: 'Appointment History', checked: false }
                                                ].map((item, index) => (
                                                    <label key={index} className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                                        <input type="checkbox" defaultChecked={item.checked} className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                        <span className="font-medium text-slate-700">{item.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Date Range */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>📅</span>
                                                <span>Date Range</span>
                                            </h3>
                                            <div className="flex items-center space-x-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-slate-600 mb-2">From</label>
                                                    <input type="date" defaultValue="2025-12-01" className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 outline-none" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-slate-600 mb-2">To</label>
                                                    <input type="date" defaultValue="2026-01-13" className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-primary-500 outline-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Privacy Options */}
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                                                <span>🔒</span>
                                                <span>Privacy & Compliance</span>
                                            </h3>
                                            <div className="space-y-3">
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                    <span className="text-sm text-slate-700">Include HIPAA compliance header</span>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                    <span className="text-sm text-slate-700">Redact personally identifiable information</span>
                                                </label>
                                                <label className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                    <span className="text-sm text-slate-700">Add digital signature and timestamp</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Export Button */}
                                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-xl">
                                            <div>
                                                <p className="font-semibold text-slate-800">Ready to export</p>
                                                <p className="text-sm text-slate-500">4 sessions • PDF format • 12 pages estimated</p>
                                            </div>
                                            <button className="btn-primary px-8 py-3 flex items-center space-x-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                <span>Generate Export</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Right (1/4) */}
                    <div className="space-y-6">
                        {/* Templates */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800">📋 Templates</h3>
                            </div>
                            <div className="space-y-2">
                                {templateOptions.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => handleApplyTemplate(template.id)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors flex items-center space-x-3 ${selectedTemplate === template.id
                                            ? 'bg-primary-50 border-2 border-primary-600'
                                            : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                                            }`}
                                    >
                                        <span className="text-xl">{template.icon}</span>
                                        <span className="text-sm font-medium text-slate-700">{template.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Session Info */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Session Info</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
                                    <p className="text-sm font-semibold text-slate-700">{sessionInfo.date}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Duration</label>
                                    <p className="text-sm font-semibold text-slate-700">{sessionInfo.duration}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Type</label>
                                    <p className="text-sm font-semibold text-slate-700">{sessionInfo.type}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                        {sessionInfo.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h3>
                            <div className="space-y-2">
                                {quickActions.map((action, index) => (
                                    <button
                                        key={index}
                                        onClick={action.onClick}
                                        className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors flex items-center space-x-3 border-2 border-transparent hover:border-slate-200"
                                    >
                                        <span className="text-xl">{action.icon}</span>
                                        <span className="text-sm font-medium text-slate-700">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SessionNotes
