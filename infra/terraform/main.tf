terraform {
  required_version = ">= 1.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.30"
    }
  }

  # Uncomment to use remote state (tfstate) storage
  # backend "s3" {
  #   bucket         = "ghs-terraform-state"
  #   key            = "terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "digitalocean" {
  token = var.digitalocean_token
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  environment  = var.environment
  project_name = var.project_name
  cidr_block   = var.vpc_cidr_block
}

# Droplet Module (Compute)
module "droplet" {
  source = "./modules/droplet"

  environment     = var.environment
  project_name    = var.project_name
  region          = var.digitalocean_region
  droplet_size    = var.droplet_size
  droplet_image   = var.droplet_image
  ssh_key_ids     = var.ssh_key_ids
  vpc_uuid        = module.networking.vpc_id
  
  tags = merge(
    var.common_tags,
    {
      Component = "Compute"
      Module    = "Droplet"
    }
  )
}

# Spaces Object Storage Module
module "spaces" {
  source = "./modules/spaces"

  environment     = var.environment
  project_name    = var.project_name
  spaces_region   = var.spaces_region
  cors_origins    = var.spaces_cors_origins
  
  tags = merge(
    var.common_tags,
    {
      Component = "Storage"
      Module    = "Spaces"
    }
  )
}

# Firewall Module
module "firewall" {
  source = "./modules/firewall"

  environment           = var.environment
  project_name          = var.project_name
  droplet_ids           = [module.droplet.droplet_id]
  allowed_ssh_ips       = var.allowed_ssh_ips
  allow_https_worldwide = var.allow_https_worldwide
  
  tags = merge(
    var.common_tags,
    {
      Component = "Security"
      Module    = "Firewall"
    }
  )
}

# DNS Module (optional, if managed via Terraform)
# module "dns" {
#   source = "./modules/dns"
#   
#   domain_name    = var.domain_name
#   droplet_ip     = module.droplet.droplet_ip_address
#   spaces_endpoint = module.spaces.spaces_endpoint
# }

# Output key infrastructure details for CI/CD integration
output "droplet_ip" {
  value       = module.droplet.droplet_ip_address
  description = "Public IP address of the GHS droplet"
}

output "droplet_id" {
  value       = module.droplet.droplet_id
  description = "Digital Ocean droplet ID"
}

output "spaces_bucket" {
  value       = module.spaces.bucket_name
  description = "Spaces bucket name"
}

output "spaces_endpoint" {
  value       = module.spaces.bucket_endpoint
  description = "Spaces bucket endpoint (for client library configuration)"
}

output "spaces_region" {
  value       = module.spaces.bucket_region
  description = "Spaces bucket region"
}

output "vpc_id" {
  value       = module.networking.vpc_id
  description = "VPC ID for subnet associations"
}
