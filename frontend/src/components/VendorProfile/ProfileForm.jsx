import React, { useState } from 'react'
import api from '../../services/api'
import { Loader2, Download, AlertCircle } from 'lucide-react'

const ProfileForm = () => {
    const [formData, setFormData] = useState({
        clientName: '',
        vendorName: '',
        dealDescription: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await api.post('/vendor/generate', formData)
            setSuccess({
                message: 'Profile generated successfully!',
                downloadUrl: response.data.downloadUrl,
                cached: response.data.cached,
                updatedAt: response.data.updatedAt
            })
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred while generating the profile.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto py-8">
            <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Generate Vendor Profile
                    </h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500">
                        <p>Enter the vendor details below to generate a comprehensive research profile.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-5 space-y-6">
                        <div>
                            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
                                Client Name
                            </label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    name="clientName"
                                    id="clientName"
                                    required
                                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                    placeholder="e.g. Acme Corp"
                                    value={formData.clientName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="vendorName" className="block text-sm font-medium text-gray-700">
                                Vendor Name
                            </label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    name="vendorName"
                                    id="vendorName"
                                    required
                                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                    placeholder="e.g. Microsoft"
                                    value={formData.vendorName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="dealDescription" className="block text-sm font-medium text-gray-700">
                                Deal Description (Optional)
                            </label>
                            <div className="mt-1">
                                <textarea
                                    id="dealDescription"
                                    name="dealDescription"
                                    rows={3}
                                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                    placeholder="Details about the negotiation..."
                                    value={formData.dealDescription}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                            >
                                {loading && <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />}
                                {loading ? 'Generating Profile...' : 'Generate Profile'}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="mt-4 rounded-md bg-red-50 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                                    <div className="mt-2 text-sm text-red-700">
                                        <p>{error}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="mt-4 rounded-md bg-green-50 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <Download className="h-5 w-5 text-green-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-green-800">Success!</h3>
                                    <div className="mt-2 text-sm text-green-700">
                                        <p>{success.message}</p>
                                        {success.cached && (
                                            <p className="mt-1 text-xs text-green-600">
                                                Using cached data from {new Date(success.updatedAt).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                    <div className="mt-4">
                                        <div className="-mx-2 -my-1.5 flex">
                                            <a
                                                href={success.downloadUrl}
                                                download
                                                className="bg-green-50 px-2 py-1.5 rounded-md text-sm font-medium text-green-800 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600"
                                            >
                                                Download Document
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ProfileForm
