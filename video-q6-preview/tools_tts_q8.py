from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import re

text = Path("narration.txt").read_text(encoding="utf-8").strip()
parts = [part.strip() for part in text.split("\n\n") if part.strip()]
out = Path("tts-q8-parts")
out.mkdir(exist_ok=True)
for index, part in enumerate(parts):
    target = out / f"part-{index:02d}.mp3"
    subtitle = out / f"part-{index:02d}.srt"
    command = ["python3", "-m", "edge_tts", "--text", part, "--voice", "vi-VN-NamMinhNeural", "--rate=-5%", "--write-media", str(target), "--write-subtitles", str(subtitle)]
    if target.exists() and target.stat().st_size > 1000 and subtitle.exists() and subtitle.stat().st_size > 0:
        continue
    for attempt in range(3):
        result = subprocess.run(command, check=False)
        if result.returncode == 0 and target.exists() and target.stat().st_size > 1000 and subtitle.exists() and subtitle.stat().st_size > 0:
            break
        target.unlink(missing_ok=True)
        subtitle.unlink(missing_ok=True)
    else:
        raise RuntimeError(f"Could not synthesize narration paragraph {index + 1}")


def parse_time(value):
    hours, minutes, seconds = value.replace(",", ".").split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def format_time(value):
    millis = round(value * 1000)
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    seconds, millis = divmod(millis, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"


offset = 0.0
cues = []
with TemporaryDirectory(prefix="q8-audio-") as temporary_directory:
    manifest = Path(temporary_directory) / "concat.txt"
    manifest.write_text("".join(f"file '{(out / f'part-{index:02d}.mp3').resolve()}'\n" for index in range(len(parts))))
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c:a", "libmp3lame", "-q:a", "2", "voice-namminh-q8.mp3"], check=True)

for index in range(len(parts)):
    part_audio = out / f"part-{index:02d}.mp3"
    duration_text = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(part_audio)], text=True).strip()
    subtitle = (out / f"part-{index:02d}.srt").read_text(encoding="utf-8").strip()
    blocks = re.split(r"\n\s*\n", subtitle)
    for block in blocks:
        lines = block.splitlines()
        if len(lines) < 3 or " --> " not in lines[1]:
            continue
        start_text, end_text = lines[1].split(" --> ")
        start = offset + parse_time(start_text)
        end = offset + parse_time(end_text)
        cues.append((start, end, "\n".join(lines[2:])))
    offset += float(duration_text)

Path("voice-namminh-q8.srt").write_text("\n\n".join(f"{index}\n{format_time(start)} --> {format_time(end)}\n{text}" for index, (start, end, text) in enumerate(cues, 1)) + "\n", encoding="utf-8")
