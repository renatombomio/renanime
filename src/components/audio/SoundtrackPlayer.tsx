import { useEffect, useMemo, useRef, useState } from "react";
import "./SoundtrackPlayer.css";

type PlaylistKey = "hero" | "ghibli";
type RepeatMode = "off" | "all" | "one";

type Track = {
  title: string;
  src: string;
};

type SavedState = {
  enabled: boolean;
  trackIndex: number;
  position: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
};

const PLAYLISTS: Record<PlaylistKey, Track[]> = {
  hero: [
    { title: "Dandadan — Main Theme", src: "/audio/hero/dandadan-main-theme.mp3" },
    { title: "Kimi no Na Wa — Main Theme", src: "/audio/hero/kiminonawa-main-theme.mp3" },
    { title: "Kiznaiver — Theme", src: "/audio/hero/kiznaiver-theme-main.mp3" },
    { title: "Mashle — Main Theme", src: "/audio/hero/mashle-main-theme.mp3" },
    { title: "Naruto — Main Theme", src: "/audio/hero/naruto-main-theme.mp3" },
    { title: "Noragami — Main Theme", src: "/audio/hero/Noragami-main-theme.mp3" },
    { title: "Wolf's Rain — Main Theme", src: "/audio/hero/WolfsRain-main-theme.mp3" },
  ],
  ghibli: [
    { title: "Arrietty — Main Theme", src: "/audio/ghibli/arrietys-main-theme.mp3" },
    { title: "Howl's Moving Castle — Main Theme", src: "/audio/ghibli/howlsmovingcastle-main-theme.mp3" },
    { title: "The Boy and the Heron — Main Theme", src: "/audio/ghibli/theboyandtheheron-main-theme.mp3" },
  ],
};

const STORAGE_KEY = "renanime:soundtrack:v2";
const DEFAULT_VOLUME = 0.12;

function getPlaylistKey() {
  return window.location.pathname.startsWith("/ghibli") ? "ghibli" : "hero";
}

function getSavedState(): SavedState {
  const fallback: SavedState = {
    enabled: false,
    trackIndex: 0,
    position: 0,
    volume: DEFAULT_VOLUME,
    muted: false,
    shuffle: false,
    repeat: "all",
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    const repeat = parsed.repeat === "one" || parsed.repeat === "all" ? parsed.repeat : "off";

    return {
      enabled: parsed.enabled === true,
      trackIndex: Number.isFinite(parsed.trackIndex) ? Math.max(0, Number(parsed.trackIndex)) : 0,
      position: Number.isFinite(parsed.position) ? Math.max(0, Number(parsed.position)) : 0,
      volume:
        Number.isFinite(parsed.volume)
          ? Math.min(1, Math.max(0, Number(parsed.volume)))
          : DEFAULT_VOLUME,
      muted: parsed.muted === true,
      shuffle: parsed.shuffle === true,
      repeat,
    };
  } catch {
    return fallback;
  }
}

function saveState(state: SavedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable in restrictive browsing modes.
  }
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function SoundtrackPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const resumeAfterVideoRef = useRef(false);
  const settingsRef = useRef({ enabled: false, volume: DEFAULT_VOLUME, muted: false, shuffle: false, repeat: "all" as RepeatMode });

  const [playlistKey, setPlaylistKey] = useState<PlaylistKey>("hero");
  const [trackIndex, setTrackIndex] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("all");
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(true);

  const tracks = PLAYLISTS[playlistKey];
  const track = tracks[trackIndex] ?? tracks[0];

  settingsRef.current = { enabled, volume, muted, shuffle, repeat };

  const progress = useMemo(
    () => (duration > 0 ? Math.min(100, (position / duration) * 100) : 0),
    [position, duration],
  );

  useEffect(() => {
    const key = getPlaylistKey();
    const saved = getSavedState();

    setPlaylistKey(key);
    setTrackIndex(saved.trackIndex % PLAYLISTS[key].length);
    setEnabled(saved.enabled);
    setPosition(saved.position);
    setVolume(saved.volume);
    setMuted(saved.muted);
    setShuffle(saved.shuffle);
    setRepeat(saved.repeat);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      const nextKey = getPlaylistKey();
      if (nextKey === playlistKey) return;

      const wasPlaying = !audioRef.current?.paused && enabled;
      setPlaylistKey(nextKey);
      setTrackIndex(0);
      setPosition(0);

      if (wasPlaying) {
        window.requestAnimationFrame(() => {
          setEnabled(true);
        });
      }
    };

    document.addEventListener("astro:after-swap", handleRouteChange);
    return () => document.removeEventListener("astro:after-swap", handleRouteChange);
  }, [playlistKey, enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    audio.pause();
    audio.src = track.src;
    audio.load();
    audio.volume = volume;
    audio.muted = muted;
    setPosition(0);
    setDuration(0);
    setAvailable(true);

    const saved = getSavedState();
    const currentKey = getPlaylistKey();

    const restore = () => {
      if (
        saved.enabled &&
        currentKey === playlistKey &&
        saved.trackIndex % tracks.length === trackIndex &&
        saved.position > 0 &&
        saved.position < audio.duration
      ) {
        audio.currentTime = saved.position;
        setPosition(saved.position);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      restore();
    };

    const handleTimeUpdate = () => {
      setPosition(audio.currentTime);

      if (saveTimerRef.current !== null) return;
      saveTimerRef.current = window.setTimeout(() => {
        saveState({
          enabled: settingsRef.current.enabled,
          trackIndex,
          position: audio.currentTime,
          volume: settingsRef.current.volume,
          muted: settingsRef.current.muted,
          shuffle: settingsRef.current.shuffle,
          repeat: settingsRef.current.repeat,
        });
        saveTimerRef.current = null;
      }, 750);
    };

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleError = () => {
      setAvailable(false);
      setPlaying(false);
    };

    const handleEnded = () => {
      if (settingsRef.current.repeat === "one") {
        audio.currentTime = 0;
        void audio.play().catch(() => setPlaying(false));
        return;
      }

      const next = getNextIndex(1);
      if (next === null) {
        setEnabled(false);
        setPlaying(false);
        saveState({
          enabled: false,
          trackIndex,
          position: 0,
          volume: settingsRef.current.volume,
          muted: settingsRef.current.muted,
          shuffle: settingsRef.current.shuffle,
          repeat: settingsRef.current.repeat,
        });
        return;
      }

      setTrackIndex(next);
      setPosition(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
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
  }, [track?.src, trackIndex, playlistKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (!enabled) return;

    const audio = audioRef.current;
    if (!audio) return;

    void audio.play().catch(() => {
      setPlaying(false);
      setEnabled(false);
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

    const handleVideoPause = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLVideoElement)) return;
      if (!resumeAfterVideoRef.current) return;

      resumeAfterVideoRef.current = false;
      if (enabled) void audioRef.current?.play().catch(() => {});
    };

    document.addEventListener("play", handleVideoPlay, true);
    document.addEventListener("pause", handleVideoPause, true);

    return () => {
      document.removeEventListener("play", handleVideoPlay, true);
      document.removeEventListener("pause", handleVideoPause, true);
    };
  }, [enabled]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seekBy(10);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekBy(-10);
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMute();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [playing, muted, enabled, position]);

  function getNextIndex(direction: 1 | -1): number | null {
    if (!tracks.length) return null;

    if (settingsRef.current.shuffle && tracks.length > 1) {
      const candidates = tracks.map((_, index) => index).filter((index) => index !== trackIndex);
      return candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    }

    const next = trackIndex + direction;
    if (next >= 0 && next < tracks.length) return next;
    if (settingsRef.current.repeat === "all") return (next + tracks.length) % tracks.length;
    return null;
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setEnabled(false);
      saveState({
        enabled: false,
        trackIndex,
        position: audio.currentTime,
        volume,
        muted,
        shuffle,
        repeat,
      });
      return;
    }

    setEnabled(true);
    audio.volume = volume;
    audio.muted = muted;

    void audio.play().then(() => {
      setPlaying(true);
      saveState({
        enabled: true,
        trackIndex,
        position: audio.currentTime,
        volume,
        muted,
        shuffle,
        repeat,
      });
    }).catch(() => {
      setEnabled(false);
      setPlaying(false);
    });
  }

  function selectTrack(index: number) {
    setTrackIndex(index);
    setPosition(0);
    setOpen(false);
    saveState({
      enabled,
      trackIndex: index,
      position: 0,
      volume,
      muted,
      shuffle,
      repeat,
    });
  }

  function changeTrack(direction: 1 | -1) {
    const next = getNextIndex(direction);
    if (next === null) return;
    selectTrack(next);
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) return;
    audio.currentTime = Math.min(Math.max(0, value), duration || value);
    setPosition(audio.currentTime);
  }

  function seekBy(seconds: number) {
    seekTo(position + seconds);
  }

  function toggleMute() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    saveState({
      enabled,
      trackIndex,
      position,
      volume,
      muted: nextMuted,
      shuffle,
      repeat,
    });
  }

  function changeVolume(nextVolume: number) {
    const next = Math.min(1, Math.max(0, nextVolume));
    setVolume(next);
    if (next > 0 && muted) setMuted(false);
    saveState({
      enabled,
      trackIndex,
      position,
      volume: next,
      muted: next === 0 ? true : false,
      shuffle,
      repeat,
    });
  }

  function cycleRepeat() {
    const next: RepeatMode = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    setRepeat(next);
    saveState({
      enabled,
      trackIndex,
      position,
      volume,
      muted,
      shuffle,
      repeat: next,
    });
  }

  function toggleShuffle() {
    const next = !shuffle;
    setShuffle(next);
    saveState({
      enabled,
      trackIndex,
      position,
      volume,
      muted,
      shuffle: next,
      repeat,
    });
  }

  if (!track || !available) return null;

  return (
    <aside
      className={`soundtrack-player ${playing ? "is-playing" : ""} ${open ? "is-open" : ""}`}
      aria-label="Banda sonora de Renanime"
    >
      <audio ref={audioRef} preload="metadata" aria-hidden="true" />

      <div className="soundtrack-player__inner">
        <div className="soundtrack-player__top">
          <button
            className="soundtrack-player__main-button"
            type="button"
            onClick={togglePlayback}
            aria-label={playing ? "Pausar música" : "Reproducir música"}
            aria-pressed={playing}
          >
            <span className="soundtrack-player__glyph" aria-hidden="true">
              {playing ? (
                <span className="soundtrack-player__bars"><i /><i /><i /><i /></span>
              ) : "♪"}
            </span>
            <span className="soundtrack-player__status">{playing ? "MUSIC ON" : "MUSIC OFF"}</span>
          </button>

          <button
            className="soundtrack-player__current"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="renanime-soundtrack-panel"
          >
            <span className="soundtrack-player__track-label">NOW PLAYING</span>
            <span className="soundtrack-player__track-title">{track.title}</span>
          </button>

          <div className="soundtrack-player__quick">
            <button type="button" onClick={() => changeTrack(-1)} aria-label="Canción anterior">←</button>
            <button type="button" onClick={() => changeTrack(1)} aria-label="Siguiente canción">→</button>
            <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Cerrar reproductor" : "Abrir reproductor"} aria-expanded={open}>
              {open ? "×" : "☰"}
            </button>
          </div>
        </div>

        <div className="soundtrack-player__progress">
          <span>{formatTime(position)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(position, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label="Posición de la canción"
            style={{ "--soundtrack-progress": `${progress}%` } as React.CSSProperties}
          />
          <span>{formatTime(duration)}</span>
        </div>

        {open && (
          <div className="soundtrack-player__panel" id="renanime-soundtrack-panel">
            <div className="soundtrack-player__panel-head">
              <div>
                <span className="soundtrack-player__eyebrow">
                  {playlistKey === "ghibli" ? "GHIBLI SOUNDTRACK" : "RENANIME SOUNDTRACK"}
                </span>
                <strong>{tracks.length} tracks</strong>
              </div>
              <div className="soundtrack-player__modes">
                <button className={shuffle ? "is-active" : ""} type="button" onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Activar reproducción aleatoria">🔀</button>
                <button className={repeat !== "off" ? "is-active" : ""} type="button" onClick={cycleRepeat} aria-label={`Repetición: ${repeat}`}>
                  {repeat === "one" ? "1" : "↻"}
                </button>
              </div>
            </div>

            <div className="soundtrack-player__queue">
              {tracks.map((item, index) => (
                <button
                  key={item.src}
                  type="button"
                  className={index === trackIndex ? "is-current" : ""}
                  onClick={() => selectTrack(index)}
                >
                  <span className="soundtrack-player__queue-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="soundtrack-player__queue-title">{item.title}</span>
                  {index === trackIndex && <span className="soundtrack-player__queue-state">{playing ? "●" : "○"}</span>}
                </button>
              ))}
            </div>

            <div className="soundtrack-player__footer">
              <button type="button" onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"}>
                {muted || volume === 0 ? "MUTE" : "VOL"}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={muted ? 0 : volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                aria-label="Volumen"
                style={{ "--soundtrack-volume": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
              />
              <span>{Math.round((muted ? 0 : volume) * 100)}%</span>
            </div>

            <div className="soundtrack-player__shortcuts">
              <span>SPACE play/pause</span>
              <span>← → ±10s</span>
              <span>M mute</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
