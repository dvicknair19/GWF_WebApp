const supabase = require('./supabaseService')

const CACHE_DURATION_DAYS = 7

const getCachedVendor = async (vendorName) => {
    const { data, error } = await supabase
        .from('vendor_cache')
        .select('*')
        .eq('vendor_name', vendorName)
        .single()

    if (error || !data) return null

    // Check if expired
    const updatedAt = new Date(data.updated_at)
    const now = new Date()
    const diffTime = Math.abs(now - updatedAt)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > CACHE_DURATION_DAYS) {
        return null // Expired
    }

    return data
}

const cacheVendor = async (vendorName, researchData) => {
    // Upsert
    const { data, error } = await supabase
        .from('vendor_cache')
        .upsert(
            {
                vendor_name: vendorName,
                research_data: researchData,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'vendor_name' }
        )
        .select()

    if (error) {
        console.error('Cache error:', error)
    }
    return data
}

module.exports = { getCachedVendor, cacheVendor }
