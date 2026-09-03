"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  getCurrentNetworkMember,
  getNetworkMembersForAdmin,
  updateNetworkMemberRoles,
} from "@/lib/api/networkMember";
import type { NetworkMember, NetworkMemberRole } from "@/lib/api/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";

const editableRoles: NetworkMemberRole[] = [
  "ADMIN", "CASTER", "DEVELOPER", "SEASON_PLAYER", "MODERATOR",
  "COMMUNITY_MANAGER", "CONTENT_CREATOR", "SOCIAL_MEDIA",
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [members, setMembers] = useState<NetworkMember[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadMembers = useCallback(async (sessionToken: string) => {
    const rows = await getNetworkMembersForAdmin(sessionToken);
    setMembers(rows);
  }, []);

  useEffect(() => {
    const sessionToken = readNetworkSessionToken();
    if (!sessionToken) { router.replace("/login?next=/admin-dashboard"); return; }
    setToken(sessionToken);
    Promise.all([getCurrentNetworkMember(sessionToken), loadMembers(sessionToken)])
      .then(([me]) => {
        if (!me.roles.some((role) => role === "ADMIN" || role === "DEVELOPER")) router.replace("/");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Network Members."));
  }, [loadMembers, router]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? members.filter((member) => member.username.toLowerCase().includes(query)) : members;
  }, [members, search]);

  const toggleRole = async (member: NetworkMember, role: NetworkMemberRole) => {
    if (!token) return;
    const nextRoles = member.roles.includes(role)
      ? member.roles.filter((item) => item !== role)
      : [...member.roles, role];
    setSavingId(member.id);
    setError(null);
    try {
      const updated = await updateNetworkMemberRoles(token, member.id, nextRoles);
      setMembers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update roles.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main>
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-border-subtle pb-5 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.3em] text-accent">Administration</p>
          <h1 className="mt-1 font-otp text-6xl uppercase leading-[0.9]">Network Members</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Discord accounts and Network roles. Access is managed only from this role list.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={17} />
          <Input
            aria-label="Search members"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Discord member"
            className="pl-10"
          />
        </div>
      </header>

      {error && (
        <div className="mb-5 rounded-sm border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card variant="bordered" className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Network roles</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar src={member.avatarUrl || undefined} fallback={member.username} />
                    <span className="font-medium">{member.username}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-3xl flex-wrap gap-1.5">
                    {editableRoles.map((role) => (
                      <Button
                        key={role}
                        size="sm"
                        variant={member.roles.includes(role) ? "primary" : "outline"}
                        disabled={savingId === member.id}
                        onClick={() => toggleRole(member, role)}
                      >
                        {role.replaceAll("_", " ")}
                      </Button>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted">{new Date(member.createdAt).toLocaleDateString("en-US")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!filtered.length && (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted">
            <Users size={18} />
            No matching members.
          </div>
        )}
      </Card>
    </main>
  );
}
