/**
 * Ingestion Agent
 * 
 * Handles ZIP upload, image extraction, deduplication, and initial processing.
 * Runs vision embeddings (CLIP) and vision captioning (Gemini 2.5 Flash).
 */

const AdmZip = require('adm-zip');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const db = require('./database');
const r2Storage = require('./r2Storage');
const logger = require('../utils/logger');
const Replicate = require('replicate');

class IngestionAgent {
  /**
   * Process uploaded ZIP file
   * @param {string} userId - User ID
   * @param {Buffer} zipBuffer - ZIP file buffer
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Portfolio and processing results
   */
  async processZipUpload(userId, zipBuffer, filename) {
    const startTime = Date.now();
    logger.info('Ingestion Agent: Starting ZIP processing', { userId, filename });

    // Create portfolio record
    const portfolio = await this.createPortfolio(userId, filename);

    try {
      // Update status to processing
      await this.updatePortfolioStatus(portfolio.id, 'processing');

      // Extract images from ZIP
      const images = await this.extractImages(zipBuffer);
      logger.info('Ingestion Agent: Extracted images', { count: images.length });

      // Validate minimum image count (50 for MVP)
      if (images.length === 0) {
        throw new Error(
          'No images found in portfolio. Please ensure your ZIP file contains image files (.jpg, .jpeg, .png, or .webp) and try again. ' +
          'Common issues: 1) Images might be in a nested folder inside the ZIP. 2) File extensions might be uppercase (.JPG instead of .jpg). ' +
          'Try extracting your ZIP and re-creating it with images at the root level.'
        );
      }
      
      // Allow minimum 5 images for testing, 50 for production
      const minImages = process.env.NODE_ENV === 'development' ? 5 : 50;
      if (images.length < minImages) {
        throw new Error(
          `Portfolio must contain at least ${minImages} images. Found ${images.length} images. ` +
          `Please add ${minImages - images.length} more images to your portfolio and try again.`
        );
      }

      // Deduplicate images
      const uniqueImages = await this.deduplicateImages(images);
      logger.info('Ingestion Agent: Deduplicated images', { 
        original: images.length, 
        unique: uniqueImages.length 
      });

      // Process each image
      const processedImages = [];
      for (let i = 0; i < uniqueImages.length; i++) {
        const imageData = uniqueImages[i];
        
        try {
          const processed = await this.processImage(userId, portfolio.id, imageData, i);
          processedImages.push(processed);
          
          // Progress logging
          if ((i + 1) % 10 === 0 || i === uniqueImages.length - 1) {
            logger.info('Ingestion Agent: Progress', { 
              processed: i + 1, 
              total: uniqueImages.length 
            });
          }
        } catch (error) {
          logger.error('Ingestion Agent: Failed to process image', { 
            filename: imageData.filename, 
            error: error.message 
          });
          // Continue processing other images
        }
      }

      // Update portfolio with results
      await this.updatePortfolioStatus(portfolio.id, 'completed', processedImages.length);

      const processingTime = Date.now() - startTime;
      logger.info('Ingestion Agent: Completed', { 
        portfolioId: portfolio.id,
        imageCount: processedImages.length,
        processingTimeMs: processingTime
      });

      return {
        portfolio: {
          id: portfolio.id,
          imageCount: processedImages.length
        },
        images: processedImages,
        processingTimeMs: processingTime
      };

    } catch (error) {
      logger.error('Ingestion Agent: Processing failed', { 
        portfolioId: portfolio.id, 
        error: error.message 
      });
      
      await this.updatePortfolioStatus(portfolio.id, 'failed', 0, error.message);
      throw error;
    }
  }

  /**
   * Create portfolio record in database
   */
  async createPortfolio(userId, filename) {
    const query = `
      INSERT INTO portfolios (user_id, zip_filename, processing_started_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      RETURNING id, user_id, title, zip_filename, created_at
    `;
    
    const result = await db.query(query, [userId, filename]);
    return result.rows[0];
  }

  /**
   * Update portfolio status
   */
  async updatePortfolioStatus(portfolioId, status, imageCount = 0, errorMessage = null) {
    const query = `
      UPDATE portfolios
      SET processing_status = $1,
          image_count = $2,
          processing_completed_at = CURRENT_TIMESTAMP,
          error_message = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `;
    
    await db.query(query, [status, imageCount, errorMessage, portfolioId]);
  }

  /**
   * Extract images from ZIP buffer
   */
  async extractImages(zipBuffer) {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    logger.info('ZIP extraction started', { totalEntries: zipEntries.length });
    
    const images = [];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const skippedFiles = [];
    
    for (const entry of zipEntries) {
      logger.info('Processing ZIP entry', {  // Changed from debug to info
        name: entry.entryName, 
        isDirectory: entry.isDirectory,
        size: entry.header?.size 
      });
      
      // Skip directories
      if (entry.isDirectory) {
        logger.info('Skipping entry (directory)', { name: entry.entryName });
        continue;
      }
      
      // Skip hidden files and __MACOSX
      const fileName = path.basename(entry.entryName);
      if (fileName.startsWith('.') || entry.entryName.includes('__MACOSX')) {
        logger.info('Skipping entry (hidden or __MACOSX)', { name: entry.entryName });
        continue;
      }
      
      // Check extension (case-insensitive)
      const ext = path.extname(entry.entryName).toLowerCase();
      logger.info('Checking extension', { filename: entry.entryName, ext, validExtensions });
      
      if (validExtensions.includes(ext)) {
        logger.info('Valid image found', { filename: entry.entryName, ext });
        images.push({
          filename: path.basename(entry.entryName),
          buffer: entry.getData(),
          originalPath: entry.entryName
        });
      } else {
        logger.info('Invalid extension, skipping', { filename: entry.entryName, ext });
        skippedFiles.push({ name: entry.entryName, ext });
      }
    }
    
    logger.info('ZIP extraction complete', { 
      totalEntries: zipEntries.length, 
      imagesFound: images.length,
      skippedFiles: skippedFiles.length,
      skippedSample: skippedFiles.slice(0, 5)
    });
    
    return images;
  }

  /**
   * Deduplicate images by content hash
   */
  async deduplicateImages(images) {
    const seen = new Set();
    const unique = [];
    
    for (const image of images) {
      const hash = crypto.createHash('sha256').update(image.buffer).digest('hex');
      
      if (!seen.has(hash)) {
        seen.add(hash);
        image.contentHash = hash;
        unique.push(image);
      }
    }
    
    return unique;
  }

  /**
   * Process individual image
   */
  async processImage(userId, portfolioId, imageData, index) {
    // Normalize filename
    const normalizedFilename = this.normalizeFilename(imageData.filename, index);
    
    // Upload to R2
    const ext = path.extname(normalizedFilename).substring(1); // Remove the dot
    const uploadResult = await r2Storage.uploadImage(imageData.buffer, {
      userId,
      jobId: portfolioId,
      imageType: 'portfolio',
      format: ext,
      originalFilename: imageData.filename
    });
    
    // Get image dimensions
    const dimensions = await this.getImageDimensions(imageData.buffer);
    
    // Create database record
    const imageRecord = await this.createImageRecord(
      userId,
      portfolioId,
      normalizedFilename,
      uploadResult.cdnUrl,
      uploadResult.key,
      dimensions,
      imageData.buffer.length
    );
    
    // Generate embedding (async, don't block)
    this.generateEmbedding(imageRecord.id, imageData.buffer).catch(err => {
      logger.error('Failed to generate embedding', { imageId: imageRecord.id, error: err.message });
    });
    
    // Generate caption (async, don't block)
    this.generateCaption(imageRecord.id, imageData.buffer).catch(err => {
      logger.error('Failed to generate caption', { imageId: imageRecord.id, error: err.message });
    });
    
    return imageRecord;
  }

  /**
   * Normalize filename
   */
  normalizeFilename(filename, index) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const normalized = base.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
    return `${normalized}_${String(index).padStart(4, '0')}${ext}`;
  }

  /**
   * Create image record in database
   */
  async createImageRecord(userId, portfolioId, filename, url, r2Key, dimensions, fileSize) {
    const query = `
      INSERT INTO portfolio_images (
        user_id, portfolio_id, filename, url_original, 
        r2_key, width, height, file_size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, portfolio_id, filename, url_original, created_at
    `;
    
    const result = await db.query(query, [
      userId,
      portfolioId,
      filename,
      url,
      r2Key,
      dimensions.width,
      dimensions.height,
      fileSize
    ]);
    
    return result.rows[0];
  }

  /**
   * Get image dimensions (placeholder - would use sharp or similar)
   */
  async getImageDimensions(buffer) {
    // TODO: Implement actual dimension detection with sharp
    // For now, return placeholder values
    return { width: 1024, height: 1024 };
  }

  /**
   * Generate embedding using CLIP (placeholder)
   */
  async generateEmbedding(imageId, buffer) {
    // TODO: Implement actual CLIP embedding
    // This would call a Python service or use transformers.js
    logger.info('Generating embedding', { imageId });
    
    // Placeholder: Generate random embedding for now
    const embedding = Array(512).fill(0).map(() => Math.random());
    
    const query = `
      INSERT INTO image_embeddings (image_id, vector, model_name)
      VALUES ($1, $2, $3)
    `;
    
    await db.query(query, [imageId, JSON.stringify(embedding), 'clip-vit-base']);
  }

  /**
   * Generate caption using Gemini 2.5 Flash via Replicate
   */
  async generateCaption(imageId, buffer) {
    try {
      if (!process.env.REPLICATE_API_TOKEN) {
        logger.warn('Replicate API token not configured, skipping caption');
        return null;
      }

      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
      });
      
      // Convert buffer to base64
      const base64Image = buffer.toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64Image}`;
      
      const prompt = `Describe this fashion image in detail, including:
- Garment type(s)
- Colors and color palette
- Fabrics and textures
- Style and aesthetic
- Any notable design details

Be concise and specific.`;

      const output = await replicate.run(
        'google/gemini-2.5-flash',
        {
          input: {
            prompt: prompt,
            image: dataUri,
            max_output_tokens: 512,
            temperature: 0.2
          }
        }
      );

      const caption = Array.isArray(output) ? output.join('') : output;
      
      // Store caption in image_descriptors as raw_analysis
      await db.query(`
        INSERT INTO image_descriptors (image_id, raw_analysis)
        VALUES ($1, $2)
        ON CONFLICT (image_id) DO UPDATE SET raw_analysis = $2
      `, [imageId, JSON.stringify({ caption })]);
      
      logger.info('Generated caption', { imageId });
      return caption;
      
    } catch (error) {
      logger.error('Failed to generate caption with Gemini via Replicate', { 
        imageId, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Add images to existing portfolio
   * @param {string} portfolioId - Portfolio ID
   * @param {Buffer} zipBuffer - ZIP file buffer
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Add results
   */
  async addImagesToPortfolio(portfolioId, zipBuffer, filename) {
    logger.info('Ingestion Agent: Adding images to portfolio', { portfolioId, filename });

    // Get portfolio and verify it exists
    const portfolio = await this.getPortfolio(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Extract images from ZIP
    const images = await this.extractImages(zipBuffer);
    logger.info('Ingestion Agent: Extracted new images', { count: images.length });

    if (images.length === 0) {
      throw new Error('No images found in ZIP file');
    }

    // Deduplicate against existing images
    const existingImages = await this.getPortfolioImages(portfolioId);
    const existingHashes = new Set(
      existingImages.map(img => img.content_hash).filter(Boolean)
    );

    const uniqueImages = [];
    let duplicateCount = 0;

    for (const image of images) {
      const hash = crypto.createHash('sha256').update(image.buffer).digest('hex');
      
      if (!existingHashes.has(hash)) {
        image.contentHash = hash;
        uniqueImages.push(image);
        existingHashes.add(hash);
      } else {
        duplicateCount++;
      }
    }

    logger.info('Ingestion Agent: Deduplicated new images', { 
      extracted: images.length, 
      unique: uniqueImages.length,
      duplicates: duplicateCount
    });

    // Process each unique image
    const processedImages = [];
    const startIndex = existingImages.length;

    for (let i = 0; i < uniqueImages.length; i++) {
      const imageData = uniqueImages[i];
      
      try {
        const processed = await this.processImage(
          portfolio.user_id, 
          portfolioId, 
          imageData, 
          startIndex + i
        );
        processedImages.push(processed);
        
        if ((i + 1) % 10 === 0 || i === uniqueImages.length - 1) {
          logger.info('Ingestion Agent: Add progress', { 
            processed: i + 1, 
            total: uniqueImages.length 
          });
        }
      } catch (error) {
        logger.error('Ingestion Agent: Failed to process new image', { 
          filename: imageData.filename, 
          error: error.message 
        });
      }
    }

    // Update portfolio image count
    const newTotal = existingImages.length + processedImages.length;
    await db.query(
      'UPDATE portfolios SET image_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newTotal, portfolioId]
    );

    return {
      addedCount: processedImages.length,
      totalImages: newTotal,
      duplicateCount
    };
  }

  /**
   * Get portfolio by ID
   */
  async getPortfolio(portfolioId) {
    const query = `
      SELECT p.*, 
        (SELECT COUNT(*) FROM portfolio_images WHERE portfolio_id = p.id) as actual_image_count
      FROM portfolios p
      WHERE p.id = $1
    `;
    
    const result = await db.query(query, [portfolioId]);
    return result.rows[0] || null;
  }

  /**
   * Get portfolio images
   */
  async getPortfolioImages(portfolioId) {
    const query = `
      SELECT pi.*, ie.vector as embedding
      FROM portfolio_images pi
      LEFT JOIN image_embeddings ie ON pi.id = ie.image_id
      WHERE pi.portfolio_id = $1
      ORDER BY pi.created_at
    `;
    
    const result = await db.query(query, [portfolioId]);
    return result.rows;
  }
}

module.exports = new IngestionAgent();
