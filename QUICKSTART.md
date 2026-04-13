# Quick Start - 5 Minutes Setup

Get Video to Text Converter running locally in just 5 minutes!

## ✅ Prerequisites

Verify you have installed:

```bash
node --version     # Should show v16+ (tested: v20.16.0)
python --version   # Should show 3.9+ (tested: 3.11)
```

If not installed:
- **Node.js**: https://nodejs.org/
- **Python**: https://www.python.org/downloads/

## 🚀 Setup Steps (5 minutes)

### Step 1: Install Dependencies (2 minutes)

```bash
cd G:\video2textwebapp

# Install Node.js packages
npm install

# Install React packages
cd client && npm install && cd ..

# Install Python transcription library
python -m pip install faster-whisper
```

### Step 1b: Build React Frontend (1 minute)

**IMPORTANT**: You must build the React frontend before starting the server:

```bash
cd client
npm run build
cd ..
```

This creates the `client/build/` folder that the server will serve. Without this step, you'll get a 404 error when opening localhost:3000.

### Step 2: Configure (1 minute)

```bash
# Copy environment template
copy .env.example .env

# Optional: Edit .env to customize model or port
# WHISPER_MODEL_SIZE=base    # Options: tiny, base, small, medium, large
# PORT=3000
```

### Step 3: Start Server (1 minute)

```bash
npm start
```

You should see:
```
> video2text-app@1.0.0 start
> node server.js

Video to Text Converter running on http://localhost:3000
Upload directory: G:\video2textwebapp\uploads
```

### Step 4: Open in Browser (1 minute)

Visit: **http://localhost:3000**

## 🎬 First Test Run

1. **Specify Output Directory** (optional)
   - Paste the path where you want output files saved
   - Leave empty to use /uploads folder

2. **Select Video**
   - Click "Select Folder" → Pick folder with MP4s
   - First MP4 found is auto-selected
   - Or drag & drop an MP4 file

3. **Process**
   - Click blue "Process Video" button
   - Watch progress bar

4. **View Results** (15-20 seconds)
   - See transcription in text area
   - View generated file paths
   - Both `.txt` and `.srt` files created!

## ⏱️ Processing Timeline

| Stage | Duration | What Happens |
|-------|----------|--------------|
| Upload | <1s | Video uploaded to server |
| Extract | 2-3s | FFmpeg converts MP4 → audio |
| Transcribe | 8-12s | Whisper model processes |
| Save | <1s | Create .txt and .srt files |
| **Total** | **~15-20s** | ✅ Complete |

⚠️ **First Run Note**: Model download (1.4GB) takes 5-15 minutes one time only

## 📁 Output Files

Your transcription generates **TWO files**:

```
📄 video.txt    → Complete transcription text
🎬 video.srt    → SRT subtitles with timing (usable in video players)
```

Both saved to your specified directory!

## ⚙️ Configuration Options

Edit `.env` file to customize:

```env
# Whisper model size (default: base)
# tiny:   Fastest (39MB)
# base:   Balanced (140MB) ← Recommended
# small:  Better (466MB)
# medium: Good (1.5GB)
# large:  Best (2.9GB)
WHISPER_MODEL_SIZE=base

# Server port (default: 3000)
PORT=3000

# Frontend API URL (default: http://localhost:3000)
REACT_APP_API_URL=http://localhost:3000
```

Restart server after changes: `npm start`

## 🎯 Quick Tasks

### Change Processing Speed

For **fastest** transcription:
```env
WHISPER_MODEL_SIZE=tiny
```

For **best accuracy**:
```env
WHISPER_MODEL_SIZE=large
```

### Use Different Port

If port 3000 is busy:
```env
PORT=8000
```

### Process Multiple Videos

Simply upload and process one at a time. Repeat as needed!

## 🐛 Common Issues

### ❌ "python: command not found"
Python not in PATH. Re-install with "Add Python to PATH" option

### ❌ "faster_whisper not installed"
```bash
python -m pip install faster-whisper
```

### ❌ Port 3000 already in use
Change port in `.env`:
```env
PORT=8000
```

### ❌ Select Folder button not working
Try a different browser (Chrome/Firefox recommended)

### ❌ First run is very slow
Downloading the Whisper model (~1.4GB). This only happens once!

### ❌ Transcription is inaccurate
Use a larger model in `.env`:
```env
WHISPER_MODEL_SIZE=small   # Better
# or
WHISPER_MODEL_SIZE=large   # Best
```

## 🌟 Key Features

✅ **No Internet Required** - Works completely offline
✅ **No API Keys** - Self-contained, no registration
✅ **Privacy First** - No cloud uploads, local only
✅ **Fast** - 15-20 seconds per video
✅ **Accurate** - OpenAI Whisper model
✅ **Dual Output** - Both text and subtitle files
✅ **Custom Directories** - Save where you want
✅ **Modern UI** - Beautiful Tailwind CSS design

## 📚 Documentation

Need more details?

- **README.md** - Complete features & API docs
- **SPEC.MD** - Technical specification
- **.env.example** - All configuration options

## ✅ You're All Set!

Your Video to Text Converter is ready!

**Open http://localhost:3000 and start transcribing** 🚀

---

**Enjoy offline, private video transcription!** 🔒
