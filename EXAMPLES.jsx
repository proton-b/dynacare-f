// Example: How to make components data-driven with props and state

// ============================================
// 1. STATSCARD WITH PROPS
// ============================================

// StatsCard.jsx (Single card component)
import React from 'react'

const StatCard = ({ title, value, change, isNegative, icon, bgColor, iconColor }) => {
    return (
        <div className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-sm text-slate-500 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
                </div>
                <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center`}>
                    <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {icon}
                    </svg>
                </div>
            </div>
            <div className="flex items-center text-sm">
                <span className={`flex items-center ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    {change}
                </span>
                <span className="text-slate-400 ml-2">vs last month</span>
            </div>
        </div>
    )
}

// ============================================
// 2. DASHBOARD WITH STATE
// ============================================

import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import StatCard from './components/StatCard'

const Dashboard = () => {
    // State for dashboard data
    const [stats, setStats] = useState({
        totalPatients: 3,
        todaysAppointments: 0,
        activeTreatments: 3,
        recentSessions: 3
    })

    const [user, setUser] = useState({
        name: 'Dr. Anderson',
        profile: {
            name: 'Dr. Sarah Smith',
            role: 'Psychologist',
            initials: 'DS'
        }
    })

    const [activities, setActivities] = useState([])

    // Fetch data on component mount
    useEffect(() => {
        // Example API call
        // fetchDashboardData()
        //   .then(data => setStats(data.stats))
        //   .catch(error => console.error(error))
    }, [])

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <Header user={user} />

                <div className="px-8 py-6">
                    {/* Pass stats as props */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Total Patients"
                            value={stats.totalPatients}
                            change="-1%"
                            isNegative={true}
                            bgColor="bg-blue-50"
                            iconColor="text-blue-600"
                            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />}
                        />
                        {/* More cards... */}
                    </div>
                </div>
            </main>
        </div>
    )
}

// ============================================
// 3. HEADER WITH PROPS
// ============================================

const Header = ({ user }) => {
    return (
        <header className="bg-white border-b border-slate-200 px-8 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 font-display">
                        Welcome Back, {user.name}
                    </h1>
                    <p className="text-slate-500 mt-1">Here's your practical overview for today</p>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-3 bg-slate-50 rounded-full py-2 px-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
                            {user.profile.initials}
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-700">{user.profile.name}</div>
                            <div className="text-xs text-slate-500">{user.profile.role}</div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}

// ============================================
// 4. ACTIVITY WITH ADD FUNCTIONALITY
// ============================================

const RecentActivity = () => {
    const [activities, setActivities] = useState([
        {
            title: 'Session completed with John Doe',
            subtitle: 'Treatment plan updated',
            time: '1 hour ago',
            type: 'success'
        }
    ])

    const addActivity = (newActivity) => {
        setActivities([newActivity, ...activities])
    }

    const handleNewPatient = () => {
        const newActivity = {
            title: 'New patient added',
            subtitle: 'Initial consultation scheduled',
            time: 'Just now',
            type: 'success'
        }
        addActivity(newActivity)
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
                <button onClick={handleNewPatient} className="btn-primary">
                    New Patient
                </button>
            </div>

            <div className="space-y-4">
                {activities.map((activity, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg">
                        <div className="flex-1">
                            <p className="text-sm font-medium">{activity.title}</p>
                            <p className="text-xs text-slate-500">{activity.subtitle}</p>
                        </div>
                        <span className="text-xs text-slate-400">{activity.time}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ============================================
// 5. USING CONTEXT FOR GLOBAL STATE
// ============================================

import React, { createContext, useContext, useState } from 'react'

// Create context
const DashboardContext = createContext()

// Provider component
export const DashboardProvider = ({ children }) => {
    const [dashboardData, setDashboardData] = useState({
        stats: {},
        appointments: [],
        patients: []
    })

    const updateStats = (newStats) => {
        setDashboardData(prev => ({
            ...prev,
            stats: { ...prev.stats, ...newStats }
        }))
    }

    return (
        <DashboardContext.Provider value={{ dashboardData, updateStats }}>
            {children}
        </DashboardContext.Provider>
    )
}

// Custom hook to use dashboard context
export const useDashboard = () => {
    const context = useContext(DashboardContext)
    if (!context) {
        throw new Error('useDashboard must be used within DashboardProvider')
    }
    return context
}

// Usage in App.jsx
import { DashboardProvider } from './context/DashboardContext'

function App() {
    return (
        <DashboardProvider>
            <Dashboard />
        </DashboardProvider>
    )
}

// ============================================
// 6. API INTEGRATION EXAMPLE
// ============================================

// api/dashboard.js
export const fetchDashboardStats = async () => {
    const response = await fetch('/api/dashboard/stats')
    if (!response.ok) throw new Error('Failed to fetch stats')
    return response.json()
}

export const fetchAppointments = async () => {
    const response = await fetch('/api/appointments')
    if (!response.ok) throw new Error('Failed to fetch appointments')
    return response.json()
}

// Usage in component
import { fetchDashboardStats } from '../api/dashboard'

const Dashboard = () => {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadStats = async () => {
            try {
                setLoading(true)
                const data = await fetchDashboardStats()
                setStats(data)
            } catch (err) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        loadStats()
    }, [])

    if (loading) return <div>Loading...</div>
    if (error) return <div>Error: {error}</div>

    return (
        <div>
            {/* Render dashboard with data */}
        </div>
    )
}

export default Dashboard
