# 🗑️ DEPRECATED SERVICES LIST

## Services No Longer in Use

These services are deprecated and can be safely removed from the codebase as they are no longer part of the new system architecture:

### Prompt-Related Services (Replaced by Intelligent Prompt Builder)
1. `promptBuilderAgent.js` - Old epsilon-greedy prompt builder
2. `promptGeneratorAgent.js` - Another old prompt generation system
3. `advancedPromptBuilderAgent.js` - Thompson Sampling version (kept temporarily for A/B testing)

### Style Analysis Services (Replaced by Ultra-Detailed Ingestion)
4. `styleDescriptorAgent.js` - Original style descriptor agent
5. `enhancedStyleDescriptorAgent.js` - Enhanced version (replaced by ultraDetailedIngestionAgent)

### RLHF Pipeline Services (Integrated into new system)
6. `validationAgent.js` - Anti-hallucination validation (functionality integrated)
7. `feedbackLearnerAgent.js` - Feedback processing (functionality integrated)
8. `continuousLearningAgent.js` - Continuous learning (functionality integrated)

### Other Deprecated Services
9. `enhancedRlhfPipeline.js` - Empty file
10. `stage9_filter_update.js` - Stage-specific update file

### Backup Files
11. `enhancedStyleDescriptorAgent.js.backup` - Backup file
12. `generationService.js.backup` - Backup file
13. `vltService.js.backup` - Backup file
14. `vltService.js.fallback-backup` - Backup file

## Services Still in Use

These services are part of the current system and should NOT be removed:

### Core Podna System
- `ingestionAgent.js` - Portfolio ZIP processing
- `ultraDetailedIngestionAgent.js` - Ultra-detailed image analysis
- `trendAnalysisAgent.js` - Style profile generation
- `imageGenerationAgent.js` - Image generation with Replicate
- `IntelligentPromptBuilder.js` - New prompt generation system
- `promptBuilderRouter.js` - A/B testing router

### Supporting Services
- `database.js` - Database connectivity
- `r2Storage.js` - Cloudflare R2 storage
- `gfpganService.js` - Image enhancement
- `realEsrganService.js` - Image upscaling

## Gradual Cleanup Schedule

### Phase 1: Immediate (After 2 weeks of stable operation)
- Remove backup files
- Remove empty/unused files

### Phase 2: After 1 month of stable operation
- Remove `promptBuilderAgent.js`
- Remove `promptGeneratorAgent.js`

### Phase 3: After 2 months of stable operation
- Remove `advancedPromptBuilderAgent.js` (only after A/B testing is complete)
- Remove `enhancedStyleDescriptorAgent.js`
- Remove `styleDescriptorAgent.js`
- Remove deprecated RLHF services if fully integrated

## Verification Checklist

Before removing any service, verify:
- [ ] Service is not imported in any route files
- [ ] Service is not referenced in any other services
- [ ] Functionality has been fully migrated to new system
- [ ] No user-facing features depend on the service
- [ ] Tests pass after removal