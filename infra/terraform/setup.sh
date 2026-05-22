#!/bin/bash
# Terraform infrastructure setup script
# Initializes and validates Terraform configuration for GHS
#
# Usage: bash infra/terraform/setup.sh [staging|production]

set -euo pipefail

ENVIRONMENT="${1:-staging}"
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[terraform-setup] Setting up Terraform for GHS ($ENVIRONMENT environment)"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "[terraform-setup] ERROR: Invalid environment. Use 'staging' or 'production'"
  exit 1
fi

# Check prerequisites
if ! command -v terraform &> /dev/null; then
  echo "[terraform-setup] ERROR: Terraform not installed. Install from https://www.terraform.io/downloads"
  exit 1
fi

if ! command -v doctl &> /dev/null; then
  echo "[terraform-setup] WARNING: doctl not installed. Get from https://github.com/digitalocean/doctl"
  echo "[terraform-setup] You can still use Terraform, but won't be able to list SSH keys with 'doctl'"
fi

# Check for required environment variables
if [[ -z "${TF_VAR_digitalocean_token:-}" ]]; then
  echo "[terraform-setup] ERROR: TF_VAR_digitalocean_token environment variable not set"
  echo "[terraform-setup] Generate token at: https://cloud.digitalocean.com/account/api/tokens"
  echo "[terraform-setup] Export with: export TF_VAR_digitalocean_token=<your-token>"
  exit 1
fi

echo "[terraform-setup] DigitalOcean token found"

# Initialize Terraform
cd "$TERRAFORM_DIR"

echo "[terraform-setup] Running terraform init..."
terraform init

# Validate configuration
echo "[terraform-setup] Validating Terraform configuration..."
terraform validate

# Format check
echo "[terraform-setup] Checking Terraform formatting..."
terraform fmt -check -recursive . || {
  echo "[terraform-setup] WARNING: Some files have formatting issues"
  echo "[terraform-setup] To auto-fix, run: terraform fmt -recursive ."
}

# Plan
echo "[terraform-setup] Creating Terraform plan for $ENVIRONMENT..."
TFVARS_FILE="${ENVIRONMENT}.tfvars"

if [[ ! -f "$TFVARS_FILE" ]]; then
  echo "[terraform-setup] ERROR: Variables file not found: $TFVARS_FILE"
  exit 1
fi

terraform plan -var-file="$TFVARS_FILE" -out="terraform-${ENVIRONMENT}.plan"

echo ""
echo "[terraform-setup] ===== PLAN COMPLETE ====="
echo "[terraform-setup] Review the plan above carefully"
echo "[terraform-setup] To apply the plan, run:"
echo "[terraform-setup]   terraform apply terraform-${ENVIRONMENT}.plan"
echo ""
echo "[terraform-setup] To adjust variables, edit:"
echo "[terraform-setup]   $TFVARS_FILE"
echo ""
echo "[terraform-setup] Setup complete!"
