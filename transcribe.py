#!/usr/bin/env python3
"""
Transcription service using faster-whisper
Runs locally without any API keys or cloud dependencies
Supports both full transcription and subtitle generation
"""

import sys
import json
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({
        "error": "faster_whisper not installed. Run: pip install faster-whisper"
    }))
    sys.exit(1)


def format_timestamp(seconds: float) -> str:
    """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def transcribe_audio(audio_path: str, model_size: str = "base") -> dict:
    """
    Transcribe audio file using faster-whisper

    Args:
        audio_path: Path to audio file (WAV, MP3, MP4, etc.)
        model_size: Model size - "tiny", "base", "small", "medium", "large"

    Returns:
        Dictionary with transcription, segments (for subtitles), and metadata
    """
    try:
        # Check if file exists
        if not Path(audio_path).exists():
            return {"error": f"Audio file not found: {audio_path}"}

        # Load model (downloads on first run)
        print(f"Loading {model_size} model...", file=sys.stderr)
        model = WhisperModel(model_size, device="auto", compute_type="auto")

        # Transcribe with segment information
        print(f"Transcribing {Path(audio_path).name}...", file=sys.stderr)
        segments, info = model.transcribe(audio_path, language="en")

        # Process segments for both text and subtitles
        text_parts = []
        subtitle_segments = []

        for idx, segment in enumerate(segments, 1):
            text_parts.append(segment.text)

            # Store segment info for subtitle generation
            subtitle_segments.append({
                "index": idx,
                "start": format_timestamp(segment.start),
                "end": format_timestamp(segment.end),
                "text": segment.text.strip()
            })

        # Combine all segments into full text
        full_text = " ".join(text_parts)

        return {
            "text": full_text,
            "segments": subtitle_segments,
            "language": info.language,
            "duration": info.duration
        }

    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: transcribe.py <audio_path> [model_size]"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"

    result = transcribe_audio(audio_path, model_size)
    print(json.dumps(result))
