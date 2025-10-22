const express = require('express');
const multer = require('multer');
const path = require('path');
const { asyncHandler } = require('../../middleware/errorHandler');
const vltService = require('../../services/vltService');
const logger = require('../../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB - increased for larger portfolios
    files: 100 // Max 100 files in batch
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif', 
      'image/webp', 
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream' // Some browsers report ZIP as octet-stream
    ];
    
    // Check MIME type first
    const mimeTypeValid = allowedTypes.includes(file.mimetype);
    
    // Also check file extension for ZIP files
    const ext = path.extname(file.originalname).toLowerCase();
    const isZipExtension = ext === '.zip';
    const isImageExtension = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    
    if (mimeTypeValid || isZipExtension || isImageExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only images and ZIP files are allowed.`), false);
    }
  }
});

/**
 * GET /api/vlt/health
 * Check VLT service health
 */
router.get('/health', asyncHandler(async (req, res) => {
  const isHealthy = await vltService.healthCheck();
  
  res.json({
    success: true,
    data: {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'VLT API',
      endpoint: process.env.VLT_API_URL,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/vlt/analyze/single
 * Analyze a single image using VLT
 */
router.post('/analyze/single', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  const { model = 'gemini', passes = 'A,B,C' } = req.body;

  logger.info('VLT single image analysis started', {
    userId: req.user?.id || 'anonymous',
    fileName: req.file.originalname,
    fileSize: req.file.size,
    model,
    passes
  });

  const startTime = Date.now();
  
  try {
    const result = await vltService.analyzeImage(req.file.buffer, {
      model,
      passes
    });

    const duration = Date.now() - startTime;
    logger.logAPICall('VLT', '/v1/jobs', 'POST', duration, 'success');

    res.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}ms`,
        model,
        passes
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAPICall('VLT', '/v1/jobs', 'POST', duration, 'error');
    throw error;
  }
}));

/**
 * POST /api/vlt/analyze/batch
 * Analyze multiple images from a ZIP file
 */
router.post('/analyze/batch', upload.single('zipFile'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No ZIP file provided'
    });
  }

  const { model = 'gemini', passes = 'A,B,C' } = req.body;

  logger.info('VLT batch analysis started', {
    userId: req.user?.id || 'anonymous',
    fileName: req.file.originalname,
    fileSize: req.file.size,
    model,
    passes
  });

  const startTime = Date.now();

  try {
    const result = await vltService.analyzeBatch(req.file.buffer, {
      model,
      passes
    });

    const duration = Date.now() - startTime;
    logger.logAPICall('VLT', '/v1/jobs', 'POST', duration, 'success');

    res.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}ms`,
        model: result.model || model,
        passes,
        imageCount: result.records.length,
        ...(result.fallback && {
          fallback: result.fallback,
          warning: `Primary model (${result.fallback.originalModel}) failed, used ${result.fallback.usedModel} instead`
        })
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAPICall('VLT', '/v1/jobs', 'POST', duration, 'error');
    throw error;
  }
}));

/**
 * POST /api/vlt/analyze/enhanced
 * Enhanced batch analysis with hybrid style detection (VLT + Local AI)
 */
router.post('/analyze/enhanced', upload.single('zipFile'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No ZIP file provided'
    });
  }

  const { 
    model = 'gemini', 
    passes = 'A,B,C', 
    useHybrid = true,
    preferLocal = false 
  } = req.body;

  logger.info('Enhanced VLT batch analysis started', {
    userId: req.user?.id || 'anonymous',
    fileName: req.file.originalname,
    fileSize: req.file.size,
    model,
    passes,
    useHybrid,
    preferLocal
  });

  const startTime = Date.now();

  try {
    // Set environment variables for this request
    process.env.USE_HYBRID_ANALYSIS = useHybrid.toString();
    process.env.PREFER_LOCAL_ANALYSIS = preferLocal.toString();
    
    const enhancedVltService = require('../../services/enhancedVltService');
    const result = await enhancedVltService.batchAnalyze(req.file.buffer, {
      model,
      passes
    });

    const duration = Date.now() - startTime;
    logger.logAPICall('Enhanced_VLT', '/analyze/enhanced', 'POST', duration, 'success');

    // Log style detection results
    const enhancedCount = result.records?.filter(r => r.styleEnhanced).length || 0;
    const detectedStyles = result.summary?.detectedStyleSignatures || {};
    
    logger.info('Enhanced analysis completed', {
      totalRecords: result.records?.length || 0,
      enhancedRecords: enhancedCount,
      detectedStyles: Object.keys(detectedStyles),
      analysisMethod: result.analysisMethod
    });

    res.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}ms`,
        model: result.model || model,
        passes,
        imageCount: result.records.length,
        analysisMethod: result.analysisMethod,
        enhancedRecords: enhancedCount,
        detectedStyleSignatures: Object.keys(detectedStyles),
        hybrid: result.enhanced || false,
        ...(result.fallback && {
          fallback: result.fallback,
          warning: `Primary model (${result.fallback.originalModel}) failed, used ${result.fallback.usedModel} instead`
        })
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAPICall('Enhanced_VLT', '/analyze/enhanced', 'POST', duration, 'error');
    throw error;
  }
}));

/**
 * POST /api/vlt/enhance-prompt
 * Convert VLT analysis to enhanced prompts
 */
router.post('/enhance-prompt', asyncHandler(async (req, res) => {
  const { vltResult } = req.body;

  if (!vltResult || !vltResult.records) {
    return res.status(400).json({
      success: false,
      message: 'Invalid VLT result data'
    });
  }

  try {
    const enhancement = vltService.toPromptEnhancement(vltResult);

    logger.info('Prompt enhancement completed', {
      userId: req.user?.id || 'anonymous',
      jobId: vltResult.jobId,
      enhancementCount: enhancement.enhancements.length
    });

    res.json({
      success: true,
      data: enhancement
    });

  } catch (error) {
    logger.error('Prompt enhancement failed', {
      userId: req.user?.id || 'anonymous',
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/vlt/analyze-url
 * Analyze image from URL
 */
router.post('/analyze-url', asyncHandler(async (req, res) => {
  const { imageUrl, model = 'gemini', passes = 'A,B,C' } = req.body;

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      message: 'Image URL is required'
    });
  }

  logger.info('VLT URL analysis started', {
    userId: req.user?.id || 'anonymous',
    imageUrl,
    model,
    passes
  });

  const startTime = Date.now();

  try {
    // Download image from URL
    const axios = require('axios');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const imageBuffer = Buffer.from(response.data);
    
    const result = await vltService.analyzeImage(imageBuffer, {
      model,
      passes
    });

    const duration = Date.now() - startTime;
    logger.logAPICall('VLT', '/v1/jobs', 'POST', duration, 'success');

    res.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}ms`,
        model,
        passes,
        sourceUrl: imageUrl
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAPICall('VLT', '/v1/jobs', 'POST', duration, 'error');
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(400).json({
        success: false,
        message: 'Unable to download image from URL'
      });
    }
    
    throw error;
  }
}));

/**
 * POST /api/vlt/analyze/direct
 * Analyze images directly using Replicate vision model (bypasses VLT tool)
 * This is more reliable and faster than the external VLT service
 */
router.post('/analyze/direct', upload.single('zipFile'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No ZIP file provided'
    });
  }

  const fashionAnalysisService = require('../../services/fashionAnalysisService');
  const AdmZip = require('adm-zip');
  const { v4: uuidv4 } = require('uuid');

  logger.info('Direct fashion analysis started', {
    userId: req.user?.id || 'anonymous',
    fileName: req.file.originalname,
    fileSize: req.file.size
  });

  const startTime = Date.now();

  try {
    // Extract images from ZIP
    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();
    
    const imageBuffers = [];
    zipEntries.forEach((entry) => {
      // Skip directories, hidden files, and macOS metadata
      if (entry.isDirectory) return;
      if (entry.entryName.includes('__MACOSX')) return;
      if (entry.entryName.includes('.DS_Store')) return;
      const filename = entry.entryName.split('/').pop(); // Get just the filename
      if (filename.startsWith('.')) return; // Skip hidden files
      
      // Check if it's a valid image file
      if (entry.entryName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        imageBuffers.push({
          buffer: entry.getData(),
          name: entry.entryName
        });
      }
    });

    if (imageBuffers.length === 0) {
      throw new Error('No valid images found in ZIP file');
    }

    logger.info(`Found ${imageBuffers.length} images in ZIP`);

    // Analyze images
    const results = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const { buffer, name } = imageBuffers[i];
      
      try {
        const analysis = await fashionAnalysisService.analyzeImage(buffer);
        results.push({
          imageId: name.replace(/\.[^/.]+$/, ''), // Remove extension
          ...analysis
        });
        
        logger.info(`Analyzed image ${i + 1}/${imageBuffers.length}`);
        
      } catch (error) {
        logger.warn(`Failed to analyze image ${name}`, { error: error.message });
        // Add fallback for failed image
        const fallback = await fashionAnalysisService._getFallbackAnalysis();
        results.push({
          imageId: name.replace(/\.[^/.]+$/, ''),
          ...fallback,
          error: error.message
        });
      }
      
      // Rate limiting
      if (i < imageBuffers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Generate summary
    const summary = {
      totalImages: results.length,
      garmentTypes: {},
      dominantColors: {},
      fabricTypes: {},
      silhouettes: {},
      averageConfidence: 0
    };

    let totalConfidence = 0;
    results.forEach(record => {
      if (record.garmentType) {
        summary.garmentTypes[record.garmentType] = 
          (summary.garmentTypes[record.garmentType] || 0) + 1;
      }
      if (record.colors?.primary) {
        summary.dominantColors[record.colors.primary] = 
          (summary.dominantColors[record.colors.primary] || 0) + 1;
      }
      if (record.fabric?.type) {
        summary.fabricTypes[record.fabric.type] = 
          (summary.fabricTypes[record.fabric.type] || 0) + 1;
      }
      if (record.silhouette) {
        summary.silhouettes[record.silhouette] = 
          (summary.silhouettes[record.silhouette] || 0) + 1;
      }
      totalConfidence += record.confidence || 0;
    });

    summary.averageConfidence = results.length > 0 ? 
      (totalConfidence / results.length).toFixed(2) : 0;

    const duration = Date.now() - startTime;
    logger.logAPICall('Replicate Vision', 'analyze/direct', 'POST', duration, 'success');

    res.json({
      success: true,
      data: {
        jobId: uuidv4(),
        status: 'completed',
        backend: 'replicate',
        model: 'llava-13b',
        timestamp: new Date().toISOString(),
        records: results,
        summary
      },
      meta: {
        processingTime: `${duration}ms`,
        imageCount: results.length
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAPICall('Replicate Vision', 'analyze/direct', 'POST', duration, 'error');
    throw error;
  }
}));

/**
 * POST /api/vlt/analyze/stream
 * Analyze images with streaming progress updates using Server-Sent Events
 * Integrates immediate Pinecone vector upload as per Stage 1 specifications
 */
router.post('/analyze/stream', upload.single('zipFile'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No ZIP file provided'
    });
  }

  const fashionAnalysisService = require('../../services/fashionAnalysisService');
  const pineconeService = require('../../services/pineconeService');
  const AdmZip = require('adm-zip');
  const { v4: uuidv4 } = require('uuid');
  
  // Extract user data from form if available (for onboarding flow)
  const { name, email, company, role } = req.body;
  const userId = req.user?.id || `user_${Date.now()}`; // Fallback for demo purposes
  
  // Note: Enhanced style detection is now handled by the fashionAnalysisService
  // with improved LLM prompts that automatically detect sporty, minimalist, etc.
  // No manual keyword mapping needed - the vision model does it automatically!

  // Set up Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  logger.info('Streaming fashion analysis started', {
    userId: req.user?.id || 'anonymous',
    fileName: req.file.originalname,
    fileSize: req.file.size
  });

  const startTime = Date.now();

  try {
    sendProgress({ progress: 5, message: 'Extracting images from ZIP...' });

    // Extract images from ZIP
    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();
    
    const imageBuffers = [];
    zipEntries.forEach((entry) => {
      // Skip directories, hidden files, and macOS metadata
      if (entry.isDirectory) return;
      if (entry.entryName.includes('__MACOSX')) return;
      if (entry.entryName.includes('.DS_Store')) return;
      const filename = entry.entryName.split('/').pop(); // Get just the filename
      if (filename.startsWith('.')) return; // Skip hidden files
      
      // Check if it's a valid image file
      if (entry.entryName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        imageBuffers.push({
          buffer: entry.getData(),
          name: entry.entryName
        });
      }
    });

    if (imageBuffers.length === 0) {
      sendProgress({ error: 'No valid images found in ZIP file' });
      return res.end();
    }

    logger.info(`Found ${imageBuffers.length} images in ZIP`);
    sendProgress({ 
      progress: 10, 
      message: `Found ${imageBuffers.length} images. Starting analysis...`,
      totalImages: imageBuffers.length 
    });

    // Analyze images with parallel batch processing
    const results = [];
    const progressPerImage = 80 / imageBuffers.length; // 80% for analysis, 20% for finalization
    
    // Process in batches of 5 images concurrently for better performance
    const BATCH_SIZE = 5;
    let completedCount = 0;
    
    for (let batchStart = 0; batchStart < imageBuffers.length; batchStart += BATCH_SIZE) {
      const batch = imageBuffers.slice(batchStart, batchStart + BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(async ({ buffer, name }, batchIndex) => {
        const imageIndex = batchStart + batchIndex;
        try {
          const analysis = await fashionAnalysisService.analyzeImage(buffer);
          return {
            index: imageIndex,
            imageId: name.replace(/\.[^/.]+$/, ''),
            ...analysis
          };
        } catch (error) {
          logger.warn(`Failed to analyze image ${name}`, { error: error.message });
          const fallback = await fashionAnalysisService._getFallbackAnalysis();
          return {
            index: imageIndex,
            imageId: name.replace(/\.[^/.]+$/, ''),
            ...fallback,
            error: error.message
          };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Sort by index and add to results (style detection handled by fashionAnalysisService)
      batchResults.sort((a, b) => a.index - b.index);
      batchResults.forEach(result => {
        const { index, ...rest } = result;
        results.push(rest);
      });
      
      completedCount += batchResults.length;
      
      // Send progress update
      sendProgress({ 
        progress: Math.min(10 + Math.floor(completedCount * progressPerImage), 90),
        message: `Analyzing images... ${completedCount} of ${imageBuffers.length} complete`,
        currentImage: completedCount,
        totalImages: imageBuffers.length
      });
      
      logger.info(`Analyzed batch: ${completedCount}/${imageBuffers.length}`);
      
      // Small delay between batches to avoid rate limits (much shorter than before)
      if (batchStart + BATCH_SIZE < imageBuffers.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    sendProgress({ 
      progress: 90, 
      message: 'Generating style summary...' 
    });

    // Generate enhanced summary with LLM-detected styles
    const summary = {
      totalImages: results.length,
      garmentTypes: {},
      dominantColors: {},
      fabricTypes: {},
      silhouettes: {},
      styleAesthetics: {},
      detectedStyleSignatures: {},
      enhancedRecords: 0,
      averageConfidence: 0
    };

    let totalConfidence = 0;
    results.forEach(record => {
      if (record.garmentType) {
        summary.garmentTypes[record.garmentType] = 
          (summary.garmentTypes[record.garmentType] || 0) + 1;
      }
      if (record.colors?.primary) {
        summary.dominantColors[record.colors.primary] = 
          (summary.dominantColors[record.colors.primary] || 0) + 1;
      }
      if (record.fabric?.type) {
        summary.fabricTypes[record.fabric.type] = 
          (summary.fabricTypes[record.fabric.type] || 0) + 1;
      }
      if (record.silhouette) {
        summary.silhouettes[record.silhouette] = 
          (summary.silhouettes[record.silhouette] || 0) + 1;
      }
      
      // Count LLM-detected style aesthetics (from fashionAnalysisService)
      if (record.style?.aesthetic) {
        summary.styleAesthetics[record.style.aesthetic] = 
          (summary.styleAesthetics[record.style.aesthetic] || 0) + 1;
          
        // Also count as detected style signature
        summary.detectedStyleSignatures[record.style.aesthetic] = 
          (summary.detectedStyleSignatures[record.style.aesthetic] || 0) + 1;
      }
      
      // Count enhanced records (from fashionAnalysisService enhanced detection)
      if (record.style?.enhancedDetection || record.attributes?.enhancedAnalysis) {
        summary.enhancedRecords++;
      }
      
      totalConfidence += record.confidence || 0;
    });

    summary.averageConfidence = results.length > 0 ? 
      (totalConfidence / results.length).toFixed(2) : 0;

    const duration = Date.now() - startTime;
    logger.logAPICall('Replicate Vision', 'analyze/stream', 'POST', duration, 'success');

    // STAGE 1: Immediate Pinecone Vector Upload (as per your instruction stages)
    sendProgress({ 
      progress: 92, 
      message: 'Uploading vectors to Pinecone for semantic search...' 
    });
    
    let pineconeResult = null;
    try {
      // Initialize Pinecone service
      await pineconeService.initialize();
      
      // Create vectors for Pinecone storage
      const vectors = [];
      for (const record of results) {
        try {
          // Generate style description for CLIP embedding
          const styleDescription = `${record.style?.aesthetic || 'unknown'} style ${record.garmentType || 'garment'} with ${record.silhouette || 'standard'} silhouette in ${record.colors?.primary || 'neutral'} ${record.fabric?.type || 'fabric'}`;
          
          // Generate CLIP embedding
          const embedding = await pineconeService.generateTextEmbedding(styleDescription);
          
          vectors.push({
            id: `${userId}_${record.imageId}_${Date.now()}`,
            values: embedding,
            metadata: {
              userId,
              imageId: record.imageId,
              garmentType: record.garmentType,
              silhouette: record.silhouette,
              aesthetic: record.style?.aesthetic || 'unknown',
              primaryColor: record.colors?.primary,
              fabricType: record.fabric?.type,
              confidence: record.confidence,
              styleDescription,
              onboardingBatch: true,
              analysisTimestamp: new Date().toISOString(),
              // VLT JSON metadata as per Stage 1
              vltData: {
                colors: record.colors,
                fabric: record.fabric,
                construction: record.construction || {},
                style: record.style,
                attributes: record.attributes || {}
              }
            }
          });
        } catch (embeddingError) {
          logger.warn('Failed to create embedding for record', { 
            imageId: record.imageId, 
            error: embeddingError.message 
          });
        }
      }
      
      // Upload vectors to Pinecone in batches
      if (vectors.length > 0) {
        // Use namespace for onboarding data
        await pineconeService.upsert(vectors, 'onboarding');
        
        pineconeResult = {
          vectorsStored: vectors.length,
          namespace: 'onboarding',
          indexName: pineconeService.indexName
        };
        
        logger.info('Vectors uploaded to Pinecone during onboarding', {
          userId,
          vectorCount: vectors.length,
          namespace: 'onboarding'
        });
      }
      
    } catch (pineconeError) {
      logger.error('Failed to upload vectors to Pinecone', { 
        userId, 
        error: pineconeError.message 
      });
      // Don't fail the entire analysis if Pinecone upload fails
      pineconeResult = {
        error: pineconeError.message,
        vectorsStored: 0
      };
    }
    
    sendProgress({ 
      progress: 95, 
      message: pineconeResult?.vectorsStored > 0 
        ? `Uploaded ${pineconeResult.vectorsStored} vectors to Pinecone for semantic search` 
        : 'Vector upload skipped (continuing with analysis)'
    });

    // Send final result with enhanced style information and Pinecone integration
    const detectedStylesMessage = Object.keys(summary.detectedStyleSignatures).length > 0 
      ? ` Detected styles: ${Object.keys(summary.detectedStyleSignatures).join(', ')}`
      : '';
    
    sendProgress({ 
      progress: 100, 
      message: `Analysis complete! Enhanced ${summary.enhancedRecords}/${results.length} records.${detectedStylesMessage}`,
      done: true,
      result: {
        jobId: uuidv4(),
        status: 'completed',
        backend: 'replicate_enhanced',
        model: 'llava-13b-enhanced',
        timestamp: new Date().toISOString(),
        records: results,
        summary,
        // Stage 1: Include Pinecone integration results
        pineconeIntegration: pineconeResult
      }
    });

    res.end();

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAPICall('Replicate Vision', 'analyze/stream', 'POST', duration, 'error');
    logger.error('Streaming analysis error', { error: error.message });
    
    sendProgress({ 
      error: error.message || 'Analysis failed',
      done: true 
    });
    res.end();
  }
}));

/**
 * GET /api/vlt/models
 * Get available VLT models
 */
router.get('/models', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      models: [
        {
          id: 'gemini',
          name: 'Gemini Vision',
          description: 'Google\'s Gemini Vision Language Model',
          recommended: true
        },
        {
          id: 'openai',
          name: 'GPT-4 Vision',
          description: 'OpenAI\'s GPT-4 with Vision capabilities',
          recommended: false
        }
      ],
      defaultModel: 'gemini',
      passes: {
        available: ['A', 'B', 'C'],
        default: 'A,B,C',
        description: {
          A: 'Basic garment analysis',
          B: 'Detailed fabric and construction analysis',
          C: 'Style and aesthetic analysis'
        }
      }
    }
  });
}));

module.exports = router;