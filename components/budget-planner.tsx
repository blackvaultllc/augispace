"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CalendarClock,
  Home,
  Lightbulb,
  PiggyBank,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";

type Expense = {
  id: string;
  label: string;
  category: "fixed" | "utility" | "living" | "future";
  amount: number;
};

const CATEGORY_META: Record<
  Expense["category"],
  { label: string; icon: typeof Home; color: string }
> = {
  fixed: {
    label: "Fixed (rent, insurance, phone plan)",
    icon: Home,
    color: "#35e0c4",
  },
  utility: {
    label: "Utilities (electricity, water, internet)",
    icon: Lightbulb,
    color: "#ffd166",
  },
  living: {
    label: "Living (groceries, transport, personal)",
    icon: Wallet,
    color: "#7ab8ff",
  },
  future: {
    label: "Future you (savings, debt payoff, emergency fund)",
    icon: PiggyBank,
    color: "#b48cff",
  },
};

const PRESETS: {
  label: string;
  category: Expense["category"];
  amount: number;
}[] = [
  { label: "Rent / mortgage", category: "fixed", amount: 0 },
  { label: "Electricity", category: "utility", amount: 0 },
  { label: "Water & sewer", category: "utility", amount: 0 },
  { label: "Internet", category: "utility", amount: 0 },
  { label: "Phone", category: "fixed", amount: 0 },
  { label: "Groceries", category: "living", amount: 0 },
  { label: "Transport (fuel, transit)", category: "living", amount: 0 },
  { label: "Emergency fund", category: "future", amount: 0 },
  { label: "Debt payoff (extra)", category: "future", amount: 0 },
];

let seq = 0;
function makeId() {
  seq += 1;
  return `exp-${seq}`;
}

export function BudgetPlanner() {
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    PRESETS.map((preset) => ({ ...preset, id: makeId() })),
  );
  const [savedNote, setSavedNote] = useState("");

  const monthlyIncome = Math.max(0, Number.parseFloat(income) || 0);
  const totals = useMemo(() => {
    const byCategory = { fixed: 0, utility: 0, living: 0, future: 0 };
    for (const expense of expenses)
      byCategory[expense.category] += Math.max(
        0,
        Number.parseFloat(String(expense.amount)) || 0,
      );
    const total =
      byCategory.fixed +
      byCategory.utility +
      byCategory.living +
      byCategory.future;
    return { ...byCategory, total, remaining: monthlyIncome - total };
  }, [expenses, monthlyIncome]);

  const overBudget = totals.remaining < 0;
  const futureShare =
    monthlyIncome > 0 ? Math.round((totals.future / monthlyIncome) * 100) : 0;
  const futureHealthy = futureShare >= 20;

  function update(id: string, patch: Partial<Expense>) {
    setExpenses((current) =>
      current.map((expense) =>
        expense.id === id ? { ...expense, ...patch } : expense,
      ),
    );
    setSavedNote("");
  }

  function addExpense() {
    setExpenses((current) => [
      ...current,
      { id: makeId(), label: "", category: "living", amount: 0 },
    ]);
  }

  function remove(id: string) {
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  }

  function saveLocally() {
    try {
      window.localStorage.setItem(
        "augi:budget-plan",
        JSON.stringify({ income: monthlyIncome, expenses }),
      );
      setSavedNote("Plan saved on this device.");
    } catch {
      setSavedNote("Storage is unavailable in this browser.");
    }
  }

  function allocatePaycheck() {
    const perCheck = monthlyIncome > 0 ? totals.remaining / 2 : 0;
    setSavedNote(
      perCheck >= 0
        ? `If you are paid twice a month, that is about $${perCheck.toFixed(0)} left over per paycheck after the plan below.`
        : "The plan spends more than the income above — trim a line before allocating a paycheck.",
    );
  }

  return (
    <div className="budget-planner">
      <div className="budget-income">
        <label htmlFor="budget-income">
          <Banknote aria-hidden="true" /> MONTHLY TAKE-HOME INCOME (USD)
        </label>
        <input
          id="budget-income"
          type="number"
          min="0"
          inputMode="decimal"
          value={income}
          onChange={(event) => setIncome(event.target.value)}
          placeholder="e.g. 3200"
        />
      </div>

      <div className="budget-summary">
        <div className={`budget-stat${overBudget ? " is-over" : ""}`}>
          <span>
            {overBudget ? (
              <TriangleAlert aria-hidden="true" />
            ) : (
              <ShieldCheck aria-hidden="true" />
            )}{" "}
            {overBudget ? "OVER BUDGET" : "LEFT AFTER PLAN"}
          </span>
          <strong>${totals.remaining.toFixed(0)}</strong>
          <small>
            {overBudget
              ? "Trim a line below — start with variable spending."
              : "Assign this to savings or extra debt payoff."}
          </small>
        </div>
        <div className="budget-stat">
          <span>
            <CalendarClock aria-hidden="true" /> FUTURE-YOU SHARE
          </span>
          <strong>{futureShare}%</strong>
          <small>
            {futureHealthy
              ? "On or above the 20% guideline."
              : "Aim for at least 20% toward savings and debt."}
          </small>
        </div>
        <div className="budget-stat">
          <span>
            <Wallet aria-hidden="true" /> TOTAL PLANNED
          </span>
          <strong>${totals.total.toFixed(0)}</strong>
          <small>
            Fixed ${totals.fixed.toFixed(0)} · Utilities $
            {totals.utility.toFixed(0)} · Living ${totals.living.toFixed(0)} ·
            Future ${totals.future.toFixed(0)}
          </small>
        </div>
      </div>

      <div className="budget-bars" aria-hidden="true">
        {(["fixed", "utility", "living", "future"] as const).map((category) => (
          <div className="budget-bar" key={category}>
            <span
              style={{
                width: `${monthlyIncome > 0 ? Math.min(100, (totals[category] / monthlyIncome) * 100) : 0}%`,
                background: CATEGORY_META[category].color,
              }}
            />
          </div>
        ))}
      </div>

      <div className="budget-list">
        <div className="budget-list-head">
          <span>LINE ITEM</span>
          <span>CATEGORY</span>
          <span>MONTHLY $</span>
          <span aria-hidden="true" />
        </div>
        {expenses.map((expense) => (
          <div className="budget-row" key={expense.id}>
            <input
              aria-label="Line item name"
              value={expense.label}
              onChange={(event) =>
                update(expense.id, { label: event.target.value })
              }
              placeholder="Line item"
              maxLength={40}
            />
            <select
              aria-label="Category"
              value={expense.category}
              onChange={(event) =>
                update(expense.id, {
                  category: event.target.value as Expense["category"],
                })
              }
            >
              {(Object.keys(CATEGORY_META) as Expense["category"][]).map(
                (category) => (
                  <option key={category} value={category}>
                    {CATEGORY_META[category].label.split(" (")[0]}
                  </option>
                ),
              )}
            </select>
            <input
              aria-label="Monthly amount"
              type="number"
              min="0"
              inputMode="decimal"
              value={expense.amount || ""}
              onChange={(event) =>
                update(expense.id, {
                  amount: Math.max(
                    0,
                    Number.parseFloat(event.target.value) || 0,
                  ),
                })
              }
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => remove(expense.id)}
              aria-label={`Remove ${expense.label || "line"}`}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="budget-add" onClick={addExpense}>
          + Add line
        </button>
      </div>

      <div className="budget-actions">
        <button type="button" onClick={saveLocally}>
          Save plan on this device
        </button>
        <button type="button" onClick={allocatePaycheck}>
          <Banknote aria-hidden="true" /> Split leftover per paycheck
        </button>
      </div>
      {savedNote && (
        <p className="budget-note" role="status">
          {savedNote}
        </p>
      )}

      <section className="budget-lessons" aria-label="Budgeting principles">
        <h3>The method behind this planner</h3>
        <ol>
          <li>
            <strong>Pay the fixed things first.</strong> Rent/mortgage,
            insurance, and the phone plan are the commitments that keep life
            stable. List them before anything flexible.
          </li>
          <li>
            <strong>Utilities next, averaged.</strong> Electricity and water
            move with the seasons. Take your highest recent bill and budget that
            amount every month — in cheap months the difference builds your
            buffer.
          </li>
          <li>
            <strong>Give every dollar one job.</strong> Income minus planned
            lines should land near zero. Money with no assignment disappears;
            money assigned to a name — "emergency fund", "debt" — gets saved.
          </li>
          <li>
            <strong>Fund future you before fun you.</strong> Target at least 20%
            of take-home toward savings and debt payoff. Start the emergency
            fund at $500, then build toward one month of expenses, then three.
          </li>
          <li>
            <strong>Calibrate each paycheck.</strong> Fixed bills usually come
            due once or twice a month. Split your plan by paycheck so the money
            for rent on the 1st is not spent on the 15th.
          </li>
          <li>
            <strong>Review monthly, adjust without guilt.</strong> A budget that
            misses by $80 and gets fixed next month is working. One that is
            abandoned after a bad month is not — the plan serves you, not the
            reverse.
          </li>
        </ol>
      </section>

      <p className="budget-disclaimer">
        This planner runs entirely in your browser — nothing you type is sent to
        any server. It is financial education, not personalized financial
        advice; for debt, credit, or tax decisions, consult a qualified
        professional or a nonprofit credit counseling agency.
      </p>
    </div>
  );
}
