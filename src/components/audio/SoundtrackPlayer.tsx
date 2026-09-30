import { useEffect, useRef, useState } from "react";

type Track = {
  title: string;
  src: string;
};

const PLAYLISTS: Record<"hero" | "ghibli", Track[]> = {
  hero: [
    { title: "Dandadan — Main Theme", src: "/audio/hero/dandadan-main-theme.mp3" },
    { title: "Naruto — Main Theme", src: "/audio/hero/naruto-main-theme.mp3" },
    { title: "Kimi no Na Wa — Main Theme", src: "/audio/hero/kiminonawa-main-theme.mp3" },
    { title: "Kiznaiver — Theme", src: "/audio/hero/kiznaiver-theme-main.mp3" },
    { title: "Mashle — Main Theme", src: "/audio/hero/mashle-main-theme.mp3" },
  ],
  ghibli: [
    { title: "Arrietty — Main Theme", src: "/audio/ghibli/arriettys-main-theme.mp3" },
    { title: "Howl's Moving Castle — Main Theme", src: "/audio/ghibli/howlsmovingcastle-main-theme.mp3" },
    { title: "The Boy and the Heron — Main Theme", src: "/audio/ghibli/theboyandtheheron-main-theme.mp3" },
  ],
};

const STORAGE_KEY = "renanime:soundtrack:v1";
const DEFAULT_VOLUME = 0.12;

type SavedState = {
  enabled: boolean;
  trackIndex: number;
  position: number;
};

function getSavedState(): SavedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, trackIndex: 0, position: 0 };

    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      enabled: parsed.enabled === true,
      trackIndex: Number.isFinite(parsed.trackIndex) ? Math.max(0, parsed.trackIndex as number) : 0,
      position: Number.isFinite(parsed.position) ? Math.max(0, parsed.position as number) : 0,
    };
  } catch {
    return { enabled: false, trackIndex: 0, position: 0 };
  }
}

function saveState(state: SavedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private browsing or restrictive environments.
  }
}

export default function SoundtrackPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const resumeAfterVideoRef = useRef(false);

  const [playlistKey, setPlaylistKey] = useState<"hero" | "ghibli">("hero");
  const [trackIndex, setTrackIndex] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [available, setAvailable] = useState(true);

  const tracks = PLAYLISTS[playlistKey];
  const track = tracks[trackIndex % tracks.length];

  useEffect(() => {
    const key = window.location.pathname.startsWith("/ghibli") ? "ghibli" : "hero";
    const saved = getSavedState();

    setPlaylistKey(key);
    setEnabled(saved.enabled);
    setTrackIndex(saved.trackIndex % PLAYLISTS[key].length);
    setPosition(saved.position);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = DEFAULT_VOLUME;
    audio.src = track.src;
    audio.load();
    setAvailable(true);

    const saved = getSavedState();
    const savedKey = window.location.pathname.startsWith("/ghibli") ? "ghibli" : "hero";

    if (saved.enabled && savedKey === playlistKey && saved.trackIndex % tracks.length === trackIndex) {
      const restorePosition = () => {
        if (Number.isFinite(saved.position) && saved.position > 0 && saved.position < audio.duration) {
          audio.currentTime = saved.position;
          setPosition(saved.position);
        }
        audio.removeEventListener("loadedmetadata", restorePosition);
      };

      audio.addEventListener("loadedmetadata", restorePosition);
    }

    const handleTimeUpdate = () => {
      setPosition(audio.currentTime);

      if (saveTimerRef.current !== null) return;

      saveTimerRef.current = window.setTimeout(() => {
        saveState({
          enabled,
          trackIndex,
          position: audio.currentTime,
        });
        saveTimerRef.current = null;
      }, 1000);
    };

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleEnded = () => {
      setTrackIndex((current) => (current + 1) % tracks.length);
    };
    const handleError = () => {
      setAvailable(false);
      setPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [track.src, trackIndex, playlistKey, tracks.length, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const audio = audioRef.current;
    if (!audio) return;

    void audio.play().catch(() => {
      setPlaying(false);
    });
  }, [enabled, trackIndex, playlistKey]);

  useEffect(() => {
    const handleVideoPlay = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLVideoElement)) return;

      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      resumeAfterVideoRef.current = true;
      audio.pause();
    };

    const handleVideoPause = () => {
      if (!resumeAfterVideoRef.current) return;

      resumeAfterVideoRef.current = false;

      if (enabled) {
        void audioRef.current?.play().catch(() => {});
      }
    };

    document.addEventListener("play", handleVideoPlay, true);
    document.addEventListener("pause", handleVideoPause, true);

    return () => {
      document.removeEventListener("play", handleVideoPlay, true);
      document.removeEventListener("pause", handleVideoPause, true);
    };
  }, [enabled]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setEnabled(false);
      saveState({ enabled: false, trackIndex, position: audio.currentTime });
      return;
    }

    setEnabled(true);
    audio.volume = DEFAULT_VOLUME;
    void audio.play().then(() => {
      setPlaying(true);
      saveState({ enabled: true, trackIndex, position: audio.currentTime });
    }).catch(() => {
      setEnabled(false);
      setPlaying(false);
    });
  };

  const changeTrack = (direction: 1 | -1) => {
    const nextIndex = (trackIndex + direction + tracks.length) % tracks.length;
    const audio = audioRef.current;

    setTrackIndex(nextIndex);
    setPosition(0);
    setAvailable(true);

    if (audio) {
      audio.currentTime = 0;
      if (enabled) {
        window.setTimeout(() => {
          void audio.play().catch(() => {});
        }, 0);
      }
    }

    saveState({ enabled, trackIndex: nextIndex, position: 0 });
  };

  if (!track || !available) {
    return null;
  }

  return (
    <aside className={`soundtrack-player ${playing ? "is-playing" : ""}`} aria-label="Banda sonora de Renanime">
      <audio ref={audioRef} preload="metadata" aria-hidden="true" />

      <div className="soundtrack-player__inner">
        <button
          className="soundtrack-player__toggle"
          type="button"
          onClick={togglePlayback}
          aria-label={playing ? "Pausar música" : "Reproducir música"}
          aria-pressed={playing}
        >
          <span className="soundtrack-player__glyph" aria-hidden="true">
            {playing ? (
              <span className="soundtrack-player__bars">
                <i /><i /><i /><i />
              </span>
            ) : (
              "♪"
            )}
          </span>
          <span className="soundtrack-player__status">{playing ? "MUSIC ON" : "MUSIC OFF"}</span>
        </button>

        <div className="soundtrack-player__track" aria-live="polite">
          <span className="soundtrack-player__track-label">NOW PLAYING</span>
          <span className="soundtrack-player__track-title">{track.title}</span>
        </div>

        <div className="soundtrack-player__controls">
          <button type="button" onClick={() => changeTrack(-1)} aria-label="Canción anterior">←</button>
          <button type="button" onClick={() => changeTrack(1)} aria-label="Siguiente canción">→</button>
        </div>
      </div>
    </aside>
  );
}
