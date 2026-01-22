#!/bin/bash
# =====================================================
# Stock Signal Bot - Secrets Setup
# =====================================================

echo "🔐 Setting up Cloudflare Secrets"
echo "================================="
echo ""
echo "This script will configure the following secrets:"
echo "- LINE_CHANNEL_ACCESS_TOKEN"
echo "- LINE_USER_ID"
echo ""

# LINE Channel Access Token
echo "Setting LINE_CHANNEL_ACCESS_TOKEN..."
echo "Paste your LINE Channel Access Token and press Enter:"
read -s LINE_TOKEN
echo "$LINE_TOKEN" | wrangler secret put LINE_CHANNEL_ACCESS_TOKEN

# LINE User ID
echo ""
echo "Setting LINE_USER_ID..."
echo "Paste your LINE User ID and press Enter:"
read LINE_USER
echo "$LINE_USER" | wrangler secret put LINE_USER_ID

echo ""
echo "✅ Secrets configured successfully!"
echo ""
echo "You can verify with: wrangler secret list"
