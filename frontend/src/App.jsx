import { useState } from 'react'
import Login from './Pages/login'
import Dashboard from './Pages/dashboard'
import EmployeeDashboard from './Pages/Employeedashboard'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState(null) // 'admin' or 'employee'

  const handleLogin = (role) => {
    setUserRole(role)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserRole(null)
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />
  }

  // Route based on role
  return userRole === 'admin' 
    ? <Dashboard onLogout={handleLogout} />
    : <EmployeeDashboard onLogout={handleLogout} />
}

export default App