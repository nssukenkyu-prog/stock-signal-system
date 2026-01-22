
// =====================================================
// Yahoo Finance Japan Scraper
// Used for Mutual Fund (Investment Trust) prices
// =====================================================

export const FUND_CODES: Record<string, string> = {
    'eMAXIS Slim 米国株式(S&P500)': '0331418A',
    '楽天・全米株式インデックス・ファンド(楽天・VTI)': '9I312179',
    'eMAXIS Slim 全世界株式(オール・カントリー)(オルカン)': '0331A18A',
    'eMAXIS Slim 全世界株式(除く日本)': '0331C183',
    '楽天・全世界株式インデックス・ファンド(楽天・VT)': '9I311179',
    '楽天・プラス・オールカントリー株式インデックス・ファンド(楽天・プラス・オールカントリー)': '9I31323A',
    'eMAXIS Slim 先進国株式インデックス(除く日本)': '03319175',
    'たわらノーロード 先進国株式': '4731B15C',
    'eMAXIS Slim 新興国株式インデックス': '0331A177',
    'ブラックロックESG世界株式ファンド（為替ヘッジなし）': '48313159',
    'eMAXIS Neo AIテクノロジー': '03311208',
};

// Also support partial matching if exact name missing
export const FUND_CODE_MAPPINGS: { pattern: RegExp; code: string }[] = [
    { pattern: /楽天・全米株式/, code: '9I312179' },
    { pattern: /楽天・全世界株式/, code: '9I311179' },
    { pattern: /eMAXIS Slim 米国株式/, code: '0331418A' },
    { pattern: /eMAXIS Slim 全世界株式.*オール・カントリー/, code: '0331A18A' },
    { pattern: /eMAXIS Slim 全世界株式.*除く日本/, code: '0331C183' },
    { pattern: /eMAXIS Slim 先進国株式/, code: '03319175' },
    { pattern: /eMAXIS Slim 新興国株式/, code: '0331A177' },
    { pattern: /たわらノーロード 先進国/, code: '4731B15C' },
    { pattern: /ブラックロックESG/, code: '48313159' },
];

export async function fetchFundPrice(code: string): Promise<number | null> {
    const url = `https://finance.yahoo.co.jp/quote/${code}`;
    console.log(`[YahooJP] Fetching ${code}...`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            }
        });

        if (!response.ok) {
            console.error(`[YahooJP] Failed to fetch ${url}: ${response.status}`);
            return null;
        }

        const text = await response.text();

        // Method 1: Extract __PRELOADED_STATE__
        const stateMatch = text.match(/window\.__PRELOADED_STATE__\s*=\s*({.*});?/);
        if (stateMatch && stateMatch[1]) {
            try {
                // The regex might capture '};' at the end, so we might need to be careful
                // JSON.parse might fail if trailing chars exist.
                // But {.*} is greedy?
                // Let's try to parse directly.
                const state = JSON.parse(stateMatch[1]);
                const priceStr = state?.mainFundPriceBoard?.fundPrices?.price;
                if (priceStr) {
                    const price = parseFloat(priceStr.replace(/,/g, ''));
                    console.log(`[YahooJP] Found price (State) for ${code}: ${price}`);
                    return price;
                }
            } catch (e) {
                console.warn(`[YahooJP] JSON parse error for ${code}`, e);
            }
        }

        // Method 2: Regex for rendered HTML (Backup)
        // Look for the header logic if JSON fails
        const match = text.match(/基準価格[^0-9]*([0-9,]+)/); // Modified to "基準価格" based on debug
        if (match && match[1]) {
            const rawPrice = match[1].replace(/,/g, '');
            // Verify it is a reasonable number (e.g. > 1000)
            const p = parseFloat(rawPrice);
            if (p > 1000) {
                console.log(`[YahooJP] Found price (Regex) for ${code}: ${p}`);
                return p;
            }
        }

        console.warn(`[YahooJP] Could not parse price for ${code}`);
        return null;

    } catch (error) {
        console.error(`[YahooJP] Error fetching ${code}:`, error);
        return null;
    }
}
