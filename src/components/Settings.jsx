import React, { useState } from 'react'

const Settings = () => {
    const [activeTab, setActiveTab] = useState('Practice Information')

    const tabs = [
        'Practice Information',
        'Session Recording',
        'AI Integration',
        'Privacy & Security',
        'Notifications'
    ]

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Practice Information':
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col">
                            <h3 className="text-xl font-bold text-slate-800">Practice Information</h3>
                            <p className="text-slate-500 text-sm mt-1">Update your practice details and professional information</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Full Name</label>
                                <input type="text" placeholder="Dr. Enter Name" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Practice Name</label>
                                <input type="text" placeholder="Enter Practice Name" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Specialization</label>
                                <input type="text" placeholder="e.g. Clinical Psychology" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">License Number</label>
                                <input type="text" placeholder="Enter License Number" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                                <input type="text" placeholder="Enter Phone Number" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Email</label>
                                <div className="space-y-1">
                                    <input type="email" defaultValue="dr.smith@mindcare.com" disabled className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed" />
                                    <p className="text-xs text-slate-400">Email cannot be changed</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 'Session Recording':
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                Session Recording Preferences
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">Configure audio recording and transcription settings</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-slate-800">Enable Session Recording</h4>
                                    <p className="text-sm text-slate-500">Record patient sessions for analysis</p>
                                </div>
                                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
                                    <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Audio Quality</label>
                                <div className="relative">
                                    <select className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all appearance-none cursor-pointer">
                                        <option>Standard (128 kbps)</option>
                                        <option>High (256 kbps)</option>
                                        <option>Ultra (320 kbps)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-slate-800">Automatic Transcription</h4>
                                    <p className="text-sm text-slate-500">Transcribe audio automatically</p>
                                </div>
                                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
                                    <span className="translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    Transcription Language
                                </label>
                                <div className="relative">
                                    <select className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all appearance-none cursor-pointer">
                                        <option>English</option>
                                        <option>Spanish</option>
                                        <option>French</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 'AI Integration':
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col">
                            <h3 className="text-xl font-bold text-slate-800">AI Integration</h3>
                            <p className="text-slate-500 text-sm mt-1">Configure OpenAI Whisper API and DSM-5 keyword detection</p>
                        </div>
                        <div className="space-y-4">
                            <div className="p-6 bg-primary-50 border border-primary-100 rounded-xl space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-400 rounded-full flex items-center justify-center text-white shrink-0">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">OpenAI Whisper API Status</h4>
                                        <p className="text-sm text-slate-500">API key needs to be configured for transcription services</p>
                                    </div>
                                </div>
                                <button className="btn-primary w-fit">Test API Connection</button>
                            </div>
                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-slate-800">DSM-5 Keyword Detection</h4>
                                    <p className="text-sm text-slate-500">Detect diagnostic keywords during sessions</p>
                                </div>
                                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
                                    <span className="translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Detection Sensitivity</label>
                                <div className="relative">
                                    <select className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all appearance-none cursor-pointer">
                                        <option>Medium - Standard detection</option>
                                        <option>Low - Reduced sensitivity</option>
                                        <option>High - Aggressive detection</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 'Privacy & Security':
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Privacy & Security
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">Manage data retention and patient consent settings</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    Data Retention Period (days)
                                </label>
                                <input type="number" defaultValue="90" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all" />
                                <p className="text-xs text-slate-400">Session data will be automatically deleted after this period (30-365 days)</p>
                            </div>
                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-slate-800">Require Patient Consent</h4>
                                    <p className="text-sm text-slate-500">Get explicit consent before AI analysis</p>
                                </div>
                                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
                                    <span className="translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                                </div>
                            </div>
                            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
                                <h4 className="text-sm font-bold text-yellow-800 mb-1 leading-relaxed">HIPAA Compliance Notice</h4>
                                <p className="text-sm text-yellow-700 leading-relaxed">
                                    All session recordings and transcriptions are encrypted and stored in compliance with HIPAA regulations. Patient data is never shared with third parties without explicit consent.
                                </p>
                            </div>
                        </div>
                    </div>
                )
            case 'Notifications':
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                Notification Preferences
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">Choose how you want to receive notifications</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-slate-800">Email Alerts</h4>
                                    <p className="text-sm text-slate-500">Receive email notifications for important events</p>
                                </div>
                                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
                                    <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-slate-800">Appointment Reminders</h4>
                                    <p className="text-sm text-slate-500">Get reminders for upcoming appointments</p>
                                </div>
                                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
                                    <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-slate-800">Diagnostic Insights</h4>
                                    <p className="text-sm text-slate-500">Receive AI-generated diagnostic insights</p>
                                </div>
                                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
                                    <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Tab Navigation */}
                <div className="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab
                                ? 'bg-primary-50 text-primary-600 shadow-sm'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                    <div className="p-8 md:p-12 min-h-[500px]">
                        {renderTabContent()}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                        <button className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export Settings
                        </button>
                        <button className="px-8 py-3 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-all flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Save Changes
                        </button>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-xs text-slate-400">© 2026 DynaCare Pro - All rights reserved</p>
                </div>
            </div>
        </div>
    )
}

export default Settings
