variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "droplet_ids" {
  description = "Droplet IDs to apply firewall to"
  type        = list(string)
  default     = []
}

variable "allowed_ssh_ips" {
  description = "CIDR blocks allowed for SSH"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allow_https_worldwide" {
  description = "Allow HTTPS from anywhere"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags for firewall"
  type        = map(string)
  default     = {}
}

resource "digitalocean_firewall" "main" {
  name        = "${var.project_name}-firewall-${var.environment}"
  droplet_ids = var.droplet_ids
  
  tags = concat(
    [var.environment],
    keys(var.tags)
  )

  # Allow SSH (restricted)
  dynamic "inbound_rule" {
    for_each = var.allowed_ssh_ips

    content {
      protocol         = "tcp"
      ports            = "22"
      sources {
        cidr_blocks = [inbound_rule.value]
      }
    }
  }

  # Allow HTTP
  inbound_rule {
    protocol         = "tcp"
    ports            = "80"
    sources {
      cidr_blocks = ["0.0.0.0/0", "::/0"]
    }
  }

  # Allow HTTPS
  inbound_rule {
    protocol         = "tcp"
    ports            = "443"
    sources {
      cidr_blocks = ["0.0.0.0/0", "::/0"]
    }
  }

  # Allow outbound traffic (all)
  outbound_rule {
    protocol              = "tcp"
    ports                 = "1-65535"
    destinations {
      cidr_blocks = ["0.0.0.0/0", "::/0"]
    }
  }

  outbound_rule {
    protocol              = "udp"
    ports                 = "1-65535"
    destinations {
      cidr_blocks = ["0.0.0.0/0", "::/0"]
    }
  }

  outbound_rule {
    protocol              = "icmp"
    destinations {
      cidr_blocks = ["0.0.0.0/0", "::/0"]
    }
  }
}

output "firewall_id" {
  value       = digitalocean_firewall.main.id
  description = "Firewall ID"
}

output "firewall_status" {
  value       = digitalocean_firewall.main.status
  description = "Firewall status"
}
