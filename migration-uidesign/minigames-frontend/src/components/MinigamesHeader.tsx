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
  const developer = hasNetworkRole(user, "DEVELOPER", "ADMIN");
  const socialMedia = hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN");
  const networkOrigin = (process.env.NEXT_PUBLIC_GOONGINGA_URL || "http://localhost:3000").replace(/\/$/, "");
  const signInHref = `${networkOrigin}/minigames?next=${encodeURIComponent(pathname || "/feud")}`;

  return <header className="topbar">
    <Link className="brand" href="/"><img className="brand-mark" src="/winton.jpg" alt="" /> <span><strong>Goonginga</strong> Game Nights</span></Link>
    <nav className="topnav" aria-label="Minigames navigation">
      <Link href="/">Home</Link>
      <Link href="/feud">Family Feud</Link>
      {socialMedia ? <Link href="/admin/feud/games">Manage Feud</Link> : null}
      {developer ? <Link href="/developer">Developer</Link> : null}
    </nav>
    <div className="account">
      <a className="network-return" href={networkOrigin}>Back to Goonginga</a>
      {user ? <><ProfileAvatar name={user.username} url={user.avatarUrl} /><span className="account-name">{user.nickname || user.username}</span><button className="network-switch" type="button" onClick={() => { clearNetworkSession(); router.push("/login"); }}>Switch account</button></> : <a className="signin" href={signInHref}>Sign in</a>}
    </div>
  </header>;
}
