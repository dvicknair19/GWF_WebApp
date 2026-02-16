require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const authRoutes = require('./routes/auth')
const vendorRoutes = require('./routes/vendor')
const profileRoutes = require('./routes/profiles')

const app = express()
const PORT = process.env.PORT || 3001
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}))
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/vendor', vendorRoutes)
app.use('/api/profiles', profileRoutes)

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' })
})

// Serve frontend static files in production
// Must come AFTER API routes so /api/* is handled first
if (IS_PRODUCTION) {
    app.use(express.static(path.join(__dirname, 'public')))
    app.get('/*splat', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'))
    })
}

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ error: 'Something went wrong!' })
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

module.exports = { app }
