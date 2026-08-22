import { MediaPlaceholder } from "./MediaPlaceholder";

export function GglTournamentOverview() {
  return (
    <section id="ggl" className="ggl-overview" aria-labelledby="ggl-overview-title">
      <div className="ggl-shell ggl-overview__layout">
        <header className="ggl-overview__heading">
          <h2 id="ggl-overview-title">
            <span>GGL</span>
            <em>Tournament</em>
          </h2>
        </header>

        <MediaPlaceholder
          label="Future tournament artwork"
          tone="dusty-blue"
          className="ggl-overview__media"
        />

        <p className="ggl-overview__copy">
          GGL is Overtime Productions&apos; multi-week Overwatch league. Each season moves from
          roster construction into round-robin play, playoffs, and a final, while one shared
          match state connects captains with the broadcast team.
        </p>
      </div>
    </section>
  );
}
