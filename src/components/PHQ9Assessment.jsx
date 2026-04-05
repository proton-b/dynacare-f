import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { assessmentService } from '../services/api'

const PHQ9_QUESTIONS = [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead or of hurting yourself in some way',
]

const SCORE_OPTIONS = [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
]

const DIFFICULTY_OPTIONS = [
    'Not difficult at all',
    'Somewhat difficult',
    'Very difficult',
    'Extremely difficult',
]

const getScoreInterpretation = (score) => {
    if (score <= 4) return { label: 'Minimal depression', color: 'text-green-700', bg: 'bg-green-50 border-green-200' }
    if (score <= 9) return { label: 'Mild depression', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' }
    if (score <= 14) return { label: 'Moderate depression', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' }
    if (score <= 19) return { label: 'Moderately severe depression', color: 'text-red-600', bg: 'bg-red-50 border-red-200' }
    return { label: 'Severe depression', color: 'text-red-800', bg: 'bg-red-100 border-red-300' }
}

const PHQ9Assessment = () => {
    const { token } = useParams()
    const [status, setStatus] = useState('loading') // loading, ready, submitted, error, expired
    const [patientName, setPatientName] = useState('')
    const [answers, setAnswers] = useState(Array(9).fill(null))
    const [difficulty, setDifficulty] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [totalScore, setTotalScore] = useState(0)

    useEffect(() => {
        const validate = async () => {
            try {
                const res = await assessmentService.validateToken(token)
                if (res.data.assessment_type !== 'PHQ9') {
                    setErrorMsg('This link is not for a PHQ-9 assessment.')
                    setStatus('error')
                    return
                }
                setPatientName(res.data.patient_name)
                setStatus('ready')
            } catch (err) {
                if (err.response?.status === 410) {
                    setStatus('expired')
                } else {
                    setErrorMsg(err.response?.data?.message || 'Invalid or expired link.')
                    setStatus('error')
                }
            }
        }
        validate()
    }, [token])

    const handleAnswer = (questionIndex, value) => {
        const newAnswers = [...answers]
        newAnswers[questionIndex] = value
        setAnswers(newAnswers)
    }

    const allAnswered = answers.every(a => a !== null)

    const handleSubmit = async () => {
        if (!allAnswered) return
        const score = answers.reduce((sum, a) => sum + a, 0)
        setTotalScore(score)
        setSubmitting(true)
        try {
            await assessmentService.submitResponse(token, {
                answers,
                total_score: score,
                difficulty: difficulty || null
            })
            setStatus('submitted')
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Failed to submit. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    // Loading
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Loading assessment...</p>
                </div>
            </div>
        )
    }

    // Error / Expired
    if (status === 'error' || status === 'expired') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">
                        {status === 'expired' ? 'Link Expired' : 'Invalid Link'}
                    </h2>
                    <p className="text-slate-500">
                        {status === 'expired' ? 'This assessment link has expired. Please contact your doctor for a new link.' : errorMsg}
                    </p>
                </div>
            </div>
        )
    }

    // Submitted
    if (status === 'submitted') {
        const interp = getScoreInterpretation(totalScore)
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Assessment Submitted</h2>
                    <p className="text-slate-500 mb-6">Thank you for completing the PHQ-9 questionnaire. Your responses have been recorded.</p>
                    <div className={`rounded-xl p-4 border ${interp.bg}`}>
                        <p className="text-sm font-medium text-slate-600 mb-1">Your Score</p>
                        <p className={`text-3xl font-bold ${interp.color}`}>{totalScore} <span className="text-base font-normal text-slate-500">/ 27</span></p>
                        <p className={`text-sm font-semibold mt-1 ${interp.color}`}>{interp.label}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-6">Your doctor will review these results at your next appointment.</p>
                </div>
            </div>
        )
    }

    // Ready - show questionnaire
    const currentScore = answers.reduce((sum, a) => sum + (a || 0), 0)
    const answeredCount = answers.filter(a => a !== null).length

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Patient Health Questionnaire (PHQ-9)</h1>
                        <p className="text-sm text-slate-500">For: {patientName}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-700">{answeredCount}/9</p>
                        <p className="text-xs text-slate-400">answered</p>
                    </div>
                </div>
                <div className="max-w-3xl mx-auto px-4 pb-2">
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / 9) * 100}%` }}></div>
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-4 py-6">
                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <p className="text-sm text-blue-800 font-medium">
                        Over the <strong>last 2 weeks</strong>, how often have you been bothered by any of the following problems?
                    </p>
                </div>

                {/* Questions */}
                <div className="space-y-4">
                    {PHQ9_QUESTIONS.map((question, qIndex) => (
                        <div key={qIndex} className={`bg-white rounded-xl border ${answers[qIndex] !== null ? 'border-blue-200' : 'border-slate-200'} p-5 transition-colors`}>
                            <p className="font-medium text-slate-800 mb-4">
                                <span className="text-blue-600 font-bold mr-2">{qIndex + 1}.</span>
                                {question}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {SCORE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => handleAnswer(qIndex, option.value)}
                                        className={`p-3 rounded-lg text-sm font-medium border-2 transition-all text-center ${
                                            answers[qIndex] === option.value
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="block text-lg font-bold mb-0.5">{option.value}</span>
                                        <span className="text-xs">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Difficulty question */}
                {allAnswered && currentScore > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 mt-6">
                        <p className="font-medium text-slate-800 mb-4">
                            If you checked off <strong>any</strong> problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {DIFFICULTY_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setDifficulty(option)}
                                    className={`p-3 rounded-lg text-sm font-medium border-2 transition-all text-center ${
                                        difficulty === option
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Score preview + Submit */}
                {allAnswered && (
                    <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-slate-500">Total Score</p>
                                <p className="text-2xl font-bold text-slate-800">{currentScore} <span className="text-sm font-normal text-slate-400">/ 27</span></p>
                                <p className={`text-sm font-semibold ${getScoreInterpretation(currentScore).color}`}>
                                    {getScoreInterpretation(currentScore).label}
                                </p>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                            >
                                {submitting ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
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

export default PHQ9Assessment
