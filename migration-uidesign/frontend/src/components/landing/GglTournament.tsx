import { Broadcast } from "./ggl/Broadcast";
import { DraftTable } from "./ggl/DraftTable";
import { GglTournamentOverview } from "./ggl/GglTournamentOverview";
import { MapPool } from "./ggl/MapPool";
import { RegularSeason } from "./ggl/RegularSeason";
import { TeamBuilding } from "./ggl/TeamBuilding";
import { TournamentSchedule } from "./ggl/TournamentSchedule";

export function GglTournament() {
  return (
    /*
      FORM: a framed Map Pool scene followed by a static, alternating draft axis.
      DESIGN SEED: ggl-editorial-107.
    */
    <div className="ggl-production" data-design-seed="ggl-editorial-107">
      <GglTournamentOverview />
      <RegularSeason />
      <TeamBuilding />
      <TournamentSchedule />
      <MapPool />
      <DraftTable />
      <Broadcast />
    </div>
  );
}
