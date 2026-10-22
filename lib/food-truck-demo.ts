import type { Truck } from "@/lib/food-truck-types";

/**
 * Demo fleet for the public food truck tracker.
 *
 * Shown when the live database has no trucks yet (or the API is unreachable),
 * so visitors always see how the tracker looks and works before signing up.
 * Every demo truck is clearly labeled as a demo listing.
 */

export const DEMO_TRUCKS: Truck[] = [
  {
    id: "demo-1",
    businessName: "Smokey Arts BBQ Co.",
    cuisine: "Barbecue · American",
    description:
      "Slow-smoked brisket and burnt ends out of a 1987 step van. Family run since 2019. Follow the smoke smell down 5th.",
    truckPhotoUrl: null,
    menuPhotoUrl: null,
    verified: true,
    location: {
      latitude: 38.8977,
      longitude: -77.0365,
      placeNote: "National Mall · 7th St entrance · until 2pm",
      active: true,
      updatedAt: new Date().toISOString(),
    },
    comments: [
      {
        id: "demo-1-c1",
        body: "The burnt ends sandwich is worth crossing town for.",
        emoji: "🔥",
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
      {
        id: "demo-1-c2",
        body: "Found them by accident, now I check this map every Friday.",
        emoji: "🌮",
        createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
    ],
  },
  {
    id: "demo-2",
    businessName: "Tacos La Vía",
    cuisine: "Tacos · Mexican",
    description:
      "Al pastor off the trompo, handmade tortillas, and aguas frescas. Two trucks, one family, twenty years on these streets.",
    truckPhotoUrl: null,
    menuPhotoUrl: null,
    verified: true,
    location: {
      latitude: 38.9072,
      longitude: -77.0369,
      placeNote: "Franklin Square · lunch service",
      active: true,
      updatedAt: new Date().toISOString(),
    },
    comments: [
      {
        id: "demo-2-c1",
        body: "Al pastor is the real deal. Cash and card.",
        emoji: "🌮",
        createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      },
    ],
  },
  {
    id: "demo-3",
    businessName: "Rolling Dim Sum",
    cuisine: "Dim sum · Fusion",
    description:
      "Steamed soup dumplings made to order in a converted trolley. Weekends only — the map knows where.",
    truckPhotoUrl: null,
    menuPhotoUrl: null,
    verified: false,
    location: {
      latitude: 38.9105,
      longitude: -77.0479,
      placeNote: "Dupont Circle farmers market · Sat & Sun",
      active: true,
      updatedAt: new Date().toISOString(),
    },
    comments: [
      {
        id: "demo-3-c1",
        body: "Soup dumplings from a TRUCK. Unreal.",
        emoji: "🥟",
        createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      },
    ],
  },
  {
    id: "demo-4",
    businessName: "The Melt Machine",
    cuisine: "Grilled cheese · Comfort",
    description:
      "Twelve cheeses, four breads, one obsession. Late-night service outside the music venues.",
    truckPhotoUrl: null,
    menuPhotoUrl: null,
    verified: true,
    location: {
      latitude: 38.9185,
      longitude: -77.0356,
      placeNote: "U Street corridor · after 9pm",
      active: true,
      updatedAt: new Date().toISOString(),
    },
    comments: [
      {
        id: "demo-4-c1",
        body: "Post-show grilled cheese is a DC institution now.",
        emoji: "🧀",
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ],
  },
  {
    id: "demo-5",
    businessName: "Birria Bikini",
    cuisine: "Birria · Coastal Mexican",
    description:
      "Quesabirria tacos with consommé on the side. The red tortillas are dyed with guajillo, nothing artificial.",
    truckPhotoUrl: null,
    menuPhotoUrl: null,
    verified: false,
    location: {
      latitude: 38.8855,
      longitude: -77.0379,
      placeNote: "The Wharf · weekend evenings",
      active: true,
      updatedAt: new Date().toISOString(),
    },
    comments: [
      {
        id: "demo-5-c1",
        body: "Get the consommé. Trust the process.",
        emoji: "🍲",
        createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      },
    ],
  },
  {
    id: "demo-6",
    businessName: "Korean Corn Dog Cart",
    cuisine: "Corn dogs · Korean street food",
    description:
      "Mozzarella-stuffed, potato-crusted, dusted with sugar. Once you have one, plain corn dogs are over.",
    truckPhotoUrl: null,
    menuPhotoUrl: null,
    verified: true,
    location: {
      latitude: 38.8993,
      longitude: -77.0452,
      placeNote: "McPherson Square · weekday lunches",
      active: true,
      updatedAt: new Date().toISOString(),
    },
    comments: [
      {
        id: "demo-6-c1",
        body: "The crunch sound is ASMR. Kids love them.",
        emoji: "🌭",
        createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
      },
    ],
  },
];

export function isDemoTruck(truck: Truck) {
  return truck.id.startsWith("demo-");
}
