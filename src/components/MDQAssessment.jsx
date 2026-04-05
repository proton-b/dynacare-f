import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { assessmentService } from '../services/api'

const MDQ_SYMPTOMS = [
    '...you felt so good or so hyper that other people thought you were not your normal self or you were so hyper that you got into trouble?',
    '...you were so irritable that you shouted at people or started fights or arguments?',
    '...you felt much more self-confident than usual?',
    '...you got much less sleep than usual and found you didn\'t really miss it?',
    '...you were much more talkative or spoke faster than usual?',
    '...thoughts raced through your head or you couldn\'t slow your mind down?',
    '...you were so easily distracted by things around you that you had trouble concentrating or staying on track?',
    '...you had much more energy than usual?',
    '...you were much more active or did many more things than usual?',
    '...you were much more social or outgoing than usual, for example, you telephoned friends in the middle of the night?',
    '...you were much more interested in sex than usual?',
    '...you did things that were unusual for you or that other people might have thought were excessive, foolish, or risky?',
    '...spending money got you or your family in trouble?',
]

const PROBLEM_OPTIONS = ['No problem', 'Minor problem', 'Moderate problem', 'Serious problem']

const getScoreInterpretation = (yesCount, q2, q3, q4, q5) => {
    // MDQ positive screen: 7+ yes in Q1, AND Q2=yes, AND Q3=Moderate or Serious
    const isPositive = yesCount >= 7 && q2 === 1 && (q3 === 2 || q3 === 3)
    if (isPositive) return { label: 'Positive screen for bipolar disorder', color: 'text-red-700', bg: 'bg-red-50 border-red-200', positive: true }
    return { label: 'Negative screen', color: 'text-green-700', bg: 'bg-green-50 border-green-200', positive: false }
}

const MDQAssessment = () => {
    const { token } = useParams()
    const [status, setStatus] = useState('loading')
    const [patientName, setPatientName] = useState('')
    const [symptomAnswers, setSymptomAnswers] = useState(Array(13).fill(null)) // Q1: 13 yes/no
    const [q2Answer, setQ2Answer] = useState(null) // Q2: yes/no - have several happened at same time?
    const [q3Answer, setQ3Answer] = useState(null) // Q3: problem level
    const [q4Answer, setQ4Answer] = useState(null) // Q4: family history yes/no
    const [q5Answer, setQ5Answer] = useState(null) // Q5: professional told you yes/no
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [result, setResult] = useState(null)

    useEffect(() => {
        const validate = async () => {
            try {
                const res = await assessmentService.validateToken(token)
                if (res.data.assessment_type !== 'MDQ') { setErrorMsg('This link is not for an MDQ assessment.'); setStatus('error'); return }
                setPatientName(res.data.patient_name); setStatus('ready')
            } catch (err) {
                setStatus(err.response?.status === 410 ? 'expired' : 'error')
                if (err.response?.status !== 410) setErrorMsg(err.response?.data?.message || 'Invalid or expired link.')
            }
        }
        validate()
    }, [token])

    const yesCount = symptomAnswers.filter(a => a === 1).length
    const allQ1Answered = symptomAnswers.every(a => a !== null)
    const showQ2 = allQ1Answered && yesCount > 1
    const showQ3 = showQ2 && q2Answer !== null
    const allAnswered = allQ1Answered && q4Answer !== null && q5Answer !== null && (!showQ2 || (q2Answer !== null && q3Answer !== null))

    const handleSubmit = async () => {
        if (!allAnswered) return
        const interp = getScoreInterpretation(yesCount, q2Answer, q3Answer, q4Answer, q5Answer)
        const totalScore = yesCount // score = number of yes answers in Q1
        const allAnswersObj = { symptoms: symptomAnswers, q2_simultaneous: q2Answer, q3_problem_level: q3Answer, q4_family_history: q4Answer, q5_professional_told: q5Answer }
        setResult(interp); setSubmitting(true)
        try {
            await assessmentService.submitResponse(token, { answers: allAnswersObj, total_score: totalScore, difficulty: interp.positive ? 'Positive Screen' : 'Negative Screen' })
            setStatus('submitted')
        } catch (err) { setErrorMsg(err.response?.data?.message || 'Failed to submit.') }
        finally { setSubmitting(false) }
    }

    if (status === 'loading') return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-500 font-medium">Loading assessment...</p></div></div>
    if (status === 'error' || status === 'expired') return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div><h2 className="text-xl font-bold text-slate-800 mb-2">{status === 'expired' ? 'Link Expired' : 'Invalid Link'}</h2><p className="text-slate-500">{status === 'expired' ? 'This assessment link has expired.' : errorMsg}</p></div></div>

    if (status === 'submitted') { const interp = result || getScoreInterpretation(yesCount, q2Answer, q3Answer, q4Answer, q5Answer); return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Assessment Submitted</h2>
            <p className="text-slate-500 mb-6">Thank you for completing the MDQ.</p>
            <div className={`rounded-xl p-4 border ${interp.bg}`}><p className="text-sm font-medium text-slate-600 mb-1">Result</p><p className={`text-lg font-bold ${interp.color}`}>{yesCount}/13 symptoms endorsed</p><p className={`text-sm font-semibold mt-1 ${interp.color}`}>{interp.label}</p></div>
            <p className="text-xs text-slate-400 mt-6">This is a screening tool, not a diagnosis. Your doctor will review these results.</p>
        </div></div>
    )}

    const answeredQ1Count = symptomAnswers.filter(a => a !== null).length

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div><h1 className="text-lg font-bold text-slate-800">Mood Disorder Questionnaire (MDQ)</h1><p className="text-sm text-slate-500">For: {patientName}</p></div>
                    <div className="text-right"><p className="text-sm font-bold text-slate-700">{answeredQ1Count}/13</p><p className="text-xs text-slate-400">Q1 answered</p></div>
                </div>
                <div className="max-w-3xl mx-auto px-4 pb-2"><div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-teal-600 h-1.5 rounded-full transition-all" style={{ width: `${(answeredQ1Count / 13) * 100}%` }}></div></div></div>
            </header>
            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
                    <p className="text-sm text-teal-800 font-medium">Please answer each question as best you can.</p>
                </div>

                {/* Q1: 13 symptom questions */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                    <p className="font-bold text-slate-800 mb-4">1. Has there ever been a period of time when you were not your usual self and...</p>
                    <div className="space-y-3">
                        {MDQ_SYMPTOMS.map((s, si) => (
                            <div key={si} className={`flex items-center justify-between p-3 rounded-lg border ${symptomAnswers[si] !== null ? 'border-teal-200 bg-teal-50/30' : 'border-slate-100'}`}>
                                <p className="text-sm text-slate-700 flex-1 mr-4">{s}</p>
                                <div className="flex space-x-2 shrink-0">
                                    <button onClick={() => { const a = [...symptomAnswers]; a[si] = 1; setSymptomAnswers(a) }} className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 ${symptomAnswers[si] === 1 ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>Yes</button>
                                    <button onClick={() => { const a = [...symptomAnswers]; a[si] = 0; setSymptomAnswers(a) }} className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 ${symptomAnswers[si] === 0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>No</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Q2 */}
                {showQ2 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                        <p className="font-bold text-slate-800 mb-4">2. If you checked YES to more than one of the above, have several of these ever happened during the same period of time?</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setQ2Answer(1)} className={`p-4 rounded-lg text-sm font-bold border-2 ${q2Answer === 1 ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Yes</button>
                            <button onClick={() => setQ2Answer(0)} className={`p-4 rounded-lg text-sm font-bold border-2 ${q2Answer === 0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>No</button>
                        </div>
                    </div>
                )}

                {/* Q3 */}
                {showQ3 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                        <p className="font-bold text-slate-800 mb-4">3. How much of a problem did any of these cause you -- like being able to work; having family, money, or legal troubles; getting into arguments or fights?</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {PROBLEM_OPTIONS.map((opt, oi) => (
                                <button key={oi} onClick={() => setQ3Answer(oi)} className={`p-3 rounded-lg text-sm font-medium border-2 text-center ${q3Answer === oi ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{opt}</button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Q4 */}
                {allQ1Answered && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                        <p className="font-bold text-slate-800 mb-4">4. Have any of your blood relatives had manic-depressive illness or bipolar disorder?</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setQ4Answer(1)} className={`p-4 rounded-lg text-sm font-bold border-2 ${q4Answer === 1 ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Yes</button>
                            <button onClick={() => setQ4Answer(0)} className={`p-4 rounded-lg text-sm font-bold border-2 ${q4Answer === 0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>No</button>
                        </div>
                    </div>
                )}

                {/* Q5 */}
                {allQ1Answered && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                        <p className="font-bold text-slate-800 mb-4">5. Has a health professional ever told you that you have manic-depressive illness or bipolar disorder?</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setQ5Answer(1)} className={`p-4 rounded-lg text-sm font-bold border-2 ${q5Answer === 1 ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Yes</button>
                            <button onClick={() => setQ5Answer(0)} className={`p-4 rounded-lg text-sm font-bold border-2 ${q5Answer === 0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>No</button>
                        </div>
                    </div>
                )}

                {/* Submit */}
                {allAnswered && (
                    <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm text-slate-500">Symptoms Endorsed</p><p className="text-2xl font-bold text-slate-800">{yesCount} <span className="text-sm font-normal text-slate-400">/ 13</span></p></div>
                            <button onClick={handleSubmit} disabled={submitting} className="px-8 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center space-x-2">
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
export default MDQAssessment
