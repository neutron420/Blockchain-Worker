#!/bin/bash
# AWS Deployment Script for Blockchain Worker
# Usage: ./deploy.sh [region]

set -e

REGION=${1:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="blockchain-worker"
CLUSTER_NAME="blockchain-worker-cluster"
SERVICE_NAME="blockchain-worker-service"

echo "🚀 Starting deployment..."
echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if [ -z "$ACCOUNT_ID" ]; then
    echo " Error: AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

# Build Docker image
echo "📦 Building Docker image..."
docker build -t $ECR_REPO .

# Login to ECR
echo "🔐 Logging into ECR..."
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

# Create ECR repository if it doesn't exist
echo "📁 Checking ECR repository..."
if ! aws ecr describe-repositories --repository-names $ECR_REPO --region $REGION &>/dev/null; then
    echo "Creating ECR repository..."
    aws ecr create-repository --repository-name $ECR_REPO --region $REGION
fi

# Tag and push image
echo "🏷️  Tagging image..."
docker tag $ECR_REPO:latest $ECR_URI/$ECR_REPO:latest

echo "⬆️  Pushing to ECR..."
docker push $ECR_URI/$ECR_REPO:latest

# Update task definition with new image
echo "📝 Updating task definition..."
TASK_DEF_FILE="aws-ecs-task-definition.json"
if [ -f "$TASK_DEF_FILE" ]; then
    # Replace placeholder with actual ECR URI
    sed -i.bak "s|YOUR_ECR_REPO_URI|$ECR_URI/$ECR_REPO|g" $TASK_DEF_FILE
    sed -i.bak "s|YOUR_ACCOUNT_ID|$ACCOUNT_ID|g" $TASK_DEF_FILE
    sed -i.bak "s|us-east-1|$REGION|g" $TASK_DEF_FILE
    
    # Register task definition
    aws ecs register-task-definition --cli-input-json file://$TASK_DEF_FILE --region $REGION
    
    # Restore original file
    mv $TASK_DEF_FILE.bak $TASK_DEF_FILE
else
    echo "⚠️  Warning: $TASK_DEF_FILE not found. Skipping task definition update."
fi

# Update service if it exists
echo "🔄 Updating ECS service..."
if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION &>/dev/null; then
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $REGION
    echo "✅ Service update initiated. Check AWS Console for status."
else
    echo "ℹ️  Service not found. Create it manually or run a task."
fi

echo ""
echo "✅ Deployment complete!"
echo "📊 View logs: aws logs tail /ecs/blockchain-worker --follow --region $REGION"

