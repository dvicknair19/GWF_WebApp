import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Loader2, RefreshCw, Download, Search } from 'lucide-react'

const ProfileHistory = () => {
    const [profiles, setProfiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [regeneratingId, setRegeneratingId] = useState(null)

    useEffect(() => {
        fetchHistory()
    }, [])

    const fetchHistory = async () => {
        try {
            const response = await api.get('/profiles')
            setProfiles(response.data)
        } catch (err) {
            setError('Failed to load history')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleRegenerate = async (profile) => {
        setRegeneratingId(profile.id)
        try {
            const response = await api.post('/vendor/generate', {
                clientName: profile.client_name,
                vendorName: profile.vendor_name,
                dealDescription: profile.deal_description,
                forceRegenerate: true
            })
            // Trigger download with auth
            const path = response.data.downloadUrl.replace(/^\/api/, '')
            const fileResponse = await api.get(path, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([fileResponse.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `${profile.client_name}_${profile.vendor_name}_MOA.docx`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (err) {
            alert('Failed to regenerate document')
        } finally {
            setRegeneratingId(null)
        }
    }

    const filteredProfiles = profiles.filter(profile =>
        profile.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-xl font-semibold text-gray-900">Profile History</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        A list of all generated vendor profiles including client, vendor, and date created.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                    <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                            placeholder="Search profiles..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="mt-4 bg-red-50 p-4 rounded-md text-red-700">
                    {error}
                </div>
            )}

            <div className="mt-8 flex flex-col">
                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Client</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Vendor</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created By</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {filteredProfiles.map((profile) => (
                                        <tr key={profile.id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                {profile.client_name}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{profile.vendor_name}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{profile.user_email || 'Unknown'}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {new Date(profile.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                <button
                                                    onClick={() => handleRegenerate(profile)}
                                                    disabled={regeneratingId === profile.id}
                                                    className="text-blue-600 hover:text-blue-900 disabled:opacity-50 inline-flex items-center"
                                                >
                                                    {regeneratingId === profile.id ? (
                                                        <Loader2 className="animate-spin h-4 w-4 mr-1" />
                                                    ) : (
                                                        <RefreshCw className="h-4 w-4 mr-1" />
                                                    )}
                                                    Regenerate
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredProfiles.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="5" className="px-3 py-8 text-center text-sm text-gray-500">
                                                No profiles found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ProfileHistory
