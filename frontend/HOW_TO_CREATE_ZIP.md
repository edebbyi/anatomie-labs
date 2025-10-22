# 📦 How to Create a ZIP File for Upload

## ⚠️ IMPORTANT: VLT API Requirement

The Visual Language Transformer (VLT) API **requires images to be uploaded as a ZIP file**, not as individual files or folders.

---

## 🍎 macOS Instructions

### Method 1: Right-Click (Easiest)

1. **Organize your images** in a single folder
   ```
   anatomie-images/
   ├── image-001.jpg
   ├── image-002.jpg
   ├── image-003.jpg
   └── ... (50-500 images)
   ```

2. **Right-click** the folder
3. Select **"Compress [folder name]"**
4. A `.zip` file will be created in the same location
5. Upload this ZIP file in the onboarding flow

### Method 2: Terminal

```bash
# Navigate to parent directory
cd ~/Pictures/

# Create ZIP file
zip -r anatomie-images.zip anatomie-images/

# Verify ZIP was created
ls -lh anatomie-images.zip
```

---

## 🪟 Windows Instructions

### Method 1: Right-Click (Easiest)

1. **Organize your images** in a single folder
2. **Right-click** the folder
3. Select **"Send to"** → **"Compressed (zipped) folder"**
4. A `.zip` file will be created
5. Rename if needed
6. Upload this ZIP file in the onboarding flow

### Method 2: Command Prompt

```cmd
# Using PowerShell
Compress-Archive -Path "C:\path\to\anatomie-images" -DestinationPath "anatomie-images.zip"
```

---

## 🐧 Linux Instructions

```bash
# Install zip if not already installed
sudo apt install zip  # Ubuntu/Debian
sudo yum install zip  # CentOS/RHEL

# Create ZIP file
zip -r anatomie-images.zip anatomie-images/

# Or using tar (alternative)
tar -czf anatomie-images.tar.gz anatomie-images/
# Note: Use .zip for best compatibility
```

---

## ✅ Verification Checklist

Before uploading your ZIP file, verify:

- [ ] File extension is `.zip` (not `.rar`, `.7z`, or other formats)
- [ ] File size is between ~25MB and 500MB (roughly 50-500 images)
- [ ] Images are at the **root of the ZIP** (not nested in subfolders)
- [ ] All images are common formats: `.jpg`, `.jpeg`, `.png`, `.webp`
- [ ] No corrupted or duplicate files

---

## 🧪 Test Your ZIP File

### macOS/Linux
```bash
# List contents of ZIP
unzip -l anatomie-images.zip

# Expected output:
# Archive:  anatomie-images.zip
#   Length      Date    Time    Name
# ---------  ---------- -----   ----
#   1234567  01-01-2024 10:00   image-001.jpg
#   1234567  01-01-2024 10:00   image-002.jpg
#   ...
```

### Windows
```powershell
# List contents of ZIP
Expand-Archive -Path anatomie-images.zip -DestinationPath temp_check

# View folder
dir temp_check

# Clean up
rmdir /s temp_check
```

---

## 📏 Size Guidelines

| Image Count | Expected ZIP Size | Status |
|-------------|------------------|---------|
| < 50        | < 25 MB          | ❌ Too few |
| 50-100      | 25-50 MB         | ✅ Good |
| 100-300     | 50-150 MB        | ✅ Good |
| 300-500     | 150-250 MB       | ✅ Good |
| > 500       | > 250 MB         | ⚠️ May be too many |

*Note: These are rough estimates based on ~500KB per image*

---

## 🚫 Common Mistakes

### ❌ Don't Do This:
- Uploading individual image files
- Uploading a folder (not zipped)
- Using RAR or 7z format
- Nesting images in subfolders within ZIP
- Including non-image files (docs, videos, etc.)

### ✅ Do This:
- Create a single ZIP file
- Keep images at root level of ZIP
- Use common image formats
- Keep total under 500MB
- Include 50-500 images

---

## 🎯 Quick Command Reference

```bash
# Create ZIP (macOS/Linux)
zip -r anatomie-images.zip anatomie-images/

# Create ZIP excluding hidden files
zip -r anatomie-images.zip anatomie-images/ -x "*/.*"

# Create ZIP with maximum compression
zip -9 -r anatomie-images.zip anatomie-images/

# Check ZIP contents
unzip -l anatomie-images.zip

# Extract to verify
unzip anatomie-images.zip -d test_extract/
```

---

## 💡 Pro Tips

1. **Name your ZIP file clearly**: `anatomie-fall-2024.zip` is better than `images.zip`

2. **Remove duplicates first**: Use tools like `fdupes` to remove duplicate images

3. **Optimize image sizes**: If ZIP is too large, resize images to max 2000px width

4. **Flat structure**: Keep all images in one folder, no subfolders

5. **Test locally first**: Extract your ZIP to make sure it contains what you expect

---

## 🆘 Troubleshooting

### "File too large" error
- Reduce image resolution
- Remove some images
- Use maximum compression: `zip -9`

### "Invalid ZIP file" error
- Recreate the ZIP file
- Ensure no corruption during download/transfer
- Try a different compression tool

### "Not enough images" warning
- Add more images to reach minimum 50
- Verify ZIP actually contains images
- Check file size matches expected count

---

## 📞 Need Help?

If you're having trouble creating the ZIP file:

1. Check the [main testing guide](../TESTING_ANATOMIE_UPLOAD.md)
2. Verify your images are valid
3. Try the command-line method
4. Check backend logs for specific error messages

---

**Ready?** Once you have your ZIP file, head to http://localhost:3000/onboarding and upload it! 🚀
