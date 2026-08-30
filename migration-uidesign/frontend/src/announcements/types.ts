// MINIGAME stays in the union: minigames moved to their own site, but rows
// published before the split are still stored and served.
export type AnnouncementType = "TOURNAMENT" | "MINIGAME" | "CUSTOM" | "FORM";

export type TournamentContent = { matchId: number | null; headline: string };
export type CustomContent = { eyebrow: string; headline: string; body: string; imageUrl: string; ctaLabel: string; ctaHref: string };
export type FormContent = { headline: string; body: string; formUrl: string; ctaLabel: string };
export type AnnouncementContent = TournamentContent | CustomContent | FormContent;

export type Announcement = {
  id: number;
  name: string;
  type: AnnouncementType;
  content: AnnouncementContent;
  countdownAt: string | null;
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementTeam = { id: number; name: string; logo: string | null };
export type AnnouncementMatch = {
  id: number; title: string | null; type: string; bestOf: number;
  status: "SCHEDULED" | "ACTIVE" | "FINISHED";
  startDate: string | null; mapWinsTeamA: number; mapWinsTeamB: number; gameNumber: number;
  teamA: AnnouncementTeam; teamB: AnnouncementTeam;
};

export type TournamentPayload = { state: "LIVE" | "UPCOMING" | "RESULT" | "IDLE"; match: AnnouncementMatch | null };
export type AnnouncementPayload = TournamentPayload | null;
export type ActiveAnnouncementEntry = Pick<Announcement, "id" | "name" | "type" | "content" | "countdownAt" | "order"> & { payload: AnnouncementPayload };
export type ActiveAnnouncements = { enabled: boolean; announcements: ActiveAnnouncementEntry[] };
export type AnnouncementSettings = { enabled: boolean; updatedAt: string };
