// =====================================================
// News Headlines Scoring (Keyword-based, no AI)
// =====================================================

import type { NewsItem } from '../types';

// Keyword dictionaries with sentiment scores
const NEGATIVE_KEYWORDS: Record<string, number> = {
    // Critical negative (strong sell signals)
    '倒産': -1.0,
    '破綻': -1.0,
    '詐欺': -1.0,
    '粉飾': -1.0,
    '不正': -0.9,
    '逮捕': -0.9,
    'リコール': -0.8,
    '訴訟': -0.7,
    '下方修正': -0.7,
    '業績悪化': -0.7,
    '赤字': -0.6,
    '減収': -0.5,
    '減益': -0.5,
    '減配': -0.5,
    'suspension': -0.8,
    'bankruptcy': -1.0,
    'fraud': -1.0,
    'scandal': -0.9,
    'lawsuit': -0.7,
    'recall': -0.8,
    'downgrade': -0.6,
    'miss': -0.5,
    'decline': -0.4,
    'weak': -0.3,
};

const POSITIVE_KEYWORDS: Record<string, number> = {
    // Strong positive (potential buy signals)
    '上方修正': 0.7,
    '業績好調': 0.6,
    '過去最高': 0.7,
    '最高益': 0.8,
    '増収': 0.5,
    '増益': 0.5,
    '増配': 0.6,
    '自社株買い': 0.5,
    '株式分割': 0.4,
    '新製品': 0.3,
    'beat': 0.6,
    'upgrade': 0.6,
    'record': 0.5,
    'strong': 0.4,
    'growth': 0.3,
    'expansion': 0.3,
    'acquisition': 0.2,
};

// =====================================================
// Score Headline
// =====================================================

export function scoreHeadline(headline: string): { score: number; keywords: string[] } {
    const lowerHeadline = headline.toLowerCase();
    let totalScore = 0;
    const matchedKeywords: string[] = [];

    // Check negative keywords
    for (const [keyword, score] of Object.entries(NEGATIVE_KEYWORDS)) {
        if (lowerHeadline.includes(keyword.toLowerCase())) {
            totalScore += score;
            matchedKeywords.push(keyword);
        }
    }

    // Check positive keywords
    for (const [keyword, score] of Object.entries(POSITIVE_KEYWORDS)) {
        if (lowerHeadline.includes(keyword.toLowerCase())) {
            totalScore += score;
            matchedKeywords.push(keyword);
        }
    }

    // Clamp to -1 to 1
    const clampedScore = Math.max(-1, Math.min(1, totalScore));

    return {
        score: clampedScore,
        keywords: matchedKeywords,
    };
}

// =====================================================
// Fetch News from RSS (Google News Alternative)
// =====================================================

export async function fetchNewsForSymbol(
    symbolName: string,
    market: 'JP' | 'US'
): Promise<NewsItem[]> {
    try {
        // Use Google News RSS (limited but free)
        const query = encodeURIComponent(symbolName);
        const hl = market === 'JP' ? 'ja' : 'en';
        const url = `https://news.google.com/rss/search?q=${query}&hl=${hl}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)',
            },
        });

        if (!response.ok) {
            return [];
        }

        const xml = await response.text();
        const items = parseRSSItems(xml);

        return items.map(item => {
            const { score, keywords } = scoreHeadline(item.title);
            return {
                headline: item.title,
                source: 'Google News',
                timestamp: item.pubDate,
                score,
                keywords,
            };
        }).slice(0, 10); // Limit to 10 items
    } catch (error) {
        console.error(`Failed to fetch news for ${symbolName}:`, error);
        return [];
    }
}

// =====================================================
// Simple RSS Parser (no external dependencies)
// =====================================================

function parseRSSItems(xml: string): { title: string; pubDate: string }[] {
    const items: { title: string; pubDate: string }[] = [];

    // Simple regex-based extraction
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const dateRegex = /<pubDate>(.*?)<\/pubDate>/;

    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];

        const titleMatch = titleRegex.exec(itemContent);
        const dateMatch = dateRegex.exec(itemContent);

        const title = titleMatch?.[1] || titleMatch?.[2] || '';
        const pubDate = dateMatch?.[1] || new Date().toISOString();

        if (title) {
            items.push({ title, pubDate });
        }
    }

    return items;
}

// =====================================================
// Get News Sentiment Summary
// =====================================================

export function getNewsSentiment(news: NewsItem[]): {
    averageScore: number;
    hasHighRisk: boolean;
    criticalHeadlines: string[];
} {
    if (news.length === 0) {
        return {
            averageScore: 0,
            hasHighRisk: false,
            criticalHeadlines: [],
        };
    }

    const totalScore = news.reduce((sum, item) => sum + item.score, 0);
    const averageScore = totalScore / news.length;

    const criticalHeadlines = news
        .filter(item => item.score <= -0.7)
        .map(item => item.headline);

    return {
        averageScore,
        hasHighRisk: criticalHeadlines.length > 0,
        criticalHeadlines,
    };
}
