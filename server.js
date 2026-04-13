import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { execFile, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Storage for uploads (temporary)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only .mp4 files are allowed'), false);
    }
  }
});

// Job tracking
const jobs = new Map();

// Whisper model configuration
const WHISPER_MODEL_SIZE = process.env.WHISPER_MODEL_SIZE || 'base';
// Options: tiny, base, small, medium, large
// tiny/base are fastest, large is most accurate
const TRANSCRIPTION_SCRIPT = path.join(__dirname, 'transcribe.py');

// POST /upload - Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const jobId = uuidv4();
  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const sourceDir = req.body.sourceDir || '';

  // Store job info
  jobs.set(jobId, {
    id: jobId,
    status: 'uploaded',
    filePath,
    originalName,
    sourceDir,
    progress: 0,
    transcription: null,
    error: null,
    createdAt: new Date()
  });

  res.json({ jobId, message: 'File uploaded successfully' });
});

// POST /process - Process video to text
app.post('/process/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  job.status = 'processing';

  // Run processing asynchronously
  processVideo(jobId).catch(error => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = error.message;
    }
  });

  res.json({ jobId, message: 'Processing started' });
});

// GET /status/:jobId - Get job status
app.get('/status/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error
  });
});

// GET /result/:jobId - Get transcription result
app.get('/result/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: `Job is ${job.status}` });
  }

  res.json({
    jobId: job.id,
    transcription: job.transcription,
    originalName: job.originalName,
    subtitlePath: job.subtitlePath,
    files: {
      text: job.outputPath,
      subtitle: job.subtitlePath
    }
  });
});

// Process video: extract audio and transcribe
async function processVideo(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.progress = 10;

    // Step 1: Extract audio from video
    const audioFile = path.join(uploadDir, `${jobId}_audio.aac`);

    await extractAudio(job.filePath, audioFile);
    job.progress = 40;

    // Step 2: Transcribe audio using faster-whisper
    job.progress = 50;
    const transcriptionData = await transcribeAudio(audioFile);
    job.transcription = transcriptionData.text;
    job.segments = transcriptionData.segments;
    job.progress = 80;

    // Step 3: Save both transcription and subtitle files
    const txtPath = saveTranscription(job, transcriptionData.text);
    const srtPath = saveSrtSubtitles(job, transcriptionData.segments);

    job.progress = 100;
    job.status = 'completed';
    job.outputPath = txtPath;
    job.subtitlePath = srtPath;

    // Cleanup temporary files
    cleanupFiles(job.filePath, audioFile);

  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    console.error(`Job ${jobId} error:`, error);
  }
}

// Extract audio from MP4 video using direct ffmpeg command
function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Ensure absolute paths
    const absoluteVideoPath = path.resolve(videoPath);
    const absoluteOutputPath = path.resolve(outputPath);

    console.log(`[FFmpeg] Input: ${absoluteVideoPath}`);
    console.log(`[FFmpeg] Output: ${absoluteOutputPath}`);

    // Try extracting with copy codec first (no re-encoding) to avoid crashes
    const args = [
      '-i', absoluteVideoPath,
      '-vn',                    // no video
      '-acodec', 'aac',         // keep original or use aac
      absoluteOutputPath
    ];

    console.log(`[FFmpeg] Attempting audio extraction...`);

    execFile(ffmpegStatic, args, { maxBuffer: 10 * 1024 * 1024, timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[FFmpeg] Exit code: ${error.code}`);
        console.error(`[FFmpeg] Error: ${error.message}`);

        // Log stderr if it has useful info
        if (stderr && stderr.length > 0) {
          const errorLines = stderr.split('\n').filter(line =>
            line.includes('Error') || line.includes('error') || line.includes('Failed')
          );
          if (errorLines.length > 0) {
            console.error(`[FFmpeg] Details: ${errorLines.join(' | ')}`);
          }
        }

        reject(new Error(`FFmpeg error: ${error.message} (code: ${error.code})`));
        return;
      }
      console.log('[FFmpeg] Audio extraction completed');
      resolve();
    });
  });
}

// Transcribe audio using faster-whisper (local Python service)
function transcribeAudio(audioPath) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`[Transcription] Starting transcription of ${audioPath}`);
      console.log(`[Transcription] Using model: ${WHISPER_MODEL_SIZE}`);

      // Spawn Python process for transcription
      const python = spawn('python', [TRANSCRIPTION_SCRIPT, audioPath, WHISPER_MODEL_SIZE], {
        timeout: 1200000 // 20 minutes timeout for model download + transcription
      });

      let stdout = '';
      let stderr = '';
      let hasOutput = false;

      python.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        hasOutput = true;
        console.log(`[Transcription] stdout: ${chunk.substring(0, 100)}`);
      });

      python.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        // Log progress/status messages
        if (chunk.includes('Loading') || chunk.includes('Transcribing') || chunk.includes('downloading')) {
          console.log(`[Transcription] ${chunk.trim()}`);
        }
      });

      python.on('error', (err) => {
        console.error(`[Transcription] Process error: ${err.message}`);
        reject(new Error(`Failed to start transcription process: ${err.message}`));
      });

      python.on('close', (code) => {
        console.log(`[Transcription] Process exited with code: ${code}`);

        if (code !== 0) {
          console.error(`[Transcription] stderr: ${stderr}`);
          reject(new Error(`Transcription failed: ${stderr || 'Unknown error'}`));
          return;
        }

        if (!hasOutput || !stdout) {
          reject(new Error('No output from transcription service'));
          return;
        }

        try {
          const result = JSON.parse(stdout);

          if (result.error) {
            reject(new Error(result.error));
          } else if (result.text) {
            console.log(`[Transcription] Success: ${result.text.substring(0, 100)}...`);
            resolve(result);
          } else {
            reject(new Error('No transcription text in response'));
          }
        } catch (parseError) {
          console.error(`[Transcription] Parse error: ${parseError.message}`);
          console.error(`[Transcription] stdout was: ${stdout.substring(0, 200)}`);
          reject(new Error(`Failed to parse transcription result: ${parseError.message}`));
        }
      });
    } catch (error) {
      console.error(`[Transcription] Error: ${error.message}`);
      reject(new Error(`Transcription error: ${error.message}`));
    }
  });
}

// Save transcription to file
function saveTranscription(job, transcription) {
  try {
    let outputDir = job.sourceDir;
    let filename = job.originalName.replace(/\.mp4$/i, '.txt');

    // If sourceDir is provided, use it; otherwise use uploads directory as fallback
    if (outputDir && outputDir.trim()) {
      // Validate path to prevent directory traversal
      const resolvedPath = path.resolve(outputDir);

      // Ensure directory exists
      if (!fs.existsSync(resolvedPath)) {
        console.warn(`Directory ${resolvedPath} does not exist, creating it...`);
        fs.mkdirSync(resolvedPath, { recursive: true });
      }

      const outputPath = path.join(resolvedPath, filename);
      fs.writeFileSync(outputPath, transcription, 'utf-8');
      console.log(`Transcription saved to: ${outputPath}`);
      return outputPath;
    } else {
      // Fallback: save in upload directory
      const outputPath = path.join(uploadDir, filename);
      fs.writeFileSync(outputPath, transcription, 'utf-8');
      console.log(`Transcription saved to: ${outputPath}`);
      return outputPath;
    }
  } catch (error) {
    throw new Error(`Failed to save transcription: ${error.message}`);
  }
}

// Save SRT subtitle file
function saveSrtSubtitles(job, segments) {
  try {
    let outputDir = job.sourceDir;
    let filename = job.originalName.replace(/\.mp4$/i, '.srt');

    // Generate SRT content
    let srtContent = '';
    if (segments && segments.length > 0) {
      srtContent = segments.map(segment => {
        return `${segment.index}\n${segment.start} --> ${segment.end}\n${segment.text}\n`;
      }).join('\n');
    }

    // If sourceDir is provided, use it; otherwise use uploads directory as fallback
    if (outputDir && outputDir.trim()) {
      const resolvedPath = path.resolve(outputDir);

      // Ensure directory exists
      if (!fs.existsSync(resolvedPath)) {
        fs.mkdirSync(resolvedPath, { recursive: true });
      }

      const outputPath = path.join(resolvedPath, filename);
      fs.writeFileSync(outputPath, srtContent, 'utf-8');
      console.log(`Subtitles saved to: ${outputPath}`);
      return outputPath;
    } else {
      // Fallback: save in upload directory
      const outputPath = path.join(uploadDir, filename);
      fs.writeFileSync(outputPath, srtContent, 'utf-8');
      console.log(`Subtitles saved to: ${outputPath}`);
      return outputPath;
    }
  } catch (error) {
    throw new Error(`Failed to save subtitles: ${error.message}`);
  }
}

// Cleanup temporary files
function cleanupFiles(...files) {
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (error) {
      console.warn(`Failed to clean up file ${file}:`, error.message);
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err.message.includes('Only .mp4')) {
    return res.status(400).json({ error: 'Only .mp4 files are allowed' });
  }

  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from client build
const clientBuildPath = path.join(__dirname, 'client', 'build');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));

  // Serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Video to Text Converter running on http://localhost:${PORT}`);
  console.log(`Upload directory: ${uploadDir}`);
});
