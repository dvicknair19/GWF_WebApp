const axios = require('axios')

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
const EXA_API_KEY = process.env.EXA_API_KEY
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const EXA_API_URL = 'https://api.exa.ai/search'

/**
 * Step 2a: Resolve vendor name using Claude Haiku
 * Returns: { matched_vendor_name, confidence_score }
 * Throws if confidence < 70
 */
const resolveVendorName = async (userInput) => {
    if (!CLAUDE_API_KEY) {
        throw new Error('Claude API key is missing')
    }

    const prompt = `Given this user input, identify the official full legal company name. The input may contain typos, abbreviations, or informal names. Return a JSON object with two fields only: matched_vendor_name (the official company name as it would appear in legal filings) and confidence_score (integer 0–100 reflecting how confident you are this is a real, identifiable company). If you cannot identify a real company from this input, return confidence_score below 70.

User input: "${userInput}"

Return ONLY the JSON object, no additional text.`

    try {
        const response = await axios.post(
            CLAUDE_API_URL,
            {
                model: 'claude-3-haiku-20240307',
                max_tokens: 500,
                temperature: 0.1,
                messages: [{ role: 'user', content: prompt }]
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

        if (!parsed.matched_vendor_name || !parsed.confidence_score) {
            throw new Error('Claude response missing required fields')
        }

        if (parsed.confidence_score < 70) {
            throw new Error('Company not recognized')
        }

        return {
            matched_vendor_name: parsed.matched_vendor_name,
            confidence_score: parsed.confidence_score
        }
    } catch (error) {
        if (error.message === 'Company not recognized') {
            throw error
        }
        const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
        console.error('Claude name resolution error:', detail)
        throw new Error(`Failed to resolve vendor name: ${detail}`)
    }
}

/**
 * Query Exa for financial research
 * Returns company data extracted by Claude from Exa search results
 */
const queryExaFinancial = async (vendorName) => {
    if (!EXA_API_KEY) {
        throw new Error('Exa API key is missing')
    }

    try {
        const query = `${vendorName} annual revenue employees fiscal year earnings`

        const response = await axios.post(
            EXA_API_URL,
            {
                query: query,
                numResults: 5,
                useAutoprompt: true,
                contents: {
                    highlights: true,
                    highlightsQuery: `${vendorName} total annual revenue full year results reported actual not guidance not outlook not forecast`
                }
            },
            {
                headers: {
                    'x-api-key': EXA_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        )

        const results = response.data.results || []
        const sources = results.map(r => r.url)

        console.log('[EXA] Financial search sources:', JSON.stringify(sources))

        if (results.length === 0) {
            console.log('[EXA] No financial results found')
            return {
                company_type: null,
                estimated_annual_revenue: null,
                employees: null,
                fiscal_year_end: null,
                stock_exchange: null,
                competitors_core: [],
                vendor_profile_paragraph: null,
                confidence: {
                    company_type: 0,
                    estimated_annual_revenue: 0,
                    employees: 0,
                    fiscal_year_end: 0
                }
            }
        }

        // Compile highlights from all results
        const compiledContent = results
            .map((r, i) => {
                const highlights = r.highlights || []
                const highlightText = highlights.join('\n')
                return `Source ${i + 1} (${r.url}):\n${highlightText}`
            })
            .join('\n\n---\n\n')

        // Use Claude to extract structured data
        const claudePrompt = `Based on the following search result highlights about ${vendorName}, extract company information and return a JSON object with these exact fields:

- company_type (string): Return 'Private', 'Public (Nasdaq)', 'Public (NYSE)', 'Public (OTC)', or 'Subsidiary of [Parent Company]'. Pay close attention to any search results mentioning acquisitions, going-private transactions, delisting, or private equity ownership. If any source indicates the company was taken private, acquired, or delisted, set company_type to 'Private' or 'Subsidiary of [acquirer]' regardless of any historical Nasdaq/NYSE references. Do not rely solely on exchange listing pages — these may be outdated. When determining company_type, check the publication dates of your sources. If the most recent source confirming a public listing is more than 2 years old and no current source confirms active trading, set company_type to 'Private' and reduce the company_type confidence score below 60. A SEC filing or news article from 2019-2020 is not sufficient evidence of current public status.
- estimated_annual_revenue (string): Total annual revenue from the most recent fiscal year (e.g. '$9.2 billion (FY 2025)'). For private companies, provide specific figures like '$300 million' or '1200 employees' (ranges will be calculated automatically). Never use forward guidance, outlook ranges, or projected figures. Only use figures explicitly labeled as reported actual results. If exact figures cannot be determined from the sources, provide a best estimate or reasonable figure based on any available context. Never return 'Unable to determine' — always return a reasonable estimate.
- employees (string): Most recently reported headcount (e.g. '22,000 employees' or '500 employees'). For private companies, provide specific numbers (ranges will be calculated automatically). If exact headcount cannot be determined from the sources, provide a best estimate based on company size indicators. Never return 'Unable to determine' — always return a reasonable estimate.
- fiscal_year_end (string): Month and day only (e.g. 'December 31')
- stock_exchange (string): Exchange name for public companies (e.g. 'Nasdaq', 'NYSE', 'OTC'), or null for private companies
- competitors_core (array): 4–6 direct competitors as strings
- vendor_profile_paragraph (string): Neutral 3–4 sentences describing what the company does and who it serves
- confidence (object): An object with per-field confidence scores (integers 0–100). Include these keys: company_type, estimated_annual_revenue, employees, fiscal_year_end. Score each field independently based on source quality and recency. For company_type confidence specifically: score 85-100 only if a source from the past 12 months confirms current active exchange listing. Score 50-70 if the most recent confirmation is 1-3 years old. Score below 50 if only historical sources are available or if any source mentions a going-private transaction, acquisition, or delisting.

Search results:
${compiledContent}

Return ONLY the JSON object, no additional text.`

        const claudeResponse = await axios.post(
            CLAUDE_API_URL,
            {
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 2000,
                temperature: 0.1,
                messages: [{ role: 'user', content: claudePrompt }]
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

        const claudeContent = claudeResponse.data.content[0].text
        const jsonMatch = claudeContent.match(/\{[\s\S]*\}/)
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(claudeContent)

        console.log('[EXA] Extracted data:', JSON.stringify(parsed, null, 2))

        // Ownership verification: If company_type confidence is below 80, run targeted search
        const companyTypeConfidence = parsed.confidence?.company_type ?? 0
        if (companyTypeConfidence < 80) {
            console.log('[EXA] Low confidence on company_type, running ownership verification search')

            try {
                const ownershipQuery = `${vendorName} private equity acquired delisted going private current ownership 2023 2024 2025`

                const ownershipResponse = await axios.post(
                    EXA_API_URL,
                    {
                        query: ownershipQuery,
                        numResults: 3,
                        useAutoprompt: true,
                        contents: {
                            highlights: true
                        }
                    },
                    {
                        headers: {
                            'x-api-key': EXA_API_KEY,
                            'Content-Type': 'application/json'
                        },
                        timeout: 30000
                    }
                )

                const ownershipResults = ownershipResponse.data.results || []
                if (ownershipResults.length > 0) {
                    const ownershipContent = ownershipResults
                        .map((r, i) => {
                            const highlights = r.highlights || []
                            const highlightText = highlights.join('\n')
                            return `Source ${i + 1} (${r.url}):\n${highlightText}`
                        })
                        .join('\n\n---\n\n')

                    const verificationPrompt = `Based only on these sources, is this company currently publicly traded or privately held? Return only a JSON object: { "company_type": string, "confidence": integer }. If any source mentions a going-private transaction, private equity acquisition, or delisting after 2019, classify as Private.

Sources:
${ownershipContent}

Return ONLY the JSON object, no additional text.`

                    const verificationResponse = await axios.post(
                        CLAUDE_API_URL,
                        {
                            model: 'claude-3-haiku-20240307',
                            max_tokens: 500,
                            temperature: 0.1,
                            messages: [{ role: 'user', content: verificationPrompt }]
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

                    const verificationContent = verificationResponse.data.content[0].text
                    const verificationMatch = verificationContent.match(/\{[\s\S]*\}/)
                    const verificationResult = verificationMatch
                        ? JSON.parse(verificationMatch[0])
                        : JSON.parse(verificationContent)

                    // Update if verification confidence is higher
                    if (verificationResult.confidence > companyTypeConfidence) {
                        console.log(`[EXA] Ownership verification improved confidence: ${companyTypeConfidence} → ${verificationResult.confidence}`)
                        parsed.company_type = verificationResult.company_type
                        parsed.confidence.company_type = verificationResult.confidence
                    } else {
                        console.log(`[EXA] Ownership verification did not improve confidence (${verificationResult.confidence} vs ${companyTypeConfidence})`)
                    }
                }
            } catch (verificationError) {
                console.error('[EXA] Ownership verification error:', verificationError.message)
                // Continue with original data if verification fails
            }
        }

        // Post-processing: Convert to ±30% ranges for private companies
        let processedRevenue = parsed.estimated_annual_revenue
        let processedEmployees = parsed.employees

        const isPrivateOrSubsidiary =
            parsed.company_type === 'Private' ||
            (parsed.company_type && parsed.company_type.startsWith('Subsidiary of'))

        if (isPrivateOrSubsidiary) {
            // Process revenue
            if (processedRevenue) {
                const revenueMatch = processedRevenue.match(/\$?([\d,.]+)\s*(million|billion|M|B)?/i)
                if (revenueMatch) {
                    let value = parseFloat(revenueMatch[1].replace(/,/g, ''))
                    const unit = revenueMatch[2]?.toLowerCase()

                    // Convert to millions for calculation
                    if (unit === 'billion' || unit === 'b') {
                        value = value * 1000
                    }

                    const lowerBound = Math.round(value * 0.7)
                    const upperBound = Math.round(value * 1.3)

                    // Format back to original unit
                    if (unit === 'billion' || unit === 'b') {
                        processedRevenue = `$${(lowerBound/1000).toFixed(1)}–${(upperBound/1000).toFixed(1)} billion`
                    } else {
                        processedRevenue = `$${lowerBound}–${upperBound} million`
                    }
                }
            }

            // Process employees
            if (processedEmployees) {
                const employeeMatch = processedEmployees.match(/([\d,]+)\s*employees?/i)
                if (employeeMatch) {
                    const value = parseInt(employeeMatch[1].replace(/,/g, ''))
                    const lowerBound = Math.round(value * 0.7)
                    const upperBound = Math.round(value * 1.3)
                    processedEmployees = `~${lowerBound.toLocaleString()}–${upperBound.toLocaleString()} employees`
                }
            }
        }

        return {
            company_type: parsed.company_type || null,
            estimated_annual_revenue: processedRevenue || null,
            employees: processedEmployees || null,
            fiscal_year_end: parsed.fiscal_year_end || null,
            stock_exchange: parsed.stock_exchange || null,
            competitors_core: parsed.competitors_core || [],
            vendor_profile_paragraph: parsed.vendor_profile_paragraph || null,
            confidence: parsed.confidence || {
                company_type: 0,
                estimated_annual_revenue: 0,
                employees: 0,
                fiscal_year_end: 0
            }
        }

    } catch (error) {
        console.error('[EXA] Financial search error:', error.message)
        if (error.response) {
            console.error('[EXA] Error response:', JSON.stringify(error.response.data, null, 2))
        }
        throw error
    }
}

/**
 * Query Exa for news articles
 * Returns recent news articles about the company
 */
const queryExaNews = async (vendorName) => {
    if (!EXA_API_KEY) {
        console.log('[EXA] API key missing, skipping news fetch')
        return []
    }

    try {
        const query = `${vendorName} news 2025`

        // Set start date to 6 months ago
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        const startDate = sixMonthsAgo.toISOString().split('T')[0]

        const response = await axios.post(
            EXA_API_URL,
            {
                query: query,
                numResults: 2,
                useAutoprompt: true,
                contents: {
                    text: true
                },
                startPublishedDate: startDate
            },
            {
                headers: {
                    'x-api-key': EXA_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        )

        const results = response.data.results || []
        const sources = results.map(r => r.url)

        console.log('[EXA] News sources:', JSON.stringify(sources))

        // Return top 2 articles with title and URL
        return results.slice(0, 2).map(r => ({
            title: r.title || 'Untitled',
            url: r.url
        }))

    } catch (error) {
        console.error('[EXA] News search error:', error.message)
        return []
    }
}

/**
 * Main orchestration function
 * Steps: 1. Resolve vendor name → 2. Fetch company data from Exa → 3. Fetch news from Exa
 */
const conductResearch = async (userInput) => {
    // Track Exa API calls
    let exaCallCount = 0

    // Step 1: Resolve vendor name and validate confidence
    let matched_vendor_name, confidence_score
    try {
        const result = await resolveVendorName(userInput)
        matched_vendor_name = result.matched_vendor_name
        confidence_score = result.confidence_score
    } catch (error) {
        // Pre-research validation failed - reject before making API calls
        if (error.message === 'Company not recognized') {
            console.log(`[VALIDATION] Vendor rejected before research: ${userInput}`)
            throw new Error('Could not verify this vendor. Please check the spelling and try again.')
        }
        // Re-throw other errors
        throw error
    }

    // Step 2: Fetch company data from Exa financial search
    const exaFinancialData = await queryExaFinancial(matched_vendor_name)
    exaCallCount++ // Financial data call

    // Step 3: Fetch news from Exa
    const news = await queryExaNews(matched_vendor_name)
    exaCallCount++ // News fetch

    // Combine all data
    const researchData = {
        matched_vendor_name,
        confidence_score,
        ...exaFinancialData,
        recent_news: news,
        data_source: 'exa'
    }

    // Ensure all fields are present (set to null if missing)
    const requiredFields = [
        'company_type',
        'estimated_annual_revenue',
        'employees',
        'fiscal_year_end',
        'stock_exchange',
        'competitors_core',
        'vendor_profile_paragraph',
        'recent_news'
    ]

    requiredFields.forEach(field => {
        if (!(field in researchData)) {
            researchData[field] = null
        }
    })

    // Log total Exa API calls
    console.log(`[EXA] Total API calls for this vendor: ${exaCallCount}`)

    return researchData
}

module.exports = { conductResearch }
