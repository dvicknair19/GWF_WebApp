import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const Field = ({ label, value }) => (
    <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || '—'}</dd>
    </div>
)

const EditableField = ({ label, value, onChange, multiline = false, confidence }) => (
    <div>
        <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {label}
            </label>
            {confidence !== undefined && confidence !== null && (
                <span className={`text-xs font-medium ${confidence >= 80 ? 'text-green-600' : confidence >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {confidence}% confidence
                </span>
            )}
        </div>
        {multiline ? (
            <textarea
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                className="mt-1 w-full text-sm text-gray-900 border border-gray-300 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        ) : (
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full text-sm text-gray-900 border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        )}
    </div>
)

const ReviewModal = ({ data, news, loading, onConfirm, onCancel }) => {
    // Extract confidence scores
    const confidence = data.confidence || {}

    // Initialize editable state from props
    const [editedData, setEditedData] = useState({
        company_type: data.company_type || '',
        estimated_annual_revenue: data.estimated_annual_revenue || '',
        employees: data.employees || '',
        fiscal_year_end: data.fiscal_year_end || '',
        competitors_core: Array.isArray(data.competitors_core)
            ? data.competitors_core.join(', ')
            : data.competitors_core || '',
        vendor_profile_paragraph: data.vendor_profile_paragraph || ''
    })

    const handleFieldChange = (field, value) => {
        setEditedData(prev => ({ ...prev, [field]: value }))
    }

    const handleConfirm = () => {
        // Convert competitors back to array if needed
        const finalData = {
            ...data,
            ...editedData,
            competitors_core: editedData.competitors_core
                ? editedData.competitors_core.split(',').map(c => c.trim()).filter(Boolean)
                : []
        }
        onConfirm(finalData)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onCancel}
            />

            {/* Modal card */}
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-xl flex flex-col max-h-[90vh]">
                <div className="px-6 py-5 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Review Research Results</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Confirm the details below before generating the report.
                    </p>
                </div>

                <div className="overflow-y-auto px-6 py-5 space-y-5">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                        <Field label="Matched Company" value={data.matched_vendor_name} />
                        <EditableField
                            label="Company Type"
                            value={editedData.company_type}
                            onChange={(val) => handleFieldChange('company_type', val)}
                            confidence={confidence.company_type}
                        />
                        <EditableField
                            label="Revenue"
                            value={editedData.estimated_annual_revenue}
                            onChange={(val) => handleFieldChange('estimated_annual_revenue', val)}
                            confidence={confidence.estimated_annual_revenue}
                        />
                        <EditableField
                            label="Employees"
                            value={editedData.employees}
                            onChange={(val) => handleFieldChange('employees', val)}
                            confidence={confidence.employees}
                        />
                        <EditableField
                            label="Fiscal Year End"
                            value={editedData.fiscal_year_end}
                            onChange={(val) => handleFieldChange('fiscal_year_end', val)}
                            confidence={confidence.fiscal_year_end}
                        />
                        <div className="col-span-2">
                            <EditableField
                                label="Competitors (comma-separated)"
                                value={editedData.competitors_core}
                                onChange={(val) => handleFieldChange('competitors_core', val)}
                            />
                        </div>
                    </dl>

                    <div>
                        <EditableField
                            label="Profile Summary"
                            value={editedData.vendor_profile_paragraph}
                            onChange={(val) => handleFieldChange('vendor_profile_paragraph', val)}
                            multiline={true}
                        />
                    </div>

                    <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Recent News
                        </dt>
                        {news && news.length > 0 ? (
                            <ul className="space-y-2">
                                {news.map((item, index) => (
                                    <li key={index} className="text-sm">
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline hover:text-blue-800"
                                        >
                                            {item.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No recent news found</p>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                        {loading && <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />}
                        {loading ? 'Generating...' : 'Confirm & Generate Report'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ReviewModal
