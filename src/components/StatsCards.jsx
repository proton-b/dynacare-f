import React, { useState, useEffect } from 'react'
import { analyticsService } from '../services/api'

const StatsCards = () => {
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('month');

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await analyticsService.getStats(range);
            setStatsData(response.data);
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [range]);

    const stats = [
        {
            title: 'Total Patients',
            value: statsData?.totalPatients || '0',
            change: '-1%',
            isNegative: true,
            icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            ),
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-600'
        },
        {
            title: range === 'today' ? "Today's Appointments" :
                range === 'week' ? "This Week's Appointments" :
                    range === 'month' ? "This Month's Appointments" :
                        range === '3months' ? "Last 3 Months' Appointments" : "Appointments",
            value: statsData?.sessionsCount || '0',
            change: '0',
            isNegative: false,
            icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            ),
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-600'
        },
        {
            title: 'Active Treatments',
            value: statsData?.activeTreatments || '0',
            change: '0',
            isNegative: false,
            icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            ),
            bgColor: 'bg-green-50',
            iconColor: 'text-green-600'
        },
        {
            title: 'Recovery Rate',
            value: `${statsData?.recoveryRate || '0'}%`,
            change: '+2%',
            isNegative: false,
            icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            ),
            bgColor: 'bg-orange-50',
            iconColor: 'text-orange-600'
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Quick Statistics</h2>
                <div className="relative inline-block text-left">
                    <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        className="block w-full pl-3 pr-10 py-2 text-base border-slate-200 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl bg-white shadow-sm font-semibold text-slate-700"
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="3months">Last 3 Months</option>
                        <option value="year">This Year</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-slate-200 rounded-2xl"></div>)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1 group-hover:text-slate-600 transition-colors uppercase tracking-wider">{stat.title}</p>
                                    <h3 className="text-3xl font-extrabold text-slate-800">{stat.value}</h3>
                                </div>
                                <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                                    <svg className={`w-6 h-6 ${stat.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {stat.icon}
                                    </svg>
                                </div>
                            </div>
                            <div className="flex items-center text-sm">
                                <span className={`flex items-center px-2 py-1 rounded-full ${stat.isNegative ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} font-bold`}>
                                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.isNegative ? "M19 14l-7 7m0 0l-7-7m7 7V3" : "M5 10l7-7m0 0l7 7m-7-7v18"} />
                                    </svg>
                                    {stat.change}
                                </span>
                                <span className="text-slate-400 ml-2 font-medium">vs last month</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default StatsCards

