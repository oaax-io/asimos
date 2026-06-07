import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { z } from "zod";
import { Sun, Moon, CloudRain, Snowflake, Volume2, VolumeX } from "lucide-react";
import logo from "@/assets/logo-asimo.png";
import bgNight from "@/assets/login-bg-night.jpg";
import bgDay from "@/assets/login-bg-day.jpg";
import bgRain from "@/assets/login-bg-rain.jpg";
import bgSnow from "@/assets/login-bg-snow.jpg";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "signup" ? "signup" : "signin") as "signin" | "signup",
  }),
  component: AuthPage,
});

const signinSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail").transform((v) => v.toLowerCase()),
  password: z.string().min(6, "Mindestens 6 Zeichen"),
});

type Scene = "day" | "night" | "rain" | "snow";

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, user, isSuperadmin, superadminStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [stayLoggedIn, setStayLoggedIn] = useState(true);

  // Auto: tag von 7-19 Uhr, sonst nacht
  const initialScene: Scene = useMemo(() => {
    const h = new Date().getHours();
    return h >= 7 && h < 19 ? "day" : "night";
  }, []);
  const [scene, setScene] = useState<Scene>(initialScene);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    if (user && superadminStatus !== "unknown") {
      navigate({ to: isSuperadmin && superadminStatus === "granted" ? "/oaax" : "/dashboard" });
    }
  }, [user, isSuperadmin, superadminStatus, navigate]);

  // Ambient sound via WebAudio (noise + filter) — kein externes Asset nötig
  const audioRef = useRef<{
    ctx: AudioContext;
    src: AudioBufferSourceNode;
    gain: GainNode;
    filter: BiquadFilterNode;
  } | null>(null);

  useEffect(() => {
    if (!soundOn) {
      audioRef.current?.src.stop();
      audioRef.current?.ctx.close();
      audioRef.current = null;
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    // 2s pink noise buffer, looped
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.15;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    audioRef.current = { ctx, src, gain, filter };

    return () => {
      try { src.stop(); } catch {}
      ctx.close();
      audioRef.current = null;
    };
  }, [soundOn]);

  // Filter/Gain je Szene anpassen
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const now = a.ctx.currentTime;
    const cfg = {
      rain: { type: "highpass" as BiquadFilterType, freq: 800, gain: 0.35 },
      snow: { type: "lowpass" as BiquadFilterType, freq: 350, gain: 0.18 },
      night: { type: "lowpass" as BiquadFilterType, freq: 500, gain: 0.12 },
      day: { type: "lowpass" as BiquadFilterType, freq: 700, gain: 0.10 },
    }[scene];
    a.filter.type = cfg.type;
    a.filter.frequency.setTargetAtTime(cfg.freq, now, 0.5);
    a.gain.gain.setTargetAtTime(cfg.gain, now, 1.2);
  }, [scene, soundOn]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = signinSchema.safeParse(form);
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
      const { error } = await signIn(r.data.email, form.password);
      if (error) { toast.error(error); return; }
    } finally { setLoading(false); }
  };

  // Pro Szene ein eigenes Hintergrundbild (Haus, Pool, Himmel reagieren mit)
  const sceneImages: Record<Scene, string> = {
    day: bgDay,
    night: bgNight,
    rain: bgRain,
    snow: bgSnow,
  };

  // Leuchtende Fenster nur dort sinnvoll, wo es dunkel/dämmrig ist
  const glowOpacity: Record<Scene, number> = { day: 0, night: 0.9, rain: 0.55, snow: 0.35 };
  const shimmerOpacity: Record<Scene, number> = { day: 0.55, night: 0.35, rain: 0.7, snow: 0 };

  const sceneButtons: { key: Scene; icon: typeof Sun; label: string }[] = [
    { key: "day", icon: Sun, label: "Tag" },
    { key: "night", icon: Moon, label: "Nacht" },
    { key: "rain", icon: CloudRain, label: "Regen" },
    { key: "snow", icon: Snowflake, label: "Schnee" },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black p-6 overflow-hidden">
      {/* Alle Szenen-Bilder gestapelt, crossfade per opacity */}
      {(Object.keys(sceneImages) as Scene[]).map((key) => (
        <div
          key={key}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms]"
          style={{ backgroundImage: `url(${sceneImages[key]})`, opacity: scene === key ? 1 : 0 }}
          aria-hidden
        />
      ))}

      {/* Pool-Shimmer: animierter Glanz im unteren Drittel (Pool-Bereich) */}
      <div
        className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none mix-blend-screen transition-opacity duration-1000 animate-pool-shimmer"
        style={{ opacity: shimmerOpacity[scene] }}
        aria-hidden
      />

      {/* Leichte Vignette für Lesbarkeit der Karte */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)" }}
        aria-hidden
      />

      {/* Pulsierende Fenster (Nacht / dämmrig) */}
      <div
        className="absolute inset-0 bg-cover bg-center mix-blend-screen animate-window-glow pointer-events-none transition-opacity duration-1000"
        style={{ backgroundImage: `url(${bgNight})`, opacity: glowOpacity[scene] }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-cover bg-center mix-blend-screen animate-window-flicker pointer-events-none transition-opacity duration-1000"
        style={{ backgroundImage: `url(${bgNight})`, filter: "brightness(1.3) saturate(1.3)", opacity: glowOpacity[scene] * 0.6 }}
        aria-hidden
      />

      {/* Wetter-Layer */}
      {scene === "rain" && <RainLayer />}
      {scene === "snow" && <SnowLayer />}
      {(scene === "day" || scene === "rain") && <CloudsLayer dark={scene === "rain"} />}

      {/* Kontroll-Leiste */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/40 backdrop-blur-md p-1 text-white">
        {sceneButtons.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setScene(key)}
            title={label}
            aria-label={label}
            className={`rounded-full p-2 transition ${
              scene === key ? "bg-white text-black" : "hover:bg-white/15"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/20" />
        <button
          type="button"
          onClick={() => setSoundOn((v) => !v)}
          title={soundOn ? "Ton aus" : "Ton an"}
          aria-label={soundOn ? "Ton aus" : "Ton an"}
          className={`rounded-full p-2 transition ${
            soundOn ? "bg-white text-black" : "hover:bg-white/15"
          }`}
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      {/* Login Karte */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-primary/40 bg-primary/80 backdrop-blur-md p-8 text-primary-foreground shadow-2xl">
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="ASIMO" className="h-16 w-auto" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-primary-foreground">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="mail@asimo.ch"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 border-white bg-white text-foreground placeholder:text-muted-foreground focus-visible:ring-white"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-primary-foreground">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="mt-1 border-white bg-white text-foreground placeholder:text-muted-foreground focus-visible:ring-white"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-primary-foreground/90 cursor-pointer">
            <Checkbox
              checked={stayLoggedIn}
              onCheckedChange={(v) => setStayLoggedIn(Boolean(v))}
              className="border-white/50 data-[state=checked]:bg-black data-[state=checked]:text-primary"
            />
            Angemeldet bleiben
          </label>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full bg-black text-primary hover:bg-black/90 shadow-lg"
          >
            {loading ? "Bitte warten…" : "Login"}
          </Button>
        </form>
      </div>

      <p className="absolute z-10 bottom-6 left-0 right-0 text-center text-xs text-white/70">
        ASIMO Treuhand AG — SaaS Powered by OAASE
      </p>
    </div>
  );
}

function RainLayer() {
  const drops = useMemo(
    () =>
      Array.from({ length: 120 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 0.5 + Math.random() * 0.7,
        opacity: 0.25 + Math.random() * 0.5,
        height: 40 + Math.random() * 60,
        key: i,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      {drops.map((d) => (
        <span
          key={d.key}
          className="absolute top-[-10%] w-px bg-gradient-to-b from-transparent via-white/80 to-white/30 animate-rain-fall"
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            opacity: d.opacity,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function SnowLayer() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 90 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 7 + Math.random() * 10,
        size: 2 + Math.random() * 5,
        drift: -20 + Math.random() * 40,
        opacity: 0.5 + Math.random() * 0.5,
        key: i,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      {flakes.map((f) => (
        <span
          key={f.key}
          className="absolute top-[-5%] rounded-full bg-white animate-snow-fall"
          style={{
            left: `${f.left}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            opacity: f.opacity,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
            ["--drift" as any]: `${f.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

function CloudsLayer() {
  const clouds = useMemo(
    () =>
      Array.from({ length: 5 }).map((_, i) => ({
        top: 5 + i * 12,
        delay: -i * 18,
        duration: 80 + Math.random() * 60,
        scale: 0.7 + Math.random() * 0.8,
        opacity: 0.25 + Math.random() * 0.25,
        key: i,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      {clouds.map((c) => (
        <div
          key={c.key}
          className="absolute h-24 w-72 rounded-full bg-white blur-2xl animate-cloud-drift"
          style={{
            top: `${c.top}%`,
            opacity: c.opacity,
            transform: `scale(${c.scale})`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
