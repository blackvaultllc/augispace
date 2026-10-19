'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Send, ShieldCheck, Sparkles } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }

export function SecurityCopilot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { fetch('/api/assistant').then((response) => response.ok ? response.json() : null).then((payload) => payload?.messages && setMessages(payload.messages)).catch(() => undefined) }, [])
  async function ask(event: React.FormEvent) {
    event.preventDefault(); const message = input.trim(); if (!message || busy) return
    setError(''); setInput(''); setMessages((current) => [...current, { role: 'user', content: message }]); setBusy(true)
    try { const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setMessages((current) => [...current, { role: 'assistant', content: payload.response }]) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Copilot unavailable.') } finally { setBusy(false) }
  }
  const mode = input.toLowerCase().includes('final stage') ? 'FINAL STAGE' : input.toLowerCase().includes('big o action') ? 'BIG O ACTION' : input.toLowerCase().includes('big o showtime') ? 'BIG O SHOWTIME' : 'STANDARD'
  return <section className="copilot-panel" aria-labelledby="copilot-title"><div className="copilot-heading"><div className="copilot-identity"><div className={`augi-terminal-face${busy ? ' is-thinking' : ''}`} role="img" aria-label={busy ? 'AUGI is thinking' : 'AUGI terminal face'}><span className="augi-face-eyes"><i /><i /></span><span className="augi-face-mouth" /></div><div><span className="workspace-micro-label"><Sparkles aria-hidden="true" /> AUGI DEFENSIVE COPILOT</span><h2 id="copilot-title">Work through the next step.</h2></div></div><span className="copilot-retention"><ShieldCheck aria-hidden="true" /> RETAINED</span></div><p className="copilot-note">Ask about containment, DNS, Linux, Windows, science, history, or a suspicious IP. AUGI checks retained local knowledge first and clearly separates facts, hypotheses, and unknowns.</p><div className="copilot-mode" aria-live="polite">WORKFLOW: <strong>{mode}</strong> · “BIG O ACTION” prepares a defensive checklist; “BIG O SHOWTIME” reports status; “FINAL STAGE” gives maximum-detail analysis without unrestricted access.</div><div className="copilot-messages" aria-live="polite">{messages.length === 0 && <p className="copilot-empty">Try: “A suspicious IP appeared in my account logs. What should I preserve and block first?”</p>}{messages.map((message, index) => <div className={`copilot-message copilot-${message.role}`} key={`${message.role}-${index}`}><span>{message.role === 'assistant' ? 'AUGI' : 'YOU'}</span><p>{message.content}</p></div>)}{busy && <LoaderCircle className="spin-icon" aria-label="AUGI is thinking" />}</div><form className="copilot-form" onSubmit={ask}><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} placeholder="Ask what to preserve, block, or investigate next…" aria-label="Ask AUGI a security question" /><button type="submit" disabled={busy || !input.trim()}><Send aria-hidden="true" /> Send</button></form>{error && <p className="workspace-error" role="alert">{error}</p>}</section>
}
