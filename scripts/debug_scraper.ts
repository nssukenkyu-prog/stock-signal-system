
import { fetchFundPrice } from '../src/data/yahoo-finance-jp';
import * as fs from 'fs';

async function debug() {
    const code = '9I312179';
    const url = `https://finance.yahoo.co.jp/quote/${code}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
    });
    const text = await res.text();

    fs.writeFileSync('debug.html', text);
    console.log('Written to debug.html');
}
debug();
