#!/usr/bin/env bash
# 07-verify.sh — Smoke test the deployed Statera app
# Usage: ./07-verify.sh
# Pre-requisites: All previous steps completed

set -euo pipefail

read -r -p "Enter CloudFront domain (e.g. d1abc.cloudfront.net): " CF_DOMAIN
BASE="https://${CF_DOMAIN}"

echo ""
echo "==> [Verify] Testing API ping..."
PING=$(curl -sf "${BASE}/api/v1/ping" || echo "FAIL")
if [[ "$PING" == *"ok"* ]]; then
  echo "    ✓ /api/v1/ping → OK"
else
  echo "    ✗ /api/v1/ping FAILED: $PING"
fi

echo "==> [Verify] Testing API health..."
HEALTH=$(curl -sf "${BASE}/api/v1/health" || echo "FAIL")
if [[ "$HEALTH" == *"healthy"* ]] || [[ "$HEALTH" == *"ok"* ]]; then
  echo "    ✓ /api/v1/health → OK"
else
  echo "    ✗ /api/v1/health FAILED: $HEALTH"
fi

echo "==> [Verify] Testing frontend loads..."
HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" "${BASE}/")
if [ "$HTTP_CODE" = "200" ]; then
  echo "    ✓ / → HTTP 200"
else
  echo "    ✗ / → HTTP $HTTP_CODE (expected 200)"
fi

echo "==> [Verify] Testing SPA routing (direct URL to /app)..."
HTTP_CODE2=$(curl -so /dev/null -w "%{http_code}" "${BASE}/app")
if [ "$HTTP_CODE2" = "200" ]; then
  echo "    ✓ /app → HTTP 200 (SPA routing works)"
else
  echo "    ✗ /app → HTTP $HTTP_CODE2 (SPA routing may be broken)"
fi

echo "==> [Verify] Testing auth endpoint (expect 401)..."
HTTP_AUTH=$(curl -so /dev/null -w "%{http_code}" "${BASE}/api/v1/auth/me")
if [ "$HTTP_AUTH" = "401" ]; then
  echo "    ✓ /api/v1/auth/me → HTTP 401 (auth is working)"
else
  echo "    ✗ /api/v1/auth/me → HTTP $HTTP_AUTH (expected 401)"
fi

echo ""
echo "==> Summary: ${BASE}"
echo "  If all checks passed, your app is live at: ${BASE}"
echo "  Admin login: use the credentials from DevDataSeeder (check Seed.cs)"
echo "  Swagger:     https://APPRUNNER_URL/swagger (direct App Runner URL)"
