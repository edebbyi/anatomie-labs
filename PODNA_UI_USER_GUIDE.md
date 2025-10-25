# Podna UI - User Guide & Feature Overview

## 🎨 Gallery View

### What You See
- **Responsive Grid:** 2-4 columns depending on screen size
- **Image Cards:** 3:4 portrait aspect ratio (fashion standard)
- **Info Icon:** Small ℹ️ icon in top-right corner of each card
- **Hover Effects:** Gradient overlay appears on hover
- **Favorite Button:** Heart icon appears on hover

### How to Interact
1. **View Image Details:** Click any image to open full-screen lightbox
2. **See Prompt:** Click image in lightbox to flip and see the prompt
3. **Add to Favorites:** Click heart icon on hover (or press L in lightbox)

---

## 💡 Info Icon Explained

**What it means:** The ℹ️ icon indicates you can click the image to see more details

**Where it appears:**
- Top-right corner of every image card
- Always visible (not just on hover)
- Scales up when you hover over the card

**What happens when you click:**
- Full-screen lightbox opens
- Image displays in high quality
- You can flip the card to see the prompt

---

## 🖼️ Lightbox (Full-Screen View)

### What You See
- **Large Image:** Full-screen image display
- **Image Counter:** Shows "1 / 12" (current / total)
- **Info Icon:** Top-right indicates you can flip
- **Navigation Arrows:** Previous/Next buttons
- **Control Buttons:** Favorite, Download, Info
- **Keyboard Shortcuts:** Help text at bottom

### How to Use

#### **Flip to See Prompt**
- **Click the image** - Smooth 3D flip animation
- **Press I key** - Keyboard shortcut
- **Back of card shows:**
  - Full prompt text
  - Generated timestamp
  - Garment type
  - Colors used
  - Silhouette
  - Fabric type
  - Style tags

#### **Navigate Images**
- **Click arrows** - Previous/Next buttons
- **Press ← or →** - Arrow keys
- **Swipe left/right** - On touch devices
- **Wraps around** - Last image → First image

#### **Other Actions**
- **Favorite:** Click heart or press L
- **Download:** Click download or press D
- **Close:** Click X or press ESC

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Previous image |
| `→` | Next image |
| `I` | Flip card (show/hide prompt) |
| `L` | Toggle favorite |
| `D` | Download image |
| `ESC` | Close lightbox |
| `/` | Show command bar (from anywhere) |

---

## 📱 Touch Gestures

| Gesture | Action |
|---------|--------|
| Swipe Left | Next image |
| Swipe Right | Previous image |
| Swipe Up | Toggle favorite |

---

## 🎯 Control Bar (Top of Page)

### What You See
- **Title:** "Your Generations"
- **Image Count:** Total number of images
- **Auto-Generate Toggle:** On/Off switch
- **Next Run Time:** When auto-generate is enabled
- **Settings Button:** Access settings

### How to Use
1. **Check Image Count:** See how many designs you have
2. **Enable Auto-Generate:** Toggle to automatically generate new designs
3. **View Next Run Time:** See when the next generation will happen
4. **Access Settings:** Click settings button for options

---

## 🎤 Command Bar (Bottom of Page)

### What You See
- **Input Field:** Type your design prompt
- **Voice Button:** Click to speak your prompt
- **Suggestions:** AI suggestions appear below
- **Send Button:** Submit your prompt

### Auto-Hide Behavior
- **Hides when:** You scroll down
- **Shows when:** You scroll up
- **Auto-hides:** After 3 seconds of inactivity
- **FAB Button:** Sparkles icon appears when hidden

### How to Use
1. **Type Prompt:** Enter your design description
2. **Use Voice:** Click microphone to speak
3. **See Suggestions:** AI suggests design ideas
4. **Submit:** Click send or press Enter
5. **Show Hidden Bar:** Press "/" or click FAB button

---

## 🔄 Prompt Display Strategy

### Where Prompts Are Visible
✅ **Lightbox (Full-Screen View)**
- Click image to flip
- See prompt on back of card
- Shows all metadata

### Where Prompts Are NOT Visible
❌ **Gallery Grid View**
- Clean, minimal interface
- Focus on images
- No text clutter

### Why This Design?
- **Clean Gallery:** Minimal UI for browsing
- **Detailed Lightbox:** Full information when needed
- **User Control:** You decide when to see details
- **Better UX:** Less overwhelming interface

---

## 🎬 Animations & Transitions

### Smooth Effects
- **Flip Animation:** 0.6s 3D rotation
- **Fade In:** Images fade in smoothly
- **Hover Effects:** Cards scale and shadow changes
- **Transitions:** All interactions are smooth (300ms)

### Loading States
- **Skeleton Loaders:** Placeholder cards while loading
- **Pulse Animation:** Smooth loading effect
- **Replaced:** Actual images appear when ready

---

## 📐 Responsive Design

### Mobile (< 640px)
- 2 columns
- Larger touch targets
- Optimized for portrait
- Full-width controls

### Tablet (640-1024px)
- 3 columns
- Balanced layout
- Touch-friendly
- Adaptive controls

### Desktop (> 1024px)
- 4 columns
- Spacious layout
- Mouse-optimized
- Full feature set

---

## ♿ Accessibility Features

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate buttons
- Arrow keys for navigation
- ESC to close modals

### Screen Readers
- All buttons have descriptive labels
- Images have alt text
- Semantic HTML structure
- ARIA labels for complex components

### Visual Accessibility
- High contrast colors
- Clear focus indicators
- Readable font sizes
- Sufficient spacing

---

## 🚀 Tips & Tricks

### Gallery Browsing
1. **Quick Browse:** Scroll through gallery
2. **Hover Preview:** See favorite button on hover
3. **Click to Explore:** Open lightbox for details
4. **Flip for Info:** See prompt and metadata

### Lightbox Navigation
1. **Keyboard Power User:** Use arrow keys for fast navigation
2. **Mobile Swipe:** Swipe left/right on touch devices
3. **Batch Favorite:** Mark favorites with L key
4. **Download All:** Use D key to download each image

### Command Bar
1. **Quick Access:** Press "/" from anywhere
2. **Voice Input:** Use microphone for hands-free
3. **Suggestions:** Click suggestions for quick prompts
4. **Auto-Hide:** Scrolls away automatically

---

## ❓ FAQ

**Q: Where can I see the prompt?**
A: Click an image to open lightbox, then click the image or press I to flip and see the prompt.

**Q: Why isn't the prompt visible in the gallery?**
A: For a clean, minimal interface. Prompts appear when you want them (in lightbox).

**Q: How do I know I can click an image?**
A: The ℹ️ icon in the top-right corner indicates interactivity.

**Q: Can I use keyboard shortcuts on mobile?**
A: Keyboard shortcuts work on mobile devices with keyboards. Use swipe gestures instead.

**Q: How do I download an image?**
A: Open lightbox, then click download button or press D.

**Q: Can I add images to favorites?**
A: Yes! Click heart icon or press L in lightbox.

**Q: How do I close the lightbox?**
A: Click X button, press ESC, or click outside the image.

---

## 🎯 Quick Start

1. **Navigate to Gallery:** http://localhost:3000/gallery
2. **Browse Images:** Scroll through the grid
3. **Click an Image:** Opens full-screen lightbox
4. **Flip to See Prompt:** Click image or press I
5. **Navigate:** Use arrows or swipe
6. **Close:** Press ESC or click X

---

**Enjoy exploring your designs! 🎨**

