/**
 * Storage client for DigitalOcean Spaces (S3-compatible)
 * Provides unified interface for uploading, downloading, and managing files
 *
 * Usage:
 *   const StorageClient = require('@ghs/storage-client');
 *   const storage = new StorageClient({
 *     endpoint: process.env.DO_SPACES_ENDPOINT,
 *     region: process.env.DO_SPACES_REGION,
 *     accessKeyId: process.env.DO_SPACES_KEY,
 *     secretAccessKey: process.env.DO_SPACES_SECRET,
 *     bucket: process.env.DO_SPACES_BUCKET,
 *   });
 *
 *   // Upload a file
 *   const url = await storage.uploadFile(
 *     Buffer.from('content'),
 *     'pdfs/invoice-123.pdf',
 *     { contentType: 'application/pdf' }
 *   );
 *
 *   // Get a signed URL (expires in 1 hour)
 *   const signedUrl = await storage.getSignedUrl('pdfs/invoice-123.pdf', 3600);
 */

const AWS = require('aws-sdk');

class StorageClient {
  constructor(config = {}) {
    this.config = {
      endpoint: config.endpoint || process.env.DO_SPACES_ENDPOINT,
      region: config.region || process.env.DO_SPACES_REGION || 'nyc3',
      accessKeyId: config.accessKeyId || process.env.DO_SPACES_KEY,
      secretAccessKey: config.secretAccessKey || process.env.DO_SPACES_SECRET,
      bucket: config.bucket || process.env.DO_SPACES_BUCKET,
      acl: config.acl || 'private',
    };

    // Validate required config
    if (!this.config.endpoint || !this.config.accessKeyId || !this.config.secretAccessKey || !this.config.bucket) {
      throw new Error(
        'StorageClient requires: endpoint, accessKeyId, secretAccessKey, bucket. ' +
        'Set as constructor args or env vars: DO_SPACES_ENDPOINT, DO_SPACES_REGION, DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_BUCKET'
      );
    }

    // Configure AWS SDK for DigitalOcean Spaces
    this.s3 = new AWS.S3({
      endpoint: this.config.endpoint,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region,
      s3ForcePathStyle: true,
    });
  }

  /**
   * Upload a file to storage
   * @param {Buffer|string} fileContent - File content
   * @param {string} filePath - Path in bucket (e.g., "pdfs/invoice-123.pdf")
   * @param {object} options - Additional options (contentType, metadata, etc.)
   * @returns {Promise<string>} Public URL of the uploaded file
   */
  async uploadFile(fileContent, filePath, options = {}) {
    const params = {
      Bucket: this.config.bucket,
      Key: filePath,
      Body: fileContent,
      ACL: this.config.acl,
      ContentType: options.contentType || 'application/octet-stream',
      Metadata: options.metadata || {},
      CacheControl: options.cacheControl || 'max-age=31536000', // 1 year for immutable assets
    };

    try {
      await this.s3.putObject(params).promise();
      const publicUrl = `${this.config.endpoint}/${this.config.bucket}/${filePath}`;
      return publicUrl;
    } catch (error) {
      throw new Error(`Failed to upload file to ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get a signed URL for temporary access to a file
   * @param {string} filePath - Path in bucket
   * @param {number} expirySeconds - URL expiry time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<string>} Signed URL with limited-time access
   */
  async getSignedUrl(filePath, expirySeconds = 3600) {
    const params = {
      Bucket: this.config.bucket,
      Key: filePath,
      Expires: expirySeconds,
    };

    try {
      const url = await this.s3.getSignedUrlPromise('getObject', params);
      return url;
    } catch (error) {
      throw new Error(`Failed to generate signed URL for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Delete a file from storage
   * @param {string} filePath - Path in bucket
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    const params = {
      Bucket: this.config.bucket,
      Key: filePath,
    };

    try {
      await this.s3.deleteObject(params).promise();
    } catch (error) {
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  /**
   * List objects in storage with optional prefix
   * @param {string} prefix - Filter by prefix (e.g., "pdfs/" to list all PDFs)
   * @returns {Promise<Array>} List of objects with keys and metadata
   */
  async listObjects(prefix = '') {
    const params = {
      Bucket: this.config.bucket,
      Prefix: prefix,
    };

    try {
      const result = await this.s3.listObjects(params).promise();
      return (result.Contents || []).map((obj) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag,
      }));
    } catch (error) {
      throw new Error(`Failed to list objects with prefix ${prefix}: ${error.message}`);
    }
  }

  /**
   * Copy a file within storage (useful for backups or organizing)
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {Promise<string>} URL of copied file
   */
  async copyFile(sourcePath, destPath) {
    const params = {
      Bucket: this.config.bucket,
      CopySource: `/${this.config.bucket}/${sourcePath}`,
      Key: destPath,
      ACL: this.config.acl,
    };

    try {
      await this.s3.copyObject(params).promise();
      const publicUrl = `${this.config.endpoint}/${this.config.bucket}/${destPath}`;
      return publicUrl;
    } catch (error) {
      throw new Error(`Failed to copy file from ${sourcePath} to ${destPath}: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in storage
   * @param {string} filePath - Path in bucket
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    const params = {
      Bucket: this.config.bucket,
      Key: filePath,
    };

    try {
      await this.s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound' || error.statusCode === 404) {
        return false;
      }
      throw new Error(`Failed to check if file exists ${filePath}: ${error.message}`);
    }
  }
}

module.exports = StorageClient;
