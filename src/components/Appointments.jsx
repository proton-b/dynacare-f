import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentService } from '../services/api'
import ScheduleAppointmentModal from './modals/ScheduleAppointmentModal'

const Appointments = () => {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState('week') // 'week' or 'month'
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false)
  const [appointments, setAppointments] = useState([])
  const [filterModal, setFilterModal] = useState(null) // null, 'today', 'week', or 'month'
  const [stats, setStats] = useState([
    { label: 'Today', value: 0, key: 'today', color: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'This Week', value: 0, key: 'week', color: 'bg-green-50', iconColor: 'text-green-600' },
    { label: 'This Month', value: 0, key: 'month', color: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  ])

  const statIcons = {
    today: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    week: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    month: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  const fetchAppointments = async () => {
    try {
      const response = await appointmentService.getAll()
      setAppointments(response.data)
    } catch (err) {
      console.error('Error fetching appointments:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await appointmentService.getStats()
      const data = response.data
      setStats([
        { label: 'Today', value: data.today, key: 'today', color: 'bg-blue-50', iconColor: 'text-blue-600' },
        { label: 'This Week', value: data.week, key: 'week', color: 'bg-green-50', iconColor: 'text-green-600' },
        { label: 'This Month', value: data.month, key: 'month', color: 'bg-emerald-50', iconColor: 'text-emerald-600' },
      ])
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  useEffect(() => {
    fetchAppointments()
    fetchStats()
  }, [])

  // Generate week days for calendar
  const getWeekDays = () => {
    const days = []
    const startOfWeek = new Date(currentDate)
    const dayOfWeek = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust to Monday

    startOfWeek.setDate(diff)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push(date)
    }
    return days
  }

  const weekDays = getWeekDays()
  const timeSlots = []
  for (let h = 7; h <= 20; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`)
    timeSlots.push(`${String(h).padStart(2, '0')}:30`)
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(newDate)
    setFilterModal(null)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setFilterModal(null)
  }

  const handleScheduleResult = (result) => {
    console.log('Appointment Scheduled:', result)
    fetchAppointments()
    fetchStats()
    setIsAppointmentModalOpen(false)
  }

  // Parse appointment date as local time (strip trailing Z to avoid UTC conversion)
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date()
    const str = typeof dateStr === 'string' ? dateStr.replace('Z', '') : dateStr
    return new Date(str)
  }

  // Get appointments for a specific day and 30-min time slot
  const getAppointmentsForSlot = (day, timeSlot) => {
    const [slotHour, slotMin] = timeSlot.split(':').map(Number)
    return appointments.filter(appt => {
      const apptDate = parseLocalDate(appt.appointment_date)
      if (
        apptDate.getFullYear() !== day.getFullYear() ||
        apptDate.getMonth() !== day.getMonth() ||
        apptDate.getDate() !== day.getDate()
      ) return false
      const apptHour = apptDate.getHours()
      const apptMin = apptDate.getMinutes()
      // Round appointment minute down to nearest 30-min block
      const roundedMin = apptMin < 30 ? 0 : 30
      return apptHour === slotHour && roundedMin === slotMin
    })
  }

  // Get today's appointments for sidebar
  const todayAppointments = appointments
    .filter(appt => {
      const apptDate = parseLocalDate(appt.appointment_date)
      const today = new Date()
      return (
        apptDate.getFullYear() === today.getFullYear() &&
        apptDate.getMonth() === today.getMonth() &&
        apptDate.getDate() === today.getDate()
      )
    })
    .sort((a, b) => parseLocalDate(a.appointment_date) - parseLocalDate(b.appointment_date))

  const statusColors = {
    'Scheduled': 'bg-blue-100 border-blue-300 text-blue-800',
    'Completed': 'bg-green-100 border-green-300 text-green-800',
    'Cancelled': 'bg-red-100 border-red-300 text-red-800',
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 font-display">Appointment Scheduling</h1>
            <p className="text-slate-500 mt-1">Manage your psychiatric practice calendar and patient appointments</p>
          </div>
          {/* <button className="flex items-center space-x-2 bg-slate-50 rounded-full py-2 px-4 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Select Contact</span>
          </button> */}
        </div>
      </header>

      {/* Content */}
      <div className="px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              onClick={() => setFilterModal(stat.key)}
              className={`bg-white rounded-xl p-5 border transition-all cursor-pointer hover:shadow-md hover:border-blue-300 ${filterModal === stat.key ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
                </div>
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center ${stat.iconColor}`}>
                  {statIcons[stat.key]}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Calendar Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Main View */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-bold text-slate-800">{formatDate(currentDate)}</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigateWeek('prev')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={goToToday}
                    className="px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => navigateWeek('next')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* View Toggle */}
                {/* <div className="flex bg-slate-100 rounded-lg p-1"> */}
                {/*     <button */}
                {/*         onClick={() => setView('week')} */}
                {/*         className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'week' */}
                {/*             ? 'bg-primary-600 text-white' */}
                {/*             : 'text-slate-600 hover:text-slate-900' */}
                {/*             }`} */}
                {/*     > */}
                {/*         Week */}
                {/*     </button> */}
                {/*     <button */}
                {/*         onClick={() => setView('month')} */}
                {/*         className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'month' */}
                {/*             ? 'bg-primary-600 text-white' */}
                {/*             : 'text-slate-600 hover:text-slate-900' */}
                {/*             }`} */}
                {/*     > */}
                {/*         Month */}
                {/*     </button> */}
                {/* </div> */}

                {/* New Appointment Button */}
                <button
                  onClick={() => setIsAppointmentModalOpen(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New Appointment</span>
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {/* Week Days Header */}
              <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
                <div className="p-3"></div>
                {weekDays.map((day, index) => (
                  <div key={index} className="p-3 text-center border-l border-slate-200">
                    <div className="text-xs font-medium text-slate-500">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-bold mt-1 ${day.toDateString() === new Date().toDateString()
                      ? 'text-primary-600'
                      : 'text-slate-800'
                      }`}>
                      {day.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              <div className="max-h-[500px] overflow-y-auto">
                {timeSlots.map((time, timeIndex) => (
                  <div key={timeIndex} className="grid grid-cols-8 border-b border-slate-200 hover:bg-slate-50">
                    <div className="p-3 text-sm font-medium text-slate-500 border-r border-slate-200">
                      {time}
                    </div>
                    {weekDays.map((day, dayIndex) => {
                      const slotAppointments = getAppointmentsForSlot(day, time)
                      return (
                        <div
                          key={dayIndex}
                          className="p-1 border-l border-slate-200 min-h-[60px] cursor-pointer hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setIsAppointmentModalOpen(true)
                          }}
                        >
                          {slotAppointments.map(appt => {
                            const apptTime = parseLocalDate(appt.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                            return (
                              <div
                                key={appt.id}
                                className={`text-xs p-1.5 rounded border mb-1 truncate ${statusColors[appt.status] || 'bg-blue-100 border-blue-300 text-blue-800'}`}
                                onClick={(e) => e.stopPropagation()}
                                title={`${appt.patient_name} - ${apptTime} - ${appt.type || 'Appointment'}`}
                              >
                                <div className="font-semibold truncate">{appt.patient_name}</div>
                                <div className="truncate opacity-75">{apptTime}</div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's Appointments Sidebar */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Today's Appointments</h3>

            {todayAppointments.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">No appointments scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map(appt => {
                  const apptDate = parseLocalDate(appt.appointment_date)
                  const timeStr = apptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                  return (
                    <div
                      key={appt.id}
                      onClick={() => navigate(`/patients?patientId=${appt.patient_id}`)}
                      className="p-4 rounded-lg border border-slate-200 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-800">{appt.patient_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[appt.status] || 'bg-blue-100 text-blue-800'}`}>
                          {appt.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{timeStr}</span>
                        <span className="text-slate-300">|</span>
                        <span>{appt.duration || 60} min</span>
                      </div>
                      {appt.type && (
                        <div className="mt-2 text-xs text-slate-500">{appt.type}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filtered Appointments Modal */}
      {filterModal && (() => {
        const now = new Date()
        const modalTitles = {
          today: "Today's Appointments",
          week: "This Week's Appointments",
          month: "This Month's Appointments",
        }

        const filtered = appointments.filter(appt => {
          const apptDate = parseLocalDate(appt.appointment_date)
          if (filterModal === 'today') {
            return (
              apptDate.getFullYear() === now.getFullYear() &&
              apptDate.getMonth() === now.getMonth() &&
              apptDate.getDate() === now.getDate()
            )
          }
          if (filterModal === 'week') {
            const startOfWeek = new Date(now)
            const day = startOfWeek.getDay()
            const diff = day === 0 ? -6 : 1 - day
            startOfWeek.setDate(startOfWeek.getDate() + diff)
            startOfWeek.setHours(0, 0, 0, 0)
            const endOfWeek = new Date(startOfWeek)
            endOfWeek.setDate(startOfWeek.getDate() + 7)
            return apptDate >= startOfWeek && apptDate < endOfWeek
          }
          if (filterModal === 'month') {
            return (
              apptDate.getFullYear() === now.getFullYear() &&
              apptDate.getMonth() === now.getMonth()
            )
          }
          return false
        }).sort((a, b) => parseLocalDate(a.appointment_date) - parseLocalDate(b.appointment_date))

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{modalTitles[filterModal]}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{filtered.length} appointment{filtered.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setFilterModal(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 text-sm">No appointments found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map(appt => {
                      const apptDate = parseLocalDate(appt.appointment_date)
                      const timeStr = apptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                      const dateStr = apptDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      return (
                        <div key={appt.id} className="p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-slate-800">{appt.patient_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[appt.status] || 'bg-blue-100 text-blue-800'}`}>
                              {appt.status}
                            </span>
                          </div>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center space-x-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{dateStr}</span>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="flex items-center space-x-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{timeStr}</span>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span>{appt.duration || 60} min</span>
                          </div>
                          {appt.type && (
                            <div className="mt-2 text-xs font-medium text-slate-500 bg-slate-50 inline-block px-2 py-0.5 rounded">{appt.type}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Appointment Modal */}
      <ScheduleAppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        onAppointmentScheduled={handleScheduleResult}
        selectedDate={currentDate}
      />
    </div>
  )
}

export default Appointments
