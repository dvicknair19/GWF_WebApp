const axios = require('axios')

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000'

const generateDocument = async (profileData) => {
    try {
        const response = await axios.post(
            `${PYTHON_SERVICE_URL}/generate-document`,
            profileData,
            {
                responseType: 'arraybuffer' // Important for binary files
            }
        )
        return response.data
    } catch (error) {
        console.error('Document generation error:', error.message)
        throw new Error('Failed to generate document')
    }
}

module.exports = { generateDocument }
