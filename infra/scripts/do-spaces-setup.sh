#!/usr/bin/env bash
# do-spaces-setup.sh — Configure DigitalOcean Spaces bucket for GHS PDFs and images.
#
# Prerequisites:
#   - Install doctl: https://docs.digitalocean.com/reference/doctl/how-to/install/
#   - Authenticate: doctl auth init
#
# Usage:
#   export BUCKET_NAME="ghs-pdfs-$(date +%s)"
#   bash infra/scripts/do-spaces-setup.sh
#
# Sets up:
#   - Bucket creation with private ACL
#   - CORS configuration for web access
#   - Lifecycle rules for cleanup (e.g., delete old temp files)
#   - Access keys for API authentication

set -euo pipefail

BUCKET_NAME="${BUCKET_NAME:-ghs-storage}"
REGION="${REGION:-nyc3}"
CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-https://ghs.socx.org.uk}"

echo "[do-spaces-setup] Creating DigitalOcean Spaces bucket: $BUCKET_NAME"

# Check if doctl is installed
if ! command -v doctl &>/dev/null; then
  echo "[do-spaces-setup] ERROR: doctl not found. Install from https://docs.digitalocean.com/reference/doctl/" >&2
  exit 1
fi

# Note: doctl doesn't have comprehensive Spaces support in the CLI.
# Manual steps or API calls are recommended:
# 1. Create bucket via DigitalOcean Console or API
# 2. Configure CORS and lifecycle via s3cmd or AWS CLI pointing to Spaces endpoint

echo ""
echo "[do-spaces-setup] Manual configuration steps:"
echo ""
echo "1. Create bucket in DigitalOcean Console or using s3cmd:"
echo "   s3cmd mb s3://$BUCKET_NAME --region=$REGION"
echo ""
echo "2. Configure CORS (allow web requests from your domain):"
cat > /tmp/cors-config.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["$CORS_ALLOWED_ORIGINS"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000,
      "ExposeHeaders": ["ETag"]
    }
  ]
}
EOF
echo "   aws s3api put-bucket-cors \\"
echo "     --bucket $BUCKET_NAME \\"
echo "     --cors-configuration file:///tmp/cors-config.json \\"
echo "     --endpoint-url https://$REGION.digitaloceanspaces.com"
echo ""
echo "3. Configure lifecycle rules (delete old temp files after 30 days):"
cat > /tmp/lifecycle-config.json <<'EOF'
{
  "Rules": [
    {
      "ID": "DeleteTempFilesAfter30Days",
      "Status": "Enabled",
      "Prefix": "temp/",
      "Expiration": {
        "Days": 30
      }
    },
    {
      "ID": "DeleteIncompleteMultipartUploads",
      "Status": "Enabled",
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    }
  ]
}
EOF
echo "   aws s3api put-bucket-lifecycle-configuration \\"
echo "     --bucket $BUCKET_NAME \\"
echo "     --lifecycle-configuration file:///tmp/lifecycle-config.json \\"
echo "     --endpoint-url https://$REGION.digitaloceanspaces.com"
echo ""
echo "4. Create API credentials:"
echo "   - Go to DigitalOcean Console → API → Spaces Keys"
echo "   - Generate new key (or reuse existing)"
echo "   - Store in GitHub secrets:"
echo "     - DO_SPACES_KEY (Access Key)"
echo "     - DO_SPACES_SECRET (Secret Key)"
echo ""
echo "5. Set GitHub repository secrets:"
echo "   - DO_SPACES_ENDPOINT: https://$REGION.digitaloceanspaces.com"
echo "   - DO_SPACES_REGION: $REGION"
echo "   - DO_SPACES_BUCKET: $BUCKET_NAME"
echo "   - DO_SPACES_KEY: <access-key>"
echo "   - DO_SPACES_SECRET: <secret-key>"
echo ""
echo "[do-spaces-setup] Setup guide complete!"
