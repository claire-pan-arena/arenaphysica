"use client";

import { signIn } from "next-auth/react";

export default function SignIn() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0d0f0e] overflow-hidden">
      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(190,255,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(190,255,0,0.04) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Corner brackets */}
      <div className="pointer-events-none absolute top-6 left-6 h-16 w-16 border-t-2 border-l-2 border-[#beff00]/40" />
      <div className="pointer-events-none absolute top-6 right-6 h-16 w-16 border-t-2 border-r-2 border-[#beff00]/40" />
      <div className="pointer-events-none absolute bottom-6 left-6 h-16 w-16 border-b-2 border-l-2 border-[#beff00]/40" />
      <div className="pointer-events-none absolute bottom-6 right-6 h-16 w-16 border-b-2 border-r-2 border-[#beff00]/40" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-12">
        {/* Wireframe sphere */}
        <div className="relative h-48 w-48">
          <svg viewBox="0 0 200 200" className="h-full w-full animate-[spin_20s_linear_infinite] opacity-30">
            <ellipse cx="100" cy="100" rx="80" ry="80" fill="none" stroke="#beff00" strokeWidth="0.5" />
            <ellipse cx="100" cy="100" rx="80" ry="40" fill="none" stroke="#beff00" strokeWidth="0.5" />
            <ellipse cx="100" cy="100" rx="80" ry="40" fill="none" stroke="#beff00" strokeWidth="0.5" transform="rotate(60 100 100)" />
            <ellipse cx="100" cy="100" rx="80" ry="40" fill="none" stroke="#beff00" strokeWidth="0.5" transform="rotate(120 100 100)" />
            <ellipse cx="100" cy="100" rx="40" ry="80" fill="none" stroke="#beff00" strokeWidth="0.5" />
            <ellipse cx="100" cy="100" rx="40" ry="80" fill="none" stroke="#beff00" strokeWidth="0.5" transform="rotate(60 100 100)" />
            <ellipse cx="100" cy="100" rx="40" ry="80" fill="none" stroke="#beff00" strokeWidth="0.5" transform="rotate(120 100 100)" />
          </svg>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="font-mono text-4xl font-bold tracking-wider text-white md:text-5xl">
            GROUND CONTROL
          </h1>
          <p className="mt-3 font-mono text-sm tracking-[0.3em] text-[#beff00]/60 uppercase">
            at Arena Physica
          </p>
        </div>

        {/* Sign in button */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="group relative font-mono text-sm tracking-widest uppercase"
        >
          <div className="border border-[#beff00]/30 bg-[#beff00]/5 px-10 py-4 text-[#beff00] transition-all duration-300 hover:border-[#beff00]/60 hover:bg-[#beff00]/10 hover:shadow-[0_0_30px_rgba(190,255,0,0.1)]">
            <span className="flex items-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#beff00" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#beff00" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#beff00" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#beff00" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </span>
          </div>
        </button>

        {/* Terminal text */}
        <div className="mt-8 font-mono text-xs text-[#beff00]/30">
          <p>&gt; AUTHENTICATING SECURE CONNECTION...</p>
        </div>
      </div>

      {/* Bottom left terminal text */}
      <div className="absolute bottom-8 left-8 font-mono text-[10px] leading-5 text-white/20">
        <p>GROUND_CONTROL V.1.0</p>
        <p>ARENA PHYSICA SYSTEMS</p>
        <p className="text-[#beff00]/30">AWAITING CREDENTIALS</p>
      </div>
    </div>
  );
}
