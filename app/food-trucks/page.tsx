import type { Metadata } from "next";
import { ShieldCheck, Truck, MapPin } from "lucide-react";
import { FoodTruckTracker } from "@/components/food-truck-tracker";
import { AugiPageShell } from "@/components/augi-page-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Food Truck Tracker — find local trucks live",
};

const rules = [
  {
    icon: Truck,
    title: "Licensed operators only",
    body: 'Registering requires your real business license number and issuing state. Staff verify licenses before a listing earns the "license verified" badge.',
  },
  {
    icon: MapPin,
    title: "You control your location",
    body: 'Update your live position whenever you open for service — with a place note like "5th & Main until 2pm" — and hide yourself with one tap when you close. The map shows only what you publish.',
  },
  {
    icon: ShieldCheck,
    title: "Community with guardrails",
    body: "Signed-in members can comment and react on your profile. Comments are tied to real accounts, and abuse of the community features is a reason to lose access.",
  },
];

export default async function FoodTrucksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AugiPageShell
      eyebrow="AUGI / COMMUNITY PROGRAM"
      title={
        <>
          Find real food,
          <br />
          <span>right now.</span>
        </>
      }
      description="A live tracker for licensed food trucks. Operators publish their location and profile; the community finds them and cheers them on. Free for operators, free to browse."
    >
      <section
        className="truck-rules section-wrap"
        aria-label="How the tracker works"
      >
        {rules.map(({ icon: Icon, title, body }) => (
          <article key={title}>
            <Icon aria-hidden="true" />
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="section-wrap" aria-label="Live food truck map">
        <FoodTruckTracker signedIn={!!user} isOperator={!!user} />
      </section>
      <section
        className="section-wrap truck-register-cta"
        aria-label="Register your truck"
      >
        <h2>Run a food truck?</h2>
        <p>
          Create an account, register with your business license number and
          state, add photos of your truck and menu, then flip yourself live on
          the map each day you serve. Listing is free.
        </p>
        <a className="button-primary" href={user ? "/workspace" : "/sign-up"}>
          {user ? "Set up your truck profile" : "Create an operator account"}
        </a>
      </section>
    </AugiPageShell>
  );
}
