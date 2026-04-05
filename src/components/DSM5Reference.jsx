import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dsm5Service } from '../services/api'

const DSM5Reference = () => {
    const navigate = useNavigate()
    const [activeCategory, setActiveCategory] = useState('All Disorders')
    const [searchQuery, setSearchQuery] = useState('')
    const [disorders, setDisorders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [bookmarks, setBookmarks] = useState([])
    const [aiLoading, setAiLoading] = useState(false)
    const [aiResult, setAiResult] = useState(null)
    const [allDisorders, setAllDisorders] = useState([])

    const categoryIcons = {
        'All Disorders': '📋',
        'Mood Disorders': '💓',
        'Anxiety Disorders': '😟',
        'Psychotic Disorders': '🌀',
        'Personality Disorders': '👥',
        'Trauma & Stress': '🧠'
    }

    const categories = [
        { name: 'All Disorders', count: allDisorders.length, icon: categoryIcons['All Disorders'] },
        ...Object.entries(
            allDisorders.reduce((acc, d) => {
                if (d.category) acc[d.category] = (acc[d.category] || 0) + 1
                return acc
            }, {})
        ).map(([name, count]) => ({
            name,
            count,
            icon: categoryIcons[name] || '📄'
        }))
    ]

    useEffect(() => {
        fetchAllDisorders()
    }, [])

    useEffect(() => {
        fetchDisorders()
        fetchBookmarks()
    }, [activeCategory])

    const fetchAllDisorders = async () => {
        try {
            const response = await dsm5Service.getDisorders({})
            setAllDisorders(response.data)
        } catch (err) {
            console.error('Error fetching all disorders for counts:', err)
        }
    }

    const fetchDisorders = async (searchToken = '') => {
        try {
            setLoading(true)
            const params = {}
            if (activeCategory !== 'All Disorders') params.category = activeCategory
            if (searchToken) params.search = searchToken

            const response = await dsm5Service.getDisorders(params)
            setDisorders(response.data)
            setError(null)
        } catch (err) {
            console.error('Error fetching disorders:', err)
            setError('Failed to load disorders. Please try again later.')
        } finally {
            setLoading(false)
        }
    }

    const fetchBookmarks = async () => {
        try {
            const response = await dsm5Service.getBookmarks()
            setBookmarks(response.data.map(b => b.id))
        } catch (err) {
            console.error('Error fetching bookmarks:', err)
        }
    }

    const handleSearch = (e) => {
        if (e) e.preventDefault()
        setAiResult(null)
        fetchDisorders(searchQuery)
    }

    const handleAISearch = async () => {
        if (!searchQuery) return
        try {
            setAiLoading(true)
            setAiResult(null)
            const response = await dsm5Service.aiSearch(searchQuery)
            setAiResult(response.data)
        } catch (err) {
            console.error('AI Search Error:', err)
            setError('AI Search failed. Please check your configuration.')
        } finally {
            setAiLoading(false)
        }
    }

    const toggleBookmark = async (disorderId) => {
        try {
            await dsm5Service.toggleBookmark(disorderId)
            fetchBookmarks()
        } catch (err) {
            console.error('Error toggling bookmark:', err)
        }
    }

    const recentSearches = []

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <button
                            onClick={() => navigate('/journals')}
                            className="flex items-center space-x-1.5 text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors mb-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>Back to Journals</span>
                        </button>
                        <h1 className="text-3xl font-bold text-slate-800 font-display">DSM-5 Reference</h1>
                        <p className="text-slate-500 mt-1">Comprehensive diagnostic criteria and AI-powered clinical insights</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <span>Search</span>
                        </button>
                        <button className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            <span>Bookmarks</span>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Search by disorder name, symptoms, or diagnostic code..."
                            className="w-full pl-4 pr-10 py-3 border-2 border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-slate-700"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center space-x-2 shadow-lg shadow-primary-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>Search</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleAISearch}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all flex items-center space-x-2 shadow-lg shadow-indigo-200 group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-primary-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        <svg className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>{aiLoading ? 'Analyzing...' : 'AI Insight'}</span>
                    </button>
                    <button type="button" className="p-3 bg-white border-2 border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </button>
                </form>

                {/* Categories */}
                <div className="flex flex-wrap gap-2 mt-6">
                    {categories.map(category => (
                        <button
                            key={category.name}
                            onClick={() => {
                                setActiveCategory(category.name)
                                setSearchQuery('')
                            }}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === category.name
                                ? 'bg-primary-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
                            <span className={`text-xs ml-1 ${activeCategory === category.name ? 'text-primary-100' : 'text-slate-400'}`}>
                                ({category.count})
                            </span>
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <div className="px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Main List - Left (3/4) */}
                    <div className="lg:col-span-3 space-y-6">
                        {aiResult && (
                            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-8 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="absolute top-0 right-0 p-4">
                                    <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full tracking-wider uppercase">AI Generated Insight</span>
                                </div>

                                <div className="mb-6">
                                    <h2 className="text-3xl font-bold text-slate-800 mb-1">{aiResult.name}</h2>
                                    <div className="flex items-center space-x-3">
                                        <span className="px-2 py-1 bg-indigo-200 text-indigo-700 text-xs font-bold rounded">
                                            {aiResult.code}
                                        </span>
                                        <span className="text-sm font-medium text-slate-500">{aiResult.category}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Diagnostic Symptoms</h3>
                                        <ul className="space-y-3">
                                            {aiResult.key_symptoms.map((symptom, idx) => (
                                                <li key={idx} className="flex items-start space-x-3 bg-white/50 p-3 rounded-lg border border-indigo-100 group hover:border-indigo-300 transition-colors">
                                                    <div className="mt-1 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                                        </svg>
                                                    </div>
                                                    <span className="text-sm text-slate-700 leading-relaxed">{symptom}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Clinical Notes</h3>
                                        <div className="bg-white/80 border border-indigo-100 rounded-xl p-4 text-sm text-slate-600 leading-relaxed shadow-sm">
                                            {aiResult.clinical_notes}
                                        </div>
                                        <div className="pt-4">
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Full Criteria</h3>
                                            <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-100 max-h-48 overflow-y-auto">
                                                {aiResult.full_criteria}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-indigo-100 flex justify-between items-center">
                                    <button className="text-indigo-600 font-bold text-sm hover:indigo-700 flex items-center space-x-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                        </svg>
                                        <span>Copy to Case Notes</span>
                                    </button>
                                    <button
                                        onClick={() => setAiResult(null)}
                                        className="text-slate-400 hover:text-slate-600 text-sm font-medium"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        )}

                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="animate-pulse bg-white rounded-xl border border-slate-200 p-6 h-64"></div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">
                                {error}
                            </div>
                        ) : disorders.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">No disorders found</h3>
                                <p className="text-slate-500">Try adjusting your search or category filters</p>
                            </div>
                        ) : (
                            disorders.map(disorder => (
                                <div key={disorder.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow group">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">{disorder.name}</h2>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded">
                                                    {disorder.code}
                                                </span>
                                                <span className="text-sm text-slate-500">{disorder.category}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleBookmark(disorder.id)}
                                            className={`${bookmarks.includes(disorder.id) ? 'text-primary-600' : 'text-slate-400'} hover:text-primary-600 transition-colors`}
                                        >
                                            <svg className="w-5 h-5" fill={bookmarks.includes(disorder.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <h3 className="text-sm font-bold text-slate-700">Key Symptoms</h3>
                                        <ul className="space-y-2">
                                            {Array.isArray(disorder.key_symptoms) ? disorder.key_symptoms.map((symptom, idx) => (
                                                <li key={idx} className="flex items-start space-x-2 text-sm text-slate-600">
                                                    <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span>{symptom}</span>
                                                </li>
                                            )) : (
                                                <li className="text-sm text-slate-500 italic">No symptoms listed</li>
                                            )}
                                        </ul>
                                        {disorder.moreSymptomsCount > 0 && (
                                            <button className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center space-x-1">
                                                <span>Show {disorder.moreSymptomsCount} more</span>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* <div className="pt-6 border-t border-slate-100 flex items-center">
                                        <button className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors flex items-center space-x-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span>Add to Notes</span>
                                        </button>
                                    </div> */}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Sidebar - Right (1/4) */}
                    <div className="space-y-6">
                        {/* Active Session Status */}
                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">No Active Session</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Start a patient session to receive AI-powered diagnostic suggestions based on conversation analysis
                            </p>
                        </div>

                        {/* Recent Searches */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Recent Searches</h3>
                                <button className="text-sm text-slate-400 hover:text-slate-600">Clear all</button>
                            </div>
                            <div className="space-y-2">
                                {recentSearches.map((search, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setSearchQuery(search)
                                            fetchDisorders(search)
                                        }}
                                        className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 rounded-lg group flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="text-sm text-slate-600 group-hover:text-slate-900">{search}</span>
                                        </div>
                                        <svg className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
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

export default DSM5Reference
