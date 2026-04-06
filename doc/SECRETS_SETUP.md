# GitHub Secrets Setup Guide

This guide explains how to configure AWS credentials and other secrets for the CI/CD pipeline.

## Option 1: Automated Setup (Recommended)

### Windows (PowerShell)

```powershell
# Run from repository root
./scripts/set-github-secrets.ps1
```

### macOS / Linux (Bash)

```bash
# Run from repository root
chmod +x scripts/set-github-secrets.sh
./scripts/set-github-secrets.sh
```

### Requirements
- GitHub CLI installed: https://cli.github.com/
- Authenticated with GitHub: `gh auth login`
- AWS credentials (Access Key ID and Secret Access Key)

## Option 2: Manual Setup

### Step 1: Get Your AWS Access Keys

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/home#/users)
2. Select your user
3. Click "Security credentials" tab
4. Under "Access keys," click "Create access key"
5. Choose "Command Line Interface (CLI)"
6. Copy your **Access Key ID** and **Secret Access Key**

### Step 2: Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add these secrets:

#### AWS_ACCESS_KEY_ID
- **Name:** `AWS_ACCESS_KEY_ID`
- **Value:** Your AWS Access Key ID from Step 1
- Click **Add secret**

#### AWS_SECRET_ACCESS_KEY
- **Name:** `AWS_SECRET_ACCESS_KEY`
- **Value:** Your AWS Secret Access Key from Step 1
- Click **Add secret**

#### SLACK_WEBHOOK_URL (Optional)
- **Name:** `SLACK_WEBHOOK_URL`
- **Value:** Your Slack webhook URL (for notifications)
- Click **Add secret**

### Step 3: Verify Secrets

```bash
gh secret list
```

You should see:
```
AWS_ACCESS_KEY_ID          Updated ...
AWS_SECRET_ACCESS_KEY      Updated ...
SLACK_WEBHOOK_URL          Updated ... (if configured)
```

## Step 4: Update Local Configuration Files

### Update `.env`

Edit `.env` and replace placeholders:

```bash
# AWS Configuration for CI/CD
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-south-1
```

### Update `terraform/terraform.tfvars`

Edit `terraform/terraform.tfvars` and replace placeholders:

```hcl
# AWS Credentials (use AWS Secrets Manager in production!)
aws_access_key_id     = "AKIAIOSFODNN7EXAMPLE"
aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

## Step 5: Test Configuration

Push to a non-main branch to test:

```bash
git checkout -b test/ci-cd
git add .
git commit -m "Test: CI/CD configuration"
git push origin test/ci-cd
```

Watch the Actions tab for workflow runs.

## Viewing Secret Values in CI/CD

Your secrets are automatically available in GitHub Actions workflows as environment variables:

```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Important Security Notes

⚠️ **CRITICAL**

1. **Never commit secrets to version control**
   - `.env` is already in `.gitignore`
   - `terraform/terraform.tfvars` is already in `.gitignore`

2. **GitHub Secrets are encrypted**
   - Visible only in workflow logs if explicitly echoed
   - Cannot be viewed after creation (only updated/deleted)

3. **Use IAM Policy Restrictions**
   - Create an IAM user with only ECR and ECS permissions
   - Not root AWS account
   - See `.github/CI_CD_SETUP.md` for IAM policy example

4. **Rotate credentials regularly**
   - Update AWS access keys every 90 days
   - Update GitHub secrets when keys change

5. **Production Best Practices**
   - Use AWS Secrets Manager for secrets in ECS task definitions
   - Don't store credentials in environment variables in production
   - Use IAM roles for EC2/ECS instances

## Troubleshooting

### "gh command not found"
Install GitHub CLI: https://cli.github.com/

### "Not authenticated with GitHub"
```bash
gh auth login
```

### "Permission denied: AWS credentials"
- Verify Access Key ID is correct
- Check that the IAM user has EC2, ECR, and ECS permissions
- Generate new credentials if needed

### Secrets not available in workflow
- Wait 1-2 minutes for GitHub to sync secrets
- Force new deployment: `git push --force`
- Check workflow logs for environment variable usage

### Script execution policy error (Windows)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Next Steps

1. ✅ Configure GitHub secrets
2. ✅ Update `.env` and `terraform.tfvars`
3. Push to `main` branch
4. Watch GitHub Actions pipeline
5. Monitor ECS deployment

See [CI_CD_SETUP.md](../../.github/CI_CD_SETUP.md) for complete setup guide.
