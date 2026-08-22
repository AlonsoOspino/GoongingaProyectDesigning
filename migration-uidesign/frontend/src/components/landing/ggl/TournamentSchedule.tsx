import { MediaPlaceholder } from "./MediaPlaceholder";

export function TournamentSchedule() {
  return (
    <section id="tournament-schedule" className="ggl-schedule" aria-labelledby="ggl-schedule-title">
      <div className="ggl-shell ggl-schedule__layout">
        <header className="ggl-schedule__heading">
          <h2 id="ggl-schedule-title">
            <em>Tournament</em>
            <span>Schedule</span>
          </h2>
        </header>

        <p className="ggl-schedule__copy">
          Every team meets the rest of the field during the regular season. The standings then
          seed an elimination bracket, where each result narrows the field until two teams remain
          for the Grand Finals.
        </p>

        <MediaPlaceholder
          label="Future schedule or bracket artwork"
          tone="muted-burgundy"
          className="ggl-schedule__media"
        />
      </div>
    </section>
  );
}
