import { Loader2 } from 'lucide-react'

const Field = ({ label, value }) => (
    <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || '—'}</dd>
    </div>
)

const ReviewModal = ({ data, loading, onConfirm, onCancel }) => {
    const competitors = Array.isArray(data.competitors_core)
        ? data.competitors_core.join(', ')
        : data.competitors_core || '—'

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
                        <Field label="Company Type" value={data.company_type} />
                        <Field label="Revenue" value={data.estimated_annual_revenue} />
                        <Field label="Employees" value={data.employees} />
                        <div className="col-span-2">
                            <Field label="Competitors" value={competitors} />
                        </div>
                    </dl>

                    <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                            Profile Summary
                        </dt>
                        <textarea
                            readOnly
                            value={data.vendor_profile_paragraph || ''}
                            rows={6}
                            className="w-full text-sm text-gray-900 border border-gray-300 rounded-md p-3 resize-none focus:outline-none bg-gray-50"
                        />
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
                        onClick={onConfirm}
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
