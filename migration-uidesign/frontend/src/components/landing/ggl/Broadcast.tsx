import { MediaPlaceholder } from "./MediaPlaceholder";

export function Broadcast() {
  return (
    <section id="broadcast" className="ggl-stream" aria-labelledby="ggl-broadcast-title">
      <div className="ggl-shell ggl-broadcast__layout">
        <MediaPlaceholder
          label="Future live broadcast capture"
          tone="dusty-blue"
          className="ggl-broadcast__media"
        />

        <h2 id="ggl-broadcast-title" className="ggl-broadcast__title">
          <span>Broadcast</span>
          <em>follows the match</em>
        </h2>

        <div className="ggl-broadcast__copy">
          <p>
            The captain view and broadcast view read the same match state. When a captain confirms
            a mode, map, or hero ban, production receives that decision without rebuilding it in a
            separate graphic.
          </p>
          <p>
            OBS-ready views can carry the score, rosters, map pool, and confirmed draft state.
            Captains see the action they made, production sees the same information, and the
            audience does not wait for someone to retype it between maps.
          </p>
        </div>
      </div>
    </section>
  );
}
