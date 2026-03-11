import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

const Layout = () => {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar />
            <Outlet />
        </div>
    )
}

export default Layout
