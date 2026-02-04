import os
import logging
import uuid
import tempfile
import concurrent.futures
from django.conf import settings
from pydub import AudioSegment
from chat.services.tts_service import generate_tts_audio

logger = logging.getLogger(__name__)

class AudioMixerService:
    @staticmethod
    def mix_podcast(script: list) -> str:
        """
        Mixes a podcast script into a single audio file using parallel TTS generation.
        script: List of dicts [{"speaker": "...", "text": "..."}]
        Returns: Relative path to the generated audio file in MEDIA_ROOT.
        """
        if not script:
            raise ValueError("Script is empty.")

        # Voice Mapping
        voice_map = {
            "Host (Alex)": "Kore",
            "Guest (Jamie)": "Fenrir"
        }

        temp_files = []
        # Store segments in order: {index: AudioSegment}
        segments_map = {}

        def process_turn(index, turn):
            speaker = turn.get("speaker", "Host (Alex)")
            text = turn.get("text", "")
            if not text:
                return None

            voice = voice_map.get(speaker, "Kore")

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
                temp_path = tf.name

            # This is thread-safe as temp_path is unique per call
            result = generate_tts_audio(text, temp_path, voice_name=voice)

            if result.get('success'):
                return (index, temp_path)
            else:
                logger.warning(f"Failed to generate audio for turn {index}: {result.get('error')}")
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return None

        try:
            # Parallel Execution
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = []
                for i, turn in enumerate(script):
                    futures.append(executor.submit(process_turn, i, turn))

                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    if result:
                        idx, path = result
                        temp_files.append(path)
                        try:
                            seg = AudioSegment.from_wav(path)
                            segments_map[idx] = seg
                        except Exception as e:
                            logger.error(f"Error reading WAV {path}: {e}")

            # Mix in Order
            full_audio = AudioSegment.empty()
            silence = AudioSegment.silent(duration=300)

            # Iterate by original index to preserve order
            for i in range(len(script)):
                if i in segments_map:
                    full_audio += segments_map[i]
                    full_audio += silence

            # Export Final Mix
            filename = f"podcast_mix_{uuid.uuid4().hex[:10]}.mp3"
            output_dir = os.path.join(settings.MEDIA_ROOT, 'podcasts')
            os.makedirs(output_dir, exist_ok=True)

            output_path = os.path.join(output_dir, filename)

            full_audio.export(output_path, format="mp3", bitrate="128k")

            return f"podcasts/{filename}"

        except Exception as e:
            logger.error(f"Error mixing podcast: {e}")
            raise e
        finally:
            # Cleanup temp files
            for f in temp_files:
                if os.path.exists(f):
                    try:
                        os.remove(f)
                    except: pass
