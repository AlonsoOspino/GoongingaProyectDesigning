/* Constantes e iconos de marca compartidos.
 *
 * Vivían dentro de LandingPage como privados del módulo. Ahora que el header es
 * el mismo en todo el sitio hacen falta en dos sitios, y duplicarlos garantizaba
 * que acabaran divergiendo.
 */

export const DISCORD_INVITE = "https://discord.gg/QMukTWr32f";
export const TWITCH_URL = "https://www.twitch.tv/goongingatournament";

export function DiscordIcon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.1 4.2 8.7 5c-2 .4-3.6 1.1-4.3 1.6C3 9.2 2.2 12.6 2.5 16.6c1.4 1.6 3.5 2.6 5.6 3l.9-1.6c-.8-.3-1.5-.6-2.1-1 .1 0 3.1 1.4 5.1 1.4s5-1.4 5.1-1.4c-.6.4-1.3.7-2.1 1l.9 1.6c2.1-.4 4.2-1.4 5.6-3 .3-4-.5-7.4-1.9-10-.7-.5-2.3-1.2-4.3-1.6l-.4-.8c-1.6-.3-3.2-.3-4.7 0ZM9 14c-.8 0-1.5-.8-1.5-1.8S8.2 10.4 9 10.4s1.5.8 1.5 1.8S9.8 14 9 14Zm6 0c-.8 0-1.5-.8-1.5-1.8s.7-1.8 1.5-1.8 1.5.8 1.5 1.8S15.8 14 15 14Z"
      />
    </svg>
  );
}

export function TwitchIcon({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4.6 2h15.1v11.6l-4.6 4.6h-3.4l-3 3H7.3v-3H4.6V2Zm4.9 4.1v6h1.9v-6H9.5Zm5 0v6h1.9v-6h-1.9Z" />
    </svg>
  );
}

export function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M13.2 4.8 11.8 6.2l4.8 4.8H3v2h13.6l-4.8 4.8 1.4 1.4L20.4 12l-7.2-7.2Z" />
    </svg>
  );
}

export function CaretIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true">
      <path d="M12 15.4 6.6 10l1.4-1.4 4 4 4-4L17.4 10 12 15.4Z" />
    </svg>
  );
}
