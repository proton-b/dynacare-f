import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Appointments from './components/Appointments'
import PatientProfile from './components/PatientProfile'
import SessionNotes from './components/SessionNotes'
import SessionRecording from './components/SessionRecording'
import DSM5Reference from './components/DSM5Reference'
import Settings from './components/Settings'
import Journals from './components/Journals'
import './dashboard.css'

import { AuthProvider } from './context/AuthContext'
import Login from './components/Login'
import Signup from './components/Signup'

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="appointments" element={<Appointments />} />
                        {/* Add more routes as needed */}
                        <Route path="patients" element={<PatientProfile />} />
                        <Route path="notes" element={<SessionNotes />} />
                        <Route path="recording" element={<SessionRecording />} />
                        <Route path="journals" element={<Journals />} />
                        <Route path="journals/dsm-5" element={<DSM5Reference />} />
                        <Route path="settings" element={<Settings />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App
