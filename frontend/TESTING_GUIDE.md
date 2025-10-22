# Quick Testing Guide 🧪

## How to Test the App Right Now

The dev server is running at **http://localhost:3002**

---

## ✅ What Actually Works Now

### 1. Voice/Text Commands (Real-time!)

**Try these commands**:

#### From Home Page:
1. Click the mic button at the bottom
2. Say (or type): **"make 10 dresses"**
3. Click "Execute" in the confirmation modal
4. **Watch**: Loading spinner appears for 2 seconds
5. **Result**: 10 new images appear at the TOP of your gallery immediately! 🎉

#### From Generate Page:
1. Navigate to "Generate" tab
2. Use the mic/text command bar
3. Say: **"make 50 elegant designs"**
4. Confirm
5. **Result**: 50 images appear below immediately!

### 2. Quick Batch Buttons (Real-time!)

**On Generate Page**:
1. Click "Quick Test (10 images)" button
2. **Watch**: Loading indicator appears
3. **Result**: 10 images appear immediately below!

Same for:
- "Standard Batch (50 images)"
- "Large Batch (100 images)"

### 3. Filter Commands

**Try**:
- "show liked images" → Filters to only liked images
- "filter by dress" → Shows only images with "dress" tag

### 4. Tinder Swipe View

1. Click any image in the Home gallery
2. **Card Mode**:
   - Swipe left or click ✗ button to discard
   - Swipe right or click ♥ button to like
   - Click "Info" button to flip card and see metadata
   - Use ← → arrow keys for quick decisions

3. **Toggle to Vertical Mode**:
   - Click the list icon (top right)
   - Scroll vertically through images
   - ♥ and ✗ buttons on left/right sides
   - Press ESC to exit

### 5. Like/Discard in Gallery

- Hover over any image
- Click the ♥ or ✗ buttons that appear
- State updates immediately!

### 6. View Mode Toggle

- Top right of Home page
- Click the grid icons to switch between:
  - Masonry (Pinterest-style)
  - Uniform Grid

---

## 🎯 Complete Test Workflow

### Full User Journey (5 minutes):

1. **Open** http://localhost:3002
2. **Navigate to Home** (you should see ~50 mock images)
3. **Test Voice Command**:
   - Click mic button
   - Say: "make 10 dresses"
   - Confirm
   - **Verify**: 10 new images appear at top!

4. **Review Images**:
   - Click first new image
   - Swipe through with arrow keys
   - Like some, discard others
   - Press ESC to exit

5. **Filter**:
   - Click "♥ Liked" filter button
   - See only liked images

6. **Generate More**:
   - Go to Generate tab
   - Click "Quick Test (10)"
   - **Verify**: 10 more images appear
   - Scroll down to see them

7. **Use Command Bar Again**:
   - Type/say: "make 20 elegant outfits"
   - Confirm
   - **Verify**: 20 more images appear!

8. **Style Profile**:
   - Go to Style Profile tab
   - Click "Show AI Suggestions"
   - Click a suggested tag to add it
   - Click X on existing tag to remove it
   - Click "Save Profile"

9. **Settings**:
   - Go to Settings tab
   - Explore profile info
   - Click "Advanced" section to see hidden analytics links

---

## 🐛 Known Behavior

### What's Simulated (Mock Data):

✅ **Works with Mock**:
- Image generation (uses Picsum API for random images)
- 2-second delay simulates real generation time
- Images have random heights for masonry layout
- Tags are randomly assigned

❌ **Not Real Yet**:
- Backend API calls (all frontend only)
- Actual VLT processing (simulated)
- Real style profile learning
- Persistent storage (refreshing page resets data)

### Timing:
- **Generation delay**: 2 seconds (simulated)
- **Real production**: 5-10 seconds per batch

---

## 🎨 UI/UX Features to Notice

### Animations:
- ✨ Smooth fade-in when images load
- 🔄 Card rotation during swipe
- 📱 Snap scrolling in vertical mode
- 🎭 Card flip animation for metadata

### Feedback:
- Loading spinners during generation
- Success alerts after generation
- Visual swipe indicators
- Hover effects everywhere

### Keyboard Shortcuts:
- `←` `→` in swipe view
- `i` to toggle metadata
- `ESC` to close modals
- `Enter` to submit commands

---

## 🔍 What to Look For

### Test These Scenarios:

1. **Multiple Generations**:
   - Generate 10 images
   - Then generate 20 more
   - **Check**: Do all 30 appear? (Yes!)
   - **Check**: Are newest on top? (Yes!)

2. **Like Then Filter**:
   - Like 5 images
   - Click "♥ Liked" filter
   - **Check**: See only 5 liked images? (Yes!)
   - Click "All" to see everything again

3. **Swipe Through All**:
   - Open swipe view
   - Use arrow keys to go through all images
   - **Check**: Does it auto-close at the end? (Yes!)

4. **Command Variations**:
   - Try: "make 15 dresses"
   - Try: "generate 30 elegant designs"
   - Try: "create 5 casual outfits"
   - **Check**: All should work!

5. **Grid Modes**:
   - Switch between masonry and grid
   - Click images in both modes
   - **Check**: Do they both open swipe view? (Yes!)

---

## 🚨 If Something Doesn't Work

### Troubleshooting:

1. **Voice not working?**
   - Check browser console for errors
   - Make sure you're using Chrome or Safari
   - Grant microphone permission when prompted
   - Try typing instead

2. **Images not appearing?**
   - Check browser console
   - Images might be loading from Picsum API
   - Refresh if needed

3. **Command bar not responding?**
   - Make sure you clicked "Execute" in the confirmation modal
   - Check console for command parsing logs

4. **Swipe view stuck?**
   - Press ESC to close
   - Refresh page if needed

---

## 📊 Performance Notes

### Current Stats:
- **Initial load**: ~50 images
- **Generation**: 2 seconds simulation
- **Bundle size**: 193KB (fast!)
- **Smooth**: 60fps animations

### Recommended Testing:
- Try generating 100 images to test performance
- Try swiping through 50+ images quickly
- Test on mobile (responsive design)

---

## 🎉 Success Criteria

### You'll know it's working when:

✅ Voice command → Confirmation modal appears  
✅ Click Execute → Loading spinner shows  
✅ After 2 seconds → New images appear at top  
✅ Click image → Full-screen swipe view opens  
✅ Swipe/Click → Image liked/discarded  
✅ Press ESC → Return to gallery  
✅ Filter buttons → Gallery updates immediately  

---

## 🔮 Next Steps After Testing

Once you've verified everything works:

1. **Backend Integration**:
   - Connect to real Designer BFF API
   - Replace mock generation with actual calls
   - Add real VLT processing

2. **Persistence**:
   - Save gallery to localStorage
   - Sync with backend database
   - Preserve state on refresh

3. **Polish**:
   - Add image upload in generation
   - Better error handling
   - Loading progress bars
   - Undo/redo actions

4. **Deploy**:
   - Build production bundle
   - Deploy to Vercel/Netlify
   - Set up backend integration

---

**Enjoy testing! 🚀**

Report any bugs or issues you find!
