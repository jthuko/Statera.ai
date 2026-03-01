#!/usr/bin/env bash
# 05-apprunner.sh — Create App Runner service with VPC connector
# Usage: ./05-apprunner.sh
# Pre-requisites: ECR image pushed (02-ecr.sh), Secrets stored (04-secrets.sh), VPC setup (03-rds.sh)

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="statera-api"
SERVICE_NAME="statera-api"

ECR_IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:latest"

read -r -p "Enter APPRUNNER_SG_ID (from 03-rds.sh output): " APPRUNNER_SG_ID
read -r -p "Enter SUBNET1_ID (from 03-rds.sh output): " SUBNET1_ID
read -r -p "Enter SUBNET2_ID (from 03-rds.sh output): " SUBNET2_ID

# Get secret ARNs
DB_SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "statera/db-connection" \
  --query 'ARN' --output text --region "$REGION")
JWT_SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "statera/jwt-key" \
  --query 'ARN' --output text --region "$REGION")

echo "==> [App Runner] Creating IAM role for ECR access..."
TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "build.apprunner.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

ACCESS_ROLE_ARN=$(aws iam create-role \
  --role-name "statera-apprunner-ecr-role" \
  --assume-role-policy-document "$TRUST_POLICY" \
  --query 'Role.Arn' --output text \
  2>/dev/null || aws iam get-role \
    --role-name "statera-apprunner-ecr-role" \
    --query 'Role.Arn' --output text)

aws iam attach-role-policy \
  --role-name "statera-apprunner-ecr-role" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess" \
  2>/dev/null || true

echo "==> [App Runner] Creating IAM role for runtime (Secrets Manager access)..."
INSTANCE_TRUST='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "tasks.apprunner.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

INSTANCE_ROLE_ARN=$(aws iam create-role \
  --role-name "statera-apprunner-instance-role" \
  --assume-role-policy-document "$INSTANCE_TRUST" \
  --query 'Role.Arn' --output text \
  2>/dev/null || aws iam get-role \
    --role-name "statera-apprunner-instance-role" \
    --query 'Role.Arn' --output text)

# Allow reading our specific secrets
SECRETS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue"],
    "Resource": [
      "${DB_SECRET_ARN}",
      "${JWT_SECRET_ARN}"
    ]
  }]
}
EOF
)

aws iam put-role-policy \
  --role-name "statera-apprunner-instance-role" \
  --policy-name "statera-secrets-access" \
  --policy-document "$SECRETS_POLICY"

echo "==> [App Runner] Creating VPC connector..."
VPC_CONNECTOR_ARN=$(aws apprunner create-vpc-connector \
  --vpc-connector-name "statera-vpc-connector" \
  --subnets "$SUBNET1_ID" "$SUBNET2_ID" \
  --security-groups "$APPRUNNER_SG_ID" \
  --region "$REGION" \
  --query 'VpcConnector.VpcConnectorArn' --output text)

echo "    VPC Connector: $VPC_CONNECTOR_ARN"

echo "==> [App Runner] Creating service (this takes ~3-5 minutes)..."
SERVICE_ARN=$(aws apprunner create-service \
  --service-name "$SERVICE_NAME" \
  --region "$REGION" \
  --source-configuration "{
    \"AuthenticationConfiguration\": {
      \"AccessRoleArn\": \"${ACCESS_ROLE_ARN}\"
    },
    \"ImageRepository\": {
      \"ImageIdentifier\": \"${ECR_IMAGE_URI}\",
      \"ImageRepositoryType\": \"ECR\",
      \"ImageConfiguration\": {
        \"Port\": \"8080\",
        \"RuntimeEnvironmentVariables\": {
          \"ASPNETCORE_ENVIRONMENT\": \"Production\",
          \"ASPNETCORE_URLS\": \"http://+:8080\",
          \"Jwt__Issuer\": \"statera\",
          \"Jwt__Audience\": \"statera-web\"
        },
        \"RuntimeEnvironmentSecrets\": {
          \"ConnectionStrings__DefaultConnection\": \"${DB_SECRET_ARN}\",
          \"Jwt__Key\": \"${JWT_SECRET_ARN}\"
        }
      }
    },
    \"AutoDeploymentsEnabled\": true
  }" \
  --instance-configuration "{
    \"Cpu\": \"1 vCPU\",
    \"Memory\": \"2 GB\",
    \"InstanceRoleArn\": \"${INSTANCE_ROLE_ARN}\"
  }" \
  --network-configuration "{
    \"EgressConfiguration\": {
      \"EgressType\": \"VPC\",
      \"VpcConnectorArn\": \"${VPC_CONNECTOR_ARN}\"
    }
  }" \
  --query 'Service.ServiceArn' --output text)

echo "==> Waiting for App Runner service to be running..."
aws apprunner wait service-running \
  --service-arn "$SERVICE_ARN" \
  --region "$REGION"

SERVICE_URL=$(aws apprunner describe-service \
  --service-arn "$SERVICE_ARN" \
  --region "$REGION" \
  --query 'Service.ServiceUrl' --output text)

echo ""
echo "✓ App Runner service is live!"
echo "  Service ARN: ${SERVICE_ARN}"
echo "  Service URL: https://${SERVICE_URL}"
echo "  Swagger:     https://${SERVICE_URL}/swagger"
echo ""
echo "  Next: update appsettings.Production.json with these values, then run 06-frontend.sh"
echo "  APP_RUNNER_SERVICE_ARN=${SERVICE_ARN}"
echo "  APPRUNNER_URL=https://${SERVICE_URL}"
