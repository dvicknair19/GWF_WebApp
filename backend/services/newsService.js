const { tavily } = require('@tavily/core')

const getRecentNews = async (vendorName) => {
    const apiKey = process.env.TAVILY_API_KEY

    if (!apiKey) {
        throw new Error('News search is not configured. Please add TAVILY_API_KEY to the backend environment.')
    }

    const client = tavily({ apiKey })
    const response = await client.search(`${vendorName} recent news`, {
        topic: 'news',
        max_results: 2,
        days: 120,
        include_domains: [
            'reuters.com',
            'apnews.com',
            'techcrunch.com',
            'theregister.com',
            'zdnet.com',
            'venturebeat.com',
            'theverge.com'
        ]
    })
    const results = response.results || []

    if (results.length === 0) {
        throw new Error(`Company not found. No news could be found for '${vendorName}'. Please verify the company name and try again.`)
    }

    return results.map(r => ({ title: r.title, url: r.url }))
}

module.exports = { getRecentNews }
