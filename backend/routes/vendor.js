const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/auth')
const claudeService = require('../services/claudeService')
const cacheService = require('../services/cacheService')
const documentService = require('../services/documentService')
const newsService = require('../services/newsService')
const supabase = require('../services/supabaseService')

// Step 1: Research Vendor (Claude only — returns data for user review)
router.post('/research', authenticate, async (req, res) => {
    try {
        const { clientName, vendorName, forceRegenerate } = req.body

        if (!clientName || !vendorName) {
            return res.status(400).json({ error: 'Client name and vendor name are required' })
        }

        let researchData = null
        let newsResults = []
        let cached = false
        let updatedAt = new Date()

        // 1. Check cache (unless forced)
        if (!forceRegenerate) {
            const cachedRecord = await cacheService.getCachedVendor(vendorName)
            if (cachedRecord) {
                researchData = cachedRecord.researchData
                newsResults = cachedRecord.newsResults
                cached = true
                updatedAt = cachedRecord.updatedAt
            }
        }

        // 2. Call Claude if not cached
        if (!researchData) {
            researchData = await claudeService.researchVendor(vendorName)

            // 2a. Confidence check — bail early if Claude can't identify the vendor
            if ((researchData.confidence_score ?? 100) < 70) {
                return res.status(422).json({
                    error: `Company not found. '${vendorName}' could not be identified as a known vendor. Please check the spelling and try again.`
                })
            }

            // 2b. Fetch Tavily News immediately
            try {
                const lookupName = researchData.matched_vendor_name || vendorName
                newsResults = await newsService.getRecentNews(lookupName, {
                    matched_vendor_name: researchData.matched_vendor_name,
                    company_type: researchData.company_type
                })
            } catch (newsErr) {
                console.error('News fetch error during research:', newsErr)
                // Fallback: empty news if Tavily fails, but we still have good research
                newsResults = []
            }

            // 3. Update cache (store BOTH)
            await cacheService.cacheVendor(vendorName, researchData, newsResults)
            updatedAt = new Date()
        }

        // 4. Return research data AND news for review
        res.json({ researchData, newsResults, cached, updatedAt })

    } catch (error) {
        console.error('Research error:', error)
        res.status(500).json({ error: error.message || 'Failed to research vendor' })
    }
})

// Step 2: Generate Document (called after user confirms review)
router.post('/generate', authenticate, async (req, res) => {
    try {
        const { clientName, vendorName, researchData, newsResults, cacheUsed = true } = req.body
        const userId = req.user.id

        if (!clientName || !vendorName || !researchData) {
            return res.status(400).json({ error: 'clientName, vendorName, and researchData are required' })
        }

        // 1. Use provided news results OR fetch fresh if missing (fallback)
        let finalNews = newsResults
        if (!finalNews || finalNews.length === 0) {
            try {
                const lookupName = researchData.matched_vendor_name || vendorName
                finalNews = await newsService.getRecentNews(lookupName, {
                    matched_vendor_name: researchData.matched_vendor_name,
                    company_type: researchData.company_type
                })
            } catch (err) {
                console.error('Fallback news fetch failed:', err)
                finalNews = []
            }
        }

        // 2. Merge news into research data for generation
        const enrichedResearch = { ...researchData, recent_news: finalNews }

        // 3. Pre-check: find existing profile record for this vendor (dedup key: vendor_name, case-insensitive)
        const normalizedVendor = vendorName.trim()
        const { data: existingProfiles } = await supabase
            .from('profiles')
            .select('id')
            .ilike('vendor_name', normalizedVendor)
            .limit(1)
        const existingProfile = existingProfiles?.[0] ?? null

        // 4. Generate Word doc via Python microservice — always runs regardless of dedup rule
        const docBuffer = await documentService.generateDocument({
            client_name: clientName,
            vendor_name: vendorName,
            research_data: enrichedResearch
        })

        // 5. Stream file back to frontend
        const date = new Date()
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthAbbr = months[date.getMonth()]
        const year = date.getFullYear()
        const filename = `GWFMOA_${clientName}_${vendorName}_${monthAbbr},${year}.docx`

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.send(Buffer.from(docBuffer))

        // 6. Apply dedup rule to profiles table after stream (errors are logged, not returned to client)
        try {
            if (!cacheUsed) {
                // Rule 3: force regenerated — delete all existing records for this vendor, insert fresh
                await supabase.from('profiles').delete().ilike('vendor_name', normalizedVendor)
                await supabase.from('profiles').insert({
                    user_id: userId,
                    client_name: clientName,
                    vendor_name: vendorName,
                    research_data: enrichedResearch,
                    cache_used: false,
                    created_at: new Date()
                })
            } else if (!existingProfile) {
                // Rule 2: cache used, first time for this vendor — insert new record
                await supabase.from('profiles').insert({
                    user_id: userId,
                    client_name: clientName,
                    vendor_name: vendorName,
                    research_data: enrichedResearch,
                    cache_used: true,
                    created_at: new Date()
                })
            }
            // Rule 1: cache used, record already exists — skip insert
        } catch (dbErr) {
            console.error('Post-stream DB error:', dbErr)
        }

    } catch (error) {
        console.error('Generate error:', error)
        res.status(500).json({ error: error.message || 'Failed to generate document' })
    }
})

// Download Document (for history — re-generates from stored research_data)
router.get('/download/:id', authenticate, async (req, res) => {
    try {
        // 1. Fetch profile data
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.params.id)
            .single()

        if (error || !profile) {
            return res.status(404).json({ error: 'Profile not found' })
        }

        // 2. Generate Doc via Python microservice
        const docBuffer = await documentService.generateDocument({
            client_name: profile.client_name,
            vendor_name: profile.vendor_name,
            research_data: profile.research_data
        })

        // 3. Send file
        const date = new Date()
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthAbbr = months[date.getMonth()]
        const year = date.getFullYear()
        const filename = `GWFMOA_${profile.client_name}_${profile.vendor_name}_${monthAbbr},${year}.docx`

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.send(Buffer.from(docBuffer))

    } catch (error) {
        console.error('Download error:', error)
        res.status(500).json({ error: 'Failed to download document' })
    }
})

module.exports = router
