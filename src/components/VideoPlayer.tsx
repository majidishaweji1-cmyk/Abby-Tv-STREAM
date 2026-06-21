import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertTriangle, Maximize, Minimize, Volume2, VolumeX, Settings, Subtitles } from "lucide-react";
import Hls from "hls.js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VideoPlayerProps {
  streamUrl: string;
  streamType: "ts" | "hls" | "m3u8" | "mpd";
  keyId?: string | null;
  drmKey?: string | null;
  token?: string | null;
  onTimeUpdate?: (currentTime: number) => void;
  onError?: () => void;
  forceStop?: boolean;
}

export const VideoPlayer = ({
  streamUrl,
  streamType,
  keyId,
  drmKey,
  token,
  onTimeUpdate,
  onError,
  forceStop = false,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shakaPlayerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsPlayerRef = useRef<any>(null);
  const hlsAudioTrackMapRef = useRef<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<{ id: number; height: number; bitrate?: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState("auto");
  const [audioLangs, setAudioLangs] = useState<string[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: number; label: string; lang: string }[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState("-1");
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const controlsTimeout = useRef<number>();
  const mountedRef = useRef(true);
  const playTimeRef = useRef(0);

  // Fetch global token from app_config (MPD only)
  const { data: globalTokenConfig } = useQuery({
    queryKey: ["app-config", "global_token"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "global_token")
        .single();
      return data?.value || "";
    },
    staleTime: 60000,
  });

  const detectStreamType = useCallback((url: string, declaredType: "ts" | "hls" | "m3u8" | "mpd") => {
    const cleanUrl = url.split("?")[0].toLowerCase();
    if (cleanUrl.endsWith(".mpd")) return "mpd" as const;
    if (cleanUrl.endsWith(".m3u8")) return "m3u8" as const;
    if (cleanUrl.endsWith(".ts")) return "ts" as const;
    return declaredType;
  }, []);

  const getMpdUrlCandidates = useCallback((url: string) => {
    const resolvedType = detectStreamType(url, streamType);
    if (resolvedType !== "mpd") return [url];
    const globalToken = String(globalTokenConfig || "").trim();
    if (!globalToken) return [url];
    const separator = url.includes("?") ? "&" : "?";
    const encodedToken = encodeURIComponent(globalToken);
    return Array.from(new Set([
      `${url}${separator}cdntoken=${encodedToken}`,
      `${url}${separator}token=${encodedToken}`,
      `${url}${separator}token=${encodedToken}&cdntoken=${encodedToken}`,
    ]));
  }, [globalTokenConfig, streamType, detectStreamType]);

  // ===== FULL CLEANUP - stops everything, releases resources =====
  const destroyPlayers = useCallback(async () => {
    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsPlayerRef.current) {
      try { mpegtsPlayerRef.current.pause?.(); } catch {}
      try { mpegtsPlayerRef.current.unload?.(); } catch {}
      try { mpegtsPlayerRef.current.detachMediaElement?.(); } catch {}
      try { mpegtsPlayerRef.current.destroy?.(); } catch {}
      mpegtsPlayerRef.current = null;
    }
    if (shakaPlayerRef.current) {
      try { await shakaPlayerRef.current.destroy(); } catch {}
      shakaPlayerRef.current = null;
    }
    hlsAudioTrackMapRef.current = {};
    // Force video element to release resources
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

  // ========== MPD/DASH with Shaka Player ==========
  const initShakaPlayer = useCallback(async () => {
    if (!videoRef.current || !mountedRef.current) return;
    const shaka = await import("shaka-player/dist/shaka-player.compiled");
    shaka.default.polyfill.installAll();

    if (!shaka.default.Player.isBrowserSupported()) {
      setError("Browser not supported for DASH streaming");
      return;
    }

    const player = new shaka.default.Player(videoRef.current);
    shakaPlayerRef.current = player;

    const trimmedKeyId = String(keyId || "").trim();
    const trimmedKey = String(drmKey || "").trim();

    const config: any = {
      manifest: { dash: { ignoreMinBufferTime: true } },
    };

    if (trimmedKeyId && trimmedKey) {
      config.drm = { clearKeys: { [trimmedKeyId]: trimmedKey } };
      console.log("[VideoPlayer] ClearKey DRM:", { keyId: trimmedKeyId, keyLength: trimmedKey.length });
    }

    player.configure(config);

    player.addEventListener("error", (e: any) => {
      console.error("[VideoPlayer] Shaka error:", e.detail?.code, e.detail);
      if (mountedRef.current) { setError("Stream playback error"); onError?.(); }
    });

    try {
      const mpdUrls = getMpdUrlCandidates(streamUrl);
      let loaded = false;
      let lastError: unknown;

      for (const finalUrl of mpdUrls) {
        console.log("[VideoPlayer] Final URL:", finalUrl);
        try {
          await player.load(finalUrl);
          loaded = true;
          break;
        } catch (loadErr) {
          lastError = loadErr;
          console.warn("[VideoPlayer] MPD load attempt failed:", finalUrl, loadErr);
        }
      }

      if (!loaded) throw lastError || new Error("Failed to load MPD stream");
      if (!mountedRef.current) return;

      setLoading(false);
      setError(null);

      // Quality levels
      const variants = player.getVariantTracks();
      const unique = variants
        .filter((t: any, i: number, arr: any[]) => arr.findIndex((a: any) => a.height === t.height) === i)
        .sort((a: any, b: any) => (b.height || 0) - (a.height || 0))
        .map((t: any) => ({ id: t.id, height: t.height || 0 }));
      setQualityLevels(unique);

      // Audio langs
      const langs = player.getAudioLanguages();
      if (langs.length > 1) setAudioLangs(langs);

      // Subtitles
      const textTracks = player.getTextTracks();
      if (textTracks.length > 0) {
        setSubtitleTracks(textTracks.map((t: any) => ({ id: t.id, label: t.label || t.language, lang: t.language })));
      }

      videoRef.current?.play().catch(() => {});
    } catch (err: any) {
      console.error("[VideoPlayer] MPD load error:", err);
      if (mountedRef.current) { setError("Failed to load MPD stream"); setLoading(false); }
    }
  }, [streamUrl, keyId, drmKey, getMpdUrlCandidates, onError]);

  // ========== HLS/M3U8 with HLS.js ==========
  const extractHlsQualities = useCallback((hls: Hls) => {
    if (!hls.levels || hls.levels.length === 0) return;
    const mapped = hls.levels.map((l, i) => ({
      id: i,
      height: l.height || 0,
      bitrate: l.bitrate || 0,
    }));
    const usable = mapped.filter(l => l.height > 0 || l.bitrate > 0);
    usable.sort((a, b) => {
      if (a.height && b.height) return b.height - a.height;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });
    const final = usable.length > 0 ? usable : (mapped.length > 1 ? mapped : []);
    if (final.length > 0) {
      setQualityLevels(prev => {
        // Only update if we got more or better data
        if (prev.length === 0 || final.length > prev.length) return final;
        // Update if old data had no height but new does
        if (prev.every(p => p.height === 0) && final.some(f => f.height > 0)) return final;
        return prev;
      });
    }
    console.log("[VideoPlayer] HLS quality levels:", final);
  }, []);

  const extractNativeTextTracks = useCallback(() => {
    if (!videoRef.current) return;
    const nativeTracks = videoRef.current.textTracks;
    if (!nativeTracks || nativeTracks.length === 0) return;
    const native: { id: number; label: string; lang: string }[] = [];
    for (let i = 0; i < nativeTracks.length; i++) {
      const t = nativeTracks[i];
      if (t.kind === "subtitles" || t.kind === "captions") {
        native.push({ id: i, label: t.label || t.language || `CC ${i + 1}`, lang: t.language || "" });
      }
    }
    if (native.length > 0) {
      setSubtitleTracks(prev => prev.length > 0 ? prev : native);
    }
  }, []);

  const initHlsPlayer = useCallback(async () => {
    if (!videoRef.current || !mountedRef.current) return;
    const finalStreamUrl = streamUrl;
    console.log("[VideoPlayer] Loading HLS:", finalStreamUrl);

    // Native HLS (Safari) - still extract tracks from native API
    if (!Hls.isSupported() && videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      const video = videoRef.current;
      video.src = finalStreamUrl;
      video.addEventListener("loadedmetadata", () => {
        if (!mountedRef.current) return;
        setLoading(false);
        // Safari exposes audioTracks and textTracks natively
        extractNativeTextTracks();
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener("error", () => {
        if (!mountedRef.current) return;
        setError("Failed to load stream");
        setLoading(false);
      }, { once: true });
      return;
    }

    if (!Hls.isSupported()) {
      setError("HLS not supported");
      setLoading(false);
      return;
    }

    const hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      enableWorker: true,
      startLevel: -1, // auto quality from start
      capLevelToPlayerSize: false,
      renderTextTracksNatively: true,
      subtitlePreference: { default: false },
    });
    hlsRef.current = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, (_e, _data) => {
      if (!mountedRef.current) return;
      setLoading(false);
      setError(null);
      extractHlsQualities(hls);
      videoRef.current?.play().catch(() => {});
    });

    // Re-check levels when they finish loading (some manifests lazy-load level details)
    hls.on(Hls.Events.LEVEL_LOADED, () => {
      if (!mountedRef.current || !hlsRef.current) return;
      extractHlsQualities(hlsRef.current);
    });

    // Quality level updated after switching
    hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
      if (!mountedRef.current || !hlsRef.current) return;
      console.log("[VideoPlayer] HLS level switched to:", data.level);
      // Re-extract in case resolution info wasn't available before
      extractHlsQualities(hlsRef.current);
    });

    // Subtitle tracks from manifest
    hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, data) => {
      if (!mountedRef.current) return;
      const subs = data.subtitleTracks.map((t, i) => ({
        id: i,
        label: t.name || t.lang || `Sub ${i + 1}`,
        lang: t.lang || "",
      }));
      if (subs.length > 0) setSubtitleTracks(subs);
    });

    // Also check native text tracks after first fragment loads
    let nativeTracksChecked = false;
    hls.on(Hls.Events.FRAG_LOADED, () => {
      if (nativeTracksChecked || !mountedRef.current) return;
      nativeTracksChecked = true;
      extractNativeTextTracks();
    });

    // Audio tracks
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, data) => {
      if (!mountedRef.current) return;
      hlsAudioTrackMapRef.current = {};
      const langs = data.audioTracks
        .map((track, index) => {
          const label = track.lang || track.name || `Audio ${index + 1}`;
          hlsAudioTrackMapRef.current[label] = index;
          return label;
        })
        .filter(Boolean);
      if (langs.length > 0) setAudioLangs(Array.from(new Set(langs)));
    });

    // Also poll audio tracks after manifest (some streams don't fire AUDIO_TRACKS_UPDATED)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (!mountedRef.current || !hlsRef.current) return;
      const tracks = hlsRef.current.audioTracks;
      if (tracks && tracks.length > 1 && audioLangs.length === 0) {
        hlsAudioTrackMapRef.current = {};
        const langs = tracks.map((t, i) => {
          const label = t.lang || t.name || `Audio ${i + 1}`;
          hlsAudioTrackMapRef.current[label] = i;
          return label;
        });
        setAudioLangs(Array.from(new Set(langs)));
      }
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      console.error("[VideoPlayer] HLS error:", data.type, data.details);
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.warn("[VideoPlayer] HLS network error, retrying...");
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.warn("[VideoPlayer] HLS media error, recovering...");
          hls.recoverMediaError();
        } else {
          if (mountedRef.current) { setError("Failed to load stream"); setLoading(false); }
        }
      }
    });

    hls.loadSource(finalStreamUrl);
    hls.attachMedia(videoRef.current);
  }, [streamUrl, extractHlsQualities, extractNativeTextTracks]);

  // ========== TS streams ==========
  const initTsPlayer = useCallback(async () => {
    if (!videoRef.current || !mountedRef.current) return;
    const video = videoRef.current;
    const finalStreamUrl = streamUrl;
    console.log("[VideoPlayer] Final URL:", finalStreamUrl);
    console.log("[VideoPlayer] Loading TS:", finalStreamUrl);

    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const waitForVideoReady = (timeoutMs = 12000) =>
      new Promise<void>((resolve, reject) => {
        let done = false;
        const timeout = window.setTimeout(() => finish(() => reject(new Error("TS readiness timeout"))), timeoutMs);

        const cleanup = () => {
          window.clearTimeout(timeout);
          video.removeEventListener("playing", onReady);
          video.removeEventListener("loadeddata", onReady);
          video.removeEventListener("canplay", onReady);
          video.removeEventListener("error", onErrorEvent);
        };

        const finish = (cb: () => void) => {
          if (done) return;
          done = true;
          cleanup();
          cb();
        };

        const onReady = () => finish(resolve);
        const onErrorEvent = () => finish(() => reject(new Error("TS video element error")));

        video.addEventListener("playing", onReady);
        video.addEventListener("loadeddata", onReady);
        video.addEventListener("canplay", onReady);
        video.addEventListener("error", onErrorEvent);
      });

    const tryMpegTs = async () => {
      const mpegtsModule: any = await import("mpegts.js");
      const mpegts = mpegtsModule.default || mpegtsModule;

      if (!mpegts?.isSupported?.()) {
        throw new Error("MPEG-TS MSE not supported on this browser");
      }

      const player = mpegts.createPlayer(
        {
          type: "mse",
          isLive: true,
          url: finalStreamUrl,
          hasAudio: true,
          hasVideo: true,
        },
        {
          enableWorker: true,
          lazyLoad: false,
          autoCleanupSourceBuffer: true,
          stashInitialSize: 384 * 1024,
          fixAudioTimestampGap: true,
          seekType: "range",
        }
      );

      mpegtsPlayerRef.current = player;
      player.attachMediaElement(video);
      player.load();
      await player.play().catch(() => undefined);
      await waitForVideoReady(12000);
    };

    const tryTsViaHls = async () => {
      if (!Hls.isSupported()) {
        throw new Error("HLS.js not supported for TS fallback");
      }

      await new Promise<void>((resolve, reject) => {
        const hls = new Hls({
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          backBufferLength: 90,
          liveSyncDurationCount: 3,
          enableWorker: true,
          renderTextTracksNatively: true,
          manifestLoadingMaxRetry: 6,
          levelLoadingMaxRetry: 6,
          fragLoadingMaxRetry: 6,
        });

        hlsRef.current = hls;

        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("TS via HLS timed out"));
        }, 12000);

        const finish = (cb: () => void) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          cb();
        };

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          const levels = data.levels.map((l, i) => ({ id: i, height: l.height }));
          setQualityLevels(levels.filter((l) => l.height > 0).sort((a, b) => b.height - a.height));
          video.play().catch(() => undefined);
          finish(resolve);
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, data) => {
          const subs = data.subtitleTracks.map((t, i) => ({
            id: i,
            label: t.name || t.lang || `Sub ${i + 1}`,
            lang: t.lang || "",
          }));
          setSubtitleTracks(subs);
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, data) => {
          hlsAudioTrackMapRef.current = {};
          const langs = data.audioTracks
            .map((track, index) => {
              const label = track.lang || track.name || `Audio ${index + 1}`;
              hlsAudioTrackMapRef.current[label] = index;
              return label;
            })
            .filter(Boolean);
          setAudioLangs(Array.from(new Set(langs)));
        });

        hls.on(Hls.Events.ERROR, (_e, data) => {
          console.error("[VideoPlayer] TS via HLS error:", data.type, data.details);
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          finish(() => reject(new Error(`TS via HLS failed: ${data.details}`)));
        });

        hls.loadSource(finalStreamUrl);
        hls.attachMedia(video);
      });
    };

    const tryNative = async () => {
      video.src = finalStreamUrl;
      video.load();
      await video.play().catch(() => undefined);
      await waitForVideoReady(10000);
    };

    let lastError: unknown = null;
    const strategies = [tryMpegTs, tryTsViaHls, tryNative];

    for (let attempt = 0; attempt < 3; attempt++) {
      for (const strategy of strategies) {
        try {
          await destroyPlayers();
          if (!mountedRef.current) return;
          await strategy();
          if (!mountedRef.current) return;
          setLoading(false);
          setError(null);
          return;
        } catch (err) {
          lastError = err;
          console.warn("[VideoPlayer] TS strategy failed:", err);
        }
      }
      await wait(1200 * (attempt + 1));
    }

    console.error("[VideoPlayer] TS final error:", lastError);
    if (mountedRef.current) {
      setError("Failed to load TS stream");
      setLoading(false);
      onError?.();
    }
  }, [streamUrl, onError]);

  // Main init
  useEffect(() => {
    mountedRef.current = true;
    playTimeRef.current = 0;
    setLoading(true);
    setError(null);
    setQualityLevels([]);
    setAudioLangs([]);
    setSubtitleTracks([]);
    setCurrentQuality("auto");
    setCurrentSubtitle("-1");
    if (forceStop) return;

    const init = async () => {
      await destroyPlayers();
      if (!mountedRef.current) return;
      const resolvedType = detectStreamType(streamUrl, streamType);
      console.log("[VideoPlayer] Stream type resolved:", {
        declaredType: streamType,
        resolvedType,
        streamUrl,
      });
      if (resolvedType === "mpd") await initShakaPlayer();
      else if (resolvedType === "ts") await initTsPlayer();
      else await initHlsPlayer();
    };
    init();

    return () => {
      mountedRef.current = false;
      // Immediately destroy all players on unmount to prevent background play
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (shakaPlayerRef.current) {
        try { shakaPlayerRef.current.destroy(); } catch {}
        shakaPlayerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };
  }, [streamUrl, streamType, keyId, drmKey, token, forceStop, globalTokenConfig, detectStreamType]);

  // Force stop - complete resource release
  useEffect(() => {
    if (forceStop) {
      destroyPlayers();
    }
  }, [forceStop, destroyPlayers]);

  // Clear error when playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlaying = () => { setError(null); setLoading(false); };
    video.addEventListener("playing", onPlaying);
    return () => video.removeEventListener("playing", onPlaying);
  }, []);

  // Time update - tracks real play time for trial
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onTimeUpdate) return;
    let lastTime = 0;
    const handler = () => {
      const now = video.currentTime;
      // Only count forward playback time
      if (now > lastTime && now - lastTime < 2) {
        playTimeRef.current += now - lastTime;
      }
      lastTime = now;
      onTimeUpdate(playTimeRef.current);
    };
    video.addEventListener("timeupdate", handler);
    return () => video.removeEventListener("timeupdate", handler);
  }, [onTimeUpdate]);

  // Fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Cleanup on page unload / visibility change
  useEffect(() => {
    const handleVisChange = () => {
      if (document.visibilityState === "hidden" && forceStop) {
        destroyPlayers();
      }
    };
    const handleBeforeUnload = () => { destroyPlayers(); };
    document.addEventListener("visibilitychange", handleVisChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [destroyPlayers, forceStop]);

  const resetControlsTimer = () => {
    setShowControls(true);
    setShowSettings(s => s); // keep settings if open
    clearTimeout(controlsTimeout.current);
    controlsTimeout.current = window.setTimeout(() => {
      setShowControls(false);
      setShowSettings(false);
    }, 4000);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await containerRef.current.requestFullscreen();
      try { await (screen.orientation as any).lock("landscape"); } catch {}
    }
  };

  const toggleMute = () => {
    if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setMuted(videoRef.current.muted); }
  };

  const handleQualityChange = (value: string) => {
    setCurrentQuality(value);
    if (value === "auto") {
      if (shakaPlayerRef.current) shakaPlayerRef.current.configure({ abr: { enabled: true } });
      else if (hlsRef.current) hlsRef.current.currentLevel = -1;
    } else {
      const id = Number(value);
      if (shakaPlayerRef.current) {
        shakaPlayerRef.current.configure({ abr: { enabled: false } });
        const track = shakaPlayerRef.current.getVariantTracks().find((t: any) => t.id === id);
        if (track) shakaPlayerRef.current.selectVariantTrack(track, true);
      } else if (hlsRef.current) {
        hlsRef.current.currentLevel = id;
      }
    }
    setShowSettings(false);
  };

  const handleSubtitleChange = (value: string) => {
    setCurrentSubtitle(value);
    const id = Number(value);
    if (shakaPlayerRef.current) {
      if (id === -1) shakaPlayerRef.current.setTextTrackVisibility(false);
      else {
        const tracks = shakaPlayerRef.current.getTextTracks();
        const track = tracks.find((t: any) => t.id === id);
        if (track) { shakaPlayerRef.current.selectTextTrack(track); shakaPlayerRef.current.setTextTrackVisibility(true); }
      }
    } else if (hlsRef.current) {
      hlsRef.current.subtitleTrack = id;
    }
    // Also handle native text tracks (for embedded subtitles)
    if (videoRef.current) {
      const nativeTracks = videoRef.current.textTracks;
      for (let i = 0; i < nativeTracks.length; i++) {
        nativeTracks[i].mode = i === id ? "showing" : "hidden";
      }
    }
    setShowSettings(false);
  };

  const handleAudioChange = (lang: string) => {
    if (shakaPlayerRef.current) shakaPlayerRef.current.selectAudioLanguage(lang);
    else if (hlsRef.current) {
      const trackIndex = hlsAudioTrackMapRef.current[lang];
      if (typeof trackIndex === "number") {
        hlsRef.current.audioTrack = trackIndex;
      }
    }
  };

  const formatBitrate = (bitrate: number) => {
    if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)}Mbps`;
    if (bitrate >= 1000) return `${Math.round(bitrate / 1000)}kbps`;
    return `${bitrate}bps`;
  };

  const getQualityLabel = (q: { height: number; bitrate?: number }) => {
    if (q.height > 0) return `${q.height}p`;
    if (q.bitrate && q.bitrate > 0) return formatBitrate(q.bitrate);
    return "Unknown";
  };

  const qualityLabel = currentQuality === "auto" ? "Auto" : (() => {
    const q = qualityLevels.find(q => String(q.id) === currentQuality);
    return q ? getQualityLabel(q) : "?";
  })();

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black overflow-hidden"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        muted={muted}
      />

      {/* Watermark */}
      <div className="absolute bottom-12 right-3 z-10 pointer-events-none select-none opacity-50">
        <span className="text-[10px] sm:text-xs font-bold text-foreground/60 tracking-wider">LOFT Tv</span>
      </div>

      {/* Loading */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && videoRef.current?.paused !== false && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center px-4">
            <AlertTriangle className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && showControls && (
        <div className="absolute bottom-14 right-2 bg-black/90 rounded-lg border border-border p-3 min-w-[180px] z-30 space-y-3">
          {/* Quality */}
          {qualityLevels.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ubora / Quality</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => handleQualityChange("auto")}
                  className={`w-full text-left text-xs px-2 py-1 rounded ${currentQuality === "auto" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent/30"}`}
                >
                  Auto
                </button>
                {qualityLevels.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => handleQualityChange(String(q.id))}
                    className={`w-full text-left text-xs px-2 py-1 rounded ${currentQuality === String(q.id) ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent/30"}`}
                  >
                    {getQualityLabel(q)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtitles */}
          {subtitleTracks.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Maneno / Subtitles</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => handleSubtitleChange("-1")}
                  className={`w-full text-left text-xs px-2 py-1 rounded ${currentSubtitle === "-1" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent/30"}`}
                >
                  Off
                </button>
                {subtitleTracks.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSubtitleChange(String(s.id))}
                    className={`w-full text-left text-xs px-2 py-1 rounded ${currentSubtitle === String(s.id) ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent/30"}`}
                  >
                    {s.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Audio */}
          {audioLangs.length > 1 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Sauti / Audio</p>
              <div className="space-y-0.5">
                {audioLangs.map((l) => (
                  <button
                    key={l}
                    onClick={() => handleAudioChange(l)}
                    className="w-full text-left text-xs px-2 py-1 rounded text-foreground hover:bg-accent/30"
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls overlay */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground live-pulse">LIVE</span>
            {qualityLevels.length > 0 && (
              <span className="text-[10px] bg-black/50 text-foreground rounded px-1.5 py-0.5 border border-border">
                {qualityLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {(qualityLevels.length > 0 || subtitleTracks.length > 0 || audioLangs.length > 1) && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent/50 transition-colors"
              >
                <Settings className="w-4 h-4 text-foreground" />
              </button>
            )}
            {subtitleTracks.length > 0 && (
              <button
                onClick={() => handleSubtitleChange(currentSubtitle === "-1" ? String(subtitleTracks[0]?.id ?? 0) : "-1")}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${currentSubtitle !== "-1" ? "bg-primary/30" : "hover:bg-accent/50"}`}
              >
                <Subtitles className="w-4 h-4 text-foreground" />
              </button>
            )}
            <button onClick={toggleMute} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent/50 transition-colors">
              {muted ? <VolumeX className="w-4 h-4 text-foreground" /> : <Volume2 className="w-4 h-4 text-foreground" />}
            </button>
            <button onClick={toggleFullscreen} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent/50 transition-colors">
              {isFullscreen ? <Minimize className="w-4 h-4 text-foreground" /> : <Maximize className="w-4 h-4 text-foreground" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
