import type { Metadata } from "next";
import { ShieldCheck, Truck, MapPin } from "lucide-react";
import Link from "next/link";
import { FoodTruckTracker } from "@/components/food-truck-tracker";
import { AugiPageShell } from "@/components/augi-page-shell";
import { createClient } from "@/lib/supabase/server";
import { getMediaAssets } from "@/lib/media";

export const metadata: Metadata = {
  title: "Food Truck Tracker — find local trucks live",
};

const rules = [
  {
    icon: Truck,
    title: "Licensed operators only",
    href: "/food-trucks/licensed-operators",
    image: "/augi-diverse-protection.png",
    body: 'Registering requires your real business license number and issuing state. Staff verify licenses before a listing earns the "license verified" badge.',
  },
  {
    icon: MapPin,
    title: "You control your location",
    href: "/food-trucks/location",
    image: "/augi-community-research.png",
    body: 'Update your live position whenever you open for service — with a place note like "5th & Main until 2pm" — and hide yourself with one tap when you close. The map shows only what you publish.',
  },
  {
    icon: ShieldCheck,
    title: "Community with guardrails",
    href: "/food-trucks/community",
    image: "/augi-protection-network.png",
    body: "Signed-in members can comment and react on your profile. Comments are tied to real accounts, and abuse of the community features is a reason to lose access.",
  },
];

export default async function FoodTrucksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const media = await getMediaAssets(["truck_hero_video", "truck_hero_image"]);
  const heroVideo = media.truck_hero_video?.url ?? "/videos/food-truck.mp4";
  const heroPoster = media.truck_hero_image?.url ?? "/augi-public-signal.png";
  const hasVideo = !!media.truck_hero_video;
  const hasImage = !!media.truck_hero_image;
  // Show the media block whenever the owner uploaded something; otherwise the
  // section collapses so the page never shows an empty "broken" slot.
  const showHero = hasVideo || hasImage;

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
      {showHero && (
        <section
          className="truck-hero"
          aria-label="Food truck tracker in action"
        >
          {hasVideo ? (
            <video
              className="truck-hero-media"
              autoPlay
              muted
              loop
              playsInline
              poster={heroPoster}
              aria-hidden="true"
            >
              <source src={heroVideo} type="video/mp4" />
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="truck-hero-media" src={heroPoster} alt="" aria-hidden="true" />
          )}
          <div className="truck-hero-overlay" aria-hidden="true" />
          <div className="truck-hero-copy">
            <span className="section-label">EAT LOCAL · TRACK LIVE</span>
            <h2>
              The street-food
              <br />
              <span>radar.</span>
            </h2>
            <p>
              Real trucks. Real locations, updated by the operators themselves.
              Zoom to street level and go find lunch.
            </p>
          </div>
        </section>
      )}
      <section
        className="truck-rules section-wrap"
        aria-label="How the tracker works"
      >
        {rules.map(({ icon: Icon, title, body, href, image }) => (
          <Link key={title} href={href} className="truck-rule-card"><img className="truck-rule-img" src={image} alt="" />
            <Icon aria-hidden="true" />
            <strong>{title}</strong>
            <p>{body}</p><span className="truck-rule-more">Read the details &rarr;</span>
          </Link>
        ))}
      </section>
      <p className="section-wrap truck-members-link"><Link href="/food-trucks/membership">Rules for members and business accounts &rarr;</Link></p>
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
