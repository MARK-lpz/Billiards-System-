import { useState } from 'react'
import Login from './Pages/login'
import Dashboard from './Pages/dashboard'
import EmployeeDashboard from './Pages/Employeedashboard'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState(null) // 'admin' or 'employee'

  const handleLogin = (role) => {
    if (!role) return // guard: don't login if no role returned
    setUserRole(role.toLowerCase())
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserRole(null)
    localStorage.removeItem('authToken') // ✅ clear token on logout
    localStorage.removeItem('user')       // ✅ clear user on logout
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />
  }

  // Route based on role
  if (userRole === 'admin') {
    return <Dashboard onLogout={handleLogout} />
  }

  if (userRole === 'employee') {
    return <EmployeeDashboard onLogout={handleLogout} />
  }

  // Fallback: unknown role
  return <Login onLogin={handleLogin} />
}

export default App