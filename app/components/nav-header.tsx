"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/kb", label: "Knowledge Base" },
  { href: "/tools", label: "Tools Library" },
];

export default function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 px-8 py-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs tracking-[0.3em] text-white/80 uppercase font-medium hover:text-white transition-colors">
          Arena Physica
        </Link>
        <button
          onClick={() => signOut()}
          className="text-[10px] tracking-widest text-white/60 uppercase hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
      <nav className="flex items-center justify-center gap-6 mt-3">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-[10px] tracking-widest uppercase transition-colors ${
              pathname === link.href
                ? "text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
