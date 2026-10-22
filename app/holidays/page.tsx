import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock3, MapPin, Sparkles } from "lucide-react";
import { AugiPageShell } from "@/components/augi-page-shell";
import { listHolidays, getHolidayContent, getTheme } from "@/lib/holidays";
import { FoodTruckTracker } from "@/components/food-truck-tracker";

export const metadata: Metadata = {
  title: "Holiday calendar & seasonal events",
  description:
    "Countdowns, themed radar markers, holiday food-truck appearances, and educational resources for upcoming holidays and observances.",
};

export const revalidate = 600;

/**
 * Public holiday experience. A holiday is "active" (countdown + themed
 * presentation) from 30 days before its date through the day itself, per the
 * platform directive. Observance is not assumed for every visitor — copy is
 * neutral, and each entry shows its source attribution.
 */
export default async function HolidaysPage() {
  const holidays = await listHolidays().catch(() => []);
  const active = holidays.filter((h) => h.active);
  const upcoming = holidays.filter((h) => !h.active);
  const featured = active[0] ?? null;
  const featuredTheme = featured
    ? await getTheme(featured.slug).catch(() => null)
    : null;
  const featuredContent = featured
    ? await getHolidayContent(featured.slug).catch(() => null)
    : null;

  return (
    <AugiPageShell
      eyebrow="AUGI / HOLIDAYS & SEASONS"
      title={
        <>
          The calendar,
          <br />
          <span>celebrated.</span>
        </>
      }
      description="Upcoming holidays and observances with live countdowns, seasonal radar themes, participating food trucks, and community resources. Observance is always your choice — nothing here assumes it for you."
    >
      {featured && (
        <section
          className="section-wrap holiday-featured"
          aria-label={`Featured: ${featured.name}`}
        >
          <div className="holiday-featured-head">
            <span className="holiday-emoji" aria-hidden="true">
              {featuredTheme?.banner_emoji ?? "✦"}
            </span>
            <div>
              <span className="section-label">
                NOW ON THE RADAR · {featured.source_ref.toUpperCase()}
              </span>
              <h2>
                {featured.name}{" "}
                <span className="holiday-countdown">
                  {featured.days_until === 0
                    ? "— today"
                    : `in ${featured.days_until} day${featured.days_until === 1 ? "" : "s"}`}
                </span>
              </h2>
              {featuredTheme?.page_copy && <p>{featuredTheme.page_copy}</p>}
            </div>
          </div>
          {featuredContent && (
            <div className="holiday-featured-content">{featuredContent}</div>
          )}
          <FoodTruckTracker
            signedIn={false}
            isOperator={false}
            seasonal={featuredTheme?.radar_marker}
          />
          <p className="holiday-map-note">
            <MapPin aria-hidden="true" /> Trucks operating during the holiday
            window appear with the seasonal marker. Location data is unaffected
            — themes are presentation only.
          </p>
        </section>
      )}

      <section
        className="section-wrap holiday-list"
        aria-labelledby="upcoming-title"
      >
        <h2 id="upcoming-title">All upcoming observances</h2>
        <ul className="holiday-list-inner">
          {holidays.map((holiday) => (
            <li className="holiday-row" key={holiday.slug}>
              <span className="holiday-date">
                <CalendarDays aria-hidden="true" />{" "}
                {new Date(
                  `${holiday.occurrence_date}T00:00:00Z`,
                ).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </span>
              <strong>{holiday.name}</strong>
              <span className="holiday-when">
                <Clock3 aria-hidden="true" />
                {holiday.days_until === 0
                  ? "Today"
                  : holiday.days_until > 0
                    ? `in ${holiday.days_until} days`
                    : "passed"}
                {holiday.active && (
                  <span className="holiday-active-tag">
                    <Sparkles aria-hidden="true" /> themed
                  </span>
                )}
              </span>
              <small>{holiday.source_ref}</small>
            </li>
          ))}
        </ul>
        <p className="holiday-note">
          Dates for movable holidays are maintained by the administrator and
          reviewed each cycle. Fixed-date federal holidays are stable; cultural
          observances vary by community and family.
        </p>
      </section>
    </AugiPageShell>
  );
}
