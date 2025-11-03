const express = require('express');
const { asyncHandler } = require('../../middleware/errorHandler');
const Pod = require('../../models/Pod');
const UserPreferences = require('../../models/UserPreferences');
const { extractMetadataFromPromptSpec } = require('../../utils/promptMetadata');

const router = express.Router();

const toPodDto = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  imageCount: Number(row.image_count) || 0,
  coverImageUrl: row.resolved_cover_image_url || row.cover_image_url || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toImageDto = (row) => ({
  id: row.id,
  url: row.url,
  createdAt: row.created_at,
  likedAt: row.liked_at,
  promptText: row.prompt_text,
  metadata: extractMetadataFromPromptSpec(row.json_spec),
  position: row.position,
  podIds: Array.isArray(row.pod_ids) ? row.pod_ids : [],
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const [pods, preferences] = await Promise.all([
      Pod.getPodsForUser(userId),
      UserPreferences.getPreferences(userId),
    ]);

    const hasSeenPodsIntro =
      Boolean(preferences?.has_seen_pods_intro) || Boolean(preferences?.pods?.hasSeenIntro);

    res.json({
      success: true,
      data: {
        pods: pods.map(toPodDto),
        preferences: {
          hasSeenPodsIntro,
          introSeenAt: preferences?.pods_intro_seen_at || preferences?.pods?.introSeenAt || null,
        },
      },
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { name, description } = req.body;

    if (!name || typeof name !== 'string') {
      const error = new Error('Pod name is required');
      error.statusCode = 400;
      throw error;
    }

    if (name.trim().length > 50) {
      const error = new Error('Pod name must be 50 characters or fewer');
      error.statusCode = 400;
      throw error;
    }

    if (description && description.trim().length > 200) {
      const error = new Error('Description must be 200 characters or fewer');
      error.statusCode = 400;
      throw error;
    }

    const pod = await Pod.createPod(userId, { name, description });
    await UserPreferences.markPodsIntroSeen(userId, { dismissed: false });

    res.status(201).json({
      success: true,
      data: {
        pod: toPodDto(pod),
      },
    });
  })
);

router.patch(
  '/:podId',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { podId } = req.params;
    const { name, description } = req.body;

    const pod = await Pod.updatePod(userId, podId, { name, description });

    if (!pod) {
      const error = new Error('Pod not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      data: {
        pod: toPodDto(pod),
      },
    });
  })
);

router.delete(
  '/:podId',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { podId } = req.params;

    const deleted = await Pod.deletePod(userId, podId);

    if (!deleted) {
      const error = new Error('Pod not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      message: 'Pod deleted successfully',
      data: {
        pod: toPodDto(deleted),
      },
    });
  })
);

router.post(
  '/:podId/images',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { podId } = req.params;
    const { imageIds } = req.body || {};

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      const error = new Error('imageIds array is required');
      error.statusCode = 400;
      throw error;
    }

    const pod = await Pod.addImages(userId, podId, imageIds);

    res.json({
      success: true,
      message: `Added ${imageIds.length} image(s) to pod`,
      data: {
        pod: toPodDto(pod),
      },
    });
  })
);

router.delete(
  '/:podId/images/:imageId',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { podId, imageId } = req.params;

    const pod = await Pod.removeImage(userId, podId, imageId);

    if (!pod) {
      const error = new Error('Pod not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      message: 'Image removed from pod',
      data: {
        pod: toPodDto(pod),
      },
    });
  })
);

router.get(
  '/:podId/images',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { podId } = req.params;

    const pod = await Pod.getPodById(userId, podId);
    if (!pod) {
      const error = new Error('Pod not found');
      error.statusCode = 404;
      throw error;
    }

    const images = await Pod.getImages(userId, podId);

    res.json({
      success: true,
      data: {
        pod: toPodDto(pod),
        images: images.map(toImageDto),
      },
    });
  })
);

router.post(
  '/intro',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { dismissed } = req.body || {};

    const prefs = await UserPreferences.markPodsIntroSeen(userId, {
      dismissed: Boolean(dismissed),
    });

    res.json({
      success: true,
      message: 'Pods intro preference saved',
      data: {
        hasSeenPodsIntro: true,
        introSeenAt: prefs?.pods_intro_seen_at || prefs?.pods?.introSeenAt || null,
      },
    });
  })
);

module.exports = router;
