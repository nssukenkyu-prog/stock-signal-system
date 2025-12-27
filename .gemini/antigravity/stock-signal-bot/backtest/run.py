#!/usr/bin/env python3
"""
Stock Signal Bot - Backtest Framework
Walk-forward validation with performance metrics

Requirements:
    pip install pandas numpy yfinance matplotlib

Usage:
    python run.py                     # Run full backtest
    python run.py --symbols NVDA AAPL # Specific symbols
    python run.py --walk-forward      # Walk-forward validation
"""

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np

try:
    import pandas as pd
    import yfinance as yf
except ImportError:
    print("Please install: pip install pandas numpy yfinance")
    exit(1)


# =====================================================
# Signal Generation Logic (Python port)
# =====================================================

def calculate_rsi(closes: pd.Series, period: int = 14) -> float:
    """Calculate RSI indicator."""
    delta = closes.diff()
    gain = delta.where(delta > 0, 0.0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50.0


def calculate_sma(closes: pd.Series, period: int) -> float:
    """Calculate Simple Moving Average."""
    return closes.rolling(period).mean().iloc[-1]


def calculate_atr(df: pd.DataFrame, period: int = 20) -> float:
    """Calculate Average True Range."""
    high = df['High']
    low = df['Low']
    close = df['Close'].shift(1)
    
    tr = pd.concat([
        high - low,
        (high - close).abs(),
        (low - close).abs()
    ], axis=1).max(axis=1)
    
    return tr.rolling(period).mean().iloc[-1]


def calculate_adx(df: pd.DataFrame, period: int = 14) -> Dict[str, float]:
    """Calculate ADX with DI+ and DI-."""
    high = df['High']
    low = df['Low']
    close = df['Close']
    
    # True Range
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs()
    ], axis=1).max(axis=1)
    
    # Directional Movement
    up_move = high - high.shift(1)
    down_move = low.shift(1) - low
    
    dm_plus = np.where((up_move > down_move) & (up_move > 0), up_move, 0)
    dm_minus = np.where((down_move > up_move) & (down_move > 0), down_move, 0)
    
    # Smoothed values
    atr = pd.Series(tr).rolling(period).mean()
    dm_plus_smooth = pd.Series(dm_plus).rolling(period).mean()
    dm_minus_smooth = pd.Series(dm_minus).rolling(period).mean()
    
    di_plus = (dm_plus_smooth / atr) * 100
    di_minus = (dm_minus_smooth / atr) * 100
    
    dx = (abs(di_plus - di_minus) / (di_plus + di_minus)) * 100
    adx = dx.rolling(period).mean()
    
    return {
        'adx': adx.iloc[-1] if not pd.isna(adx.iloc[-1]) else 0,
        'di_plus': di_plus.iloc[-1] if not pd.isna(di_plus.iloc[-1]) else 0,
        'di_minus': di_minus.iloc[-1] if not pd.isna(di_minus.iloc[-1]) else 0,
    }


def generate_signal(df: pd.DataFrame, horizon: int = 60) -> Dict[str, Any]:
    """
    Generate trading signal based on L1-L4 factors.
    Returns signal with action, confidence, and reasons.
    """
    if len(df) < 120:
        return {'action': 'HOLD', 'confidence': 0.5, 'reasons': ['Insufficient data']}
    
    closes = df['Close']
    current_price = closes.iloc[-1]
    
    # Calculate indicators
    rsi = calculate_rsi(closes)
    sma20 = calculate_sma(closes, 20)
    sma60 = calculate_sma(closes, 60)
    atr = calculate_atr(df)
    adx_data = calculate_adx(df)
    
    # Volume ratio
    vol_avg = df['Volume'].rolling(20).mean().iloc[-1]
    vol_ratio = df['Volume'].iloc[-1] / vol_avg if vol_avg > 0 else 1.0
    
    # Volatility-based target
    atr_pct = (atr / current_price) * 100
    target_pct = max(5, min(30, atr_pct * 2))
    
    # ===== L1: Upside probability =====
    l1_score = 0.5
    reasons = []
    
    # RSI factor
    if rsi < 30:
        l1_score += 0.15
        reasons.append(f'RSI {rsi:.0f} (oversold)')
    elif rsi < 50:
        l1_score += 0.05
    elif rsi > 70:
        l1_score -= 0.1
    
    # Trend factor
    if current_price > sma60 and current_price > sma20:
        l1_score += 0.1
        reasons.append('Above 20 & 60 SMA')
    elif current_price > sma60:
        l1_score += 0.05
    elif current_price < sma60 and current_price < sma20:
        l1_score -= 0.1
    
    # Volume factor
    if vol_ratio > 1.5:
        l1_score += 0.05
        reasons.append(f'Volume {vol_ratio:.1f}x avg')
    
    # ===== L2: Downside probability =====
    l2_score = 0.5
    
    if rsi > 70:
        l2_score += 0.15
    elif rsi > 50:
        l2_score += 0.05
    elif rsi < 30:
        l2_score -= 0.1
    
    if current_price < sma60 and current_price < sma20:
        l2_score += 0.1
    
    # ===== L3: Expected return =====
    expected_return = l1_score * target_pct - l2_score * target_pct
    
    # ===== L4: Trend =====
    adx = adx_data['adx']
    di_plus = adx_data['di_plus']
    di_minus = adx_data['di_minus']
    
    if adx < 20:
        trend = 'RANGE'
    elif di_plus > di_minus:
        trend = 'UPTREND'
        reasons.append('Uptrend (ADX)')
    else:
        trend = 'DOWNTREND'
    
    # ===== Aggregate =====
    l1_score = np.clip(l1_score, 0.1, 0.9)
    l2_score = np.clip(l2_score, 0.1, 0.9)
    
    # Decision logic
    buy_conditions = [l1_score >= 0.6, expected_return > 0, trend in ['UPTREND', 'RANGE']]
    sell_conditions = [l2_score >= 0.6, expected_return < 0, trend == 'DOWNTREND']
    
    buy_score = sum(buy_conditions)
    sell_score = sum(sell_conditions)
    
    if buy_score >= 2 and sell_score < 2:
        action = 'BUY'
        confidence = (l1_score + (0.7 if adx > 25 else 0.5)) / 2
    elif sell_score >= 2 and buy_score < 2:
        action = 'SELL'
        confidence = (l2_score + (0.7 if adx > 25 else 0.5)) / 2
    elif buy_score >= 1 or sell_score >= 1:
        action = 'WATCH'
        confidence = 0.5
    else:
        action = 'HOLD'
        confidence = 0.5
    
    return {
        'action': action,
        'confidence': float(np.clip(confidence, 0, 1)),
        'l1': float(l1_score),
        'l2': float(l2_score),
        'expected_return': float(expected_return),
        'trend': trend,
        'reasons': reasons,
        'target_pct': float(target_pct),
    }


# =====================================================
# Backtest Engine
# =====================================================

def fetch_data(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch historical data from Yahoo Finance."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start_date, end=end_date)
    return df


def backtest_symbol(
    symbol: str,
    df: pd.DataFrame,
    lookback: int = 120,
    horizon: int = 60
) -> List[Dict]:
    """
    Run backtest for a single symbol.
    Returns list of predictions with outcomes.
    """
    results = []
    
    for i in range(lookback, len(df) - horizon):
        # Get data up to current point
        current_df = df.iloc[:i+1].copy()
        
        # Generate signal
        signal = generate_signal(current_df, horizon)
        
        if signal['action'] not in ['BUY', 'SELL']:
            continue
        
        # Calculate actual outcome
        entry_price = current_df['Close'].iloc[-1]
        future_prices = df.iloc[i+1:i+1+horizon]
        
        if len(future_prices) < horizon:
            continue
        
        max_price = future_prices['High'].max()
        min_price = future_prices['Low'].min()
        final_price = future_prices['Close'].iloc[-1]
        
        max_return = (max_price - entry_price) / entry_price * 100
        min_return = (min_price - entry_price) / entry_price * 100
        actual_return = (final_price - entry_price) / entry_price * 100
        
        results.append({
            'symbol': symbol,
            'date': current_df.index[-1].strftime('%Y-%m-%d'),
            'action': signal['action'],
            'confidence': signal['confidence'],
            'l1': signal['l1'],
            'l2': signal['l2'],
            'expected_return': signal['expected_return'],
            'entry_price': float(entry_price),
            'actual_return': float(actual_return),
            'max_return': float(max_return),
            'min_return': float(min_return),
            'hit_target': max_return >= signal['target_pct'] if signal['action'] == 'BUY' else min_return <= -signal['target_pct'],
        })
    
    return results


def calculate_metrics(results: List[Dict]) -> Dict:
    """Calculate performance metrics from backtest results."""
    if not results:
        return {}
    
    df = pd.DataFrame(results)
    
    # BUY signals
    buy_signals = df[df['action'] == 'BUY']
    buy_correct = len(buy_signals[buy_signals['actual_return'] > 0])
    buy_total = len(buy_signals)
    
    # SELL signals
    sell_signals = df[df['action'] == 'SELL']
    sell_correct = len(sell_signals[sell_signals['actual_return'] < 0])
    sell_total = len(sell_signals)
    
    # Overall win rate
    total_correct = buy_correct + sell_correct
    total_signals = buy_total + sell_total
    win_rate = total_correct / total_signals if total_signals > 0 else 0
    
    # Average return (considering direction)
    returns = []
    for _, row in df.iterrows():
        if row['action'] == 'BUY':
            returns.append(row['actual_return'])
        else:
            returns.append(-row['actual_return'])  # Invert for SELL
    
    avg_return = np.mean(returns) if returns else 0
    
    # Profit factor
    profits = [r for r in returns if r > 0]
    losses = [abs(r) for r in returns if r < 0]
    profit_factor = sum(profits) / sum(losses) if losses and sum(losses) > 0 else float('inf')
    
    # Maximum drawdown (simulated)
    cumulative = np.cumsum(returns)
    running_max = np.maximum.accumulate(cumulative)
    drawdown = cumulative - running_max
    max_drawdown = abs(np.min(drawdown)) if len(drawdown) > 0 else 0
    
    # Target hit rate
    hit_rate = len(df[df['hit_target']]) / len(df) if len(df) > 0 else 0
    
    return {
        'total_signals': total_signals,
        'buy_signals': buy_total,
        'sell_signals': sell_total,
        'win_rate': float(win_rate),
        'avg_return': float(avg_return),
        'profit_factor': float(profit_factor) if profit_factor != float('inf') else 999.99,
        'max_drawdown': float(max_drawdown),
        'target_hit_rate': float(hit_rate),
    }


def walk_forward_validation(
    symbol: str,
    df: pd.DataFrame,
    n_periods: int = 12,
    train_pct: float = 0.7
) -> List[Dict]:
    """
    Perform walk-forward validation.
    Splits data into n_periods and tests each period.
    """
    period_results = []
    period_len = len(df) // n_periods
    
    for i in range(n_periods):
        start_idx = i * period_len
        end_idx = (i + 2) * period_len if i < n_periods - 1 else len(df)
        
        if end_idx > len(df):
            break
        
        period_df = df.iloc[start_idx:end_idx]
        
        if len(period_df) < 180:
            continue
        
        # Backtest this period
        results = backtest_symbol(symbol, period_df)
        metrics = calculate_metrics(results)
        
        if metrics:
            metrics['period'] = i + 1
            metrics['start_date'] = period_df.index[0].strftime('%Y-%m-%d')
            metrics['end_date'] = period_df.index[-1].strftime('%Y-%m-%d')
            period_results.append(metrics)
    
    return period_results


# =====================================================
# Report Generation
# =====================================================

def generate_report(all_results: Dict, output_path: Path):
    """Generate HTML report from backtest results."""
    
    html = """
<!DOCTYPE html>
<html>
<head>
    <title>Stock Signal Bot - Backtest Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #4CAF50; color: white; }
        tr:hover { background: #f5f5f5; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 15px; background: #e8f5e9; border-radius: 8px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2e7d32; }
        .metric-label { font-size: 12px; color: #666; }
        .good { color: #2e7d32; }
        .bad { color: #c62828; }
        .summary { background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Stock Signal Bot - Backtest Report</h1>
        <p>Generated: """ + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + """</p>
"""
    
    # Overall metrics
    if 'overall' in all_results:
        overall = all_results['overall']
        html += """
        <div class="summary">
            <h2>Overall Performance</h2>
            <div class="metric">
                <div class="metric-value">""" + f"{overall.get('win_rate', 0)*100:.1f}%" + """</div>
                <div class="metric-label">Win Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">""" + f"{overall.get('profit_factor', 0):.2f}" + """</div>
                <div class="metric-label">Profit Factor</div>
            </div>
            <div class="metric">
                <div class="metric-value">""" + f"{overall.get('avg_return', 0):.2f}%" + """</div>
                <div class="metric-label">Avg Return</div>
            </div>
            <div class="metric">
                <div class="metric-value">""" + f"{overall.get('max_drawdown', 0):.2f}%" + """</div>
                <div class="metric-label">Max Drawdown</div>
            </div>
        </div>
"""
    
    # Per-symbol results
    if 'by_symbol' in all_results:
        html += """
        <h2>Performance by Symbol</h2>
        <table>
            <tr>
                <th>Symbol</th>
                <th>Signals</th>
                <th>Win Rate</th>
                <th>Avg Return</th>
                <th>Profit Factor</th>
                <th>Max DD</th>
            </tr>
"""
        for symbol, metrics in all_results['by_symbol'].items():
            wr_class = 'good' if metrics.get('win_rate', 0) > 0.5 else 'bad'
            html += f"""
            <tr>
                <td><strong>{symbol}</strong></td>
                <td>{metrics.get('total_signals', 0)}</td>
                <td class="{wr_class}">{metrics.get('win_rate', 0)*100:.1f}%</td>
                <td>{metrics.get('avg_return', 0):.2f}%</td>
                <td>{metrics.get('profit_factor', 0):.2f}</td>
                <td class="bad">{metrics.get('max_drawdown', 0):.2f}%</td>
            </tr>
"""
        html += "</table>"
    
    # Walk-forward results
    if 'walk_forward' in all_results:
        html += """
        <h2>Walk-Forward Validation</h2>
        <table>
            <tr>
                <th>Period</th>
                <th>Date Range</th>
                <th>Signals</th>
                <th>Win Rate</th>
                <th>Profit Factor</th>
            </tr>
"""
        for period in all_results['walk_forward']:
            wr_class = 'good' if period.get('win_rate', 0) > 0.5 else 'bad'
            html += f"""
            <tr>
                <td>{period.get('period', '')}</td>
                <td>{period.get('start_date', '')} to {period.get('end_date', '')}</td>
                <td>{period.get('total_signals', 0)}</td>
                <td class="{wr_class}">{period.get('win_rate', 0)*100:.1f}%</td>
                <td>{period.get('profit_factor', 0):.2f}</td>
            </tr>
"""
        html += "</table>"
    
    html += """
        <hr>
        <p style="color: #666; font-size: 12px;">
            ⚠️ 免責事項: このバックテストは過去のデータに基づくものであり、将来のパフォーマンスを保証するものではありません。
        </p>
    </div>
</body>
</html>
"""
    
    output_path.write_text(html)
    print(f"Report saved to: {output_path}")


# =====================================================
# Main Entry Point
# =====================================================

def main():
    parser = argparse.ArgumentParser(description='Stock Signal Bot Backtest')
    parser.add_argument('--symbols', nargs='+', default=['NVDA', 'CRWD', '7203.T', '9023.T'],
                        help='Symbols to backtest')
    parser.add_argument('--start', default='2023-01-01', help='Start date')
    parser.add_argument('--end', default=datetime.now().strftime('%Y-%m-%d'), help='End date')
    parser.add_argument('--walk-forward', action='store_true', help='Run walk-forward validation')
    parser.add_argument('--periods', type=int, default=12, help='Number of walk-forward periods')
    parser.add_argument('--output', default='reports', help='Output directory')
    
    args = parser.parse_args()
    
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    
    all_results = {
        'by_symbol': {},
        'all_signals': [],
    }
    
    print(f"Running backtest for {len(args.symbols)} symbols...")
    print(f"Date range: {args.start} to {args.end}")
    print("-" * 50)
    
    for symbol in args.symbols:
        print(f"\nProcessing {symbol}...")
        
        try:
            df = fetch_data(symbol, args.start, args.end)
            
            if len(df) < 180:
                print(f"  Skipping {symbol}: insufficient data ({len(df)} days)")
                continue
            
            # Regular backtest
            results = backtest_symbol(symbol, df)
            metrics = calculate_metrics(results)
            
            all_results['by_symbol'][symbol] = metrics
            all_results['all_signals'].extend(results)
            
            print(f"  Signals: {metrics.get('total_signals', 0)}")
            print(f"  Win Rate: {metrics.get('win_rate', 0)*100:.1f}%")
            print(f"  Profit Factor: {metrics.get('profit_factor', 0):.2f}")
            
            # Walk-forward validation
            if args.walk_forward:
                wf_results = walk_forward_validation(symbol, df, args.periods)
                if 'walk_forward' not in all_results:
                    all_results['walk_forward'] = []
                all_results['walk_forward'].extend(wf_results)
        
        except Exception as e:
            print(f"  Error processing {symbol}: {e}")
    
    # Calculate overall metrics
    all_results['overall'] = calculate_metrics(all_results['all_signals'])
    
    print("\n" + "=" * 50)
    print("OVERALL RESULTS")
    print("=" * 50)
    overall = all_results['overall']
    print(f"Total Signals: {overall.get('total_signals', 0)}")
    print(f"Win Rate: {overall.get('win_rate', 0)*100:.1f}%")
    print(f"Average Return: {overall.get('avg_return', 0):.2f}%")
    print(f"Profit Factor: {overall.get('profit_factor', 0):.2f}")
    print(f"Max Drawdown: {overall.get('max_drawdown', 0):.2f}%")
    
    # Generate report
    report_path = output_dir / f"backtest_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    generate_report(all_results, report_path)
    
    # Save raw results
    json_path = output_dir / f"backtest_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(json_path, 'w') as f:
        # Convert for JSON serialization
        json_results = {
            'overall': all_results['overall'],
            'by_symbol': all_results['by_symbol'],
            'walk_forward': all_results.get('walk_forward', []),
        }
        json.dump(json_results, f, indent=2)
    print(f"Results saved to: {json_path}")


if __name__ == '__main__':
    main()
