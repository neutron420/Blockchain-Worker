# Quick Start - Blockchain Worker Deployment

## Prerequisites
- AWS account + AWS CLI configured (`aws configure`)
- Docker installed
- Terraform installed (`>= 1.5`)
- Redis endpoint
- Ethereum RPC URL + funded private key
- Pinata JWT
- AWS Secrets Manager access

## 1) Configure Environment
Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required values:
- `BLOCKCHAIN_RPC_URL`
- `PRIVATE_KEY`
- `CONTRACT_ADDRESS`
- `REDIS_URL`
- `PINATA_JWT`

Recommended queue values:
- `USER_QUEUE_NAME=user:registration:queue`
- `COMPLAINT_QUEUE_NAME=complaint:blockchain:queue`
- `METADATA_SYNC_QUEUE=blockchain:metadata:queue`

## 2) Compile and Test

```bash
npm run compile
npm test
```

## 3) Provision AWS Infrastructure (Terraform)

Create required secrets first (example names shown below):

```bash
aws secretsmanager create-secret --name blockchain/rpc-url --secret-string "https://eth-sepolia.g.alchemy.com/v2/<key>"
aws secretsmanager create-secret --name blockchain/private-key --secret-string "<wallet-private-key>"
aws secretsmanager create-secret --name blockchain/redis-url --secret-string "redis://<host>:6379"
aws secretsmanager create-secret --name blockchain/pinata-api-key --secret-string "<pinata-api-key>"
aws secretsmanager create-secret --name blockchain/pinata-api-secret --secret-string "<pinata-api-secret>"
aws secretsmanager create-secret --name blockchain/pinata-jwt --secret-string "<pinata-jwt>"
```

Set these ARN values in `terraform/terraform.tfvars`:
- `blockchain_rpc_url_secret_arn`
- `private_key_secret_arn`
- `redis_url_secret_arn`
- `pinata_api_key_secret_arn`
- `pinata_api_secret_secret_arn`
- `pinata_jwt_secret_arn`
- `backend_sync_token_secret_arn` (optional)

Then provision infrastructure:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

This provisions the ECS/ECR/VPC/logging resources used by the worker.

## 4) Build and Push Container

```bash
# from repository root
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin <ECR_URL>

docker build -t blockchain-worker .
docker tag blockchain-worker:latest <ECR_URL>:latest
docker push <ECR_URL>:latest
```

## 5) Deploy/Refresh ECS Service

```bash
aws ecs update-service \
  --cluster blockchain-worker-cluster \
  --service blockchain-worker-service \
  --force-new-deployment \
  --region ap-south-1
```

## 6) Monitor

```bash
aws logs tail /ecs/blockchain-worker --follow --region ap-south-1
```

## Common Checks
- Worker health endpoint: `GET /health`
- Ensure wallet has enough ETH for gas
- Confirm operator wallet is authorized in the contract (`setAuthorizedOperator`)
- Inspect DLQ queues if messages fail repeatedly:
  - `user:registration:queue:dlq`
  - `complaint:blockchain:queue:dlq`

## Rollback / Teardown

```bash
cd terraform
terraform destroy
```
