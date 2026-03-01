# Statera AWS Deployment Guide

## Architecture

```
Browser
  │
  └── CloudFront (HTTPS, free SSL via ACM)
        ├── /api/*  ──────► App Runner  (backend .NET 8, auto-scales)
        │                       └── VPC Connector ──► RDS SQL Server Express
        └── /*      ──────► S3 Bucket  (React SPA static files)
```

**Estimated monthly cost:** ~$55–70/mo
| Service | Cost |
|---------|------|
| S3 + CloudFront | ~$2–5/mo |
| App Runner (1 vCPU / 2 GB) | ~$25–35/mo |
| RDS SQL Server Express db.t3.small | ~$28/mo |
| Secrets Manager (2 secrets) | ~$0.80/mo |

---

## Pre-Requisites

Install these tools before running any scripts:

```bash
# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Configure with your IAM credentials
aws configure
# Prompts for: AWS Access Key ID, Secret, Region (e.g. us-east-1), output format (json)

# Docker (for building backend image)
# Node.js 20 (for building frontend)
```

You need an IAM user with **AdministratorAccess** or at minimum:
- ECR: full access
- RDS: full access
- Secrets Manager: full access
- App Runner: full access
- S3: full access
- CloudFront: full access
- IAM: create roles/policies

---

## One-Time Setup (Run in Order)

All scripts are run from the **repository root** (the `Statera.ai/` directory):

```bash
cd /path/to/Statera.ai
```

### Step 1 — Push backend image to ECR
```bash
bash deploy/aws/02-ecr.sh
```
- Creates an ECR repository called `statera-api`
- Builds the Docker image from `backend/`
- Pushes it to ECR
- **Output:** ECR image URI (save for step 3)

### Step 2 — Create VPC + RDS database
```bash
bash deploy/aws/03-rds.sh
```
- Creates a VPC with two private subnets across two AZs
- Creates security groups for App Runner → RDS traffic
- Creates RDS SQL Server Express (db.t3.small) in the private subnets
- Takes ~10 minutes to provision
- **Output:** RDS endpoint, APPRUNNER_SG_ID, SUBNET1_ID, SUBNET2_ID (save all)

### Step 3 — Store secrets in AWS Secrets Manager
```bash
bash deploy/aws/04-secrets.sh
```
- Stores the DB connection string at `statera/db-connection`
- Stores a strong random JWT signing key at `statera/jwt-key`
- **Output:** Secret ARNs

### Step 4 — Deploy backend to App Runner
```bash
bash deploy/aws/05-apprunner.sh
```
- Creates IAM roles for ECR access and Secrets Manager
- Creates App Runner VPC connector (allows App Runner → RDS)
- Creates App Runner service (auto-deploys on new ECR push)
- First startup automatically applies EF Core migrations (`MigrateAsync`)
- **Output:** App Runner service URL (save for next step)

### Step 5 — Update production config with real URLs
Edit `backend/src/Statera.Api/appsettings.Production.json`:
```json
{
  "Integrations": {
    "FrontendBaseUrl": "https://YOUR_CLOUDFRONT_DOMAIN",
    "Gusto":      { "RedirectUri": "https://YOUR_APPRUNNER_URL/api/v1/integrations/gusto/callback" },
    "QuickBooks": { "RedirectUri": "https://YOUR_APPRUNNER_URL/api/v1/integrations/quickbooks/callback" }
  }
}
```
Then commit and push — this will be deployed automatically after step 7 CI/CD is set up.

### Step 6 — Build frontend, upload to S3, create CloudFront
```bash
bash deploy/aws/06-frontend.sh
```
- Builds the React app (`npm run build`)
- Creates an S3 bucket with public access blocked
- Uploads the `dist/` folder to S3
- Creates a CloudFront distribution with dual-origin routing:
  - `/api/*` → App Runner
  - `/*` → S3
- Enables SPA fallback (404 → index.html) for React Router
- **Output:** CloudFront domain + Distribution ID (save both)

### Step 7 — Set GitHub Actions secrets
Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value |
|------------|-------|
| `AWS_ACCESS_KEY_ID` | Your IAM deploy key |
| `AWS_SECRET_ACCESS_KEY` | Your IAM deploy secret |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_ACCOUNT_ID` | 12-digit account ID |
| `ECR_REPOSITORY` | `statera-api` |
| `APP_RUNNER_SERVICE_ARN` | ARN from step 4 output |
| `S3_BUCKET_NAME` | From step 6 output |
| `CLOUDFRONT_DISTRIBUTION_ID` | From step 6 output |

### Step 8 — Verify
```bash
bash deploy/aws/07-verify.sh
```

---

## CI/CD (Automatic After Setup)

Once GitHub Actions secrets are set:

- **Push to `main` (backend changes)** → `.github/workflows/deploy-backend.yml`
  - Builds Docker image → pushes to ECR → App Runner auto-deploys (1–3 min)

- **Push to `main` (frontend changes)** → `.github/workflows/deploy-frontend.yml`
  - `npm run build` → S3 sync → CloudFront invalidation (~2 min)

---

## Environment Variables in App Runner

**Non-sensitive** (set directly):
```
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:8080
Jwt__Issuer=statera
Jwt__Audience=statera-web
```

**Sensitive** (pulled from Secrets Manager):
```
ConnectionStrings__DefaultConnection  ← statera/db-connection
Jwt__Key                              ← statera/jwt-key
```

---

## Troubleshooting

### App Runner can't connect to RDS
- Check VPC connector is attached to the service
- Verify security group `statera-apprunner-sg` is the one in the VPC connector
- Verify `statera-rds-sg` allows inbound TCP/1433 from `statera-apprunner-sg`

### Frontend 404 on page refresh
- CloudFront custom error responses must route 403/404 → `/index.html` with HTTP 200
- The `06-frontend.sh` script sets this automatically

### Migration failed on first boot
- Check App Runner CloudWatch logs: Console → App Runner → `statera-api` → Logs
- Common cause: wrong DB connection string in Secrets Manager

### CloudFront /api/* returns wrong response
- Check CloudFront behavior for `/api/*` is pointing to the App Runner origin
- Ensure the origin policy forwards all headers (`b689b0a8...` = AllViewer policy)
