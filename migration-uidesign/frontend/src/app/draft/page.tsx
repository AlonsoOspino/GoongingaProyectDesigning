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
    <main className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Draft Hub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted">
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
