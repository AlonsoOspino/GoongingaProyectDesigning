"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/session/SessionProvider";
import {
  adminDeleteHero,
  adminDeleteMap,
  adminCreateHero,
  adminCreateMap,
  getHeroes,
  getMaps,
  type AdminGameMap,
  type AdminHero,
} from "@/lib/api/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { resolveHeroImageUrl, resolveMapImageUrl } from "@/lib/assetUrls";

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
  const [maps, setMaps] = useState<AdminGameMap[]>([]);
  const [heroes, setHeroes] = useState<AdminHero[]>([]);
  const [deletingMapId, setDeletingMapId] = useState<number | null>(null);
  const [deletingHeroId, setDeletingHeroId] = useState<number | null>(null);

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

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || user?.role !== "ADMIN") {
      return;
    }

    let cancelled = false;

    async function loadContent() {
      try {
        const [nextMaps, nextHeroes] = await Promise.all([getMaps(), getHeroes()]);
        if (!cancelled) {
          setMaps(nextMaps);
          setHeroes(nextHeroes);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load Overwatch content.";
          showNotif("error", message);
        }
      }
    }

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, isAuthenticated, user]);

  const showNotif = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  async function uploadContentImage(file: File, type: "map" | "hero") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Upload failed");
    }

    if (!payload?.url) {
      throw new Error("Upload did not return a URL.");
    }

    return String(payload.url);
  }

  async function deleteUploadedContentImage(imgPath?: string | null) {
    if (!imgPath || !/^https?:\/\//i.test(imgPath)) {
      return;
    }

    const response = await fetch("/api/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imgPath }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Failed to delete uploaded image.");
    }
  }

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
      const imageUrl = await uploadContentImage(mapForm.image, "map");
      const createdMap = await adminCreateMap(token, {
        name: trimmedName,
        type: mapForm.type,
        imageUrl,
      });
      setMaps((prev) => [createdMap, ...prev]);

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
      const imageUrl = await uploadContentImage(heroForm.image, "hero");
      const createdHero = await adminCreateHero(token, {
        name: trimmedName,
        role: heroForm.role,
        imageUrl,
      });
      setHeroes((prev) => [createdHero, ...prev]);

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

  async function handleDeleteMap(map: AdminGameMap) {
    if (!token) return;
    if (!confirm(`Delete map "${map.description}"?`)) return;

    setDeletingMapId(map.id);
    try {
      const deleted = await adminDeleteMap(token, map.id);
      await deleteUploadedContentImage(deleted.imgPath);
      setMaps((prev) => prev.filter((item) => item.id !== map.id));
      showNotif("success", `Map "${map.description}" deleted.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete map.";
      showNotif("error", message);
    } finally {
      setDeletingMapId(null);
    }
  }

  async function handleDeleteHero(hero: AdminHero) {
    if (!token) return;
    if (!confirm(`Delete hero "${hero.name}"?`)) return;

    setDeletingHeroId(hero.id);
    try {
      const deleted = await adminDeleteHero(token, hero.id);
      await deleteUploadedContentImage(deleted.imgPath);
      setHeroes((prev) => prev.filter((item) => item.id !== hero.id));
      showNotif("success", `Hero "${hero.name}" deleted.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete hero.";
      showNotif("error", message);
    } finally {
      setDeletingHeroId(null);
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Maps ({maps.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {maps.length === 0 ? (
                <p className="text-sm text-muted">No maps created yet.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {maps.map((map) => (
                    <div key={map.id} className="rounded-lg border border-border bg-surface overflow-hidden">
                      <div className="aspect-[16/9] bg-background/60">
                        {map.imgPath ? (
                          <img
                            src={resolveMapImageUrl(map.imgPath)}
                            alt={map.description}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <div>
                          <p className="font-medium text-foreground">{map.description}</p>
                          <p className="text-xs text-muted">{map.type}</p>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteMap(map)}
                          disabled={deletingMapId === map.id}
                        >
                          {deletingMapId === map.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Heroes ({heroes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {heroes.length === 0 ? (
                <p className="text-sm text-muted">No heroes created yet.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {heroes.map((hero) => (
                    <div key={hero.id} className="rounded-lg border border-border bg-surface overflow-hidden">
                      <div className="aspect-[16/9] bg-background/60">
                        {hero.imgPath ? (
                          <img
                            src={resolveHeroImageUrl(hero.imgPath)}
                            alt={hero.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <div>
                          <p className="font-medium text-foreground">{hero.name}</p>
                          <p className="text-xs text-muted">{hero.role}</p>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteHero(hero)}
                          disabled={deletingHeroId === hero.id}
                        >
                          {deletingHeroId === hero.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
