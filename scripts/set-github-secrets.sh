#!/bin/bash

# Bash Script to Set GitHub Secrets
# Run this script from the repository root
# Prerequisites: GitHub CLI (gh) installed and authenticated

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}GitHub Secrets Configuration${NC}"
echo -e "${CYAN}======================================${NC}"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}ERROR: GitHub CLI is not installed.${NC}"
    echo -e "${YELLOW}   Install from: https://cli.github.com/${NC}"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo -e "${RED}ERROR: Not authenticated with GitHub.${NC}"
    echo -e "${YELLOW}   Run: gh auth login${NC}"
    exit 1
fi

echo -e "${GREEN}OK: GitHub CLI authenticated${NC}"

# Prompt for secrets
echo ""
echo -e "${CYAN}Enter your AWS credentials (these will be set as GitHub secrets):${NC}"
echo -e "${CYAN}---${NC}"

read -p "AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY
if [ -z "$AWS_ACCESS_KEY" ]; then
    echo -e "${RED}ERROR: AWS_ACCESS_KEY_ID cannot be empty.${NC}"
    exit 1
fi

read -sp "AWS_SECRET_ACCESS_KEY: " AWS_SECRET_KEY
echo ""
if [ -z "$AWS_SECRET_KEY" ]; then
    echo -e "${RED}ERROR: AWS_SECRET_ACCESS_KEY cannot be empty.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Do you want to set SLACK_WEBHOOK_URL? (y/n)${NC}"
read -p "" slack_choice
SLACK_WEBHOOK=""

if [ "$slack_choice" = "y" ] || [ "$slack_choice" = "Y" ]; then
    read -p "SLACK_WEBHOOK_URL: " SLACK_WEBHOOK
fi

# Set secrets using GitHub CLI
echo ""
echo -e "${CYAN}Setting GitHub secrets...${NC}"
echo -e "${CYAN}---${NC}"

# AWS_ACCESS_KEY_ID
echo -n "Setting AWS_ACCESS_KEY_ID... "
echo "$AWS_ACCESS_KEY" | gh secret set AWS_ACCESS_KEY_ID
if [ $? -eq 0 ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# AWS_SECRET_ACCESS_KEY
echo -n "Setting AWS_SECRET_ACCESS_KEY... "
echo "$AWS_SECRET_KEY" | gh secret set AWS_SECRET_ACCESS_KEY
if [ $? -eq 0 ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# SLACK_WEBHOOK_URL (optional)
if [ ! -z "$SLACK_WEBHOOK" ]; then
    echo -n "Setting SLACK_WEBHOOK_URL... "
    echo "$SLACK_WEBHOOK" | gh secret set SLACK_WEBHOOK_URL
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}All secrets configured successfully.${NC}"
echo -e "${GREEN}=====================================${NC}"

echo ""
echo -e "${CYAN}Current GitHub secrets:${NC}"
gh secret list

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "${YELLOW}1. Update .env file with your AWS credentials${NC}"
echo -e "${YELLOW}2. Update terraform/terraform.tfvars with your AWS credentials${NC}"
echo -e "${YELLOW}3. Push to main branch to trigger CI/CD pipeline${NC}"
echo ""
echo -e "${CYAN}Documentation: .github/CI_CD_SETUP.md${NC}"
