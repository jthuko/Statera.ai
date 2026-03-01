#!/usr/bin/env bash
# 06-frontend.sh — Build React app, upload to S3, create CloudFront distribution
# Usage: ./06-frontend.sh
# Pre-requisites: App Runner URL from 05-apprunner.sh, Node.js 20 installed

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="${S3_BUCKET_NAME:-statera-web-prod-${ACCOUNT_ID}}"

read -r -p "Enter App Runner service URL (e.g. https://xxxxx.us-east-1.awsapprunner.com): " APPRUNNER_URL
APPRUNNER_ORIGIN="${APPRUNNER_URL#https://}"   # strip https:// for CloudFront

echo "==> [Frontend] Building React app..."
(cd frontend/statera-web && npm ci && npm run build)

echo "==> [S3] Creating bucket: ${BUCKET_NAME}..."
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION"
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=${REGION}"
fi

# Block all public access — CloudFront will be the only access point
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "==> [S3] Uploading frontend build..."
aws s3 sync frontend/statera-web/dist/ "s3://${BUCKET_NAME}/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# index.html: no-cache so browser always fetches latest
aws s3 cp frontend/statera-web/dist/index.html "s3://${BUCKET_NAME}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate"

echo "==> [CloudFront] Creating Origin Access Control for S3..."
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config "{
    \"Name\": \"statera-s3-oac\",
    \"Description\": \"OAC for Statera S3 bucket\",
    \"SigningProtocol\": \"sigv4\",
    \"SigningBehavior\": \"always\",
    \"OriginAccessControlOriginType\": \"s3\"
  }" \
  --query 'OriginAccessControl.Id' --output text)

echo "==> [CloudFront] Creating distribution with dual-origin routing..."
DISTRIBUTION=$(aws cloudfront create-distribution --distribution-config "{
  \"CallerReference\": \"statera-$(date +%s)\",
  \"Comment\": \"Statera production\",
  \"DefaultRootObject\": \"index.html\",
  \"Origins\": {
    \"Quantity\": 2,
    \"Items\": [
      {
        \"Id\": \"s3-origin\",
        \"DomainName\": \"${BUCKET_NAME}.s3.${REGION}.amazonaws.com\",
        \"S3OriginConfig\": { \"OriginAccessIdentity\": \"\" },
        \"OriginAccessControlId\": \"${OAC_ID}\"
      },
      {
        \"Id\": \"api-origin\",
        \"DomainName\": \"${APPRUNNER_ORIGIN}\",
        \"CustomOriginConfig\": {
          \"HTTPSPort\": 443,
          \"OriginProtocolPolicy\": \"https-only\",
          \"OriginSSLProtocols\": { \"Quantity\": 1, \"Items\": [\"TLSv1.2\"] }
        }
      }
    ]
  },
  \"DefaultCacheBehavior\": {
    \"TargetOriginId\": \"s3-origin\",
    \"ViewerProtocolPolicy\": \"redirect-to-https\",
    \"AllowedMethods\": { \"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"] },
    \"CachePolicyId\": \"658327ea-f89d-4fab-a63d-7e88639e58f6\",
    \"Compress\": true
  },
  \"CacheBehaviors\": {
    \"Quantity\": 1,
    \"Items\": [
      {
        \"PathPattern\": \"/api/*\",
        \"TargetOriginId\": \"api-origin\",
        \"ViewerProtocolPolicy\": \"redirect-to-https\",
        \"AllowedMethods\": {
          \"Quantity\": 7,
          \"Items\": [\"GET\", \"HEAD\", \"OPTIONS\", \"PUT\", \"POST\", \"PATCH\", \"DELETE\"],
          \"CachedMethods\": { \"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"] }
        },
        \"CachePolicyId\": \"4135ea2d-6df8-44a3-9df3-4b5a84be39ad\",
        \"OriginRequestPolicyId\": \"b689b0a8-53d0-40ab-baf2-68738e2966ac\",
        \"Compress\": false
      }
    ]
  },
  \"CustomErrorResponses\": {
    \"Quantity\": 2,
    \"Items\": [
      { \"ErrorCode\": 403, \"ResponseCode\": \"200\", \"ResponsePagePath\": \"/index.html\", \"ErrorCachingMinTTL\": 0 },
      { \"ErrorCode\": 404, \"ResponseCode\": \"200\", \"ResponsePagePath\": \"/index.html\", \"ErrorCachingMinTTL\": 0 }
    ]
  },
  \"Enabled\": true,
  \"HttpVersion\": \"http2\"
}")

DISTRIBUTION_ID=$(echo "$DISTRIBUTION" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Distribution']['Id'])")
CLOUDFRONT_DOMAIN=$(echo "$DISTRIBUTION" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Distribution']['DomainName'])")

echo "==> [S3] Granting CloudFront OAC read access to bucket..."
BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
      }
    }
  }]
}
EOF
)
aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy "$BUCKET_POLICY"

echo ""
echo "✓ Frontend deployed!"
echo "  CloudFront Domain:  https://${CLOUDFRONT_DOMAIN}"
echo "  Distribution ID:    ${DISTRIBUTION_ID}"
echo "  S3 Bucket:          ${BUCKET_NAME}"
echo ""
echo "  ⚠ Note: CloudFront takes ~15 minutes to fully propagate globally."
echo ""
echo "  Next steps:"
echo "  1. Update appsettings.Production.json — replace REPLACE_WITH_CLOUDFRONT_DOMAIN with: ${CLOUDFRONT_DOMAIN}"
echo "  2. Add GitHub Actions secrets:"
echo "     CLOUDFRONT_DISTRIBUTION_ID=${DISTRIBUTION_ID}"
echo "     S3_BUCKET_NAME=${BUCKET_NAME}"
echo "  3. Commit and push to trigger CD pipeline"
