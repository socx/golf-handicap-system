variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name for naming"
  type        = string
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
}

variable "droplet_size" {
  description = "Droplet machine type"
  type        = string
}

variable "droplet_image" {
  description = "Droplet image ID or slug"
  type        = string
}

variable "ssh_key_ids" {
  description = "SSH key IDs to add to droplet"
  type        = list(string)
  default     = []
}

variable "vpc_uuid" {
  description = "VPC UUID for networking"
  type        = string
}

variable "tags" {
  description = "Tags for the droplet"
  type        = map(string)
  default     = {}
}

resource "digitalocean_droplet" "main" {
  name               = "${var.project_name}-${var.environment}"
  region             = var.region
  size               = var.droplet_size
  image              = var.droplet_image
  backups            = true
  monitoring         = true
  ipv6               = true
  private_networking = true
  vpc_uuid           = var.vpc_uuid
  ssh_keys           = var.ssh_key_ids
  tags               = concat(
    [var.environment],
    keys(var.tags)
  )

  # Startup script (replaces manual bootstrap)
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    project_name = var.project_name
    environment  = var.environment
  }))

  depends_on = []
}

output "droplet_id" {
  value       = digitalocean_droplet.main.id
  description = "Droplet ID"
}

output "droplet_ip_address" {
  value       = digitalocean_droplet.main.ipv4_address
  description = "Droplet public IPv4 address"
}

output "droplet_private_ip" {
  value       = digitalocean_droplet.main.ipv4_address_private
  description = "Droplet private IP address"
}

output "droplet_ipv6" {
  value       = digitalocean_droplet.main.ipv6_address
  description = "Droplet public IPv6 address"
}
