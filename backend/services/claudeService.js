const axios = require('axios')

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
const API_URL = 'https://api.anthropic.com/v1/messages'

const researchVendor = async (vendorName) => {
    if (!CLAUDE_API_KEY) {
        throw new Error('Claude API key is missing')
    }

    const prompt = `You are a financial analyst assistant for Gray Wolf Financial, a vendor-agnostic consulting firm. Your task is to gather objective, factual information about vendors for third-party analysis.

IMPORTANT: Use the most current information available (2025-2026 data preferred). Prioritize recent sources and explicitly state the year for all financial metrics.

CRITICAL: This is NOT a marketing document. Gray Wolf Financial is completely vendor-agnostic. All descriptions must be neutral, objective, and analytical. Do not include promotional language, marketing claims, or subjective praise.

Please provide detailed information about the vendor "${vendorName}" that would be relevant for a Master Services Agreement (MSA) and vendor profile document.

Return your response as a valid JSON object with the following structure:
{
    "vendor_profile_paragraph": "A neutral, objective 3-4 sentence description of the company's business operations, market segment, scale of operations, and factual characteristics. Write as an impartial third-party analyst would - focus solely on observable facts, business model, and market positioning without promotional language or subjective claims about quality or superiority",
    "company_type": "Public/Private/Subsidiary/Partnership",
    "fiscal_year_end": "Month and day of fiscal year end (e.g., December 31, March 31)",
    "estimated_annual_revenue": "Most recent annual revenue with year (e.g., $45.3 billion (2023))",
    "employees": "Approximate number of employees (e.g., 738,000 employees globally)",
    "competitors_core": [
        "Major Competitor 1",
        "Major Competitor 2",
        "Major Competitor 3"
    ],
    "recent_news": [
        {
            "title": "Recent news article title 1",
            "url": "https://example.com/news1"
        },
        {
            "title": "Recent news article title 2",
            "url": "https://example.com/news2"
        },
        {
            "title": "Recent news article title 3",
            "url": "https://example.com/news3"
        }
    ]
}

Requirements:
- CRITICAL: Always use the most recent data available. Search for current information from 2025-2026.
- The vendor_profile_paragraph should be a well-written, professional summary suitable for inclusion in a business document
- The vendor_profile_paragraph MUST be completely objective and analytical - NO marketing language, NO promotional tone, NO subjective claims about quality or value. Write as a neutral third-party observer describing factual business operations and market presence only.
- Include only factual, publicly available information
- If specific information is not available, use "Not publicly available" as the value
- Estimated Annual Revenue: Use the most recent fiscal year data available (2024 or later preferred)
- Employees: Use current headcount (2025-2026 if available)
- When providing financial data, always include the year (e.g., "$64B (FY 2024)" not just "$64B")
- For recent_news, include 2-3 relevant recent news articles from the past 3-6 months (2025-2026 articles strongly preferred)
- Competitors should be 4-6 direct, major competitors based on current market positioning

Return ONLY the JSON object, no additional text or formatting.`

    try {
        const response = await axios.post(
            API_URL,
            {
                model: 'claude-3-5-sonnet-20241022', // updated model name
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
                timeout: 60000 // 60s timeout
            }
        )

        const content = response.data.content[0].text
        // Extract JSON from content if it contains extra text
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }
        return JSON.parse(content)
    } catch (error) {
        console.error('Claude API Error:', error.response?.data || error.message)
        throw new Error('Failed to research vendor via Claude API')
    }
}

module.exports = { researchVendor }
