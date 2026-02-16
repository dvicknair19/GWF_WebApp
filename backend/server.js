require('dotenv').config()
const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes/auth')
const vendorRoutes = require('./routes/vendor')
const profileRoutes = require('./routes/profiles')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Supabase Admin Client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/vendor', vendorRoutes)
app.use('/api/profiles', profileRoutes)

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' })
})

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ error: 'Something went wrong!' })
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

module.exports = { app, supabase }
