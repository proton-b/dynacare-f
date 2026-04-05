import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { assessmentService } from '../services/api'

const AUDIT_QUESTIONS = [
    { text: 'How often do you have a drink containing alcohol?', options: ['Never', 'Monthly or less', '2-4 times a month', '2-3 times a week', '4 or more times a week'] },
    { text: 'How many drinks containing alcohol do you have on a typical day when you are drinking?', options: ['0-2', '3 or 4', '5 or 6', '7-9', '10 or more'] },
    { text: 'How often do you have five or more drinks on one occasion?', options: ['Never', 'Less than monthly', 'Monthly', 'Weekly', 'Daily or almost daily'] },
    { text: 'How often during the last year have you found that you were not able to stop drinking once you had started?', options: ['Never', 'Less than monthly', 'Monthly', 'Weekly', 'Daily or almost daily'] },
    { text: 'How often during the last year have you failed to do what was normally expected of you because of drinking?', options: ['Never', 'Less than monthly', 'Monthly', 'Weekly', 'Daily or almost daily'] },
    { text: 'How often during the last year have you needed a first drink in the morning to get yourself going after a heavy drinking session?', options: ['Never', 'Less than monthly', 'Monthly', 'Weekly', 'Daily or almost daily'] },
    { text: 'How often during the last year have you had a feeling of guilt or remorse after drinking?', options: ['Never', 'Less than monthly', 'Monthly', 'Weekly', 'Daily or almost daily'] },
    { text: 'How often during the last year have you been unable to remember what happened the night before because of your drinking?', options: ['Never', 'Less than monthly', 'Monthly', 'Weekly', 'Daily or almost daily'] },
    { text: 'Have you or someone else been injured because of your drinking?', options: ['No', '', 'Yes, but not in the last year', '', 'Yes, in the last year'] },
    { text: 'Has a relative, friend, doctor, or other health care worker been concerned about your drinking or suggested you cut down?', options: ['No', '', 'Yes, but not in the last year', '', 'Yes, in the last year'] },
]

// Questions 9 and 10 score 0, 2, or 4 only
const getQuestionScore = (qi, val) => {
    if (qi >= 8) return [0, 0, 2, 2, 4][val] ?? val
    return val
}

const getScoreInterpretation = (score) => {
    if (score <= 3) return { label: 'Low risk (Zone I)', color: 'text-green-700', bg: 'bg-green-50 border-green-200' }
    if (score <= 9) return { label: 'Risky drinking (Zone II)', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' }
    if (score <= 13) return { label: 'Harmful drinking (Zone III)', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' }
    return { label: 'Possible dependence (Zone IV)', color: 'text-red-800', bg: 'bg-red-100 border-red-300' }
}

const AUDITAssessment = () => {
    const { token } = useParams()
    const [status, setStatus] = useState('loading')
    const [patientName, setPatientName] = useState('')
    const [answers, setAnswers] = useState(Array(10).fill(null))
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [totalScore, setTotalScore] = useState(0)

    useEffect(() => {
        const validate = async () => {
            try {
                const res = await assessmentService.validateToken(token)
                if (res.data.assessment_type !== 'AUDIT') { setErrorMsg('This link is not for an AUDIT assessment.'); setStatus('error'); return }
                setPatientName(res.data.patient_name); setStatus('ready')
            } catch (err) {
                setStatus(err.response?.status === 410 ? 'expired' : 'error')
                if (err.response?.status !== 410) setErrorMsg(err.response?.data?.message || 'Invalid or expired link.')
            }
        }
        validate()
    }, [token])

    const handleAnswer = (qi, val) => { const a = [...answers]; a[qi] = val; setAnswers(a) }
    const allAnswered = answers.every(a => a !== null)

    const computeScore = () => answers.reduce((s, a, qi) => s + (a !== null ? getQuestionScore(qi, a) : 0), 0)

    const handleSubmit = async () => {
        if (!allAnswered) return
        const score = computeScore()
        setTotalScore(score); setSubmitting(true)
        try {
            await assessmentService.submitResponse(token, { answers, total_score: score })
            setStatus('submitted')
        } catch (err) { setErrorMsg(err.response?.data?.message || 'Failed to submit.') }
        finally { setSubmitting(false) }
    }

    if (status === 'loading') return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-500 font-medium">Loading assessment...</p></div></div>
    if (status === 'error' || status === 'expired') return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div><h2 className="text-xl font-bold text-slate-800 mb-2">{status === 'expired' ? 'Link Expired' : 'Invalid Link'}</h2><p className="text-slate-500">{status === 'expired' ? 'This assessment link has expired.' : errorMsg}</p></div></div>

    if (status === 'submitted') { const interp = getScoreInterpretation(totalScore); return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Assessment Submitted</h2>
            <p className="text-slate-500 mb-6">Thank you for completing the AUDIT questionnaire.</p>
            <div className={`rounded-xl p-4 border ${interp.bg}`}><p className="text-sm font-medium text-slate-600 mb-1">Your Score</p><p className={`text-3xl font-bold ${interp.color}`}>{totalScore} <span className="text-base font-normal text-slate-500">/ 40</span></p><p className={`text-sm font-semibold mt-1 ${interp.color}`}>{interp.label}</p></div>
        </div></div>
    )}

    const currentScore = computeScore()
    const answeredCount = answers.filter(a => a !== null).length

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div><h1 className="text-lg font-bold text-slate-800">Alcohol Use Disorders Identification Test (AUDIT)</h1><p className="text-sm text-slate-500">For: {patientName}</p></div>
                    <div className="text-right"><p className="text-sm font-bold text-slate-700">{answeredCount}/10</p><p className="text-xs text-slate-400">answered</p></div>
                </div>
                <div className="max-w-3xl mx-auto px-4 pb-2"><div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-orange-600 h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / 10) * 100}%` }}></div></div></div>
            </header>
            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                    <p className="text-sm text-orange-800 font-medium">Please answer each question as honestly as possible. Your responses will help your healthcare provider understand your drinking patterns.</p>
                </div>
                <div className="space-y-4">
                    {AUDIT_QUESTIONS.map((q, qi) => (
                        <div key={qi} className={`bg-white rounded-xl border ${answers[qi] !== null ? 'border-orange-200' : 'border-slate-200'} p-5 transition-colors`}>
                            <p className="font-medium text-slate-800 mb-4"><span className="text-orange-600 font-bold mr-2">{qi + 1}.</span>{q.text}</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {q.options.map((opt, oi) => opt ? (
                                    <button key={oi} onClick={() => handleAnswer(qi, oi)} className={`p-3 rounded-lg text-sm font-medium border-2 transition-all text-center ${answers[qi] === oi ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                                        {opt}
                                    </button>
                                ) : null)}
                            </div>
                        </div>
                    ))}
                </div>
                {allAnswered && (
                    <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm text-slate-500">Total Score</p><p className="text-2xl font-bold text-slate-800">{currentScore} <span className="text-sm font-normal text-slate-400">/ 40</span></p><p className={`text-sm font-semibold ${getScoreInterpretation(currentScore).color}`}>{getScoreInterpretation(currentScore).label}</p></div>
                            <button onClick={handleSubmit} disabled={submitting} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center space-x-2">
                                {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                                <span>{submitting ? 'Submitting...' : 'Submit'}</span>
                            </button>
                        </div>
                        {errorMsg && <p className="text-sm text-red-600 mt-2">{errorMsg}</p>}
                    </div>
                )}
            </div>
        </div>
    )
}
export default AUDITAssessment
