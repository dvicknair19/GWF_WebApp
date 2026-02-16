import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Login from './components/Auth/Login'
import SetPassword from './components/Auth/SetPassword'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import Layout from './components/Layout/Layout'
import ProfileForm from './components/VendorProfile/ProfileForm'
import ProfileHistory from './components/VendorProfile/ProfileHistory'

const isInviteFlow = () => {
  const params = new URLSearchParams(window.location.hash.replace('#', ''))
  return params.get('type') === 'invite'
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={isInviteFlow() ? <SetPassword /> : <ProfileForm />} />
            <Route path="/history" element={<ProfileHistory />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
