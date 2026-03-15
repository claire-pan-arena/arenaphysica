"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/kb", label: "Knowledge Base" },
  { href: "/tools", label: "Tools Library" },
  { href: "/crm", label: "CRM" },
];

export default function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4">
      <Link href="/" className="text-xs tracking-[0.3em] text-white/80 uppercase font-medium hover:text-white transition-colors">
        Arena Physica
      </Link>
      <nav className="flex items-center gap-6">
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
      <button
        onClick={() => signOut()}
        className="text-[10px] tracking-widest text-white/60 uppercase hover:text-white transition-colors"
      >
        Sign out
      </button>
    </header>
  );
}
