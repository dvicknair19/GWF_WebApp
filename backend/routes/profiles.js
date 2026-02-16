const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/auth')
const supabase = require('../services/supabaseService')

// Get all profiles (History)
router.get('/', authenticate, async (req, res) => {
    try {
        // In complex apps, we might join with auth.users to get email which isn't directly exposed in public schema often.
        // For V1, we'll assume we can fetch user_id or store email in profiles for simplicity, 
        // OR we fetch users via admin client if we want to show "Created By Email".
        // Let's try to fetch profiles first.

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            throw error
        }

        // To get emails, valid strategy is:
        // 1. Store email in profiles table at creation (easiest for V1)
        // 2. Fetch list of users from Auth API (admin only)

        // For now, return profiles. Frontend handles displaying logic.
        // If we want email, we might need to adjust schema or fetch it.
        // Let's updated 'vendor.js' to save email if possible, or we just show "User ID" or "Me".

        // Actually, `supabase.auth.admin.listUsers()` works if we have service key.
        // Let's map user_ids to emails if we can.

        const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

        const profilesWithEmail = profiles.map(p => {
            const u = users?.find(u => u.id === p.user_id)
            return {
                ...p,
                user_email: u?.email || 'Unknown'
            }
        })

        res.json(profilesWithEmail)
    } catch (error) {
        console.error('History error:', error)
        res.status(500).json({ error: 'Failed to fetch history' })
    }
})

module.exports = router
