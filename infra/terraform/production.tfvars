# Terraform variables for production environment

environment           = "production"
digitalocean_region   = "nyc3"
spaces_region         = "nyc3"
droplet_size          = "s-4vcpu-8gb"  # Larger for production
droplet_image         = "ubuntu-22-04-x64"

# For production, restrict SSH to specific IPs (office, VPN, CI/CD)
allowed_ssh_ips = [
  # Add your office/VPN CIDR blocks here
  # "203.0.113.0/24"
  # "198.51.100.0/32"
  # For now, keep open but MUST restrict before deploying to production
  "0.0.0.0/0"
]

allow_https_worldwide = true

spaces_cors_origins = [
  "https://ghs.socx.org.uk"
]

common_tags = {
  ManagedBy   = "Terraform"
  Project     = "GHS"
  Environment = "Production"
}

# SSH key IDs (obtain via: doctl compute ssh-key list)
# ssh_key_ids = ["1234567", "7654321"]
