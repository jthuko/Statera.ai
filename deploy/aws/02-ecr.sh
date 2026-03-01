#!/usr/bin/env bash
# 02-ecr.sh — Create ECR repository, build backend Docker image, push to ECR
# Usage: ./02-ecr.sh
# Pre-requisites: AWS CLI configured, Docker running, run from repo root

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="statera-api"
IMAGE_TAG="latest"

echo "==> [ECR] Creating repository (skip if exists)..."
aws ecr create-repository \
  --repository-name "$REPO_NAME" \
  --region "$REGION" \
  --image-scanning-configuration scanOnPush=true \
  2>/dev/null || echo "    Repository already exists — OK"

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"

echo "==> [ECR] Authenticating Docker to ECR..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "==> [Docker] Building backend image (from backend/ directory)..."
docker build -t "${REPO_NAME}:${IMAGE_TAG}" ./backend

echo "==> [Docker] Tagging image..."
docker tag "${REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"

echo "==> [ECR] Pushing image..."
docker push "${ECR_URI}:${IMAGE_TAG}"

echo ""
echo "✓ Image pushed to: ${ECR_URI}:${IMAGE_TAG}"
echo "  Save this URI — you'll need it in 05-apprunner.sh"
echo "  ECR_IMAGE_URI=${ECR_URI}:${IMAGE_TAG}"
