import { useState } from 'react'
import Login from './Pages/login'
import Dashboard from './Pages/dashboard'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  return isLoggedIn
    ? <Dashboard onLogout={() => setIsLoggedIn(false)} />
    : <Login onLogin={() => setIsLoggedIn(true)} />
}

export default App