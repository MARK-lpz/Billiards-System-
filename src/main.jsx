import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { installStorageFallback } from './utils/safeStorage.js'
import { isStaffHost } from './utils/siteAddress'

// Has to run before App renders, because App reads storage during render.
installStorageFallback()

// The staff app is kept out of search results (public/.htaccess sends the same
// as a header); its login is what keeps it private.
if (isStaffHost(window.location.hostname)) {
  const robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex, nofollow'
  document.head.append(robots)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
