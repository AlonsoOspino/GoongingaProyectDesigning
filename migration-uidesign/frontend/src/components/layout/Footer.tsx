import Image from "next/image";

const projectImage = "/landing/realtime.webp";

const socialLinks = [
  { label: "TikTok", icon: "tiktok", href: "https://www.tiktok.com/@goongingatournament" },
  { label: "YouTube", icon: "youtube", href: "https://www.youtube.com/@goongingatournament" },
  { label: "Instagram", icon: "instagram", href: "https://www.instagram.com/goongingatournament/" },
  { label: "Discord", icon: "discord", href: "https://discord.gg/QMukTWr32f" },
  { label: "Twitch", icon: "twitch", href: "https://www.twitch.tv/goongingatournament", featured: true },
];

export function Footer() {
  return (
    <footer className="otp-footer">
      <div className="landing-shell otp-footer-feature">
        <div className="otp-footer-feature-copy">
          <h2>Watch GGL live on Twitch.</h2>
          <p>
            Live matches, draft decisions, and Finals are carried on the same channel whenever a
            season is running.
          </p>
          <a
            href="https://www.twitch.tv/goongingatournament"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the Twitch channel
          </a>
        </div>
        <figure>
          <Image
            src={projectImage}
            alt=""
            fill
            sizes="(max-width: 800px) 100vw, 44vw"
          />
        </figure>
      </div>

      <div className="landing-shell otp-footer-bottom">
        <div className="otp-footer-brand">
          <span className="otp-footer-brand-image">
            <Image src={projectImage} alt="" fill sizes="36px" />
          </span>
          <div>
            <strong>Overtime Productions</strong>
            <span>Community events and live production</span>
          </div>
        </div>

        <nav className="otp-social-links" aria-label="Overtime Productions social channels">
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={social.featured ? "otp-social-featured" : ""}
            >
              <span
                className={`otp-social-icon otp-social-icon--${social.icon}`}
                aria-hidden="true"
              />
              <span>{social.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
