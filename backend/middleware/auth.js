const { createClient } = require('@supabase/supabase-js')

// We use a separate client for auth verification if needed, 
// or just verify the JWT. Supabase js provides getUser() which verifies the token.

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header provided' })
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
        return res.status(401).json({ error: 'No token provided' })
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' })
        }

        req.user = user
        next()
    } catch (err) {
        console.error('Auth error:', err)
        res.status(500).json({ error: 'Authentication failed' })
    }
}

module.exports = authenticate
