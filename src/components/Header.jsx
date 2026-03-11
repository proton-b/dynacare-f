import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Header = () => {
    const { user, logout } = useAuth();

    // Get display name (supports both 'name' and 'full_name' from backend)
    const displayName = user?.full_name || user?.name || 'Guest';
    const firstName = displayName.split(' ')[0] || 'Guest';
    const initials = displayName.split(' ').map(n => n?.[0] || '').join('').substring(0, 2).toUpperCase() || 'U';

    return (
        <header className="bg-white border-b border-slate-200 px-8 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 font-display">
                        Welcome Back, {firstName}
                    </h1>
                    <p className="text-slate-500 mt-1">Here's your practical overview for today</p>
                </div>
                <div className="flex items-center space-x-3">
                    {user ? (
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-3 bg-slate-50 rounded-full py-2 px-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
                                    {initials}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-700">{displayName}</div>
                                    <div className="text-xs text-slate-500">{user.role || 'Professional'}</div>
                                </div>
                            </div>
                            <button
                                onClick={logout}
                                className="text-sm text-slate-500 hover:text-red-500 font-medium px-3 py-2"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-3">
                            <Link to="/login" className="px-4 py-2 text-primary-600 font-bold hover:bg-primary-50 rounded-lg transition-colors">
                                Login
                            </Link>
                            <Link to="/signup" className="btn-primary px-4 py-2 text-sm">
                                Sign Up
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}

export default Header
