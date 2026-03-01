#!/usr/bin/env bash
# 04-secrets.sh — Store sensitive values in AWS Secrets Manager
# Usage: ./04-secrets.sh
# Pre-requisites: AWS CLI configured, RDS endpoint from step 03

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

echo "==> [Secrets Manager] Storing DB connection string..."
read -r -p "    RDS endpoint (from 03-rds.sh output, e.g. statera-db.xxx.rds.amazonaws.com): " RDS_ENDPOINT
read -r -p "    DB master username (default: sa_statera): " DB_USER
DB_USER="${DB_USER:-sa_statera}"
read -r -s -p "    DB password: " DB_PASSWORD
echo ""

CONN_STRING="Server=${RDS_ENDPOINT},1433;Database=Statera;User Id=${DB_USER};Password=${DB_PASSWORD};TrustServerCertificate=True;MultipleActiveResultSets=true"

aws secretsmanager create-secret \
  --name "statera/db-connection" \
  --description "Statera RDS SQL Server connection string" \
  --secret-string "$CONN_STRING" \
  --region "$REGION" \
  2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id "statera/db-connection" \
  --secret-string "$CONN_STRING" \
  --region "$REGION"

echo "    ✓ DB connection string stored"

echo "==> [Secrets Manager] Storing JWT signing key..."
read -r -s -p "    Enter a strong JWT key (min 32 chars, random string): " JWT_KEY
echo ""

# Auto-generate if empty
if [ -z "$JWT_KEY" ]; then
  JWT_KEY=$(openssl rand -base64 48)
  echo "    Auto-generated JWT key: $JWT_KEY"
  echo "    (Save this — you'll need it if you ever rotate)"
fi

aws secretsmanager create-secret \
  --name "statera/jwt-key" \
  --description "Statera JWT signing key" \
  --secret-string "$JWT_KEY" \
  --region "$REGION" \
  2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id "statera/jwt-key" \
  --secret-string "$JWT_KEY" \
  --region "$REGION"

echo "    ✓ JWT key stored"

echo ""
echo "✓ Secrets stored in Secrets Manager (region: ${REGION})"
echo "  statera/db-connection"
echo "  statera/jwt-key"
echo ""
echo "  Secret ARNs (needed for App Runner):"
aws secretsmanager describe-secret --secret-id "statera/db-connection" \
  --query 'ARN' --output text
aws secretsmanager describe-secret --secret-id "statera/jwt-key" \
  --query 'ARN' --output text
