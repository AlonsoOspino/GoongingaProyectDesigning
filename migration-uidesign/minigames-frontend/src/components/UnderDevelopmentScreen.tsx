"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

type DeveloperProfile = {
  username: string;
  avatarUrl: string | null;
} | null;

type UnderDevelopmentScreenProps = {
  title: string;
  developer: DeveloperProfile;
  coverImageUrl?: string | null;
  backHref?: string;
};

function DeveloperAvatar({ developer }: { developer: Exclude<DeveloperProfile, null> }) {
  return developer.avatarUrl
    ? <img className="construction-avatar" src={developer.avatarUrl} alt={`${developer.username}'s profile`} />
    : <span className="construction-avatar construction-avatar-fallback" aria-hidden="true">{developer.username.slice(0, 2).toUpperCase()}</span>;
}

export function UnderDevelopmentScreen({ title, developer, coverImageUrl, backHref = "/" }: UnderDevelopmentScreenProps) {
  const background = coverImageUrl
    ? { "--construction-cover": `url("${coverImageUrl}")` } as CSSProperties
    : undefined;

  return <section className="under-construction" style={background}>
    <span className="construction-spark construction-spark-one" aria-hidden="true" />
    <span className="construction-spark construction-spark-two" aria-hidden="true" />
    <span className="construction-spark construction-spark-three" aria-hidden="true" />
    <article className="build-card">
      <p className="eyebrow">Goonginga Game Nights - work in progress</p>
      <p className="construction-label">{title}</p>
      <h1 className="font-display">Still building it!</h1>
      <p className="construction-copy">This game is still in the workshop. New rounds, surprises, and live-show polish are on the way.</p>

      <div className="developer-speech" aria-label={developer ? `${developer.username} is still building this game` : "This game is still being built"}>
        {developer ? <DeveloperAvatar developer={developer} /> : <span className="construction-avatar construction-avatar-fallback" aria-hidden="true">GG</span>}
        <div>
          <span className="developer-speech-kicker">{developer ? `Message from ${developer.username}` : "Message from the workshop"}</span>
          <strong>"Still building it!"</strong>
          <span>{developer ? "I'm making this one worth the wait." : "We're making this one worth the wait."}</span>
        </div>
      </div>

      <Link className="secondary-button construction-back" href={backHref}>Back to Game Nights</Link>
    </article>
  </section>;
}
