import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const SetPassword = () => {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const { setUserPassword } = useAuth()
    const navigate = useNavigate()

    const validate = () => {
        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return false
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return false
        }
        return true
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        if (!validate()) return

        setLoading(true)
        try {
            await setUserPassword(password)
            setSuccess(true)
            // Clear the invite hash so App.jsx stops rendering SetPassword,
            // then navigate to / which will now show ProfileForm
            setTimeout(() => {
                window.location.replace('/') // Forces full reload and clears hash
            }, 2000)
        } catch (err) {
            setError(err.message || 'Failed to set password. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
                <h2 className="mb-2 text-3xl font-bold text-center text-gray-800">Welcome!</h2>
                <p className="mb-6 text-sm text-center text-gray-500">
                    Set a password to complete your account setup.
                </p>

                {error && (
                    <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
                        {error}
                    </div>
                )}

                {success ? (
                    <div className="p-3 text-sm text-green-700 bg-green-100 rounded-lg" role="alert">
                        Password set successfully! Redirecting you to the app...
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="password">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    className="w-full px-3 py-2 leading-tight text-gray-700 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Min. 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 px-3 text-sm text-gray-500 hover:text-gray-700"
                                    onClick={() => setShowPassword((v) => !v)}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block mb-2 text-sm font-bold text-gray-700" htmlFor="confirmPassword">
                                Confirm Password
                            </label>
                            <input
                                className="w-full px-3 py-2 leading-tight text-gray-700 border rounded shadow appearance-none focus:outline-none focus:shadow-outline"
                                id="confirmPassword"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Re-enter your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            className={`w-full px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Setting Password...' : 'Set Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

export default SetPassword
