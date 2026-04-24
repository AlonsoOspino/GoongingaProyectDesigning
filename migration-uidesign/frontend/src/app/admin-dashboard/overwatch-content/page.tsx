"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/session/SessionProvider";
import {
  adminCreateHero,
  adminCreateMap,
  type AdminGameMap,
  type AdminHero,
} from "@/lib/api/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type NotificationState = {
  type: "success" | "error";
  message: string;
} | null;

const MAP_TYPE_OPTIONS: Array<{ value: AdminGameMap["type"]; label: string }> = [
  { value: "CONTROL", label: "Control" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "PAYLOAD", label: "Payload" },
  { value: "PUSH", label: "Push" },
  { value: "FLASHPOINT", label: "Flashpoint" },
];

const HERO_ROLE_OPTIONS: Array<{ value: AdminHero["role"]; label: string }> = [
  { value: "TANK", label: "Tank" },
  { value: "DPS", label: "DPS" },
  { value: "SUPPORT", label: "Support" },
];

export default function AddOverwatchContentPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated } = useSession();

  const mapFileInputRef = useRef<HTMLInputElement>(null);
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<NotificationState>(null);
  const [mapSubmitting, setMapSubmitting] = useState(false);
  const [heroSubmitting, setHeroSubmitting] = useState(false);

  const [mapForm, setMapForm] = useState({
    name: "",
    type: "CONTROL" as AdminGameMap["type"],
    image: null as File | null,
  });

  const [heroForm, setHeroForm] = useState({
    name: "",
    role: "TANK" as AdminHero["role"],
    image: null as File | null,
  });

  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "ADMIN")) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  const showNotif = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  async function handleCreateMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const trimmedName = mapForm.name.trim();
    if (!trimmedName) {
      showNotif("error", "Map name is required.");
      return;
    }

    if (!mapForm.image) {
      showNotif("error", "Map image is required.");
      return;
    }

    setMapSubmitting(true);
    try {
      await adminCreateMap(token, {
        name: trimmedName,
        type: mapForm.type,
        image: mapForm.image,
      });

      setMapForm({
        name: "",
        type: "CONTROL",
        image: null,
      });
      if (mapFileInputRef.current) {
        mapFileInputRef.current.value = "";
      }
      showNotif("success", `Map \"${trimmedName}\" created successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create map.";
      showNotif("error", message);
    } finally {
      setMapSubmitting(false);
    }
  }

  async function handleCreateHero(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const trimmedName = heroForm.name.trim();
    if (!trimmedName) {
      showNotif("error", "Hero name is required.");
      return;
    }

    if (!heroForm.image) {
      showNotif("error", "Hero image is required.");
      return;
    }

    setHeroSubmitting(true);
    try {
      await adminCreateHero(token, {
        name: trimmedName,
        role: heroForm.role,
        image: heroForm.image,
      });

      setHeroForm({
        name: "",
        role: "TANK",
        image: null,
      });
      if (heroFileInputRef.current) {
        heroFileInputRef.current.value = "";
      }
      showNotif("success", `Hero \"${trimmedName}\" created successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create hero.";
      showNotif("error", message);
    } finally {
      setHeroSubmitting(false);
    }
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "ADMIN") {
    return null;
  }

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Add Overwatch content</h1>
            <p className="text-muted mt-1">Create new maps and heroes with their images.</p>
          </div>
          <Button variant="ghost" onClick={() => router.push("/admin-dashboard")}>
            Back to Admin Dashboard
          </Button>
        </div>

        {notification && (
          <div
            className={`mb-6 rounded-lg px-4 py-3 border ${
              notification.type === "success"
                ? "bg-success/10 text-success border-success/30"
                : "bg-danger/10 text-danger border-danger/30"
            }`}
          >
            {notification.message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Add Map</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateMap} className="space-y-4">
                <Input
                  label="Map name"
                  placeholder="Example: Midtown"
                  value={mapForm.name}
                  onChange={(e) => setMapForm((prev) => ({ ...prev, name: e.target.value }))}
                />

                <Select
                  label="Map type"
                  value={mapForm.type}
                  onChange={(e) =>
                    setMapForm((prev) => ({
                      ...prev,
                      type: e.target.value as AdminGameMap["type"],
                    }))
                  }
                  options={MAP_TYPE_OPTIONS}
                />

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Map image
                  </label>
                  <input
                    ref={mapFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setMapForm((prev) => ({
                        ...prev,
                        image: e.target.files?.[0] || null,
                      }))
                    }
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-foreground file:mr-3 file:px-3 file:py-1 file:border-0 file:rounded file:bg-primary file:text-primary-foreground"
                  />
                  {mapForm.image && (
                    <p className="mt-2 text-xs text-muted">Selected: {mapForm.image.name}</p>
                  )}
                </div>

                <Button type="submit" disabled={mapSubmitting}>
                  {mapSubmitting ? "Creating map..." : "Create map"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Add Hero</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateHero} className="space-y-4">
                <Input
                  label="Hero name"
                  placeholder="Example: Tracer"
                  value={heroForm.name}
                  onChange={(e) => setHeroForm((prev) => ({ ...prev, name: e.target.value }))}
                />

                <Select
                  label="Hero role"
                  value={heroForm.role}
                  onChange={(e) =>
                    setHeroForm((prev) => ({
                      ...prev,
                      role: e.target.value as AdminHero["role"],
                    }))
                  }
                  options={HERO_ROLE_OPTIONS}
                />

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Hero image
                  </label>
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setHeroForm((prev) => ({
                        ...prev,
                        image: e.target.files?.[0] || null,
                      }))
                    }
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-md text-foreground file:mr-3 file:px-3 file:py-1 file:border-0 file:rounded file:bg-primary file:text-primary-foreground"
                  />
                  {heroForm.image && (
                    <p className="mt-2 text-xs text-muted">Selected: {heroForm.image.name}</p>
                  )}
                </div>

                <Button type="submit" disabled={heroSubmitting}>
                  {heroSubmitting ? "Creating hero..." : "Create hero"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
