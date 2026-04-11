import { useState, useEffect } from 'react'
import Login from './Pages/login'
import Dashboard from './Pages/Admin/AdminDashboard'
import EmployeeDashboard from './Pages/Employee/Employeedashboard'
import TournamentQR from './Pages/Guest/tournament-qr'
import TournamentForm from './Pages/Guest/billiards-form'
import LoadingBar from './Elements/Global/Loading'
import './styles/Modal.css'
import './styles/globalTheme.css'
import { NotificationProvider } from './Elements/Global/NotifContext'

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

function App() {
  const [currentView, setCurrentView] = useState('login')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tables, setTables] = useState(() => {
    try {
      const stored = localStorage.getItem('poolTables')
      return stored ? JSON.parse(stored) : initialTables
    } catch (error) {
      return initialTables
    }
  })

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  const [logs, setLogs] = useState(() => {
    const initialLogs = [
      { id: 1, time: '14:32:05', type: 'auth', staff: 'Admin', action: 'logged in', detail: 'Successful login from 192.168.1.1' },
      { id: 2, time: '14:35:12', type: 'sale', staff: 'Staff A', action: 'processed sale', detail: 'Transaction #12345 - ₱150.00' },
    ]
    try {
      const stored = localStorage.getItem('activityLogs')
      return stored ? JSON.parse(stored) : initialLogs
    } catch (error) {
      return initialLogs
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('poolTables', JSON.stringify(tables))
    } catch (error) {
      console.warn('Unable to persist pool tables', error)
    }
  }, [tables])

  useEffect(() => {
    try {
      localStorage.setItem('activityLogs', JSON.stringify(logs))
    } catch (error) {
      console.warn('Unable to persist activity logs', error)
    }
  }, [logs])

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch (error) {
      console.warn('Unable to persist theme', error)
    }
  }, [theme])

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'poolTables') {
        try {
          const newTables = JSON.parse(e.newValue);
          setTables(newTables);
        } catch (error) {
          console.warn('Failed to parse poolTables from storage', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [])

  const handleReload = () => {
    setLoading(true)

    try {
      const storedTables = localStorage.getItem('poolTables')
      if (storedTables) {
        setTables(JSON.parse(storedTables))
      }
    } catch (error) {
      console.warn('Unable to reload pool tables from storage', error)
    }

    try {
      const storedLogs = localStorage.getItem('activityLogs')
      if (storedLogs) {
        setLogs(JSON.parse(storedLogs))
      }
    } catch (error) {
      console.warn('Unable to reload activity logs from storage', error)
    }

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
          <TournamentForm onGoBack={() => navigateTo('qr')} />
        )}

        {isLoggedIn && userRole === 'admin' && (
          <Dashboard onLogout={handleLogout} onReload={handleReload} tables={tables} setTables={setTables} logs={logs} theme={theme} setTheme={setTheme} />
        )}

        {isLoggedIn && userRole === 'employee' && (
          <EmployeeDashboard onLogout={handleLogout} onReload={handleReload} tables={tables} setTables={setTables} setLogs={setLogs} theme={theme} setTheme={setTheme} />
        )}
      </div>
    </NotificationProvider>
  )
}

export default App