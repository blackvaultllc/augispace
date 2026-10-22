import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AugiPageShell } from "@/components/augi-page-shell";

type Topic = {
  eyebrow: string;
  title: string;
  description: string;
  sections: { heading: string; text?: string; items?: string[] }[];
};

const TOPICS: Record<string, Topic> = {
  "licensed-operators": {
    eyebrow: "FOOD TRUCK TRACKER / OPERATORS",
    title: "Licensed operators only",
    description: "Every truck on the map is a real, licensed business. Here is how that works.",
    sections: [
      { heading: "What you need to register", items: [
        "An account on this site.",
        "Your business name.",
        "Your business license number, exactly as printed on the license.",
        "The state that issued the license.",
      ] },
      { heading: "How approval works", text: "After you register, our staff check your license with the issuing state. Until that is done, your truck does not appear on the public map. Once you are approved, your listing earns the verified badge and you can go live." },
      { heading: "If you change your license details", text: "Changing your business name, license number or license state sends your listing back to review. This keeps the verified badge honest for everyone." },
      { heading: "Photos of your truck and menu", text: "Approved operators can add photos of their truck and menu. Only approved operators can add photos." },
    ],
  },
  location: {
    eyebrow: "FOOD TRUCK TRACKER / LOCATION",
    title: "You control your location",
    description: "The map only shows what you choose to publish, and you can hide yourself any time.",
    sections: [
      { heading: "Going live", text: "When you open for service, set your position and add a short note such as 5th and Main until 2pm. Customers see the dot on the map and your note." },
      { heading: "Closing for the day", text: "Tap once to hide yourself. When you are hidden, your truck does not show on the map." },
      { heading: "What the public sees", items: [
        "Only the location and note you published.",
        "A green dot when you are open and a red dot when you are closed.",
        "Nothing about where you are when you are hidden.",
      ] },
      { heading: "How customers use the map", text: "Customers tap any glowing dot to see the truck's name, menu and where it is parked. The scanner on the map sweeps the area and lights up each truck as it passes." },
    ],
  },
  community: {
    eyebrow: "FOOD TRUCK TRACKER / COMMUNITY",
    title: "Community with guardrails",
    description: "Customers can cheer trucks on. Everyone is accountable for what they post.",
    sections: [
      { heading: "Who can comment", text: "Signed-in members can leave comments and emoji reactions on a truck's profile." },
      { heading: "Why accounts are required", text: "Every comment is tied to a real account. That keeps the community friendly and makes it possible to remove people who cause trouble." },
      { heading: "What is not allowed", items: [
        "Harassment, threats or hate.",
        "Spam or advertising for other businesses.",
        "False claims about a truck or its owner.",
      ] },
      { heading: "What happens if someone breaks the rules", text: "Abuse of the community features is a reason to lose access to commenting or to the whole account." },
    ],
  },
  membership: {
    eyebrow: "FOOD TRUCK TRACKER / ACCOUNTS",
    title: "Rules for members and business accounts",
    description: "What a regular account can do, what a business account can do, and how to ask for more.",
    sections: [
      { heading: "Regular members (free)", items: [
        "Browse the map and every truck profile.",
        "Comment and react on trucks after signing in.",
        "No license is needed.",
      ] },
      { heading: "Business accounts (free to start)", items: [
        "Register your truck with your business license and issuing state.",
        "After staff approval, appear on the live map.",
        "Go live and hide yourself whenever you want.",
        "Add photos of your truck and menu once approved.",
      ] },
      { heading: "Asking for more exposure", text: "If you want your business featured on the front page at certain times, or have another special request for your page, send a request to our staff from your account. Staff review every request. Anything with a cost is shown to you before you agree to it." },
      { heading: "Rules for business accounts", items: [
        "Only list a truck you are licensed to operate.",
        "Keep your location and photos honest and current.",
        "Do not use the community features to advertise other businesses.",
        "Accounts that break these rules can be removed from the map.",
      ] },
    ],
  },
};

type Props = { params: Promise<{ topic: string }> };

export function generateStaticParams() {
  return Object.keys(TOPICS).map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const data = TOPICS[topic];
  return { title: data ? `${data.title} | Food Truck Tracker` : "Food Truck Tracker" };
}

export default async function TopicPage({ params }: Props) {
  const { topic } = await params;
  const data = TOPICS[topic];
  if (!data) notFound();
  return (
    <AugiPageShell eyebrow={data.eyebrow} title={<>{data.title}</>} description={data.description}>
      <section className="section-wrap truck-topic">
        {data.sections.map((section) => (
          <div key={section.heading}>
            <h2>{section.heading}</h2>
            {section.text && <p>{section.text}</p>}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <div className="truck-topic-links">
          <Link href="/food-trucks">&larr; Back to the map</Link>
          <Link href="/sign-up">Create an account</Link>
        </div>
      </section>
    </AugiPageShell>
  );
}
