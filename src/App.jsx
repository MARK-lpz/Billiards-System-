import { useState, useEffect } from 'react'
import Login from './Pages/login'
import Dashboard from './Pages/Admin/AdminDashboard'
import EmployeeDashboard from './Pages/Employee/Employeedashboard'
import TournamentQR from './Pages/Guest/tournament-qr'
import TournamentForm from './Pages/Guest/billiards-form'
import LoadingBar from './Elements/Global/Loading'
import './styles/Modal.css'
import './styles/globalTheme.css'
import './styles/globalThemeAdmin.css'
import './styles/globalThemeEmployee.css'
import { NotificationProvider } from './Elements/Global/NotifContext'
import { initialReservations } from './utils/reservations'
import { createAuditEntry, normalizeAuditLogs } from './utils/audit'

const initialTables = [
  { id: 1, name: 'Table 1', rate: 15, status: 'available', startTime: null, customer: '' },
  { id: 2, name: 'Table 2', rate: 15, status: 'occupied', startTime: Date.now() - 2700000, customer: 'John Doe' },
  { id: 3, name: 'Table 3', rate: 15, status: 'available', startTime: null, customer: '' },
  { id: 4, name: 'Table 4', rate: 15, status: 'reserved', startTime: null, customer: '' },
  { id: 5, name: 'Table 5', rate: 15, status: 'available', startTime: null, customer: '' },
  { id: 6, name: 'Table 6', rate: 15, status: 'occupied', startTime: Date.now() - 4800000, customer: '' },
  { id: 7, name: 'Table 7', rate: 15, status: 'available', startTime: null, customer: '' },
  { id: 8, name: 'Table 8', rate: 15, status: 'available', startTime: null, customer: '' },
  { id: 9, name: 'Table 9', rate: 15, status: 'occupied', startTime: Date.now() - 1800000, customer: '' },
  { id: 10, name: 'Table 10', rate: 15, status: 'available', startTime: null, customer: '' },
  { id: 11, name: 'Table 11', rate: 15, status: 'reserved', startTime: null, customer: '' },
  { id: 12, name: 'Table 12', rate: 15, status: 'available', startTime: null, customer: '' },
]

const initialProducts = [
  { id: 1, name: "Coca Cola", category: "Beverage", price: 25, stock: 50, minStock: 10, unit: "pcs" },
  { id: 2, name: "Chips", category: "Food", price: 15, stock: 30, minStock: 10, unit: "pcs" },
  { id: 3, name: "Cue Chalk", category: "Equipment", price: 50, stock: 20, minStock: 5, unit: "pcs" },
]

const initialTransactions = []
const initialCustomers = []
const initialEvents = []
const legacyEventIds = new Set([101, 102])

const sanitizeEvents = (events) =>
  Array.isArray(events) ? events.filter((event) => !legacyEventIds.has(event?.id)) : initialEvents
function App() {
  const [currentView, setCurrentView] = useState('login')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(false)

  const [tables, setTables] = useState(() => {
    try {
      const stored = localStorage.getItem('poolTables')
      return stored ? JSON.parse(stored) : initialTables
    } catch {
      return initialTables
    }
  })

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  const [logs, setLogs] = useState(() => {
    const initialLogs = [
      createAuditEntry({ id: 1, timestamp: '2026-04-19T14:32:05+08:00', type: 'auth', staff: 'Admin', action: 'logged in', detail: 'Successful login from 192.168.1.1', entity: 'session' }),
      { id: 2, time: '14:35:12', type: 'sale', staff: 'Staff A', action: 'processed sale', detail: 'Transaction #12345 - ₱150.00' },
    ]
    try {
      const stored = localStorage.getItem('activityLogs')
      return stored ? JSON.parse(stored) : initialLogs
    } catch {
      return initialLogs
    }
  })

  const [products, setProducts] = useState(() => {
    try {
      const stored = localStorage.getItem('products')
      return stored ? JSON.parse(stored) : initialProducts
    } catch {
      return initialProducts
    }
  })

  const [transactions, setTransactions] = useState(() => {
    try {
      const stored = localStorage.getItem('transactions')
      return stored ? JSON.parse(stored) : initialTransactions
    } catch {
      return initialTransactions
    }
  })

  const [events, setEvents] = useState(() => {
    try {
      const stored = localStorage.getItem('events')
      return stored ? sanitizeEvents(JSON.parse(stored)) : initialEvents
    } catch {
      return initialEvents
    }
  })

  const [reservations, setReservations] = useState(() => {
    try {
      const stored = localStorage.getItem('reservations')
      return stored ? JSON.parse(stored) : initialReservations
    } catch {
      return initialReservations
    }
  })

  // 👇 added
  const [customers, setCustomers] = useState(() => {
    try {
      const stored = localStorage.getItem('customers')
      return stored ? JSON.parse(stored) : initialCustomers
    } catch {
      return initialCustomers
    }
  })

  useEffect(() => {
    try { localStorage.setItem('poolTables', JSON.stringify(tables)) }
    catch (error) { console.warn('Unable to persist pool tables', error) }
  }, [tables])

  useEffect(() => {
    try { localStorage.setItem('activityLogs', JSON.stringify(logs)) }
    catch (error) { console.warn('Unable to persist activity logs', error) }
  }, [logs])

  useEffect(() => {
    try { localStorage.setItem('products', JSON.stringify(products)) }
    catch (error) { console.warn('Unable to persist products', error) }
  }, [products])

  useEffect(() => {
    try { localStorage.setItem('transactions', JSON.stringify(transactions)) }
    catch (error) { console.warn('Unable to persist transactions', error) }
  }, [transactions])

  useEffect(() => {
    try { localStorage.setItem('reservations', JSON.stringify(reservations)) }
    catch (error) { console.warn('Unable to persist reservations', error) }
  }, [reservations])

  useEffect(() => {
    try { localStorage.setItem('events', JSON.stringify(sanitizeEvents(events))) }
    catch (error) { console.warn('Unable to persist events', error) }
  }, [events])

  useEffect(() => {
    try { localStorage.setItem('theme', theme) }
    catch (error) { console.warn('Unable to persist theme', error) }
  }, [theme])


  useEffect(() => {
    try { localStorage.setItem('customers', JSON.stringify(customers)) }
    catch (error) { console.warn('Unable to persist customers', error) }
  }, [customers])

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'poolTables') {
        try {
          const newTables = JSON.parse(e.newValue)
          setTables(newTables)
        } catch (error) {
          console.warn('Failed to parse poolTables from storage', error)
        }
      }

      if (e.key === 'events') {
        try {
          const nextEvents = e.newValue ? sanitizeEvents(JSON.parse(e.newValue)) : initialEvents
          setEvents(nextEvents)
        } catch (error) {
          console.warn('Failed to parse events from storage', error)
        }
      }

      if (e.key === 'reservations') {
        try {
          const nextReservations = e.newValue ? JSON.parse(e.newValue) : initialReservations
          setReservations(nextReservations)
        } catch (error) {
          console.warn('Failed to parse reservations from storage', error)
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleReload = () => {
    setLoading(true)

    try {
      const stored = localStorage.getItem('poolTables')
      if (stored) setTables(JSON.parse(stored))
    } catch (error) { console.warn('Unable to reload pool tables', error) }

    try {
      const stored = localStorage.getItem('activityLogs')
      if (stored) setLogs(JSON.parse(stored))
    } catch (error) { console.warn('Unable to reload activity logs', error) }

    try {
      const stored = localStorage.getItem('products')
      if (stored) setProducts(JSON.parse(stored))
    } catch (error) { console.warn('Unable to reload products', error) }

    try {
      const stored = localStorage.getItem('transactions')
      if (stored) setTransactions(JSON.parse(stored))
    } catch (error) { console.warn('Unable to reload transactions', error) }

    try {
      const stored = localStorage.getItem('reservations')
      if (stored) setReservations(JSON.parse(stored))
    } catch (error) { console.warn('Unable to reload reservations', error) }

    try {
      const stored = localStorage.getItem('events')
      if (stored) setEvents(sanitizeEvents(JSON.parse(stored)))
    } catch (error) { console.warn('Unable to reload events', error) }


    try {
      const stored = localStorage.getItem('customers')
      if (stored) setCustomers(JSON.parse(stored))
    } catch (error) { console.warn('Unable to reload customers', error) }

    setTimeout(() => setLoading(false), 300)
  }

  const handleLogin = (role) => {
    if (!role) return
    setLoading(true)
    setTimeout(() => {
      setUserRole(role.toLowerCase())
      setIsLoggedIn(true)
      setLoading(false)
    }, 500)
  }

  const handleLogout = () => {
    setLoading(true)
    setTimeout(() => {
      setIsLoggedIn(false)
      setUserRole(null)
      setCurrentView('login')
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      setLoading(false)
    }, 300)
  }

  const navigateTo = (view) => {
    setLoading(true)
    setTimeout(() => {
      setCurrentView(view)
      setLoading(false)
    }, 300)
  }

  return (
    <NotificationProvider>
      <div className={theme}>
        <LoadingBar loading={loading} />

        {currentView === 'login' && !isLoggedIn && (
          <Login onLogin={handleLogin} onGoToRegister={() => navigateTo('qr')} />
        )}

        {currentView === 'qr' && (
          <TournamentQR
            onNavigateToForm={() => navigateTo('form')}
            onBackToLogin={() => navigateTo('login')}
          />
        )}

        {currentView === 'form' && (
          <TournamentForm onGoBack={() => navigateTo('qr')} events={events} setEvents={setEvents} />
        )}

        {isLoggedIn && userRole === 'admin' && (
          <Dashboard
            onLogout={handleLogout}
            onReload={handleReload}
            tables={tables}
            setTables={setTables}
            logs={logs}
            setLogs={setLogs}
            products={products}
            setProducts={setProducts}
            transactions={transactions}
            setTransactions={setTransactions}
            reservations={reservations}
            setReservations={setReservations}
            events={events}
            setEvents={setEvents}
            theme={theme}
            setTheme={setTheme}
          />
        )}

        {isLoggedIn && userRole === 'employee' && (
          <EmployeeDashboard
            onLogout={handleLogout}
            onReload={handleReload}
            tables={tables}
            setTables={setTables}
            setLogs={setLogs}
            products={products}
            setProducts={setProducts}
            transactions={transactions}
            setTransactions={setTransactions}
            reservations={reservations}
            setReservations={setReservations}
            events={events}
            theme={theme}
            setTheme={setTheme}
            customers={customers}        
            setCustomers={setCustomers}  
          />
        )}
      </div>
    </NotificationProvider>
  )
}

export default App
