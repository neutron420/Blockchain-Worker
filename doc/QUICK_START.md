# ⚡ Quick Start - AWS Deployment

## Prerequisites Checklist
- [ ] AWS Account
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS CLI configured (`aws configure`)
- [ ] Docker installed (`docker --version`)
- [ ] Infura/Alchemy account for RPC
- [ ] Pinata account for IPFS
- [ ] Ethereum wallet with private key

## 5-Minute Setup

### 1. Create AWS Resources (One-time setup)

```bash
# Create ECR repository
aws ecr create-repository --repository-name blockchain-worker --region us-east-1

# Create ElastiCache Redis (via Console or CLI)
# Note: Get the endpoint after creation

# Create Secrets in Secrets Manager
aws secretsmanager create-secret --name blockchain/private-key --secret-string "YOUR_PRIVATE_KEY"
aws secretsmanager create-secret --name blockchain/pinata-jwt --secret-string "YOUR_PINATA_JWT"

# Create CloudWatch Log Group
aws logs create-log-group --log-group-name /ecs/blockchain-worker
```

### 2. Update Configuration

Edit `aws-ecs-task-definition.json`:
- Replace `YOUR_ACCOUNT_ID` with your AWS account ID
- Replace `YOUR_ECR_REPO_URI` with: `YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/blockchain-worker`
- Update `REDIS_URL` with your ElastiCache endpoint
- Update `BLOCKCHAIN_RPC_URL` with your RPC URL
- Update `CONTRACT_ADDRESS` with your deployed contract

### 3. Deploy

```bash
# Make script executable (Linux/Mac)
chmod +x deploy.sh

# Deploy
./deploy.sh us-east-1

# Or manually:
docker build -t blockchain-worker .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker tag blockchain-worker:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/blockchain-worker:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/blockchain-worker:latest
aws ecs register-task-definition --cli-input-json file://aws-ecs-task-definition.json
```

### 4. Run Task

```bash
# Get your subnet and security group IDs from VPC Console
aws ecs run-task \
  --cluster blockchain-worker-cluster \
  --task-definition blockchain-worker \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
```

### 5. Monitor

```bash
# View logs
aws logs tail /ecs/blockchain-worker --follow

# Check task status
aws ecs list-tasks --cluster blockchain-worker-cluster
```

## Common Commands

```bash
# View logs
aws logs tail /ecs/blockchain-worker --follow

# List running tasks
aws ecs list-tasks --cluster blockchain-worker-cluster

# Stop a task
aws ecs stop-task --cluster blockchain-worker-cluster --task TASK_ID

# Update service (if using service)
aws ecs update-service --cluster blockchain-worker-cluster --service blockchain-worker-service --force-new-deployment
```

## Troubleshooting

**Container won't start?**
```bash
aws logs tail /ecs/blockchain-worker --follow
```

**Can't connect to Redis?**
- Check security group allows port 6379
- Verify ElastiCache endpoint is correct
- Check VPC configuration

**Secrets not loading?**
- Verify IAM role has `secretsmanager:GetSecretValue` permission
- Check secret ARNs in task definition

## Full Documentation

See `aws-deployment-guide.md` for complete instructions.

