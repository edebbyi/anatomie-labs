# 🧹 INTELLIGENT PROMPT BUILDER CLEANUP

## Cleanup Schedule

**Start Date:** October 23, 2025
**Cleanup Date:** November 6, 2025 (2 weeks after implementation)

## Cleanup Tasks

After 2 weeks of stable operation, perform the following cleanup tasks:

### 1. Verify System Stability
- [ ] Confirm 100% traffic on new system
- [ ] Monitor error rates (<1%)
- [ ] Check cache hit rates (>80%)
- [ ] Verify Thompson Sampling parameters are updating

### 2. Remove Old Prompt Builder Files
```bash
# Move old files to archive
mkdir -p src/services/_deprecated
mv src/services/advancedPromptBuilderAgent.js src/services/_deprecated/
mv src/services/promptBuilderAgent.js src/services/_deprecated/
mv src/services/promptGeneratorAgent.js src/services/_deprecated/
```

### 3. Update All Imports
```bash
# Search for old imports
grep -r "advancedPromptBuilderAgent" src/
grep -r "promptBuilderAgent" src/
grep -r "promptGeneratorAgent" src/

# Replace with:
# const intelligentPromptBuilder = require('./services/IntelligentPromptBuilder');
```

### 4. Clean Up Test Files
```bash
# After confirming everything works:
rm tests/migration_guide.js
```

### 5. Database Cleanup (Optional)
Only after 1 month of stable operation:
- Remove old columns from prompts table (if no longer needed)
- Archive old prompt data

## Monitoring During Transition

### Daily Checks (First Week)
- [ ] Error logs
- [ ] Performance metrics
- [ ] User feedback

### Weekly Checks (Weeks 1-2)
- [ ] A/B test results
- [ ] Cache performance
- [ ] Thompson Sampling effectiveness

## Rollback Plan

If issues occur during the 2-week transition period:

1. Reduce traffic to new system:
   ```javascript
   // In podna.js, reduce percentage
   const promptRouter = new PromptBuilderRouter(5); // or 0 to disable
   ```

2. Investigate errors:
   - Check logs
   - Review error rates
   - Analyze user feedback

3. Fix issues and resume rollout

4. Old systems remain functional during entire migration

## Contact

For issues during cleanup:
- Lead Developer: [Your Name]
- Backup: [Backup Developer Name]