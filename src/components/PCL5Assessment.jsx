import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { assessmentService } from '../services/api'

const PCL5_QUESTIONS = [
    'Repeated, disturbing, and unwanted memories of the stressful experience?',
    'Repeated, disturbing dreams of the stressful experience?',
    'Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)?',
    'Feeling very upset when something reminded you of the stressful experience?',
    'Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)?',
    'Avoiding memories, thoughts, or feelings related to the stressful experience?',
    'Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?',
    'Trouble remembering important parts of the stressful experience?',
    'Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)?',
    'Blaming yourself or someone else for the stressful experience or what happened after it?',
    'Having strong negative feelings such as fear, horror, anger, guilt, or shame?',
    'Loss of interest in activities that you used to enjoy?',
    'Feeling distant or cut off from other people?',
    'Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)?',
    'Irritable behavior, angry outbursts, or acting aggressively?',
    'Taking too many risks or doing things that could cause you harm?',
    'Being "superalert" or watchful or on guard?',
    'Feeling jumpy or easily startled?',
    'Having difficulty concentrating?',
    'Trouble falling or staying asleep?',
]

const SCORE_OPTIONS = [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'A little bit' },
    { value: 2, label: 'Moderately' },
    { value: 3, label: 'Quite a bit' },
    { value: 4, label: 'Extremely' },
]

const getScoreInterpretation = (score) => {
    if (score <= 10) return { label: 'Minimal symptoms', color: 'text-green-700', bg: 'bg-green-50 border-green-200' }
    if (score <= 25) return { label: 'Mild symptoms', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' }
    if (score <= 40) return { label: 'Moderate symptoms', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' }
    if (score <= 55) return { label: 'Significant symptoms', color: 'text-red-600', bg: 'bg-red-50 border-red-200' }
    return { label: 'Severe symptoms', color: 'text-red-800', bg: 'bg-red-100 border-red-300' }
}

const PCL5Assessment = () => {
    const { token } = useParams()
    const [status, setStatus] = useState('loading')
    const [patientName, setPatientName] = useState('')
    const [answers, setAnswers] = useState(Array(20).fill(null))
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [totalScore, setTotalScore] = useState(0)

    useEffect(() => {
        const validate = async () => {
            try {
                const res = await assessmentService.validateToken(token)
                if (res.data.assessment_type !== 'PCL5') { setErrorMsg('This link is not for a PCL-5 assessment.'); setStatus('error'); return }
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

    const handleSubmit = async () => {
        if (!allAnswered) return
        const score = answers.reduce((s, a) => s + a, 0)
        setTotalScore(score); setSubmitting(true)
        try {
            await assessmentService.submitResponse(token, { answers, total_score: score })
            setStatus('submitted')
        } catch (err) { setErrorMsg(err.response?.data?.message || 'Failed to submit.') }
        finally { setSubmitting(false) }
    }

    if (status === 'loading') return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-500 font-medium">Loading assessment...</p></div></div>

    if (status === 'error' || status === 'expired') return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">{status === 'expired' ? 'Link Expired' : 'Invalid Link'}</h2>
            <p className="text-slate-500">{status === 'expired' ? 'This assessment link has expired. Please contact your doctor for a new link.' : errorMsg}</p>
        </div></div>
    )

    if (status === 'submitted') { const interp = getScoreInterpretation(totalScore); return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Assessment Submitted</h2>
            <p className="text-slate-500 mb-6">Thank you for completing the PCL-5 questionnaire.</p>
            <div className={`rounded-xl p-4 border ${interp.bg}`}><p className="text-sm font-medium text-slate-600 mb-1">Your Score</p><p className={`text-3xl font-bold ${interp.color}`}>{totalScore} <span className="text-base font-normal text-slate-500">/ 80</span></p><p className={`text-sm font-semibold mt-1 ${interp.color}`}>{interp.label}</p></div>
            <p className="text-xs text-slate-400 mt-6">A score of 31-33 suggests probable PTSD diagnosis. Your doctor will review these results.</p>
        </div></div>
    )}

    const currentScore = answers.reduce((s, a) => s + (a || 0), 0)
    const answeredCount = answers.filter(a => a !== null).length

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div><h1 className="text-lg font-bold text-slate-800">PTSD Checklist (PCL-5)</h1><p className="text-sm text-slate-500">For: {patientName}</p></div>
                    <div className="text-right"><p className="text-sm font-bold text-slate-700">{answeredCount}/20</p><p className="text-xs text-slate-400">answered</p></div>
                </div>
                <div className="max-w-3xl mx-auto px-4 pb-2"><div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-red-600 h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / 20) * 100}%` }}></div></div></div>
            </header>
            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <p className="text-sm text-red-800 font-medium">Below is a list of problems that people sometimes have in response to a very stressful experience. Keeping your <strong>worst event</strong> in mind, please indicate how much you have been bothered by that problem <strong>in the past month</strong>.</p>
                </div>
                <div className="space-y-4">
                    {PCL5_QUESTIONS.map((q, qi) => (
                        <div key={qi} className={`bg-white rounded-xl border ${answers[qi] !== null ? 'border-red-200' : 'border-slate-200'} p-5 transition-colors`}>
                            <p className="font-medium text-slate-800 mb-4"><span className="text-red-600 font-bold mr-2">{qi + 1}.</span>{q}</p>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                {SCORE_OPTIONS.map(o => (
                                    <button key={o.value} onClick={() => handleAnswer(qi, o.value)} className={`p-3 rounded-lg text-sm font-medium border-2 transition-all text-center ${answers[qi] === o.value ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                                        <span className="block text-lg font-bold mb-0.5">{o.value}</span><span className="text-xs">{o.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                {allAnswered && (
                    <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm text-slate-500">Total Score</p><p className="text-2xl font-bold text-slate-800">{currentScore} <span className="text-sm font-normal text-slate-400">/ 80</span></p><p className={`text-sm font-semibold ${getScoreInterpretation(currentScore).color}`}>{getScoreInterpretation(currentScore).label}</p></div>
                            <button onClick={handleSubmit} disabled={submitting} className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2">
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
export default PCL5Assessment
