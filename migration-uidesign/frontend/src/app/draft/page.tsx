"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/features/session/SessionProvider";

export default function DraftPage() {
  const { isHydrated, isAuthenticated, user } = useSession();

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background py-12 px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-20 left-[5%] w-64 h-64 rounded-full bg-primary/5 blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-20 right-[5%] w-48 h-48 rounded-full bg-accent/5 blur-3xl animate-float pointer-events-none" style={{ animationDelay: "2s" }} />
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
      
      <div className="max-w-3xl mx-auto relative">
        {/* Header with decoration */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Draft Hub</h1>
            <p className="text-sm text-muted">Manage your competitive draft picks</p>
          </div>
        </div>
        
        <Card className="gradient-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <p className="text-muted leading-relaxed">
              Draft tables are created per match. Open a match from the manager or captain dashboard, then enter the draft table from there.
            </p>

            {!isAuthenticated ? (
              <div className="space-y-3">
                <p className="text-sm text-danger">You need to log in before joining a draft table.</p>
                <Link href="/login">
                  <Button>Go to Login</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  Signed in as {user?.username ?? "user"}. Choose your dashboard:
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/captain-dashboard">
                    <Button variant="secondary">Captain Dashboard</Button>
                  </Link>
                  <Link href="/manager-dashboard">
                    <Button>Manager Dashboard</Button>
                  </Link>
                  <Link href="/schedule">
                    <Button variant="ghost">View Schedule</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
