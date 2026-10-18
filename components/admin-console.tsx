'use client'

import { useState } from 'react'
import { BookOpen, CheckCircle2, Command, LockKeyhole, Send } from 'lucide-react'

type Props = { email: string; role: string }

const definitions = [
  ['RBAC', 'Role-based access control. Permissions are assigned by role instead of shared passwords.'],
  ['Audit trail', 'A time-stamped record of who performed an administrative action and what changed.'],
  ['Verification gate', 'A required identity check before sensitive profile, access, or billing changes.'],
  ['Read-only command', 'A diagnostic command that can inspect approved AUGI data without changing systems.'],
  ['Least privilege', 'Each team member receives only the access needed for their assigned job.'],
  ['Public signal', 'Information intentionally exposed by a domain or infrastructure provider, not private-person data.'],
]

const commands = ['help', 'whoami', 'show definitions', 'show access policy', 'show audit scope']

export function AdminConsole({ email, role }: Props) {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('Type help to see the approved read-only commands.')

  function runCommand() {
    const value = command.trim().toLowerCase()
    const responses: Record<string, string> = {
      help: 'Approved commands: whoami · show definitions · show access policy · show audit scope. Arbitrary OS shell, credential access, destructive actions, and deanonymization are intentionally unavailable.',
      whoami: `${email} · role=${role} · session verified by AUGI access controls.`,
      'show definitions': 'Definitions are listed below. Each administrative action is designed to be attributable and reviewable.',
      'show access policy': 'Owner: full AUGI administration. Technical team: role-scoped access only. Members: personal account data only. Sensitive changes require verification.',
      'show audit scope': 'AUGI records actor, action, target, timestamp, result, and reason for approved administrative actions. It does not record private command output or provide arbitrary host access.',
    }
    setOutput(responses[value] ?? 'Command not recognized. Use help for the approved command list.')
    setCommand('')
  }

  return <section className="admin-console" aria-labelledby="admin-console-title">
    <div className="admin-console-header"><div><span className="workspace-micro-label"><Command aria-hidden="true" /> OWNER / TEAM CONTROL PLANE</span><h2 id="admin-console-title">Explain every action.</h2><p>Hybrid Linux and PowerShell terminology is supported as a teaching layer, but this web console does not expose an unrestricted operating-system shell.</p></div><span className="admin-verified"><LockKeyhole aria-hidden="true" /> VERIFIED SESSION</span></div>
    <div className="admin-terminal"><div className="admin-terminal-bar"><span /><span /><span /><strong>AUGI SAFE CONSOLE / READ-ONLY</strong></div><div className="admin-terminal-output" aria-live="polite">{output}</div><div className="admin-command-form"><span>&gt;</span><input aria-label="Approved admin command" value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runCommand() }} placeholder="help" /><button type="button" onClick={runCommand}><Send aria-hidden="true" /> Run</button></div><div className="admin-command-chips">{commands.map((item) => <button type="button" key={item} onClick={() => { setCommand(item); setTimeout(runCommand, 0) }}>{item}</button>)}</div></div>
    <div className="admin-definitions"><div className="definition-head"><BookOpen aria-hidden="true" /><span>BACK-END DEFINITIONS / ACCESS MODEL</span></div><div className="admin-definition-grid">{definitions.map(([term, definition]) => <article key={term}><strong>{term}</strong><p>{definition}</p></article>)}</div></div>
    <div className="admin-audit-note"><CheckCircle2 aria-hidden="true" /><span>Changes to names, access, roles, billing, or account recovery should require verified identity and produce an attributable audit event.</span></div>
  </section>
}
