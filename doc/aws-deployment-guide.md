# AWS Deployment Guide for Blockchain Worker

This guide will walk you through deploying your blockchain worker to AWS using Docker and ECS (Elastic Container Service).

## 📋 Prerequisites

Before you begin, ensure you have:

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **Docker** installed locally
4. **Node.js/Bun** installed (for local testing)
5. **Required AWS Services Access:**
   - ECS (Elastic Container Service)
   - ECR (Elastic Container Registry)
   - ElastiCache (for Redis)
   - Secrets Manager (for sensitive data)
   - CloudWatch Logs
   - VPC and Security Groups

## 🏗️ Architecture Overview

```
┌─────────────┐
│   ECS Fargate│
│   Container │
└──────┬──────┘
       │
       ├──> Redis (ElastiCache)
       ├──> Blockchain RPC (Sepolia)
       └──> Pinata IPFS
```

## 📝 Step-by-Step Deployment Process

### Step 1: Prepare Your Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in all required values in `.env`:
   - `REDIS_URL`: Will be set to ElastiCache endpoint
   - `BLOCKCHAIN_RPC_URL`: Your Infura/Alchemy RPC URL
   - `PRIVATE_KEY`: Your wallet private key (keep secure!)
   - `CONTRACT_ADDRESS`: Your deployed contract address
   - `PINATA_JWT`: Your Pinata JWT token
   - `WORKER_POLL_INTERVAL`: Polling interval (default: 5000ms)

### Step 2: Set Up AWS ElastiCache (Redis)

1. **Create ElastiCache Subnet Group:**
   ```bash
   aws elasticache create-cache-subnet-group \
     --cache-subnet-group-name blockchain-redis-subnet \
     --cache-subnet-group-description "Subnet group for blockchain worker Redis" \
     --subnet-ids subnet-xxxxx subnet-yyyyy
   ```

2. **Create Redis Cluster:**
   ```bash
   aws elasticache create-cache-cluster \
     --cache-cluster-id blockchain-redis \
     --cache-node-type cache.t3.micro \
     --engine redis \
     --num-cache-nodes 1 \
     --cache-subnet-group-name blockchain-redis-subnet \
     --security-group-ids sg-xxxxx
   ```

3. **Get Redis Endpoint:**
   ```bash
   aws elasticache describe-cache-clusters \
     --cache-cluster-id blockchain-redis \
     --show-cache-node-info
   ```
   Note the `Endpoint.Address` - this is your `REDIS_URL`

### Step 3: Store Secrets in AWS Secrets Manager

**IMPORTANT:** Never commit private keys to code. Use AWS Secrets Manager.

1. **Store Private Key:**
   ```bash
   aws secretsmanager create-secret \
     --name blockchain/private-key \
     --secret-string "your_private_key_without_0x"
   ```

2. **Store Pinata JWT:**
   ```bash
   aws secretsmanager create-secret \
     --name blockchain/pinata-jwt \
     --secret-string "your_pinata_jwt_token"
   ```

### Step 4: Build and Push Docker Image to ECR

1. **Create ECR Repository:**
   ```bash
   aws ecr create-repository \
     --repository-name blockchain-worker \
     --region us-east-1
   ```

2. **Get Login Token:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   ```

3. **Build Docker Image:**
   ```bash
   cd blockchain-be
   docker build -t blockchain-worker .
   ```

4. **Tag Image:**
   ```bash
   docker tag blockchain-worker:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/blockchain-worker:latest
   ```

5. **Push to ECR:**
   ```bash
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/blockchain-worker:latest
   ```

### Step 5: Create IAM Roles

1. **Create Task Execution Role** (for pulling images and secrets):
   - Go to IAM Console
   - Create role: `ecsTaskExecutionRole`
   - Attach policy: `AmazonECSTaskExecutionRolePolicy`
   - Add inline policy for Secrets Manager access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "secretsmanager:GetSecretValue"
         ],
         "Resource": [
           "arn:aws:secretsmanager:*:*:secret:blockchain/*"
         ]
       }
     ]
   }
   ```

2. **Create Task Role** (for application permissions):
   - Create role: `ecsTaskRole`
   - Add permissions as needed (CloudWatch, etc.)

### Step 6: Create CloudWatch Log Group

```bash
aws logs create-log-group --log-group-name /ecs/blockchain-worker
```

### Step 7: Create ECS Task Definition

1. **Update `aws-ecs-task-definition.json`:**
   - Replace `YOUR_ACCOUNT_ID` with your AWS account ID
   - Replace `YOUR_ECR_REPO_URI` with your ECR repository URI
   - Update Redis endpoint
   - Update other environment variables
   - Update secret ARNs

2. **Register Task Definition:**
   ```bash
   aws ecs register-task-definition --cli-input-json file://aws-ecs-task-definition.json
   ```

### Step 8: Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name blockchain-worker-cluster
```

### Step 9: Create ECS Service (Optional - for long-running service)

If you want the worker to run continuously:

1. **Create Service:**
   ```bash
   aws ecs create-service \
     --cluster blockchain-worker-cluster \
     --service-name blockchain-worker-service \
     --task-definition blockchain-worker \
     --desired-count 1 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
   ```

### Step 10: Run Task Manually (Alternative to Service)

If you prefer to run tasks manually:

```bash
aws ecs run-task \
  --cluster blockchain-worker-cluster \
  --task-definition blockchain-worker \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
```

## 🔧 Configuration Files Needed

### Files You Already Have:
- ✅ `Dockerfile` - Fixed and ready
- ✅ `.dockerignore` - Created
- ✅ `.env.example` - Created
- ✅ `package.json` - Updated with build script and dependencies

### Files You Need to Create/Update:
1. **`.env`** - Create from `.env.example` (DO NOT commit)
2. **`aws-ecs-task-definition.json`** - Update with your values
3. **VPC and Security Groups** - Set up in AWS Console

## 🔐 Security Best Practices

1. **Never commit `.env` file** - Already in `.dockerignore`
2. **Use AWS Secrets Manager** for sensitive data (private keys, API tokens)
3. **Use IAM roles** instead of access keys when possible
4. **Enable VPC endpoints** for private communication with AWS services
5. **Use security groups** to restrict network access
6. **Enable CloudWatch logging** for monitoring

## 📊 Monitoring and Logs

1. **View Logs:**
   ```bash
   aws logs tail /ecs/blockchain-worker --follow
   ```

2. **CloudWatch Metrics:**
   - CPU Utilization
   - Memory Utilization
   - Task Count

3. **Set Up Alarms:**
   - Create CloudWatch alarms for task failures
   - Monitor Redis connection errors
   - Track blockchain transaction failures

## 🚀 Quick Deployment Script

Create a deployment script `deploy.sh`:

```bash
#!/bin/bash
set -e

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
ECR_REPO="blockchain-worker"

echo "Building Docker image..."
docker build -t $ECR_REPO .

echo "Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

echo "Tagging image..."
docker tag $ECR_REPO:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:latest

echo "Pushing to ECR..."
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:latest

echo "Updating ECS service..."
aws ecs update-service \
  --cluster blockchain-worker-cluster \
  --service blockchain-worker-service \
  --force-new-deployment \
  --region $REGION

echo "Deployment complete!"
```

## 🐛 Troubleshooting

### Container fails to start:
- Check CloudWatch logs: `/ecs/blockchain-worker`
- Verify environment variables are set correctly
- Check IAM roles have correct permissions

### Cannot connect to Redis:
- Verify security group allows traffic on port 6379
- Check ElastiCache endpoint is correct
- Ensure VPC configuration is correct

### Cannot connect to blockchain:
- Verify RPC URL is correct and accessible
- Check private key is correct
- Ensure wallet has sufficient funds for gas

### Secrets not loading:
- Verify IAM role has `secretsmanager:GetSecretValue` permission
- Check secret ARNs in task definition are correct
- Ensure secrets exist in the same region

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [AWS ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)

## ✅ Checklist

- [ ] AWS account set up and configured
- [ ] ElastiCache Redis cluster created
- [ ] Secrets stored in Secrets Manager
- [ ] ECR repository created
- [ ] Docker image built and pushed
- [ ] IAM roles created with correct permissions
- [ ] CloudWatch log group created
- [ ] Task definition created and registered
- [ ] ECS cluster created
- [ ] ECS service/task running
- [ ] Logs verified in CloudWatch
- [ ] Worker processing queues successfully

---

**Need Help?** Check the logs first, then review the troubleshooting section above.

