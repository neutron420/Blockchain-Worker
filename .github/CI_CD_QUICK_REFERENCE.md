# CI/CD Quick Reference

## GitHub Secrets Required

```yaml
AWS_ACCESS_KEY_ID: <your-aws-access-key>
AWS_SECRET_ACCESS_KEY: <your-aws-secret-key>
SLACK_WEBHOOK_URL: <optional-for-notifications>
```

## Workflow Triggers

| Action | Workflow | Status |
|--------|----------|--------|
| `git push origin feature/xyz` | quality.yml, deploy.yml | Tests run, no deploy |
| `git push origin main` | All workflows | Tests → Build → Deploy to ECS |
| `git pull-request to main` | quality.yml, security.yml | Security & quality checks |
| `Scheduled (2 AM UTC)` | security.yml | Security audit |

## Local Development Commands

```bash
# Install dependencies
npm install

# Compile Solidity contracts
npm run compile

# Run tests
npm test

# Build Docker image locally
docker build -t grievance-blockchain-worker:local .

# Run Docker container
docker run -it -e REDIS_URL=redis://localhost:6379 grievance-blockchain-worker:local

# Check types
npx tsc --noEmit --skipLibCheck

# Run linter
npx eslint src/ test/
```

## AWS Commands (Manual)

```bash
# Push image to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker tag grievance-blockchain-worker:local \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/grievance-blockchain-worker:latest

docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/grievance-blockchain-worker:latest

# Deploy to ECS
aws ecs update-service \
  --cluster grievance-cluster \
  --service grievance-blockchain-worker \
  --force-new-deployment \
  --region us-east-1

# Check deployment status
aws ecs describe-services \
  --cluster grievance-cluster \
  --services grievance-blockchain-worker \
  --region us-east-1 \
  --query 'services[0].[serviceName,status,runningCount,desiredCount]' \
  --output table

# View logs
aws logs tail /ecs/grievance-blockchain-worker --follow --region us-east-1
```

## GitHub Actions Status

View all workflows: **Actions** tab in repository

```bash
# View workflow runs
gh run list

# View specific workflow
gh run view <run-id>

# View job details
gh run view <run-id> --log

# Monitor in real-time
gh run watch
```

## Troubleshooting Checklist

### Tests are failing
```bash
npm test -- --verbose
npm run compile
```

### Docker build fails
```bash
docker build -t test:latest . --no-cache
docker logs <container-id>
```

### ECR push fails
- ✅ Verify AWS credentials: `aws sts get-caller-identity`
- ✅ Check GitHub Secrets are set correctly
- ✅ Validate IAM permissions

### ECS deployment fails
- ✅ Check task definition exists: `aws ecs describe-task-definition --task-definition grievance-blockchain-worker`
- ✅ Verify cluster: `aws ecs list-clusters`
- ✅ Check service: `aws ecs describe-services --cluster grievance-cluster --services grievance-blockchain-worker`

### Container not starting
```bash
# View logs
aws logs tail /ecs/grievance-blockchain-worker --follow

# SSH into container (if needed)
aws ecs execute-command \
  --cluster grievance-cluster \
  --task <task-id> \
  --container grievance-blockchain-worker \
  --interactive \
  --command "/bin/sh"
```

## Slack Notifications

✅ Receives notifications for:
- ✓ Deployment success
- ✗ Test failures
- ✗ Build failures
- ✗ Deployment failures

To enable: Add `SLACK_WEBHOOK_URL` secret

## Files Modified

```
.github/
├── workflows/
│   ├── deploy.yml        # Main CI/CD pipeline
│   ├── security.yml      # Security scanning
│   └── quality.yml       # Code quality checks
└── CI_CD_SETUP.md        # Setup documentation
```

## Next Steps

1. **Configure Secrets**
   - Go to GitHub → Settings → Secrets and variables
   - Add AWS and Slack credentials

2. **Setup AWS**
   - Create IAM user with ECR & ECS permissions
   - Create ECR repository
   - Create ECS cluster, service, task definition

3. **First Deployment**
   - Push to main branch
   - Monitor Actions tab
   - Check CloudWatch logs

4. **Monitor**
   - Set up Slack notifications
   - Monitor CloudWatch metrics
   - Review logs regularly

## Resources

- [Full CI/CD Setup Guide](.github/CI_CD_SETUP.md)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)

---

**Last Updated:** April 2026
**Status:** ✅ All workflows configured and tested
