#!/bin/bash
# =====================================================
# Stock Signal Bot - Deployment Script
# =====================================================

set -e

echo "🚀 Stock Signal Bot Deployment"
echo "=============================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in
echo "📋 Checking Cloudflare login..."
if ! wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare:"
    wrangler login
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create KV namespace if not exists
echo "🗄️ Setting up KV namespace..."
KV_OUTPUT=$(wrangler kv:namespace create "STATE" 2>&1 || true)
if echo "$KV_OUTPUT" | grep -q "already exists"; then
    echo "  KV namespace already exists"
else
    echo "  Created KV namespace"
    echo "  ⚠️  Update wrangler.toml with the KV namespace ID from above output"
fi

# Create D1 database if not exists
echo "💾 Setting up D1 database..."
D1_OUTPUT=$(wrangler d1 create stock-signals 2>&1 || true)
if echo "$D1_OUTPUT" | grep -q "already exists"; then
    echo "  D1 database already exists"
else
    echo "  Created D1 database"
    echo "  ⚠️  Update wrangler.toml with the D1 database ID from above output"
fi

# Run migrations
echo "📊 Running database migrations..."
wrangler d1 execute stock-signals --file=./migrations/0001_init.sql --remote
wrangler d1 execute stock-signals --file=./migrations/0002_seed.sql --remote

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with KV and D1 IDs if needed"
echo "2. Set secrets with: ./scripts/setup-secrets.sh"
echo "3. Deploy with: npm run deploy"
