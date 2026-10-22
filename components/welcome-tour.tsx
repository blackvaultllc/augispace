"use client";

import { useEffect, useState } from "react";
import { Compass, Radar, ShieldCheck, Sparkles, X } from "lucide-react";

const STORAGE_KEY = "augi:welcome-tour-done";

type Step = {
  title: string;
  body: string;
  icon: typeof Radar;
  targetId?: string;
};

export function WelcomeTour({ role }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      /* storage unavailable — do not show the tour */
    }
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  const isStaff = role === "staff";
  const steps: Step[] = [
    {
      title: "Welcome to AUGI",
      body: isStaff
        ? "This is your staff workspace. Everything here runs on verified public sources — nothing simulated."
        : "This is your private intelligence workspace. Every signal comes from a named, verifiable source.",
      icon: Compass,
    },
    {
      title: "Tactical radar",
      body: "The radar plots your GPS fix, saved IP dossiers, and live verified threat-feed contacts. Use the terminal below the map for commands like `radar --global`.",
      icon: Radar,
    },
    {
      title: "Investigations",
      body: "Enter an email address to read a domain’s public DNS posture. Reports are saved to your account — visible only to you.",
      icon: ShieldCheck,
    },
    {
      title: "Your data stays yours",
      body: "Coordinates stay in this browser tab. API keys live encrypted on the server. Members never see elevated tools.",
      icon: Sparkles,
    },
  ];

  const step = steps[stepIndex];
  const Icon = step.icon;
  const last = stepIndex === steps.length - 1;

  return (
    <div
      className="welcome-tour-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
      onClick={dismiss}
    >
      <aside
        className="welcome-tour"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="welcome-tour-close"
          onClick={dismiss}
          aria-label="Close tour"
        >
          <X aria-hidden="true" />
        </button>
        <span className="welcome-tour-icon">
          <Icon aria-hidden="true" />
        </span>
        <span className="workspace-micro-label">
          AUGI / GETTING STARTED · {stepIndex + 1} OF {steps.length}
        </span>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="welcome-tour-dots" aria-hidden="true">
          {steps.map((_, index) => (
            <span
              key={index}
              className={index === stepIndex ? "is-current" : ""}
            />
          ))}
        </div>
        <div className="welcome-tour-actions">
          <button
            type="button"
            onClick={() => (last ? dismiss() : setStepIndex(stepIndex + 1))}
          >
            {last ? "Enter the workspace" : "Next"}
          </button>
          <button type="button" className="welcome-tour-skip" onClick={dismiss}>
            Skip
          </button>
        </div>
      </aside>
    </div>
  );
}
