# Toast Messages Fix - Like/Unlike Functionality

## Problem Identified
The like button behavior in the HomeGallery component had a critical issue:
- Clicking like on an unlicked image would show "Saved to likes" ✅
- Clicking like again on an already liked image would NOT toggle the unlike state
- No appropriate toast message was shown when unliking an image

## Root Cause
In `Home.tsx`, the `handleLike` function always passed `true` to `submitFeedback`, regardless of the image's current liked state:

```typescript
// BEFORE (Incorrect)
const handleLike = async (imageId: string) => {
  recordInteraction(imageId);
  await submitFeedback(imageId, true);  // Always sets liked = true
  toast.success('Saved to likes');
};
```

This meant:
1. First click (liked: false → true): Shows "Saved to likes" ✅
2. Second click (liked: true → true): No visible change, confusing for users ❌

## Solution Implemented
Modified `handleLike` in `/frontend/src/pages/Home.tsx` to:

1. **Check the current state** of the image from the images array
2. **Toggle the like state** (true ↔ false)
3. **Show contextual toast messages**:
   - When liking: "Added to likes" (success toast)
   - When unliking: "Removed from likes" with description (standard toast)

```typescript
// AFTER (Fixed)
const handleLike = async (imageId: string) => {
  recordInteraction(imageId);
  
  // Get current image state
  const currentImage = images.find(img => img.id === imageId);
  const isCurrentlyLiked = currentImage?.liked ?? false;
  
  // Toggle the like state
  const newLikedState = !isCurrentlyLiked;
  
  await submitFeedback(imageId, newLikedState);
  
  // Show appropriate toast message
  if (newLikedState) {
    toast.success('Added to likes');
  } else {
    toast('Removed from likes', {
      description: 'You can find it in your collection anytime.',
    });
  }
};
```

## Components Affected
The fix automatically applies to:
- **HomeGallery** - Main gallery view with like/unlike buttons
- **SwipeView** - Detailed view mode (calls the same `handleLike` callback)
- **ImageCard** - Individual image cards with heart button

## User Experience Improvements

### Scenario 1: Like an image
1. User hovers over image → Sees heart button
2. User clicks heart → Icon fills with pink
3. Toast appears: ✅ "Added to likes"
4. Image count in "Liked" collection increases

### Scenario 2: Unlike an image
1. User clicks heart on a liked image
2. Heart icon returns to outline
3. Toast appears: "Removed from likes" with description
4. Image removed from "Liked" collection
5. User can still find it in "All" collection

## Toast Message Summary
| Action | Message | Type | Description |
|--------|---------|------|-------------|
| Like image | "Added to likes" | success | ✅ Green success toast |
| Unlike image | "Removed from likes" | default | Blue toast with helpful description |
| Discard image | "Design moved to archive" | default | Blue toast with restoration info |
| Restore from archive | "Design restored from archive" | success | ✅ Green success toast |

## Testing Checklist
- [ ] Click heart on unlicked image → Shows "Added to likes" toast
- [ ] Click heart again → Shows "Removed from likes" toast
- [ ] Liked collection count updates correctly
- [ ] Works in gallery masonry view
- [ ] Works in grid view
- [ ] Works in SwipeView card mode
- [ ] Works in SwipeView vertical mode
- [ ] Discard functionality still works
- [ ] Archive/restore functionality still works

## Files Modified
- `/frontend/src/pages/Home.tsx` - Updated `handleLike` function to support toggle behavior with contextual messages

## Backward Compatibility
✅ No breaking changes
✅ No API changes
✅ Uses existing `submitFeedback` hook
✅ No new dependencies added