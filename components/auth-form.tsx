'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Fingerprint, LockKeyhole, LoaderCircle, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)

    const supabase = createClient()
    const result = isSignUp
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
          },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password })

    setBusy(false)
    if (result.error) {
      setError('We could not complete that request. Check your details and try again.')
      return
    }

    router.push(isSignUp ? '/sign-in?created=1' : '/workspace')
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setError('')
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/workspace`,
      },
    })
    if (error) {
      setBusy(false)
      setError('Google sign-in is temporarily unavailable. Please try again.')
    }
  }

  return (
    <main className="member-auth-page">
      <div className="auth-ambient auth-ambient-one" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-two" aria-hidden="true" />
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="auth-back-link" href="/"><ArrowLeft aria-hidden="true" /> Back to AUGI</Link>
        <div className="auth-brand-mark" aria-hidden="true"><Fingerprint /></div>
        <p className="auth-eyebrow">SERPENT INTELLIGENCE SYSTEMS / MEMBER ACCESS</p>
        <h1 id="auth-title">{isSignUp ? 'A clearer picture starts here.' : 'Welcome back.'}</h1>
        <p className="auth-description">{isSignUp ? 'Create a secure account to save your domain investigations and build a history of the signals that matter.' : 'Sign in to return to your saved investigations and security workspace.'}</p>

        <button className="auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={busy}>
          <span className="google-g" aria-hidden="true">G</span>
          Continue with Google
          <ArrowRight aria-hidden="true" />
        </button>

        <div className="auth-divider"><span />OR WITH EMAIL<span /></div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <label className="auth-field" htmlFor="auth-name">
              <span>YOUR NAME</span>
              <div><Fingerprint aria-hidden="true" /><input id="auth-name" type="text" autoComplete="name" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Name for your account" /></div>
            </label>
          )}
          <label className="auth-field" htmlFor="auth-email">
            <span>EMAIL ADDRESS</span>
            <div><Mail aria-hidden="true" /><input id="auth-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></div>
          </label>
          <label className="auth-field" htmlFor="auth-password">
            <span>PASSWORD</span>
            <div><LockKeyhole aria-hidden="true" /><input id="auth-password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : null}
            {busy ? 'SECURING SESSION' : isSignUp ? 'CREATE SECURE ACCOUNT' : 'SIGN IN'}
            {!busy && <ArrowRight aria-hidden="true" />}
          </button>
        </form>

        <p className="auth-switch">{isSignUp ? 'Already have an account?' : "Don't have an account yet?"} <Link href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Sign in' : 'Create one'}</Link></p>
        <p className="auth-privacy"><LockKeyhole aria-hidden="true" />Your account is protected with an encrypted, server-managed session.</p>
      </section>
    </main>
  )
}
