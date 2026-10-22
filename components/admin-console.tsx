"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Send,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";

type StaffMember = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
};
type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};
type Integration = {
  key: string;
  label: string;
  configured: boolean;
  updatedAt: string | null;
};
type AdminData = {
  staff: StaffMember[];
  invites: Invite[];
  integrations: Integration[];
};

type Props = { email: string; role: string };

const definitions = [
  [
    "Owner access",
    "The owner workspace is available only to the configured owner email after authentication verifies the session.",
  ],
  [
    "Role-based access",
    "Owner and staff accounts get elevated tools; ordinary members use the public demo and their own workspace only.",
  ],
  [
    "Secret storage",
    "Integration API keys are encrypted with AES-256-GCM on the server before storage. Browsers and members never see them.",
  ],
  [
    "Verification",
    "Sign-in and email confirmation are handled by the auth provider.",
  ],
  [
    "Least privilege",
    "Workspace APIs verify the caller role and database rows are additionally scoped by row-level security.",
  ],
  [
    "Public signal",
    "Information intentionally exposed by a domain, IP registry, or government feed — not private-person data.",
  ],
];

export function AdminConsole({ email, role }: Props) {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("Type help to see available topics.");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "member">("staff");
  const [inviteMessage, setInviteMessage] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const payload = (await response.json()) as AdminData & { error?: string };
      if (response.ok && !payload.error) {
        setData({
          staff: payload.staff,
          invites: payload.invites,
          integrations: payload.integrations,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };
      return response.ok
        ? payload.message || "Done."
        : payload.error || "The action failed.";
    } finally {
      setBusy(false);
    }
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    setInviteMessage("");
    const message = await post({
      action: "invite_staff",
      email: inviteEmail,
      role: inviteRole,
    });
    setInviteMessage(message);
    setInviteEmail("");
    void load();
  }

  async function saveKey() {
    setKeyMessage("");
    const message = await post({
      action: "save_integration",
      key: "abuseipdb_api_key",
      value: keyDraft,
    });
    setKeyMessage(message);
    setKeyDraft("");
    void load();
  }

  async function removeKey() {
    setKeyMessage("");
    const message = await post({
      action: "delete_integration",
      key: "abuseipdb_api_key",
    });
    setKeyMessage(message);
    void load();
  }

  async function revokeInvite(inviteEmail: string) {
    await post({ action: "revoke_invite", email: inviteEmail });
    void load();
  }

  function runCommand(value = command) {
    const normalized = (value ?? "").trim().toLowerCase();
    const responses: Record<string, string> = {
      help: "Topics: whoami · show definitions · show access policy · show team · show integrations. This console does not execute operating-system commands.",
      whoami: `${email} · access=${role} · session verified.`,
      "show definitions":
        "The terminology guide below describes the application’s access model and its current limits.",
      "show access policy":
        "Only owner and invited staff accounts access elevated tools. Member data is isolated by row-level security.",
      "show team": data
        ? `${data.staff.length} elevated accounts · ${data.invites.filter((i) => i.status === "pending").length} pending invites.`
        : "Team data is loading…",
      "show integrations": data
        ? data.integrations
            .map(
              (item) =>
                `${item.label}: ${item.configured ? "configured" : "not configured"}`,
            )
            .join(" · ")
        : "Integration data is loading…",
    };
    setOutput(
      responses[normalized] ??
        "Topic not recognized. Use help to see the available topics.",
    );
    setCommand("");
  }

  const pendingInvites =
    data?.invites.filter((invite) => invite.status === "pending") ?? [];

  return (
    <section className="admin-console" aria-labelledby="admin-console-title">
      <div className="admin-console-header">
        <div>
          <span className="workspace-micro-label">
            AUGI / OWNER CONTROL PLANE
          </span>
          <h2 id="admin-console-title">Control center.</h2>
          <p>
            Manage staff access and server-side integrations. This console
            cannot run operating-system commands or touch infrastructure.
          </p>
        </div>
        <span className="admin-verified">
          <LockKeyhole aria-hidden="true" /> OWNER SESSION
        </span>
      </div>

      <div className="admin-terminal">
        <div className="admin-terminal-bar">
          <span />
          <span />
          <span />
          <strong>AUGI / STATUS CONSOLE</strong>
        </div>
        <div className="admin-terminal-output" aria-live="polite">
          {output}
        </div>
        <div className="admin-command-form">
          <span aria-hidden="true">&gt;</span>
          <input
            aria-label="Console topic"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runCommand();
            }}
            placeholder="help"
          />
          <button type="button" onClick={() => runCommand()}>
            <Send aria-hidden="true" /> Run
          </button>
        </div>
        <div className="admin-command-chips">
          {["help", "whoami", "show team", "show integrations"].map((item) => (
            <button type="button" key={item} onClick={() => runCommand(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-panels">
        <section className="admin-panel" aria-labelledby="staff-title">
          <div className="admin-panel-head">
            <UserPlus aria-hidden="true" />
            <h3 id="staff-title">Staff & access</h3>
          </div>
          <form className="admin-invite-form" onSubmit={submitInvite}>
            <label htmlFor="invite-email">INVITE BY EMAIL</label>
            <div className="admin-invite-row">
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="colleague@example.com"
              />
              <select
                aria-label="Role"
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(
                    event.target.value === "member" ? "member" : "staff",
                  )
                }
              >
                <option value="staff">Staff</option>
                <option value="member">Member</option>
              </select>
              <button type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin-icon" aria-hidden="true" />
                ) : (
                  <Mail aria-hidden="true" />
                )}{" "}
                Invite
              </button>
            </div>
            {inviteMessage && <p role="status">{inviteMessage}</p>}
          </form>
          <div className="admin-team-list">
            {loading && <p>Loading team…</p>}
            {data?.staff.map((member) => (
              <div className="admin-team-row" key={member.user_id}>
                <span>
                  <Users aria-hidden="true" /> {member.email}
                </span>
                <strong>{member.role.toUpperCase()}</strong>
              </div>
            ))}
            {pendingInvites.map((invite) => (
              <div className="admin-team-row is-pending" key={invite.id}>
                <span>
                  <Mail aria-hidden="true" /> {invite.email}
                </span>
                <button
                  type="button"
                  onClick={() => revokeInvite(invite.email)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel" aria-labelledby="integrations-title">
          <div className="admin-panel-head">
            <KeyRound aria-hidden="true" />
            <h3 id="integrations-title">Integrations</h3>
          </div>
          <p className="admin-panel-note">
            API credentials are encrypted on the server and used only in
            server-side code. They are never sent to browsers.
          </p>
          {(data?.integrations ?? []).map((integration) => (
            <div className="admin-integration" key={integration.key}>
              <div className="admin-integration-head">
                <strong>{integration.label}</strong>
                <span
                  className={
                    integration.configured ? "admin-badge ok" : "admin-badge"
                  }
                >
                  {integration.configured ? "CONFIGURED" : "NOT SET"}
                </span>
              </div>
              {integration.key === "abuseipdb_api_key" && (
                <div className="admin-integration-form">
                  <input
                    type="password"
                    autoComplete="off"
                    value={keyDraft}
                    onChange={(event) => setKeyDraft(event.target.value)}
                    placeholder="Paste AbuseIPDB API key"
                    aria-label="AbuseIPDB API key"
                  />
                  <div className="admin-integration-actions">
                    <button
                      type="button"
                      onClick={saveKey}
                      disabled={busy || !keyDraft.trim()}
                    >
                      Save encrypted
                    </button>
                    {integration.configured && (
                      <button
                        type="button"
                        className="admin-danger"
                        onClick={removeKey}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
              {keyMessage && <p role="status">{keyMessage}</p>}
              {integration.updatedAt && (
                <small>
                  Last updated{" "}
                  {new Date(integration.updatedAt).toLocaleString()}
                </small>
              )}
            </div>
          ))}
        </section>
      </div>

      <div className="admin-definitions">
        <div className="definition-head">
          <BookOpen aria-hidden="true" />
          <span>ACCESS MODEL / DEFINITIONS</span>
        </div>
        <div className="admin-definition-grid">
          {definitions.map(([term, definition]) => (
            <article key={term}>
              <strong>{term}</strong>
              <p>{definition}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="admin-audit-note">
        <CheckCircle2 aria-hidden="true" />
        <span>
          Elevated actions are role-checked server-side on every request. Secret
          values are encrypted and never returned by any API.
        </span>
      </div>
      <p className="admin-footnote">
        <ShieldAlert aria-hidden="true" /> Staff members gain access the first
        time they sign up with their invited email address.
      </p>
    </section>
  );
}
