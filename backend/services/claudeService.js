const axios = require('axios')

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
const API_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Formats research data from researchService into the schema expected by the rest of the app
 * No longer performs research - only formatting
 */
const formatResearchData = async (researchData) => {
    if (!CLAUDE_API_KEY) {
        throw new Error('Claude API key is missing')
    }

    // Note: The matched company confidence check happens in researchService.js (resolveVendorName)
    // Per-field confidence scores (confidence.company_type, confidence.estimated_annual_revenue, etc.)
    // are for display purposes only and should NOT block profile generation

    const prompt = `You are a formatting assistant. You will receive research data about a company and must return it in the exact JSON schema format expected by the application.

Input data:
${JSON.stringify(researchData, null, 2)}

Return this data formatted as a valid JSON object with these exact fields:
{
    "confidence": (object with per-field confidence scores from input: {company_type, estimated_annual_revenue, employees, fiscal_year_end}),
    "matched_vendor_name": (string, from input),
    "vendor_profile_paragraph": (string, from input),
    "company_type": (string, from input),
    "fiscal_year_end": (string, from input or null),
    "estimated_annual_revenue": (string, from input or null),
    "employees": (string, from input or null),
    "competitors_core": (array of strings, from input or empty array),
    "recent_news": (array of objects with 'title' and 'url', from input or empty array)
}

Do not modify the values - only ensure they match the expected schema. If a field is missing in the input, set it to null (or [] for arrays).

Return ONLY the JSON object, no additional text.`

    try {
        const response = await axios.post(
            API_URL,
            {
                model: 'claude-3-haiku-20240307',
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3
            },
            {
                headers: {
                    'x-api-key': CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                timeout: 30000
            }
        )

        const content = response.data.content[0].text
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)

        return parsed
    } catch (error) {
        const detail = error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message
        console.error('Claude formatting error:', detail)
        throw new Error(`Failed to format research data: ${detail}`)
    }
}

module.exports = { formatResearchData }
