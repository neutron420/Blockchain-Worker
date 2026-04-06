# GitHub Actions CI/CD Setup Guide

## Overview

The repository uses GitHub Actions for automated CI/CD pipeline that:

1. **Tests** - Runs Solidity compilation, TypeScript checks, and Hardhat tests
2. **Builds** - Builds Docker image and pushes to AWS ECR
3. **Deploys** - Deploys to AWS ECS with automatic updates
4. **Monitors** - Security scanning, code quality analysis, and Slack notifications

## Workflows

### 1. `deploy.yml` - Main CI/CD Pipeline
- **Triggers**: Push to `main` or `develop`, PR to `main` or `develop`
- **Jobs**:
  - `test` - Runs all tests (always)
  - `build` - Builds and pushes Docker image to ECR (only on main)
  - `deploy` - Deploys to ECS (only on main)
  - `notify` - Sends Slack notifications

### 2. `security.yml` - Security Scanning
- **Triggers**: Push/PR, or scheduled daily at 2 AM UTC
- **Jobs**:
  - `security-audit` - NPM package vulnerability audit
  - `docker-scan` - Trivy docker image vulnerability scan
  - `dependency-check` - Check for outdated dependencies
  - `solidity-security` - Solither security analysis

### 3. `quality.yml` - Code Quality
- **Triggers**: Push/PR
- **Jobs**:
  - `lint` - TypeScript and ESLint checks
  - `format-check` - Prettier formatting validation
  - `coverage-report` - Test coverage analysis
  - `contract-complexity` - Solidity complexity metrics

## Setup Instructions

### Step 1: Add GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

```
AWS_ACCESS_KEY_ID          - Your AWS Access Key ID
AWS_SECRET_ACCESS_KEY      - Your AWS Secret Access Key
SLACK_WEBHOOK_URL          - Slack webhook for notifications (optional)
```

### Step 2: Configure AWS Credentials

Create an IAM user with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:us-east-1:ACCOUNT_ID:repository/grievance-blockchain-worker"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
        "arn:aws:iam::ACCOUNT_ID:role/ecsTaskRole"
      ]
    }
  ]
}
```

### Step 3: Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name grievance-blockchain-worker \
  --region us-east-1
```

### Step 4: Set AWS Environment Variables

Edit `.github/workflows/deploy.yml` and update:

```yaml
AWS_REGION: us-east-1                           # Your AWS region
ECS_CLUSTER: grievance-cluster                  # Your ECS cluster name
ECS_SERVICE: grievance-blockchain-worker        # Your ECS service name
ECS_TASK_DEFINITION: grievance-blockchain-worker  # Task definition name
```

### Step 5: Configure ECS Task Definition

Create an ECS task definition with:

```json
{
  "family": "grievance-blockchain-worker",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "grievance-blockchain-worker",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/grievance-blockchain-worker:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "REDIS_URL",
          "value": "redis://your-redis-host:6379"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/grievance-blockchain-worker",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Step 6: Setup Slack Notifications (Optional)

1. Create a Slack workspace
2. Create a Slack app with Incoming Webhooks
3. Get the webhook URL
4. Add as `SLACK_WEBHOOK_URL` secret

## Deployment Workflow

### On Push to `main`:

```
1. Run Tests
   ├─ Compile Solidity
   ├─ Run Hardhat tests
   └─ Check TypeScript types
   
2. Build Docker Image (on success)
   ├─ Login to AWS ECR
   ├─ Build image
   └─ Push to ECR with SHA and `latest` tags
   
3. Deploy to ECS (on build success)
   ├─ Download current task definition
   ├─ Update with new image
   └─ Deploy to ECS cluster
   
4. Send Notifications
   ├─ Slack notification (success/failure)
   └─ GitHub Actions summary
```

### On Pull Request:

```
1. Run Tests (all checks must pass)
2. Security Scanning
3. Code Quality Analysis
4. No automatic deployment (manual merge required)
```

## Monitoring Deployments

### Check Pipeline Status

GitHub: **Actions** tab in repository

### View ECS Deployment

```bash
aws ecs describe-services \
  --cluster grievance-cluster \
  --services grievance-blockchain-worker
```

### View Container Logs

```bash
aws logs tail /ecs/grievance-blockchain-worker --follow
```

## Troubleshooting

### Build Fails: "Artifact for contract not found"
```bash
npm run compile
```

### ECR Login Fails
- Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
- Verify IAM user has ECR permissions

### ECS Deployment Fails
- Ensure task definition exists: `grievance-blockchain-worker`
- Check ECS cluster name matches: `grievance-cluster`
- Verify IAM role has ECS permissions

### Tests Fail
```bash
npm test
# or with coverage:
npm test -- --coverage
```

## Manual Deployment (if needed)

```bash
# Build image locally
docker build -t grievance-blockchain-worker:latest .

# Push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker tag grievance-blockchain-worker:latest \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/grievance-blockchain-worker:latest

docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/grievance-blockchain-worker:latest

# Trigger ECS deployment
aws ecs update-service \
  --cluster grievance-cluster \
  --service grievance-blockchain-worker \
  --force-new-deployment
```

## Next Steps

1. Configure all GitHub Secrets
2. Create AWS IAM user with required permissions
3. Create ECR repository
4. Create ECS cluster, service, and task definition
5. Push code to `main` branch to trigger deployment

For more details, see:
- [AWS ECS Deployment Guide](../doc/aws-deployment-guide.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
