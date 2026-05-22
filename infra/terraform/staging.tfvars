# Terraform variables for staging environment

environment           = "staging"
digitalocean_region   = "nyc3"
spaces_region         = "nyc3"
droplet_size          = "s-2vcpu-4gb"
droplet_image         = "ubuntu-22-04-x64"

# For staging, allow SSH from broader ranges or specific IPs
allowed_ssh_ips = [
  "0.0.0.0/0"  # Warning: Open to world
  # Restrict in production to your office/VPN CIDR
]

allow_https_worldwide = true

spaces_cors_origins = [
  "https://staging.ghs.socx.org.uk",
  "http://localhost:5175"  # For local development
]

common_tags = {
  ManagedBy   = "Terraform"
  Project     = "GHS"
  Environment = "Staging"
}

# SSH key IDs (obtain via: doctl compute ssh-key list)
# ssh_key_ids = ["1234567"]
