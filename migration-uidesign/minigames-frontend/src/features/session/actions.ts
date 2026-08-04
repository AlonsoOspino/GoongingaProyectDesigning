"use client";

import { login } from "@/lib/api/auth";
import type { LoginResponse } from "@/lib/api/types";
import type { SessionContextValue } from "@/features/session/types";

export async function loginAndPersist(
  session: Pick<SessionContextValue, "setSession">,
  credentials: { user: string; password: string }
): Promise<LoginResponse> {
  const result = await login(credentials.user, credentials.password);
  session.setSession(result.token, result.user);
  return result;
}

export function logoutAndClear(session: Pick<SessionContextValue, "clearSession">) {
  session.clearSession();
}
