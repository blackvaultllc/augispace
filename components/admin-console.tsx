'use client'

import { useState } from 'react'
import { BookOpen, CheckCircle2, Command, LockKeyhole, Send } from 'lucide-react'

type Props = { email: string; role: string }

const definitions = [
  ['Owner access', 'The owner workspace is available only to the configured owner email after Supabase verifies the session.'],
  ['Audit log', 'An administrative action log is not implemented in this application.'],
  ['Verification', 'Sign-in and email confirmation are handled by Supabase Auth.'],
  ['Read-only guide', 'This page returns fixed educational text and does not connect to a host shell or change systems.'],
  ['Least privilege', 'Workspace APIs verify the owner email and database rows are additionally scoped by Supabase row-level security.'],
  ['Public signal', 'Information intentionally exposed by a domain or infrastructure provider, not private-person data.'],
]

const commands = ['help', 'whoami', 'show definitions', 'show access policy', 'show audit status']

export function AdminConsole({ email, role }: Props) {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('This is a fixed command guide, not a system shell. Type help to see available topics.')

  function runCommand(value = command) {
    const normalized = value.trim().toLowerCase()
    const responses: Record<string, string> = {
      help: 'Topics: whoami · show definitions · show access policy · show audit status. This guide does not execute operating-system commands, change accounts, or access infrastructure.',
      whoami: `${email} · access=${role} · session verified by Supabase Auth.`,
      'show definitions': 'The terminology guide below describes the application’s actual access model and its current limitations.',
      'show access policy': 'Only the configured owner email may access the private workspace. Saved report and assistant rows are protected by Supabase row-level security.',
      'show audit status': 'No administrative action audit log is implemented. This guide does not record actions or provide command history.',
    }
    setOutput(responses[normalized] ?? 'Topic not recognized. Use help to see the available guide topics.')
    setCommand('')
  }

  return <section className="admin-console" aria-labelledby="admin-console-title">
    <div className="admin-console-header"><div><span className="workspace-micro-label"><Command aria-hidden="true" /> AGAMOSS / OWNER CONTROL PLANE</span><h2 id="admin-console-title">A guide, not a shell.</h2><p>This read-only page explains the access model. It cannot run Linux or PowerShell commands, change accounts, or administer infrastructure.</p></div><span className="admin-verified"><LockKeyhole aria-hidden="true" /> SUPABASE SESSION</span></div>
    <div className="admin-terminal"><div className="admin-terminal-bar"><span /><span /><span /><strong>AGAMOSS / FIXED COMMAND GUIDE</strong></div><div className="admin-terminal-output" aria-live="polite">{output}</div><div className="admin-command-form"><span aria-hidden="true">&gt;</span><input aria-label="Command guide topic" value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) runCommand() }} placeholder="help" /><button type="button" onClick={() => runCommand()}><Send aria-hidden="true" /> Run</button></div><div className="admin-command-chips">{commands.map((item) => <button type="button" key={item} onClick={() => runCommand(item)}>{item}</button>)}</div></div>
    <div className="admin-definitions"><div className="definition-head"><BookOpen aria-hidden="true" /><span>ACCESS MODEL / DEFINITIONS</span></div><div className="admin-definition-grid">{definitions.map(([term, definition]) => <article key={term}><strong>{term}</strong><p>{definition}</p></article>)}</div></div>
    <div className="admin-audit-note"><CheckCircle2 aria-hidden="true" /><span>Administrative audit logging is not implemented. This page does not claim or imply that actions are recorded.</span></div>
  </section>
}
