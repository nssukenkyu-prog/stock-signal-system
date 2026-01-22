
// Test script for Yahoo Finance JP Scraper
// Run with: npx ts-node --esm scripts/test_scraper.ts

import { fetchFundPrice } from '../src/data/yahoo-finance-jp';

async function main() {
    const testCodes = [
        '9I312179', // 楽天VTI
        '48313159'  // BlackRock ESG
    ];

    for (const code of testCodes) {
        console.log(`Testing ${code}...`);
        const price = await fetchFundPrice(code);
        console.log(`Result for ${code}: ${price}`);
    }
}

main();
