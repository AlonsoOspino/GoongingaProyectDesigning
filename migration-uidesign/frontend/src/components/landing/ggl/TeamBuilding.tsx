import { MediaPlaceholder } from "./MediaPlaceholder";

export function TeamBuilding() {
  return (
    <section id="team-building" className="ggl-team" aria-labelledby="ggl-team-title">
      <div className="ggl-shell ggl-team__layout">
        <header className="ggl-team__heading">
          <h2 id="ggl-team-title">
            Team <em>Building</em>
          </h2>
        </header>

        <MediaPlaceholder
          label="Future transparent player PNG"
          tone="sage"
          className="ggl-team__media"
        />

        <p className="ggl-team__copy">
          Captains choose from the players registered for the season. Before the draft, the
          administrative team reviews ranks and the available player pool so every roster can
          finish near the same average level. Captains still make the decisions; the structure
          prevents one obviously uneven roster from deciding the season before it begins.
        </p>
      </div>
    </section>
  );
}
