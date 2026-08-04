"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasNetworkRole, useNetworkSession } from "@/lib/networkSession";

function ProfileAvatar({ name, url }: { name: string; url: string | null }) {
  return url ? <img className="avatar" src={url} alt="" /> : <span className="avatar avatar-fallback">{name.slice(0, 2).toUpperCase()}</span>;
}

export function MinigamesHeader() {
  const pathname = usePathname();
  const { user } = useNetworkSession();
  if (pathname?.endsWith("/stream")) return null;
  const social = hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN");
  const developer = hasNetworkRole(user, "DEVELOPER", "ADMIN");

  return <header className="topbar">
    <Link className="brand" href="/"><img className="brand-mark" src="/winton.jpg" alt="Winton" /> Goonginga <span>Game Nights</span></Link>
    <nav className="topnav" aria-label="Minigames navigation">
      <Link href="/">Games</Link>
      {social ? <Link href="/social-media">Social Media</Link> : null}
      {developer ? <Link href="/developer">Developer</Link> : null}
    </nav>
    <div className="account">
      {user ? <><ProfileAvatar name={user.username} url={user.avatarUrl} /><span className="account-name">{user.username}</span></> : <Link className="signin" href="/login">Sign in with Discord</Link>}
    </div>
  </header>;
}
