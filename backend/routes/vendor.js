const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/auth')
const claudeService = require('../services/claudeService')
const cacheService = require('../services/cacheService')
const documentService = require('../services/documentService')
const supabase = require('../services/supabaseService')

// Generate Vendor Profile
router.post('/generate', authenticate, async (req, res) => {
    try {
        const { clientName, vendorName, dealDescription, forceRegenerate } = req.body
        const userId = req.user.id

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

        // 2. Research if needed
        if (!researchData) {
            researchData = await claudeService.researchVendor(vendorName)

            // 3. Update cache
            await cacheService.cacheVendor(vendorName, researchData)
            updatedAt = new Date()
        }

        // 4. Save to profiles table
        // We save the inputs + the research data used at that moment
        const { data: profile, error: dbError } = await supabase
            .from('profiles')
            .insert({
                user_id: userId,
                client_name: clientName,
                vendor_name: vendorName,
                deal_description: dealDescription || '',
                research_data: researchData,
                cache_used: cached,
                created_at: new Date()
            })
            .select()
            .single()

        if (dbError) {
            console.error('Database error:', dbError)
            throw new Error('Failed to save profile')
        }

        // 5. Return success + download URL
        res.json({
            success: true,
            profileId: profile.id,
            downloadUrl: `${process.env.API_URL || '/api'}/vendor/download/${profile.id}`,
            cached,
            updatedAt
        })

    } catch (error) {
        console.error('Generation error:', error)
        res.status(500).json({ error: error.message || 'Failed to generate profile' })
    }
})

// Download Document
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

        // 2. Generate Doc via Python Service
        const docBuffer = await documentService.generateDocument({
            client_name: profile.client_name,
            vendor_name: profile.vendor_name,
            deal_description: profile.deal_description,
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
