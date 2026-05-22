variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "cidr_block" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.10.0.0/16"
}

resource "digitalocean_vpc" "main" {
  name        = "${var.project_name}-vpc-${var.environment}"
  region      = "nyc3"  # VPC region should match primary region
  description = "VPC for ${var.project_name} ${var.environment} environment"
}

resource "digitalocean_vpc_subnet" "main" {
  vpc_id            = digitalocean_vpc.main.id
  region            = "nyc3"
  subnet_cidr       = "10.10.0.0/24"
  type              = "private"
  description       = "Private subnet for ${var.project_name} ${var.environment}"
}

output "vpc_id" {
  value       = digitalocean_vpc.main.id
  description = "VPC ID"
}

output "vpc_urn" {
  value       = digitalocean_vpc.main.urn
  description = "VPC URN"
}

output "subnet_id" {
  value       = digitalocean_vpc_subnet.main.id
  description = "Subnet ID"
}
