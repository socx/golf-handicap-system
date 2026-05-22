variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "spaces_region" {
  description = "Spaces region"
  type        = string
  default     = "nyc3"
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = []
}

resource "digitalocean_spaces_bucket" "media" {
  name           = "${var.project_name}-media-${var.environment}"
  region         = var.spaces_region
  acl            = "private"
  force_destroy  = false
  
  lifecycle_rule {
    id      = "delete-temp-files"
    enabled = true
    
    prefix = "temp/"
    
    expiration {
      days = 30
    }
  }

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_origins
    expose_headers  = ["ETag", "x-amz-version-id"]
    max_age_seconds = 3600
  }
}

# Lifecycle rule for old uploads cleanup
resource "digitalocean_spaces_bucket_lifecycle_configuration" "media" {
  bucket = digitalocean_spaces_bucket.media.id
  region = var.spaces_region

  rule {
    id     = "delete-incomplete-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

output "bucket_name" {
  value       = digitalocean_spaces_bucket.media.name
  description = "Spaces bucket name"
}

output "bucket_region" {
  value       = digitalocean_spaces_bucket.media.region
  description = "Spaces bucket region"
}

output "bucket_endpoint" {
  value       = "${digitalocean_spaces_bucket.media.region}.digitaloceanspaces.com"
  description = "Spaces bucket endpoint"
}

output "bucket_urn" {
  value       = digitalocean_spaces_bucket.media.urn
  description = "Spaces bucket URN"
}
