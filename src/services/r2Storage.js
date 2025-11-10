async testConnection() {
  try {
    console.log('==> R2 Test Connection Details:');
    console.log('  Bucket:', this.bucket);
    console.log('  Endpoint:', process.env.R2_ENDPOINT);
    console.log('  Access Key ID:', process.env.R2_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
    console.log('  Secret Access Key:', process.env.R2_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
    
    const command = new HeadBucketCommand({ Bucket: this.bucket });
    await this.s3Client.send(command);
    logger.info('R2 connection test successful');
    return true;
  } catch (error) {
    console.error('==> R2 connection test FAILED:', error.message);
    console.error('==> Full error:', error);
    logger.error('R2 connection test failed', { error: error.message });
    return false;
  }
}


const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Cloudflare R2 Storage Service
 * S3-compatible object storage with zero egress fees
 * Using AWS SDK v3 for better performance and modern features
 */
class R2StorageService {
  constructor() {
    // Configure S3 client for R2 with AWS SDK v3
    this.s3Client = new S3Client({
      endpoint: process.env.R2_ENDPOINT || 'https://<account-id>.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      },
      region: 'auto', // R2 doesn't use regions like S3
      forcePathStyle: true // Required for R2 to use path-style URLs
    });

    this.bucket = process.env.R2_BUCKET_NAME || 'designer-bff-images';
    this.cdnUrl = process.env.R2_CDN_URL || `https://images.designerbff.com`;
    this.useSignedUrls = process.env.R2_USE_SIGNED_URLS === 'true'; // Set to true if bucket is private

    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      logger.warn('R2 credentials not configured. Image storage will be unavailable.');
    }
  }

  /**
   * Upload image to R2
   * @param {Buffer} imageBuffer - Image data
   * @param {Object} metadata - Image metadata
   * @returns {Promise<Object>} Upload result with CDN URL
   */
  async uploadImage(imageBuffer, metadata = {}) {
    try {
      const {
        userId,
        jobId,
        imageType = 'generated', // generated, thumbnail, enhanced
        format = 'jpg',
        originalFilename
      } = metadata;

      // Generate unique key with organized structure
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const imageId = uuidv4();
      const key = `${userId}/${timestamp}/${imageType}/${imageId}.${format}`;

      // Prepare upload parameters
      const params = {
        Bucket: this.bucket,
        Key: key,
        Body: imageBuffer,
        ContentType: this.getContentType(format),
        Metadata: {
          userId,
          jobId: jobId || '',
          imageType,
          uploadedAt: new Date().toISOString(),
          originalFilename: originalFilename || ''
        }
        // Note: R2 bucket public access is managed via Cloudflare Dashboard
        // not via ACL like traditional S3
      };

      // Upload to R2 using AWS SDK v3
      const startTime = Date.now();
      const command = new PutObjectCommand(params);
      const result = await this.s3Client.send(command);
      const uploadTime = Date.now() - startTime;

      // Try to use public CDN URL, but fallback to signed URL if bucket is private
      // For production, bucket should be configured as public for best performance
      const cdnUrl = this.useSignedUrls 
        ? await this.getSignedUrl(key, 3600 * 24 * 7) // 7 days
        : `${this.cdnUrl}/${key}`;

      logger.info('Image uploaded to R2', {
        userId,
        key,
        size: imageBuffer.length,
        uploadTime: `${uploadTime}ms`,
        cdnUrl
      });

      return {
        success: true,
        key,
        bucket: this.bucket,
        cdnUrl,
        size: imageBuffer.length,
        etag: result.ETag,
        uploadTime
      };

    } catch (error) {
      logger.error('R2 upload failed', {
        error: error.message,
        metadata
      });
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple images in batch
   * @param {Array} images - Array of {buffer, metadata}
   * @returns {Promise<Array>} Upload results
   */
  async uploadBatch(images) {
    logger.info('Starting batch upload', { count: images.length });

    const uploadPromises = images.map(({ buffer, metadata }) =>
      this.uploadImage(buffer, metadata)
        .catch(error => ({
          success: false,
          error: error.message,
          metadata
        }))
    );

    const results = await Promise.all(uploadPromises);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info('Batch upload completed', {
      total: images.length,
      successful,
      failed
    });

    return results;
  }

  /**
   * Get image from R2
   * @param {string} key - R2 object key
   * @returns {Promise<Buffer>} Image data
   */
  async getImage(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      const command = new GetObjectCommand(params);
      const result = await this.s3Client.send(command);
      
      // Convert stream to buffer in AWS SDK v3
      const chunks = [];
      for await (const chunk of result.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);

    } catch (error) {
      logger.error('R2 get image failed', {
        key,
        error: error.message
      });
      throw new Error(`R2 get image failed: ${error.message}`);
    }
  }

  /**
   * Delete image from R2
   * @param {string} key - R2 object key
   * @returns {Promise<boolean>} Success status
   */
  async deleteImage(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      const command = new DeleteObjectCommand(params);
      await this.s3Client.send(command);

      logger.info('Image deleted from R2', { key });
      return true;

    } catch (error) {
      logger.error('R2 delete failed', {
        key,
        error: error.message
      });
      throw new Error(`R2 delete failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple images
   * @param {Array<string>} keys - Array of R2 object keys
   * @returns {Promise<Object>} Deletion results
   */
  async deleteBatch(keys) {
    try {
      const params = {
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const command = new DeleteObjectsCommand(params);
      const result = await this.s3Client.send(command);

      logger.info('Batch delete completed', {
        requested: keys.length,
        deleted: result.Deleted?.length || 0,
        errors: result.Errors?.length || 0
      });

      return {
        success: true,
        deleted: result.Deleted || [],
        errors: result.Errors || []
      };

    } catch (error) {
      logger.error('R2 batch delete failed', {
        error: error.message,
        keyCount: keys.length
      });
      throw new Error(`R2 batch delete failed: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for temporary access
   * @param {string} key - R2 object key
   * @param {number} expiresIn - Expiration in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;

    } catch (error) {
      logger.error('R2 signed URL generation failed', {
        key,
        error: error.message
      });
      throw new Error(`R2 signed URL generation failed: ${error.message}`);
    }
  }

  /**
   * List images for a user
   * @param {string} userId - User ID
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} List of images
   */
  async listUserImages(userId, options = {}) {
    try {
      const {
        maxKeys = 100,
        continuationToken,
        imageType
      } = options;

      const prefix = imageType 
        ? `${userId}/*/${imageType}/`
        : `${userId}/`;

      const params = {
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken
      };

      const command = new ListObjectsV2Command(params);
      const result = await this.s3Client.send(command);

      const images = result.Contents.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        cdnUrl: `${this.cdnUrl}/${obj.Key}`,
        etag: obj.ETag
      }));

      return {
        images,
        isTruncated: result.IsTruncated,
        nextContinuationToken: result.NextContinuationToken,
        keyCount: result.KeyCount
      };

    } catch (error) {
      logger.error('R2 list images failed', {
        userId,
        error: error.message
      });
      throw new Error(`R2 list images failed: ${error.message}`);
    }
  }

  /**
   * Get storage statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Storage stats
   */
  async getUserStorageStats(userId) {
    try {
      const result = await this.listUserImages(userId, { maxKeys: 1000 });
      
      const totalSize = result.images.reduce((sum, img) => sum + img.size, 0);
      const totalCount = result.images.length;

      return {
        totalCount,
        totalSize,
        totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(3),
        estimatedMonthlyCost: this.calculateStorageCost(totalSize)
      };

    } catch (error) {
      logger.error('R2 storage stats failed', {
        userId,
        error: error.message
      });
      throw new Error(`R2 storage stats failed: ${error.message}`);
    }
  }

  /**
   * Calculate estimated storage cost
   * @param {number} sizeBytes - Total size in bytes
   * @returns {number} Monthly cost in USD
   */
  calculateStorageCost(sizeBytes) {
    const sizeGB = sizeBytes / (1024 * 1024 * 1024);
    const costPerGB = 0.015; // R2 pricing: $0.015/GB/month
    return (sizeGB * costPerGB).toFixed(4);
  }

  /**
   * Get content type for format
   * @param {string} format - Image format
   * @returns {string} Content type
   */
  getContentType(format) {
    const contentTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      avif: 'image/avif'
    };

    return contentTypes[format.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Check if R2 is properly configured
   * @returns {boolean} Configuration status
   */
  isConfigured() {
    return !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
  }

  /**
   * Test R2 connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      const command = new HeadBucketCommand({ Bucket: this.bucket });
      await this.s3Client.send(command);
      logger.info('R2 connection test successful');
      return true;
    } catch (error) {
      logger.error('R2 connection test failed', { error: error.message });
      return false;
    }
  }
}

module.exports = new R2StorageService();
