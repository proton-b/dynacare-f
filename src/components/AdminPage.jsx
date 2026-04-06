import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '../services/api'
import logo from '../assets/logo.png'

const AdminPage = () => {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('overview')
    const [stats, setStats] = useState({ totalDoctors: 0, totalPatients: 0, totalAppointments: 0 })
    const [doctors, setDoctors] = useState([])
    const [patients, setPatients] = useState([])
    const [doctorPatientCounts, setDoctorPatientCounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createType, setCreateType] = useState('doctor') // 'doctor' or 'admin'
    const [createForm, setCreateForm] = useState({
        full_name: '', email: '', password: '', practice_name: '',
        specialization: '', license_number: '', phone_number: ''
    })
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')
    const [createSuccess, setCreateSuccess] = useState('')
    const [searchDoctor, setSearchDoctor] = useState('')
    const [searchPatient, setSearchPatient] = useState('')
    const [journals, setJournals] = useState([])
    const [journalAssignments, setJournalAssignments] = useState([])
    const [assignForm, setAssignForm] = useState({ user_id: '', journal_id: '' })
    const [assigning, setAssigning] = useState(false)
    const [assignMsg, setAssignMsg] = useState({ type: '', text: '' })
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [passwordDoctor, setPasswordDoctor] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [updatingPassword, setUpdatingPassword] = useState(false)

    const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [statsRes, doctorsRes, patientsRes, countsRes, journalsRes, assignmentsRes] = await Promise.all([
                adminService.getStats(),
                adminService.getDoctors(),
                adminService.getPatients(),
                adminService.getDoctorPatientCounts(),
                adminService.getJournals(),
                adminService.getJournalAssignments(),
            ])
            setStats(statsRes.data)
            setDoctors(doctorsRes.data)
            setPatients(patientsRes.data)
            setDoctorPatientCounts(countsRes.data)
            setJournals(journalsRes.data)
            setJournalAssignments(assignmentsRes.data)
        } catch (err) {
            console.error('Error fetching admin data:', err)
            if (err.response?.status === 401 || err.response?.status === 403) {
                handleLogout()
            }
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminUser')
        navigate('/admin-login')
    }

    const handleAssignJournal = async (e) => {
        e.preventDefault()
        if (!assignForm.user_id || !assignForm.journal_id) return
        setAssigning(true)
        setAssignMsg({ type: '', text: '' })
        try {
            await adminService.assignJournal(assignForm.user_id, assignForm.journal_id)
            setAssignMsg({ type: 'success', text: 'Journal access granted!' })
            setAssignForm({ user_id: '', journal_id: '' })
            const res = await adminService.getJournalAssignments()
            setJournalAssignments(res.data)
        } catch (err) {
            setAssignMsg({ type: 'error', text: err.response?.data?.message || 'Failed to assign journal' })
        } finally {
            setAssigning(false)
        }
    }

    const handleRevokeJournal = async (userId, journalId, userName, journalName) => {
        if (!confirm(`Revoke "${journalName}" access from ${userName}?`)) return
        try {
            await adminService.revokeJournal(userId, journalId)
            const res = await adminService.getJournalAssignments()
            setJournalAssignments(res.data)
        } catch (err) {
            console.error('Error revoking journal:', err)
        }
    }

    const openCreateModal = (type) => {
        setCreateType(type)
        setCreateForm({
            full_name: '', email: '', password: '', practice_name: '',
            specialization: '', license_number: '', phone_number: ''
        })
        setCreateError('')
        setCreateSuccess('')
        setShowCreateModal(true)
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        setCreating(true)
        setCreateError('')
        setCreateSuccess('')
        try {
            if (createType === 'admin') {
                await adminService.createAdmin({
                    full_name: createForm.full_name,
                    email: createForm.email,
                    password: createForm.password,
                })
                setCreateSuccess('Admin credentials created successfully!')
            } else {
                await adminService.createDoctor(createForm)
                setCreateSuccess('Doctor credentials created successfully!')
            }
            setCreateForm({
                full_name: '', email: '', password: '', practice_name: '',
                specialization: '', license_number: '', phone_number: ''
            })
            fetchData()
            setTimeout(() => {
                setShowCreateModal(false)
                setCreateSuccess('')
            }, 2000)
        } catch (err) {
            setCreateError(err.response?.data?.message || `Failed to create ${createType} credentials`)
        } finally {
            setCreating(false)
        }
    }

    const openPasswordModal = (doctor) => {
        setPasswordDoctor(doctor)
        setNewPassword('')
        setPasswordError('')
        setPasswordSuccess('')
        setShowPasswordModal(true)
    }

    const handleUpdatePassword = async (e) => {
        e.preventDefault()
        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters')
            return
        }
        setUpdatingPassword(true)
        setPasswordError('')
        setPasswordSuccess('')
        try {
            await adminService.updateDoctorPassword(passwordDoctor.id, newPassword)
            setPasswordSuccess('Password updated successfully!')
            setTimeout(() => {
                setShowPasswordModal(false)
                setPasswordSuccess('')
            }, 1500)
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'Failed to update password')
        } finally {
            setUpdatingPassword(false)
        }
    }

    const filteredDoctors = doctors.filter(d =>
        d.full_name.toLowerCase().includes(searchDoctor.toLowerCase()) ||
        d.email.toLowerCase().includes(searchDoctor.toLowerCase()) ||
        (d.specialization || '').toLowerCase().includes(searchDoctor.toLowerCase())
    )

    const filteredPatients = patients.filter(p =>
        p.full_name.toLowerCase().includes(searchPatient.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(searchPatient.toLowerCase()) ||
        (p.phone || '').includes(searchPatient)
    )

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'doctors', label: 'Doctors' },
        { id: 'patients', label: 'Patients' },
        { id: 'assignments', label: 'Doctor-Patient Stats' },
        { id: 'journals', label: 'Journal Access' },
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-slate-500">Loading admin panel...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Navigation Bar */}
            <div className="bg-slate-800 text-white px-8 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <img src={logo} alt="DynaCare Logo" className="w-32 h-auto object-contain brightness-0 invert" />
                    <span className="bg-white/20 text-white text-xs font-medium px-3 py-1 rounded-full">Admin Portal</span>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-sm text-slate-300">
                        {adminUser.full_name || adminUser.email || 'Admin'}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-1.5 text-sm text-slate-300 hover:text-white transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1>
                        <p className="text-slate-500 mt-1">Manage doctors, patients, and credentials</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => openCreateModal('admin')}
                            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span>Create Admin</span>
                        </button>
                        <button
                            onClick={() => openCreateModal('doctor')}
                            className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Create Doctor</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 mt-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="px-8 py-6">
                {activeTab === 'overview' && (
                    <div>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Total Doctors</p>
                                        <p className="text-2xl font-bold text-slate-800">{stats.totalDoctors}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Total Patients</p>
                                        <p className="text-2xl font-bold text-slate-800">{stats.totalPatients}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Total Appointments</p>
                                        <p className="text-2xl font-bold text-slate-800">{stats.totalAppointments}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Doctor-Patient Summary */}
                        <div className="bg-white rounded-xl border border-slate-200">
                            <div className="px-6 py-4 border-b border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-800">Patients per Doctor</h2>
                            </div>
                            <div className="p-6">
                                {doctorPatientCounts.length === 0 ? (
                                    <p className="text-slate-400 text-center py-4">No data available</p>
                                ) : (
                                    <div className="space-y-4">
                                        {doctorPatientCounts.map(doc => (
                                            <div key={doc.id} className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                        <span className="text-primary-700 font-semibold text-sm">
                                                            {doc.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800">{doc.full_name}</p>
                                                        <p className="text-sm text-slate-500">{doc.specialization || 'General'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-2xl font-bold text-slate-700">{doc.patient_count}</span>
                                                    <span className="text-sm text-slate-400">patients</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'doctors' && (
                    <div className="bg-white rounded-xl border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800">All Doctors ({doctors.length})</h2>
                            <div className="relative">
                                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search doctors..."
                                    value={searchDoctor}
                                    onChange={(e) => setSearchDoctor(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Specialization</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Practice</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">License #</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDoctors.map(doc => (
                                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                                        <span className="text-primary-700 font-semibold text-xs">
                                                            {doc.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium text-slate-800">{doc.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{doc.email}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                                    {doc.specialization || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{doc.practice_name || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{doc.license_number || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{doc.phone_number || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(doc.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => openPasswordModal(doc)}
                                                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                                    <span>Edit Password</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredDoctors.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                                                No doctors found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'patients' && (
                    <div className="bg-white rounded-xl border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800">All Patients ({patients.length})</h2>
                            <div className="relative">
                                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search patients..."
                                    value={searchPatient}
                                    onChange={(e) => setSearchPatient(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Gender</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned Doctor</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPatients.map(patient => (
                                        <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                        <span className="text-green-700 font-semibold text-xs">
                                                            {patient.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium text-slate-800">{patient.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{patient.email || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{patient.phone || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{patient.gender || '—'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                                    patient.status === 'Active'
                                                        ? 'bg-green-50 text-green-700'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {patient.status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{patient.assigned_doctor || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(patient.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredPatients.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                                                No patients found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'assignments' && (
                    <div className="bg-white rounded-xl border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-800">Patients per Doctor</h2>
                            <p className="text-sm text-slate-500 mt-1">Based on appointment history</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Doctor</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Specialization</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Patient Count</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Distribution</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {doctorPatientCounts.map(doc => {
                                        const maxCount = Math.max(...doctorPatientCounts.map(d => parseInt(d.patient_count) || 0), 1)
                                        const percentage = ((parseInt(doc.patient_count) || 0) / maxCount) * 100
                                        return (
                                            <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                                            <span className="text-primary-700 font-semibold text-xs">
                                                                {doc.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <span className="font-medium text-slate-800">{doc.full_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                                        {doc.specialization || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-semibold text-slate-800">{doc.patient_count}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary-500 rounded-full transition-all"
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {doctorPatientCounts.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                                                No data available
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'journals' && (
                    <div className="space-y-6">
                        {/* Assign Journal Form */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">Assign Journal to Doctor</h2>
                            {assignMsg.text && (
                                <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
                                    assignMsg.type === 'success'
                                        ? 'bg-green-50 border border-green-200 text-green-700'
                                        : 'bg-red-50 border border-red-200 text-red-700'
                                }`}>
                                    {assignMsg.text}
                                </div>
                            )}
                            <form onSubmit={handleAssignJournal} className="flex items-end space-x-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Doctor</label>
                                    <select
                                        value={assignForm.user_id}
                                        onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Choose a doctor...</option>
                                        {doctors.map(d => (
                                            <option key={d.id} value={d.id}>{d.full_name} ({d.email})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Journal</label>
                                    <select
                                        value={assignForm.journal_id}
                                        onChange={(e) => setAssignForm({ ...assignForm, journal_id: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Choose a journal...</option>
                                        {journals.map(j => (
                                            <option key={j.id} value={j.id}>{j.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={assigning}
                                    className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {assigning ? 'Assigning...' : 'Grant Access'}
                                </button>
                            </form>
                        </div>

                        {/* Available Journals */}
                        <div className="bg-white rounded-xl border border-slate-200">
                            <div className="px-6 py-4 border-b border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-800">Available Journals ({journals.length})</h2>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {journals.map(j => (
                                    <div key={j.id} className="border border-slate-200 rounded-lg p-4">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">{j.name}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">For: {j.target_audience || 'All'}</p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {journalAssignments.filter(a => a.journal_id === j.id).length} doctor(s) assigned
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {journals.length === 0 && (
                                    <p className="text-slate-400 col-span-full text-center py-4">No journals found</p>
                                )}
                            </div>
                        </div>

                        {/* Current Assignments */}
                        <div className="bg-white rounded-xl border border-slate-200">
                            <div className="px-6 py-4 border-b border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-800">Current Access Assignments ({journalAssignments.length})</h2>
                                <p className="text-sm text-slate-500 mt-1">Which doctors have access to which journals</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Doctor</th>
                                            <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                            <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Journal</th>
                                            <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned On</th>
                                            <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {journalAssignments.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                                            <span className="text-primary-700 font-semibold text-xs">
                                                                {a.user_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <span className="font-medium text-slate-800">{a.user_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">{a.user_email}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                                                        {a.journal_name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500">
                                                    {new Date(a.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleRevokeJournal(a.user_id, a.journal_id, a.user_name, a.journal_name)}
                                                        className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        Revoke
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {journalAssignments.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                                                    No journal assignments yet
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Credentials Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <h3 className="text-lg font-semibold text-slate-800">
                                    Create {createType === 'admin' ? 'Admin' : 'Doctor'} Credentials
                                </h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    createType === 'admin'
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-primary-100 text-primary-700'
                                }`}>
                                    {createType === 'admin' ? 'Admin' : 'Doctor'}
                                </span>
                            </div>
                            <button
                                onClick={() => { setShowCreateModal(false); setCreateError(''); setCreateSuccess('') }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            {createError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                    {createError}
                                </div>
                            )}
                            {createSuccess && (
                                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                                    {createSuccess}
                                </div>
                            )}

                            {/* Type Switcher */}
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setCreateType('doctor')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                                        createType === 'doctor'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Doctor (User)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreateType('admin')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                                        createType === 'admin'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Admin
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={createForm.full_name}
                                    onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder={createType === 'admin' ? 'Admin Name' : 'Dr. John Smith'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder={createType === 'admin' ? 'admin@dynacare.com' : 'doctor@example.com'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="Minimum 6 characters"
                                />
                            </div>

                            {/* Doctor-specific fields */}
                            {createType === 'doctor' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Practice Name</label>
                                            <input
                                                type="text"
                                                value={createForm.practice_name}
                                                onChange={(e) => setCreateForm({ ...createForm, practice_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="Clinic name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
                                            <select
                                                value={createForm.specialization}
                                                onChange={(e) => setCreateForm({ ...createForm, specialization: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            >
                                                <option value="">Select...</option>
                                                <option value="Psychiatry">Psychiatry</option>
                                                <option value="Clinical Psychology">Clinical Psychology</option>
                                                <option value="Counseling Psychology">Counseling Psychology</option>
                                                <option value="General Practice">General Practice</option>
                                                <option value="Neurology">Neurology</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">License Number</label>
                                            <input
                                                type="text"
                                                value={createForm.license_number}
                                                onChange={(e) => setCreateForm({ ...createForm, license_number: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="LIC-XXXXX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                            <input
                                                type="text"
                                                value={createForm.phone_number}
                                                onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="+1 (555) 000-0000"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowCreateModal(false); setCreateError(''); setCreateSuccess('') }}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className={`px-5 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                                        createType === 'admin'
                                            ? 'bg-slate-800 hover:bg-slate-900'
                                            : 'bg-primary-600 hover:bg-primary-700'
                                    }`}
                                >
                                    {creating ? 'Creating...' : `Create ${createType === 'admin' ? 'Admin' : 'Doctor'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Password Modal */}
            {showPasswordModal && passwordDoctor && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Edit Password</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{passwordDoctor.full_name} ({passwordDoctor.email})</p>
                            </div>
                            <button
                                onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess('') }}
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
                            {passwordError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{passwordError}</div>
                            )}
                            {passwordSuccess && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{passwordSuccess}</div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 6 characters"
                                    required
                                    minLength={6}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess('') }}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatingPassword}
                                    className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                                >
                                    {updatingPassword ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminPage
