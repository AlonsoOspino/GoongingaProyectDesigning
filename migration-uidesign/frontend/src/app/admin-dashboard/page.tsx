"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getCurrentNetworkMember,
  getNetworkMembersForAdmin,
  updateNetworkMemberRoles,
  updateNetworkMemberCompetitiveRole,
} from "@/lib/api/networkMember";
import type { MemberRole, NetworkMember, NetworkMemberRole } from "@/lib/api/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";

const editableRoles: NetworkMemberRole[] = [
  "ADMIN", "CASTER", "DEVELOPER", "SEASON_PLAYER", "MODERATOR",
  "COMMUNITY_MANAGER", "CONTENT_CREATOR", "SOCIAL_MEDIA",
];
const competitiveRoles: MemberRole[] = ["DEFAULT", "CAPTAIN", "MANAGER", "EDITOR", "ADMIN"];

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

  const changeCompetitiveRole = async (member: NetworkMember, role: MemberRole) => {
    if (!token) return;
    setSavingId(member.id);
    setError(null);
    try {
      const updated = await updateNetworkMemberCompetitiveRole(token, member.id, role);
      setMembers((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update competitive role.");
    } finally { setSavingId(null); }
  };

  return (
    <main className="ow-section">
      <div className="ow-container">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><span className="ow-eyebrow"><ShieldCheck size={15} /> Administration</span><h1 className="mt-3 font-display text-6xl uppercase">Network Members</h1><p className="mt-2 text-sm text-muted">Discord accounts and Goonginga roles. Password accounts are no longer supported.</p></div>
          <div className="relative w-full md:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={17} /><Input aria-label="Search members" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Discord member" className="pl-10" /></div>
        </div>
        {error && <div className="mb-5 rounded-sm border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
        <div className="history-table-wrap">
          <table className="history-table">
            <thead><tr><th>Member</th><th>Competitive access</th><th>Network roles</th><th>Joined</th></tr></thead>
            <tbody>{filtered.map((member) => <tr key={member.id}><td><div className="history-team"><Avatar src={member.avatarUrl || undefined} fallback={member.username} /><span>{member.username}</span></div></td><td><select className="rounded-sm border border-input-border bg-input px-2 py-2 text-sm" value={member.role || "DEFAULT"} disabled={savingId === member.id} onChange={(event) => changeCompetitiveRole(member, event.target.value as MemberRole)}>{competitiveRoles.map((role) => <option key={role}>{role}</option>)}</select></td><td><div className="flex max-w-3xl flex-wrap gap-1.5">{editableRoles.map((role) => <Button key={role} size="sm" variant={member.roles.includes(role) ? "primary" : "outline"} disabled={savingId === member.id} onClick={() => toggleRole(member, role)}>{role.replaceAll("_", " ")}</Button>)}</div></td><td className="text-muted">{new Date(member.createdAt).toLocaleDateString("en-US")}</td></tr>)}</tbody>
          </table>
          {!filtered.length && <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted"><Users size={18} /> No matching members.</div>}
        </div>
      </div>
    </main>
  );
}
