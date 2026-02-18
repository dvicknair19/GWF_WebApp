const { tavily } = require('@tavily/core')
const axios = require('axios')

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
const API_URL = 'https://api.anthropic.com/v1/messages'

const validateNewsWithClaude = async (titles, vendorName, companyType) => {
    try {
        const response = await axios.post(
            API_URL,
            {
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                temperature: 0,
                messages: [
                    {
                        role: 'user',
                        content: `Are these news article titles about ${vendorName}, a ${companyType}? Titles: ${JSON.stringify(titles)}. Respond with only 'yes' or 'no'. Answer 'no' if articles are about competitors, different companies with similar names, or unrelated topics.`
                    }
                ]
            },
            {
                headers: {
                    'x-api-key': CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                timeout: 10000
            }
        )
        const text = response.data.content[0].text.trim().toLowerCase()
        return text.includes('yes')
    } catch (error) {
        console.error('News validation error:', error)
        return true // Default to true if validation fails to avoid blocking
    }
}

const getRecentNews = async (vendorName, researchContext = {}) => {
    const apiKey = process.env.TAVILY_API_KEY

    if (!apiKey) {
        throw new Error('News search is not configured. Please add TAVILY_API_KEY to the backend environment.')
    }

    const primaryName = researchContext.matched_vendor_name || vendorName
    const companyType = researchContext.company_type || 'company'

    // Attempt 1: Standard query
    let query = `${primaryName} company news`
    const client = tavily({ apiKey })

    const performSearch = async (q) => {
        const response = await client.search(q, {
            topic: 'news',
            max_results: 2,
            days: 120,
            include_domains: [
                'apnews.com',
                'techcrunch.com',
                'theregister.com',
                'zdnet.com',
                'venturebeat.com',
                'theverge.com'
            ]
        })
        return response.results || []
    }

    let results = await performSearch(query)

    if (results.length === 0) {
        throw new Error(`Company not found. No news could be found for '${vendorName}'. Please verify the company name and try again.`)
    }

    const titles = results.map(r => r.title)
    const isValid = await validateNewsWithClaude(titles, primaryName, companyType)

    if (isValid) {
        return results.map(r => ({ title: r.title, url: r.url }))
    }

    // Attempt 2: Retry with more specific query
    console.log(`News validation failed for '${query}'. Retrying with specific query...`)
    query = `${primaryName} ${companyType} news`
    results = await performSearch(query)

    if (results.length > 0) {
        const retryTitles = results.map(r => r.title)
        const isRetryValid = await validateNewsWithClaude(retryTitles, primaryName, companyType)

        if (isRetryValid) {
            return results.map(r => ({ title: r.title, url: r.url }))
        }
    }

    throw new Error(`Could not find relevant news for ${primaryName}. Search results were about unrelated companies. Please try again with a more specific vendor name.`)
}

module.exports = { getRecentNews }
