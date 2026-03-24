import { useState } from 'react'
import Login from './Pages/login'
import Dashboard from './Pages/Admin/AdminDashboard'
import EmployeeDashboard from './Pages/Employee/Employeedashboard'
import TournamentQR from './Pages/Guest/tournament-qr'
import TournamentForm from './Pages/Guest/billiards-form'
import LoadingBar from './Elements/Global/Loading'
import './styles/Modal.css'
import { NotificationProvider } from './Elements/Global/NotifContext'

function App() {
  const [currentView, setCurrentView] = useState('login')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(false)

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
        <Dashboard onLogout={handleLogout} />
      )}

      {isLoggedIn && userRole === 'employee' && (
        <EmployeeDashboard onLogout={handleLogout} />
      )}
    </NotificationProvider>
  )
}

export default App