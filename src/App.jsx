import { useState, useEffect } from 'react'
import Login from './Pages/login'
import Dashboard from './Pages/Admin/AdminDashboard'
import EmployeeDashboard from './Pages/Employee/Employeedashboard'
import TournamentQR from './Pages/Guest/tournament-qr'
import TournamentForm from './Pages/Guest/billiards-form'
import OnlineReservationForm from './Pages/Guest/OnlineReservationForm'
import GuestLanding from './Pages/Guest/GuestLanding'
import LoadingBar from './Elements/Global/Loading'
import './styles/Modal.css'
import './styles/globalTheme.css'
import './styles/globalThemeAdmin.css'
import './styles/globalThemeEmployee.css'
import { NotificationProvider } from './Elements/Global/NotifContext'
import { initialReservations } from './utils/reservations'
import { fetchRemoteReservations } from './utils/reservationApi'
import { createAuditEntry, normalizeAuditLogs } from './utils/audit'

const initialTables = [
  { id: 1, name: 'Table 1', rate: 15, status: 'available', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 2, name: 'Table 2', rate: 15, status: 'occupied', startTime: Date.now() - 2700000, customer: 'John Doe', durationMinutes: 60, addedMinutes: 30 },
  { id: 3, name: 'Table 3', rate: 15, status: 'available', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 4, name: 'Table 4', rate: 15, status: 'reserved', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 5, name: 'Table 5', rate: 15, status: 'available', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 6, name: 'Table 6', rate: 15, status: 'occupied', startTime: Date.now() - 4800000, customer: '', durationMinutes: 90, addedMinutes: 0 },
  { id: 7, name: 'Table 7', rate: 15, status: 'available', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 8, name: 'Table 8', rate: 15, status: 'available', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 9, name: 'Table 9', rate: 15, status: 'occupied', startTime: Date.now() - 1800000, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 10, name: 'Table 10', rate: 15, status: 'available', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 11, name: 'Table 11', rate: 15, status: 'reserved', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
  { id: 12, name: 'Table 12', rate: 15, status: 'available', startTime: null, customer: '', durationMinutes: 60, addedMinutes: 0 },
]

const initialProducts = [
  { id: 1, sku: "DRK-COCA-001", name: "Coca Cola", category: "Beverage", supplier: "Local Beverage Supplier", location: "Chiller A", expiryDate: "2026-12-31", price: 25, stock: 50, minStock: 10, unit: "pcs" },
  { id: 2, sku: "FOD-CHIP-001", name: "Chips", category: "Food", supplier: "Snack Distributor", location: "Shelf B2", expiryDate: "2026-10-15", price: 15, stock: 30, minStock: 10, unit: "pcs" },
  { id: 3, sku: "EQP-CHALK-001", name: "Cue Chalk", category: "Equipment", supplier: "Billiards Supply", location: "Counter Drawer", expiryDate: "", price: 50, stock: 20, minStock: 5, unit: "pcs" },
]

const initialTransactions = []
const initialCustomers = []
const initialEvents = []
const legacyEventIds = new Set([101, 102])
const PUBLIC_ROUTES = {
  guest: "/",
}

const getPublicView = () => "guest"

const sanitizeEvents = (events) =>
  Array.isArray(events) ? events.filter((event) => !legacyEventIds.has(event?.id)) : initialEvents
function App() {
  const isStaffApp = typeof window !== "undefined" && window.location.hostname === "app.breakandchill.com"
  const [currentView, setCurrentView] = useState(() => (
    isStaffApp ? "login" : getPublicView(window.location.pathname)
  ))
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
    const activeReservationIds = new Set(
      reservations
        .filter((reservation) => ["approved", "reserved", "arrived", "seated"].includes(reservation.status))
        .map((reservation) => String(reservation.id))
    )

    setTables((currentTables) => {
      let changed = false
      const nextTables = currentTables.map((table) => {
        if (
          table.status !== "reserved" ||
          !table.reservationId ||
          activeReservationIds.has(String(table.reservationId))
        ) {
          return table
        }

        changed = true
        return {
          ...table,
          status: "available",
          startTime: null,
          customer: "",
          reservationId: null,
          reservationDate: "",
          reservationTime: "",
        }
      })

      return changed ? nextTables : currentTables
    })
  }, [reservations])

  useEffect(() => {
    let cancelled = false

    const syncReservations = async () => {
      try {
        const remoteReservations = await fetchRemoteReservations()
        if (cancelled) return

        setReservations((current) => {
          const remoteById = new Map(remoteReservations.map((reservation) => [String(reservation.id), reservation]))
          const merged = current.map((reservation) => remoteById.get(String(reservation.id)) || reservation)
          const localIds = new Set(current.map((reservation) => String(reservation.id)))
          const next = [...remoteReservations.filter((reservation) => !localIds.has(String(reservation.id))), ...merged]
          return JSON.stringify(next) === JSON.stringify(current) ? current : next
        })
      } catch (error) {
        console.warn('Unable to sync shared reservations', error)
      }
    }

    syncReservations()
    const interval = setInterval(syncReservations, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

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
    const expectedPath = isStaffApp ? "/login" : PUBLIC_ROUTES[currentView]
    if (expectedPath && window.location.pathname !== expectedPath) {
      window.history.replaceState({}, "", expectedPath)
    }

    const handlePopState = () => {
      setCurrentView(isStaffApp ? "login" : getPublicView(window.location.pathname))
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [currentView, isStaffApp])

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
      setCurrentView(isStaffApp ? "login" : "guest")
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      setLoading(false)
    }, 300)
  }

  const navigateTo = (view) => {
    setLoading(true)
    setTimeout(() => {
      const nextPath = isStaffApp ? "/login" : PUBLIC_ROUTES[view]
      if (nextPath && window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath)
      }
      setCurrentView(view)
      setLoading(false)
    }, 300)
  }

  return (
    <NotificationProvider
      canReceiveAdminNotifications={isLoggedIn && userRole === 'admin'}
      canReceiveEmployeeNotifications={isLoggedIn && userRole === 'employee'}
    >
      <div className={theme}>
        <LoadingBar loading={loading} />

        {isStaffApp && currentView === 'login' && !isLoggedIn && (
          <Login onLogin={handleLogin} />
        )}

        {!isStaffApp && currentView === 'guest' && (
          <GuestLanding
            onOpenReservation={() => navigateTo('reservation')}
            onOpenTournamentForm={() => navigateTo('form')}
          />
        )}

        {!isStaffApp && currentView === 'reservation' && (
          <OnlineReservationForm
            tables={tables}
            reservations={reservations}
            setReservations={setReservations}
            onGoBack={() => navigateTo('guest')}
          />
        )}

        {!isStaffApp && currentView === 'qr' && (
          <TournamentQR
            onNavigateToForm={() => navigateTo('form')}
            onBackToLogin={() => navigateTo('guest')}
          />
        )}

        {!isStaffApp && currentView === 'form' && (
          <TournamentForm onGoBack={() => navigateTo('guest')} events={events} setEvents={setEvents} />
        )}

        {isStaffApp && isLoggedIn && userRole === 'admin' && (
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

        {isStaffApp && isLoggedIn && userRole === 'employee' && (
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
