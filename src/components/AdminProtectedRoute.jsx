import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

const AdminProtectedRoute = ({ children }) => {
    const location = useLocation()
    const adminToken = localStorage.getItem('adminToken')
    const adminUser = localStorage.getItem('adminUser')

    if (!adminToken || !adminUser) {
        return <Navigate to="/admin-login" state={{ from: location }} replace />
    }

    return children
}

export default AdminProtectedRoute
