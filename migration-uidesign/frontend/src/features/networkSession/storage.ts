const STORAGE_KEY = "goonginga.network.session";

export function saveNetworkToken(token: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // A user can still finish Discord sign-in in privacy-restricted browsers;
    // protected network features will ask them to sign in again when needed.
  }
}
