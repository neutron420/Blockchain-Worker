# 🚀 AWS Deployment Summary

## What You Need

### 1. **AWS Account & Setup**
   - AWS account with billing enabled
   - AWS CLI installed and configured (`aws configure`)
   - Appropriate IAM permissions for:
     - ECS (Elastic Container Service)
     - ECR (Elastic Container Registry)
     - ElastiCache
     - Secrets Manager
     - CloudWatch Logs
     - VPC/Security Groups

### 2. **External Services**
   - **Redis**: AWS ElastiCache (or external Redis service)
   - **Blockchain RPC**: Infura, Alchemy, or public Sepolia RPC
   - **Pinata Account**: For IPFS storage (get JWT token)
   - **Wallet**: Ethereum wallet with private key and some ETH for gas

### 3. **Local Tools**
   - Docker installed
   - Node.js/Bun (for local testing)
   - Git (for version control)

## Files Created/Updated

### ✅ Files Ready for Deployment:
1. **`Dockerfile`** - Fixed and optimized for AWS
2. **`.dockerignore`** - Excludes unnecessary files from Docker build
3. **`package.json`** - Updated with build script and missing dependencies (axios, form-data, ethers)
4. **`aws-ecs-task-definition.json`** - ECS task definition template
5. **`aws-deployment-guide.md`** - Complete step-by-step deployment guide
6. **`deploy.sh`** - Automated deployment script

### 📝 Files You Need to Create:
1. **`.env`** - Create from the template below (DO NOT commit to git)
2. **AWS Resources** - VPC, Security Groups, ElastiCache, etc.

## Environment Variables Template

Create a `.env` file in `blockchain-be/` directory:

```env
# Redis Configuration
REDIS_URL=redis://your-elasticache-endpoint:6379

# Blockchain Configuration
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Wallet Configuration (KEEP SECRET!)
PRIVATE_KEY=your_private_key_without_0x_prefix

# Smart Contract
CONTRACT_ADDRESS=0xYourDeployedContractAddress

# Pinata IPFS
PINATA_JWT=your_pinata_jwt_token

# Worker Settings
WORKER_POLL_INTERVAL=5000
```

## Quick Start Deployment Process

### Step 1: Prepare AWS Resources
```bash
# 1. Create ElastiCache Redis cluster
# 2. Store secrets in AWS Secrets Manager
# 3. Create ECR repository
# 4. Create IAM roles
# 5. Create CloudWatch log group
```

### Step 2: Update Configuration
```bash
# 1. Update aws-ecs-task-definition.json with your values
# 2. Create .env file (don't commit it)
# 3. Update deploy.sh if needed
```

### Step 3: Deploy
```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh us-east-1
```

### Step 4: Verify
```bash
# Check logs
aws logs tail /ecs/blockchain-worker --follow

# Check ECS service status
aws ecs describe-services --cluster blockchain-worker-cluster --services blockchain-worker-service
```

## What Each File Does

| File | Purpose |
|------|---------|
| `Dockerfile` | Defines how to build the Docker container |
| `.dockerignore` | Excludes files from Docker build context |
| `package.json` | Project dependencies and build scripts |
| `aws-ecs-task-definition.json` | ECS task configuration (CPU, memory, env vars, secrets) |
| `aws-deployment-guide.md` | Complete deployment instructions |
| `deploy.sh` | Automated script to build and push to ECR |
| `.env` | Local environment variables (create this, don't commit) |

## AWS Services You'll Use

1. **ECS Fargate** - Runs your container (serverless, no EC2 management)
2. **ECR** - Stores your Docker images
3. **ElastiCache** - Managed Redis for queues
4. **Secrets Manager** - Stores private keys and API tokens securely
5. **CloudWatch Logs** - Application logging
6. **VPC** - Network isolation and security
7. **IAM** - Access control and permissions

## Cost Estimation (Approximate)

- **ECS Fargate**: ~$15-30/month (512 CPU, 1GB RAM, 24/7)
- **ElastiCache**: ~$15/month (cache.t3.micro)
- **ECR**: ~$0.10/GB/month (storage)
- **CloudWatch Logs**: ~$0.50/GB ingested
- **Secrets Manager**: ~$0.40/secret/month
- **Data Transfer**: Variable

**Total**: ~$30-50/month for basic setup

## Security Checklist

- [ ] Private keys stored in AWS Secrets Manager (NOT in code)
- [ ] `.env` file in `.gitignore` (already in `.dockerignore`)
- [ ] IAM roles with least privilege permissions
- [ ] Security groups restrict access appropriately
- [ ] VPC endpoints for private AWS service access
- [ ] CloudWatch logging enabled for monitoring

## Next Steps

1. **Read the full guide**: `aws-deployment-guide.md`
2. **Set up AWS resources** following Step 1-9 in the guide
3. **Test locally** with Docker before deploying
4. **Deploy** using `deploy.sh` script
5. **Monitor** using CloudWatch logs and metrics

## Troubleshooting

If something goes wrong:
1. Check CloudWatch logs first
2. Verify all environment variables are set
3. Check IAM role permissions
4. Verify network connectivity (security groups, VPC)
5. Review the troubleshooting section in `aws-deployment-guide.md`

## Support

- AWS Documentation: https://docs.aws.amazon.com/
- ECS User Guide: https://docs.aws.amazon.com/ecs/
- Check logs: `aws logs tail /ecs/blockchain-worker --follow`

---

**Ready to deploy?** Start with `aws-deployment-guide.md` for detailed instructions!

