#!/usr/bin/env bash
# 03-rds.sh — Create VPC, private subnets, security groups, and RDS SQL Server Express
# Usage: ./03-rds.sh
# Pre-requisites: AWS CLI configured, run from repo root

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
DB_IDENTIFIER="statera-db"
DB_NAME="Statera"
DB_MASTER_USER="sa_statera"
# DB password is prompted — never stored in script
DB_ENGINE="sqlserver-ex"        # SQL Server Express (no additional license fee)
DB_ENGINE_VERSION="15.00.4382.1.v1"   # SQL Server 2019 Express
DB_INSTANCE_CLASS="db.t3.small"
DB_STORAGE=20    # GB (Express edition max is 10GB enforced by RDS, but 20 declared)

echo "==> [VPC] Creating VPC..."
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --region "$REGION" \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=statera-vpc}]" \
  --query 'Vpc.VpcId' --output text)
echo "    VPC: $VPC_ID"

# Enable DNS hostnames (required for RDS)
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames "{\"Value\":true}"
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support "{\"Value\":true}"

echo "==> [VPC] Creating private subnets in two AZs..."
AZS=($(aws ec2 describe-availability-zones --region "$REGION" \
  --query 'AvailabilityZones[0:2].ZoneName' --output text))

SUBNET1_ID=$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block 10.0.1.0/24 \
  --availability-zone "${AZS[0]}" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=statera-private-1}]" \
  --query 'Subnet.SubnetId' --output text)

SUBNET2_ID=$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block 10.0.2.0/24 \
  --availability-zone "${AZS[1]}" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=statera-private-2}]" \
  --query 'Subnet.SubnetId' --output text)

echo "    Subnet 1: $SUBNET1_ID (${AZS[0]})"
echo "    Subnet 2: $SUBNET2_ID (${AZS[1]})"

echo "==> [VPC] Creating DB subnet group..."
aws rds create-db-subnet-group \
  --db-subnet-group-name "statera-db-subnet-group" \
  --db-subnet-group-description "Statera RDS private subnets" \
  --subnet-ids "$SUBNET1_ID" "$SUBNET2_ID"

echo "==> [VPC] Creating security group for RDS..."
RDS_SG_ID=$(aws ec2 create-security-group \
  --group-name "statera-rds-sg" \
  --description "Statera RDS SQL Server — allow App Runner VPC connector" \
  --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text)
echo "    RDS SG: $RDS_SG_ID"

echo "==> [VPC] Creating security group for App Runner VPC connector..."
APPRUNNER_SG_ID=$(aws ec2 create-security-group \
  --group-name "statera-apprunner-sg" \
  --description "Statera App Runner VPC connector outbound" \
  --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text)
echo "    App Runner SG: $APPRUNNER_SG_ID"

# Allow App Runner SG to reach RDS on port 1433
aws ec2 authorize-security-group-ingress \
  --group-id "$RDS_SG_ID" \
  --protocol tcp \
  --port 1433 \
  --source-group "$APPRUNNER_SG_ID"

echo "==> [RDS] Creating SQL Server Express instance (takes ~10 minutes)..."
read -r -s -p "    Enter a strong DB password (min 8 chars, letters+numbers+symbols): " DB_PASSWORD
echo ""

aws rds create-db-instance \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --db-instance-class "$DB_INSTANCE_CLASS" \
  --engine "$DB_ENGINE" \
  --engine-version "$DB_ENGINE_VERSION" \
  --master-username "$DB_MASTER_USER" \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage "$DB_STORAGE" \
  --db-subnet-group-name "statera-db-subnet-group" \
  --vpc-security-group-ids "$RDS_SG_ID" \
  --no-publicly-accessible \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Mon:04:00-Mon:05:00" \
  --storage-encrypted \
  --license-model "license-included" \
  --region "$REGION"

echo ""
echo "==> Waiting for RDS instance to become available (this takes ~10 minutes)..."
aws rds wait db-instance-available --db-instance-identifier "$DB_IDENTIFIER"

RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --query 'DBInstances[0].Endpoint.Address' --output text)

echo ""
echo "✓ RDS SQL Server Express ready!"
echo "  Endpoint: ${RDS_ENDPOINT}"
echo "  Port:     1433"
echo "  Username: ${DB_MASTER_USER}"
echo "  DB Name:  ${DB_NAME}"
echo ""
echo "  Save these for 04-secrets.sh:"
echo "  APPRUNNER_SG_ID=${APPRUNNER_SG_ID}"
echo "  SUBNET1_ID=${SUBNET1_ID}"
echo "  SUBNET2_ID=${SUBNET2_ID}"
echo "  Connection string:"
echo "  Server=${RDS_ENDPOINT},1433;Database=${DB_NAME};User Id=${DB_MASTER_USER};Password=<your-password>;TrustServerCertificate=True;MultipleActiveResultSets=true"
