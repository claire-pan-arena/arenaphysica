"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

const bootSequence = [
  "ESTABLISHING SECURE FIELD UPLINK........",
  "PROVISIONING DEPLOYMENT TOOLKIT........",
  "LOADING STRATEGIST RELAY PROTOCOLS........",
  "CALIBRATING ONSITE GROUND OPS........",
  "STANDING BY FOR DISPATCH........",
];

function TypedLine({ text, onDone }: { text: string; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
        onDone?.();
      }
    }, 18);
    return () => clearInterval(interval);
  }, [text, onDone]);

  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse">|</span>}
    </span>
  );
}

export default function SignIn() {
  const [activeLine, setActiveLine] = useState(0);
  const [startedTyping, setStartedTyping] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStartedTyping(true), 300);
    return () => clearTimeout(t);
  }, []);

  const handleLineDone = (i: number) => {
    if (i < bootSequence.length - 1) {
      setTimeout(() => setActiveLine(i + 1), 200);
    } else {
      setTimeout(() => setShowContent(true), 400);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Full page gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />

      {/* Horizon glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 70%, rgba(180,160,130,0.4) 0%, transparent 70%)",
        }}
      />

      {/* Subtle light flare */}
      <div
        className="absolute top-[30%] left-1/2 -translate-x-1/2 h-[600px] w-[600px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%)",
        }}
      />

      {/* Large wireframe sphere */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg
          viewBox="0 0 400 400"
          className="h-[500px] w-[500px] animate-[spin_25s_linear_infinite] opacity-15 md:h-[700px] md:w-[700px]"
        >
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="60" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
          <line x1="20" y1="200" x2="380" y2="200" stroke="white" strokeWidth="0.3" />
          <line x1="200" y1="20" x2="200" y2="380" stroke="white" strokeWidth="0.3" />
        </svg>
      </div>

      {/* Boot sequence - bottom left */}
      <div className="absolute bottom-8 left-8 z-20 font-mono text-[10px] leading-5 md:text-xs md:leading-6">
        {startedTyping &&
          bootSequence.slice(0, activeLine + 1).map((line, i) => (
            <p
              key={i}
              className={`${
                i < activeLine ? "text-white/25" : "text-white/60"
              }`}
            >
              <span className="text-white/40">&gt; </span>
              {i === activeLine ? (
                <TypedLine text={line} onDone={() => handleLineDone(i)} />
              ) : (
                line
              )}
            </p>
          ))}
      </div>

      {/* Main content - fades in after boot */}
      <div
        className={`relative z-10 flex flex-col items-center gap-10 px-8 text-center transition-all duration-1000 ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div>
          <p className="text-xs tracking-[0.3em] text-white/40 uppercase mb-4">
            Arena Physica
          </p>
          <h1
            className="text-5xl leading-[1.1] tracking-tight text-white md:text-7xl lg:text-8xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Welcome to
            <br />
            <em className="font-normal">Ground Control</em>
          </h1>
          <p className="mt-6 text-base text-white/50">
            Foundational intelligence for modern hardware.
          </p>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="flex items-center gap-3 border border-white/20 bg-white/5 px-10 py-4 text-sm tracking-widest text-white uppercase backdrop-blur-sm transition-all duration-300 hover:border-white/40 hover:bg-white/10"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>

      {/* Top right version tag */}
      <div className="absolute top-8 right-8 z-20 font-mono text-[10px] text-white/20">
        GC-SYS V.1.0
      </div>
    </div>
  );
}
