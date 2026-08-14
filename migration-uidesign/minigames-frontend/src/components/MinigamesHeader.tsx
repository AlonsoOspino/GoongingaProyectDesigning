"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearNetworkSession, hasNetworkRole, useNetworkSession } from "@/lib/networkSession";

function ProfileAvatar({ name, url }: { name: string; url: string | null }) {
  return url ? <img className="avatar" src={url} alt="" /> : <span className="avatar avatar-fallback">{name.slice(0, 2).toUpperCase()}</span>;
}

export function MinigamesHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useNetworkSession();
  if (pathname?.endsWith("/stream") || pathname?.startsWith("/feud/spectator/")) return null;
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
      {user ? <><ProfileAvatar name={user.username} url={user.avatarUrl} /><span className="account-name">{user.username}</span><button className="network-switch" type="button" onClick={() => { clearNetworkSession(); router.push("/login"); }}>Re-login</button></> : <Link className="signin" href="/login">Sign in with Discord</Link>}
    </div>
  </header>;
}
