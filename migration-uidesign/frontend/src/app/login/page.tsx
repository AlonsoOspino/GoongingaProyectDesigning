"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import { login } from "@/lib/api/auth";
import { getDiscordLoginUrl } from "@/lib/api/networkMember";
import { saveNetworkToken } from "@/features/networkSession/storage";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [networkMessage, setNetworkMessage] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const requestedNextPath = searchParams.get("next") || "/";
  const nextPath = requestedNextPath.startsWith("/") && !requestedNextPath.startsWith("//") ? requestedNextPath : "/";

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = new URLSearchParams(url.hash.slice(1)).get("network_token");
    const discordError = url.searchParams.get("discord_error");

    if (token) {
      const networkUser = saveNetworkToken(token);
      url.hash = "";
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      setNetworkMessage(
        networkUser
          ? `Discord connected as ${networkUser.username}. Welcome to the Goonginga network!`
          : "Discord connected. Welcome to the Goonginga network!",
      );
      if (networkUser) {
        router.replace(nextPath);
        return;
      }
    }

    if (discordError) {
      url.searchParams.delete("discord_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      setNetworkError(discordError);
    }
  }, [nextPath, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await login(username, password);
      setSession(response.token, response.user);
      router.push(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const startDiscordLogin = () => {
    window.location.assign(getDiscordLoginUrl());
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 relative">
      {/* Decorative background */}
      <div className="fixed inset-0 bg-grid-pattern-subtle pointer-events-none opacity-50" />
      <div className="fixed top-1/4 left-1/4 w-80 h-80 bg-primary/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center glow-teal transition-all group-hover:scale-105">
              <span className="font-bold text-primary-foreground text-xl">GL</span>
            </div>
          </Link>
        </div>

        <Card variant="featured">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <p className="text-muted text-sm mt-1">Sign in to your account</p>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                  {error}
                </div>
              )}

              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoComplete="username"
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                isLoading={loading}
                disabled={!username || !password}
              >
                Sign In
              </Button>

              <p className="text-sm text-center text-muted">
                GGL season accounts keep using this login.
              </p>
            </CardFooter>
          </form>

          <section className="relative border-t border-primary/30 bg-primary/5 px-4 py-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <p className="text-xs font-bold tracking-[0.18em] text-primary text-center">GOONGINGA NETWORK</p>
            <h2 className="mt-2 text-center text-xl font-bold text-foreground">WE ARE MOVING TO DISCORD!</h2>
            <p className="mt-2 text-center text-sm leading-6 text-muted">
              Register or log in in one step with Discord. You must be a member of the GGL server.
            </p>

            {networkMessage && (
              <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-center text-sm text-success">
                {networkMessage}
              </div>
            )}
            {networkError && (
              <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-center text-sm text-danger">
                {networkError}
              </div>
            )}

            <Button type="button" className="mt-4 w-full bg-[#5865F2] hover:bg-[#4752C4]" onClick={startDiscordLogin}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.32 4.37A19.8 19.8 0 0015.45 3c-.21.37-.45.87-.62 1.26a18.2 18.2 0 00-5.66 0A12.6 12.6 0 008.54 3 19.73 19.73 0 003.67 4.38C.58 9.04-.26 13.59.16 18.08A19.9 19.9 0 006.13 21c.48-.65.9-1.34 1.27-2.06a12.5 12.5 0 01-2-.96c.17-.12.33-.25.49-.38 3.87 1.8 8.08 1.8 11.9 0 .16.13.32.26.49.38-.64.38-1.31.7-2 .96.37.72.8 1.41 1.27 2.06a19.83 19.83 0 005.97-2.92c.5-5.2-.85-9.7-3.2-13.7zM8.02 15.35c-1.16 0-2.11-1.07-2.11-2.39s.93-2.39 2.11-2.39c1.19 0 2.13 1.07 2.11 2.39 0 1.32-.93 2.39-2.11 2.39zm7.96 0c-1.16 0-2.11-1.07-2.11-2.39s.93-2.39 2.11-2.39c1.19 0 2.13 1.07 2.11 2.39 0 1.32-.92 2.39-2.11 2.39z" />
              </svg>
              Register / Log in with Discord
            </Button>

            <p className="mt-3 text-center text-xs text-muted">
              Not in GGL yet?{" "}
              <Link href="https://discord.gg/QMukTWr32f" className="text-primary hover:underline">
                Join the Discord server
              </Link>
            </p>
          </section>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
