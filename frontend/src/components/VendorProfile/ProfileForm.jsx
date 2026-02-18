import { useState } from 'react'
import api from '../../services/api'
import { Loader2, Download, AlertCircle } from 'lucide-react'
import ReviewModal from './ReviewModal'

const ProfileForm = () => {
    const [formData, setFormData] = useState({
        clientName: '',
        vendorName: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [forceRegenerate, setForceRegenerate] = useState(false)
    const [reviewData, setReviewData] = useState(null)
    const [newsResults, setNewsResults] = useState(null)
    const [cacheUsed, setCacheUsed] = useState(false)

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const triggerDownload = (blob, filename) => {
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await api.post('/vendor/research', { ...formData, forceRegenerate })
            setReviewData(response.data.researchData)
            setNewsResults(response.data.newsResults)
            setCacheUsed(response.data.cached ?? false)
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred while researching the vendor.')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await api.post(
                '/vendor/generate',
                { clientName: formData.clientName, vendorName: formData.vendorName, researchData: reviewData, newsResults, cacheUsed },
                { responseType: 'blob' }
            )
            const _date = new Date()
            const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const _monthAbbr = _months[_date.getMonth()]
            const _year = _date.getFullYear()
            triggerDownload(
                new Blob([response.data]),
                `GWFMOA_${formData.clientName}_${formData.vendorName}_${_monthAbbr},${_year}.docx`
            )
            setReviewData(null)
            setSuccess({ message: 'Profile generated and downloaded successfully!' })
        } catch (err) {
            setReviewData(null)
            let errorMsg = 'An error occurred while generating the document.'
            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text()
                    errorMsg = JSON.parse(text).error || errorMsg
                } catch { }
            } else {
                errorMsg = err.response?.data?.error || errorMsg
            }
            setError(errorMsg)
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        setReviewData(null)
    }

    return (
        <>
            {reviewData && (
                <ReviewModal
                    data={reviewData}
                    news={newsResults}
                    loading={loading}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
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

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={forceRegenerate}
                                        onChange={(e) => setForceRegenerate(e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    Force Regenerate (bypass cache)
                                </label>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                                >
                                    {loading && <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />}
                                    {loading ? 'Researching...' : 'Generate Profile'}
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
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default ProfileForm
