import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { journalService } from '../services/api'

const Journals = () => {
    const [journals, setJournals] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchJournals = async () => {
            try {
                const res = await journalService.getMyJournals()
                setJournals(res.data)
            } catch (err) {
                console.error('Error fetching journals:', err)
                setError('Failed to load journals')
            } finally {
                setLoading(false)
            }
        }
        fetchJournals()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
            </div>
        )
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Journals</h1>
                <p className="text-slate-500 mt-1">Access your assigned medical reference journals</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* DSM-5 Reference Card */}
                <Link
                    to="/journals/dsm-5"
                    className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md hover:border-primary-200 transition-all group"
                >
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-1 group-hover:text-primary-700 transition-colors">DSM-5 Reference</h3>
                    <p className="text-sm text-slate-500 mb-4">For: Psychiatrists</p>
                    <span className="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-700">
                        Open Reference
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </span>
                </Link>

                {/* Journal Cards */}
                {journals.map((journal) => (
                    <div key={journal.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">{journal.name}</h3>
                        <p className="text-sm text-slate-500 mb-4">For: {journal.target_audience}</p>
                        <a
                            href={journal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                            Open Journal
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Journals
