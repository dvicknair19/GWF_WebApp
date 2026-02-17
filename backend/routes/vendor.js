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
        let cached = false
        let updatedAt = new Date()

        // 1. Check cache (unless forced)
        if (!forceRegenerate) {
            const cachedRecord = await cacheService.getCachedVendor(vendorName)
            if (cachedRecord) {
                researchData = cachedRecord.research_data
                cached = true
                updatedAt = cachedRecord.updated_at
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

            // 3. Update cache
            await cacheService.cacheVendor(vendorName, researchData)
            updatedAt = new Date()
        }

        // 4. Return research data for review — no DB save, no Tavily, no doc generation
        res.json({ researchData, cached, updatedAt })

    } catch (error) {
        console.error('Research error:', error)
        res.status(500).json({ error: error.message || 'Failed to research vendor' })
    }
})

// Step 2: Generate Document (called after user confirms review)
router.post('/generate', authenticate, async (req, res) => {
    try {
        const { clientName, vendorName, researchData, cacheUsed = true } = req.body
        const userId = req.user.id

        if (!clientName || !vendorName || !researchData) {
            return res.status(400).json({ error: 'clientName, vendorName, and researchData are required' })
        }

        // 1. Fetch real news via Tavily
        const lookupName = researchData.matched_vendor_name || vendorName
        const recentNews = await newsService.getRecentNews(lookupName)

        // 2. Merge Tavily news into research data
        const enrichedResearch = { ...researchData, recent_news: recentNews }

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
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        res.setHeader('Content-Disposition', `attachment; filename="${clientName}_${vendorName}_MOA.docx"`)
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
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        res.setHeader('Content-Disposition', `attachment; filename="${profile.client_name}_${profile.vendor_name}_MOA.docx"`)
        res.send(Buffer.from(docBuffer))

    } catch (error) {
        console.error('Download error:', error)
        res.status(500).json({ error: 'Failed to download document' })
    }
})

module.exports = router
