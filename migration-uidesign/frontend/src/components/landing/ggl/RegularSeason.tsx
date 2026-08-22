import { MediaPlaceholder } from "./MediaPlaceholder";

export function RegularSeason() {
  return (
    <section id="regular-season" className="ggl-season" aria-labelledby="ggl-season-title">
      <div className="ggl-shell ggl-season__layout">
        <header className="ggl-season__heading">
          <h2 id="ggl-season-title">
            <span>Regular</span>
            <em>Season</em>
          </h2>
          <p>
            The tournament runs across several weeks instead of being compressed into one
            weekend. That pace gives every roster time to prepare, play, review the result, and
            return for the next opponent.
          </p>
        </header>

        <MediaPlaceholder
          label="Future regular-season gameplay still"
          tone="warm-stone"
          className="ggl-season__media"
        />

        <div className="ggl-season__copy">
          <p>
            The opening phase uses a round-robin schedule, normally with one match per team each
            week, until every roster has faced the others. Those results create the standings and
            determine playoff placement.
          </p>
          <p>
            Playoffs turn those standings into an elimination bracket. Higher seeds may act first
            during map selection and bans, but those benefits never change the rules inside the
            game. The season closes with the Grand Finals, and the winner receives the revenue
            collected from that season&apos;s broadcasts.
          </p>
        </div>
      </div>
    </section>
  );
}
