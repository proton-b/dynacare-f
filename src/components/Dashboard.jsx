import React from 'react'
import Header from './Header'
import StatsCards from './StatsCards'
import TodaysSchedule from './TodaysSchedule'
import RecentActivity from './RecentActivity'

const Dashboard = () => {
    return (
        <div className="flex-1 overflow-y-auto bg-slate-50">
            {/* Header */}
            <Header />

            {/* Content */}
            <div className="px-8 py-6">
                {/* Stats Cards */}
                <StatsCards />

                {/* Today's Schedule */}
                <div className="mt-8">
                    <TodaysSchedule />
                </div>

                {/* Recent Activity */}
                <div className="mt-8">
                    <RecentActivity />
                </div>
            </div>
        </div>
    )
}

export default Dashboard
