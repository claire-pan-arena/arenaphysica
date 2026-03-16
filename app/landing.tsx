export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Subtle radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)",
        }}
      />

      {/* Wireframe sphere */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg
          viewBox="0 0 400 400"
          className="h-[500px] w-[500px] animate-[spin_30s_linear_infinite] opacity-10 md:h-[700px] md:w-[700px]"
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

      {/* Branding */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <h1
          className="text-5xl tracking-tight text-white md:text-7xl lg:text-8xl"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Arena Physica
        </h1>
        <p className="text-sm tracking-[0.3em] text-white/30 uppercase">
          Foundational intelligence for modern hardware
        </p>
      </div>
    </div>
  );
}
