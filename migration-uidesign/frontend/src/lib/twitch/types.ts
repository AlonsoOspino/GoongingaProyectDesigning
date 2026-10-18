export interface TwitchClip {
  id: string;
  title: string;
  views: number;
  duration: number;
  thumbnail: string;
}

export interface TwitchClipResponse {
  clips: TwitchClip[];
  stale?: boolean;
}
