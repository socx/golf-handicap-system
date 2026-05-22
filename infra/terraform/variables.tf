variable "digitalocean_token" {
  description = "DigitalOcean API token for authentication"
  type        = string
  sensitive   = true
  # Set via environment variable: TF_VAR_digitalocean_token
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "project_name" {
  description = "Project name for resource naming and tagging"
  type        = string
  default     = "ghs"
}

variable "digitalocean_region" {
  description = "DigitalOcean region for compute resources"
  type        = string
  default     = "nyc3"
  validation {
    condition     = contains(["nyc1", "nyc3", "sfo1", "sfo2", "sfo3", "lon1", "ams3", "fra1", "blr1", "sgp1", "tor1"], var.digitalocean_region)
    error_message = "Invalid DigitalOcean region."
  }
}

variable "spaces_region" {
  description = "DigitalOcean Spaces region (may differ from droplet region)"
  type        = string
  default     = "nyc3"
}

variable "vpc_cidr_block" {
  description = "CIDR block for VPC networking"
  type        = string
  default     = "10.10.0.0/16"
}

variable "droplet_size" {
  description = "Droplet machine type (e.g., s-2vcpu-4gb, s-4vcpu-8gb)"
  type        = string
  default     = "s-2vcpu-4gb"
  validation {
    condition = contains([
      "s-1vcpu-1gb", "s-1vcpu-2gb", "s-2vcpu-2gb", "s-2vcpu-4gb",
      "s-4vcpu-8gb", "s-6vcpu-16gb"
    ], var.droplet_size)
    error_message = "Invalid droplet size."
  }
}

variable "droplet_image" {
  description = "Base image for droplet (Ubuntu version)"
  type        = string
  default     = "ubuntu-22-04-x64"
}

variable "ssh_key_ids" {
  description = "List of SSH key IDs to add to the droplet"
  type        = list(string)
  default     = []
  # E.g., ["12345678", "87654321"]
  # Find SSH key IDs with: doctl compute ssh-key list
}

variable "allowed_ssh_ips" {
  description = "List of CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Warning: Open to world; restrict in production
  # E.g., ["203.0.113.0/24", "198.51.100.0/24"]
}

variable "allow_https_worldwide" {
  description = "Allow HTTPS (443) from anywhere"
  type        = bool
  default     = true
}

variable "spaces_cors_origins" {
  description = "CORS allowed origins for Spaces bucket"
  type        = list(string)
  default     = ["https://ghs.socx.org.uk"]
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    ManagedBy = "Terraform"
    Project   = "GHS"
  }
}
