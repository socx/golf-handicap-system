# Terraform Infrastructure-as-Code for GHS

Complete Infrastructure-as-Code setup for GHS using Terraform and DigitalOcean.

## Overview

This Terraform configuration provisions:
- **Droplet**: Main compute instance (configurable size, Ubuntu 22.04 LTS)
- **Spaces**: Object storage bucket for PDFs, images, and assets
- **VPC & Networking**: Private VPC with subnet configuration
- **Firewall**: Stateful firewall with port management
- **DNS** (optional): Domain routing configuration

## Prerequisites

1. **Terraform** >= 1.0
   ```bash
   # macOS
   brew install terraform
   
   # Linux - download from https://www.terraform.io/downloads
   ```

2. **DigitalOcean Account**
   - Create a Personal Access Token: https://cloud.digitalocean.com/account/api/tokens
   - Save as environment variable: `export TF_VAR_digitalocean_token=<your-token>`

3. **doctl** (optional, for SSH key management)
   ```bash
   # macOS
   brew install doctl
   
   # Linux - download from https://github.com/digitalocean/doctl/releases
   
   # Configure with token
   doctl auth init
   ```

## Quick Start

### 1. Get DigitalOcean Token

```bash
# Generate token at: https://cloud.digitalocean.com/account/api/tokens
export TF_VAR_digitalocean_token=dop_v1_xxxxx
```

### 2. Configure Variables

**Staging:**
```bash
# Review and edit if needed
cat infra/terraform/staging.tfvars

# Add SSH key IDs (list with: doctl compute ssh-key list)
# Edit staging.tfvars and uncomment ssh_key_ids line
```

**Production:**
```bash
# Review and edit (important: restrict SSH IPs!)
cat infra/terraform/production.tfvars

# REQUIRED: Update allowed_ssh_ips with your IP addresses
# Restrict to your office/VPN before deploying to production
```

### 3. Initialize Terraform

```bash
cd infra/terraform

# Initialize Terraform (downloads providers)
terraform init

# Format and validate
terraform fmt -recursive .
terraform validate
```

### 4. Plan Deployment

```bash
# For staging (preview changes)
terraform plan -var-file=staging.tfvars -out=staging.plan

# For production (preview changes)
terraform plan -var-file=production.tfvars -out=production.plan

# Review the plan output carefully!
```

### 5. Apply Configuration

```bash
# Apply staging infrastructure
terraform apply staging.plan

# Or apply production (REQUIRES manual approval)
terraform apply production.plan

# Output key values:
# - droplet_ip: Public IP of the instance
# - spaces_bucket: Object storage bucket name
# - vpc_id: VPC identifier
```

### 6. Capture Outputs

After deployment:
```bash
# Get all outputs
terraform output

# Get specific output
terraform output droplet_ip
terraform output spaces_bucket
terraform output spaces_endpoint

# Use outputs in CI/CD
export DROPLET_IP=$(terraform output -raw droplet_ip)
export SPACES_BUCKET=$(terraform output -raw spaces_bucket)
```

## Directory Structure

```
infra/terraform/
├── main.tf                  # Root configuration, module composition
├── variables.tf             # Variable definitions
├── outputs.tf               # Output definitions
├── staging.tfvars          # Staging environment variables
├── production.tfvars       # Production environment variables
├── setup.sh                # Setup helper script
├── README.md               # This file
└── modules/
    ├── droplet/            # Compute module
    │   ├── main.tf
    │   └── user_data.sh   # Droplet initialization script
    ├── spaces/            # Object storage module
    │   └── main.tf
    ├── networking/        # VPC & subnet module
    │   └── main.tf
    └── firewall/          # Firewall configuration module
        └── main.tf
```

## Key Configuration Options

### Droplet Size

Change `droplet_size` in tfvars:
- `s-2vcpu-4gb` — Staging (default)
- `s-4vcpu-8gb` — Production (recommended)
- See DigitalOcean pricing: https://www.digitalocean.com/pricing/droplets

### SSH Access

Update `allowed_ssh_ips` in tfvars:
```hcl
allowed_ssh_ips = [
  "203.0.113.0/24",      # Your office
  "198.51.100.0/32",     # Your VPN
  "192.0.2.1/32"         # CI/CD server
]
```

### CORS Configuration

Update `spaces_cors_origins` in tfvars:
```hcl
spaces_cors_origins = [
  "https://ghs.socx.org.uk",
  "https://api.ghs.socx.org.uk"
]
```

## Operations

### Update Infrastructure

```bash
# Edit .tfvars file
vim staging.tfvars

# Plan and apply changes
terraform plan -var-file=staging.tfvars -out=staging.plan
terraform apply staging.plan
```

### Destroy Infrastructure

```bash
# WARNING: Deletes all resources
terraform destroy -var-file=staging.tfvars

# Or destroy specific resources
terraform destroy -var-file=staging.tfvars -target module.droplet
```

### Migrate State

If using remote state (S3 backend):
```bash
# Configure S3 backend in main.tf backend block
# Push state to S3
terraform init -migrate-state

# Pull state from S3
terraform init
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Infrastructure
on:
  push:
    paths:
      - 'infra/terraform/**'
    branches:
      - main

env:
  TF_VAR_digitalocean_token: ${{ secrets.DIGITALOCEAN_TOKEN }}

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.5.0
      
      - working-directory: infra/terraform
        run: |
          terraform init
          terraform plan -var-file=production.tfvars -out=plan
      
      - working-directory: infra/terraform
        run: terraform apply plan
      
      - working-directory: infra/terraform
        run: |
          echo "DROPLET_IP=$(terraform output -raw droplet_ip)" >> $GITHUB_ENV
```

### Storing State Securely

Use S3 backend (recommended for production):
```hcl
# main.tf
backend "s3" {
  bucket         = "ghs-terraform-state"
  key            = "terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-locks"
}
```

## Troubleshooting

### "Invalid token"
```bash
# Verify token
echo $TF_VAR_digitalocean_token

# Get new token at: https://cloud.digitalocean.com/account/api/tokens
```

### "Droplet creation failed"
```bash
# Check region availability
# Not all sizes are available in all regions
# Update droplet_size or region in tfvars
```

### "Can't reach Spaces bucket"
```bash
# Verify bucket was created
terraform output spaces_bucket_name

# Check CORS configuration in module
# Verify region in spaces_cors_origins
```

### "Import existing droplet"

If you have an existing droplet to import:
```bash
# Get droplet ID
doctl compute droplet list

# Import to Terraform
terraform import module.droplet.digitalocean_droplet.main <droplet-id>

# Then manage with Terraform
```

## Outputs

After `terraform apply`, get values with:

```bash
# All outputs
terraform output -json

# Specific outputs
terraform output droplet_ip
terraform output spaces_bucket
terraform output spaces_endpoint
terraform output spaces_region
terraform output vpc_id
```

These outputs can be:
- Stored in `/tmp/ghs-outputs.json` for CI/CD
- Used by deployment scripts
- Exported to environment variables for CLI tools

## Security Best Practices

1. **SSH Access**: Restrict to specific IPs in production
2. **Object Storage**: Keep buckets private; use signed URLs for access
3. **Firewall**: Default-deny; explicitly allow required ports
4. **DNS**: Manage separately (not in this Terraform config)
5. **Secrets**: Use DigitalOcean environment variables, not Terraform state
6. **State File**: Enable encryption and use remote backend

## Monitoring & Maintenance

### Costs
Review monthly costs in DigitalOcean Dashboard:
https://cloud.digitalocean.com/account/billing

### Backups
Droplet backups are automated (enabled in module via `backups = true`)
- Stored for 7 days
- Can be restored via DigitalOcean Dashboard

### Scaling
To increase capacity:
```bash
# Edit tfvars
vi staging.tfvars

# Change droplet_size
droplet_size = "s-4vcpu-8gb"

# Apply changes
terraform plan -var-file=staging.tfvars
terraform apply staging.plan
```

## Next Steps

1. ✅ Generate DigitalOcean token
2. ✅ Configure `staging.tfvars` with SSH keys
3. ✅ Restrict SSH IPs in `production.tfvars`
4. ✅ Run `terraform init`
5. ✅ Review `terraform plan` output
6. ✅ Run `terraform apply`
7. ✅ Integrate with CI/CD
8. ✅ Configure DNS (separate from Terraform)

## Support

- Terraform docs: https://registry.terraform.io/providers/digitalocean/digitalocean/latest
- DigitalOcean API: https://developers.digitalocean.com/
- Issues: Review Terraform state and logs

