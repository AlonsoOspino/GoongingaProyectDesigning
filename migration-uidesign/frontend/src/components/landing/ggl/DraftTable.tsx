import Image from "next/image";
import { MediaPlaceholder, type MediaTone } from "./MediaPlaceholder";

type DraftStepProps = {
  number: string;
  title: string;
  copy: string;
  placeholder: string;
  tone: MediaTone;
  side: "left" | "right";
  imageSrc?: string;
};

function DraftStep({ number, title, copy, placeholder, tone, side, imageSrc }: DraftStepProps) {
  return (
    <li className={`ggl-draft__step ggl-draft__step--${number} ggl-draft__step--media-${side}`}>
      <span className="ggl-draft__number" aria-hidden="true">
        {number}
      </span>
      {imageSrc ? (
        <figure className="ggl-media ggl-draft__media ggl-draft__image">
          <Image
            src={imageSrc}
            alt={placeholder}
            fill
            sizes="(max-width: 640px) 100vw, 42vw"
          />
        </figure>
      ) : (
        <MediaPlaceholder label={placeholder} tone={tone} className="ggl-draft__media" />
      )}
      <div className="ggl-draft__copy">
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
    </li>
  );
}

export function DraftTable() {
  return (
    <section id="draft-table" className="ggl-draft" aria-labelledby="ggl-draft-title">
      <div className="ggl-shell">
        <header className="ggl-draft__heading">
          <div>
            <h2 id="ggl-draft-title">
              The match <em>flow</em>
            </h2>
          </div>
          <p className="ggl-draft__intro">
            The draft table moves through one shared sequence. Every confirmed choice becomes part
            of the match state, so the captain view, production view, and stream do not drift apart.
          </p>
        </header>

        <ol className="ggl-draft__flow">
          <DraftStep
            number="01"
            title="Control opens the match"
            copy="The first game is always Control. Both teams enter the match knowing the opening mode before any other map decision is made."
            placeholder="Control map"
            tone="dusty-blue"
            side="left"
            imageSrc="/control-imagen.png"
          />
          <DraftStep
            number="02"
            title="The captain chooses the next mode"
            copy="From the second game onward, the captain with first turn chooses Hybrid, Payload, or Push/Flashpoint. That decision defines the legal map list for the next action."
            placeholder="Future mode-selection interface"
            tone="warm-stone"
            side="right"
          />
          <DraftStep
            number="03"
            title="Map picking follows"
            copy="Once the mode is confirmed, the active captain has ninety seconds to select an eligible map. The timer keeps the draft and broadcast moving together."
            placeholder="Future map-selection capture"
            tone="sage"
            side="left"
          />
          <DraftStep
            number="04"
            title="Bans carry across the match"
            copy="Each captain confirms two bans for the map. Across both teams, no role can lose more than two heroes, and a team cannot ban the same hero twice during one match."
            placeholder="Future hero-ban interface"
            tone="muted-burgundy"
            side="right"
          />
        </ol>
      </div>
    </section>
  );
}
