"use client";

import { signIn } from "next-auth/react";

export default function SignIn() {
  return (
    <div className="relative flex min-h-screen bg-[#f4f1eb] overflow-hidden">
      {/* Left panel */}
      <div className="relative z-10 flex w-full flex-col justify-between px-10 py-12 md:w-1/2 md:px-16 lg:px-24">
        {/* Top - Logo area */}
        <div>
          <p className="text-xs tracking-[0.25em] text-[#4a5540] uppercase">
            Arena Physica
          </p>
        </div>

        {/* Middle - Main content */}
        <div className="flex flex-col gap-10">
          <div>
            <h1
              className="text-5xl leading-[1.1] tracking-tight text-[#1a1a1a] md:text-6xl lg:text-7xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Welcome to
              <br />
              <em className="font-normal">Ground Control</em>
            </h1>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-[#6b6860]">
              Foundational intelligence for modern hardware.
              <br />
              Authenticate to continue.
            </p>
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="group flex w-fit items-center gap-3 border border-[#4a5540] bg-[#4a5540] px-8 py-4 text-sm tracking-widest text-[#f4f1eb] uppercase transition-all duration-300 hover:bg-[#3a4530]"
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

        {/* Bottom - Footer */}
        <div className="flex items-end justify-between">
          <p className="text-[10px] tracking-widest text-[#a09e97] uppercase">
            Embedded Systems
          </p>
          <p className="text-[10px] text-[#a09e97]">
            &copy; 2026 Arena Physica
          </p>
        </div>
      </div>

      {/* Right panel - gradient/visual */}
      <div className="hidden md:block md:w-1/2 relative">
        {/* Layered gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />

        {/* Horizon glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 120% 60% at 50% 70%, rgba(180,160,130,0.4) 0%, transparent 70%)",
          }}
        />

        {/* Subtle planetary arc */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[60%]">
          <div
            className="h-[600px] w-[600px] rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, #6b7b6a 0%, #3a4a3a 40%, #1a2a1a 70%, transparent 100%)",
              boxShadow: "0 -40px 120px rgba(140,160,180,0.3)",
            }}
          />
        </div>

        {/* Light flare */}
        <div
          className="absolute top-[30%] left-1/2 -translate-x-1/2 h-64 w-64"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Circular wireframe element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <svg
            viewBox="0 0 300 300"
            className="h-72 w-72 animate-[spin_30s_linear_infinite] opacity-20"
          >
            <circle cx="150" cy="150" r="120" fill="none" stroke="white" strokeWidth="0.5" />
            <circle cx="150" cy="150" r="90" fill="none" stroke="white" strokeWidth="0.5" />
            <circle cx="150" cy="150" r="60" fill="none" stroke="white" strokeWidth="0.5" />
            <ellipse cx="150" cy="150" rx="120" ry="50" fill="none" stroke="white" strokeWidth="0.5" />
            <ellipse cx="150" cy="150" rx="50" ry="120" fill="none" stroke="white" strokeWidth="0.5" />
            <line x1="30" y1="150" x2="270" y2="150" stroke="white" strokeWidth="0.3" />
            <line x1="150" y1="30" x2="150" y2="270" stroke="white" strokeWidth="0.3" />
          </svg>
        </div>
      </div>
    </div>
  );
}
