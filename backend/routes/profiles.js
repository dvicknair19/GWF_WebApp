const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/auth')
const supabase = require('../services/supabaseService')

// Get all profiles (History)
router.get('/', authenticate, async (req, res) => {
    try {
        const [profilesResult, usersResult] = await Promise.all([
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.auth.admin.listUsers()
        ])

        if (profilesResult.error) throw profilesResult.error

        const users = usersResult.data?.users ?? []

        const profilesWithEmail = profilesResult.data.map(p => {
            const u = users.find(u => u.id === p.user_id)
            return { ...p, user_email: u?.email || 'Unknown' }
        })

        res.json(profilesWithEmail)
    } catch (error) {
        console.error('History error:', error)
        res.status(500).json({ error: 'Failed to fetch history' })
    }
})

module.exports = router
