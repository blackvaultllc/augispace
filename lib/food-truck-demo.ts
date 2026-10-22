import type { Truck } from "@/lib/food-truck-types";

/**
 * Sample trucks for the public demo preview. Every name is fictional.
 * IDs start with "demo-" so the app never treats them as real listings.
 */
const NOW = new Date().toISOString();

type State = "open" | "pending" | "closed";

function make(
  n: number,
  businessName: string,
  cuisine: string,
  description: string,
  latitude: number,
  longitude: number,
  placeNote: string,
  state: State = "open",
): Truck {
  return {
    id: `demo-${n}`,
    businessName,
    cuisine,
    description,
    truckPhotoUrl: null,
    menuPhotoUrl: null,
    verified: state === "open",
    location: {
      latitude,
      longitude,
      placeNote,
      active: state !== "closed",
      updatedAt: NOW,
    },
    comments: [
      {
        id: `demo-${n}-c1`,
        body: "Sample comment. Real trucks get real community comments.",
        emoji: "🌮",
        createdAt: NOW,
      },
    ],
  } as unknown as Truck;
}

export const DEMO_TRUCKS: Truck[] = [
  make(1, "Gulf Coast Tacos", "Tacos", "Street tacos and fresh salsa. Sample listing.", 30.6944, -88.0431, "Dauphin St and Royal St until 2pm"),
  make(2, "Bayou Smoke BBQ", "Barbecue", "Slow-smoked ribs and brisket. Sample listing.", 30.6745, -88.1655, "Airport Blvd lot until 8pm"),
  make(3, "Port City Po'Boys", "Cajun", "Shrimp and oyster po'boys. Sample listing.", 30.6935, -88.105, "Midtown, near the park"),
  make(4, "Azalea Snow Cones", "Desserts", "Shaved ice in 30 flavors. Sample listing.", 30.6836, -88.136, "Springhill Ave", "pending"),
  make(5, "Fairhope Crepe Wagon", "Crepes", "Sweet and savory crepes. Sample listing.", 30.523, -87.9033, "Fairhope Pier lot"),
  make(6, "Shrimp Shack on Wheels", "Seafood", "Gulf shrimp baskets. Sample listing.", 30.246, -87.7008, "Gulf Shores public beach", "open"),
  make(7, "Island Lunch Wagon", "Sandwiches", "Beach-day lunches. Sample listing.", 30.25, -88.11, "Dauphin Island", "closed"),
  make(8, "Crescent Beignet Cart", "Desserts", "Hot beignets and cafe au lait. Sample listing.", 29.9584, -90.0644, "French Quarter"),
  make(9, "Boardwalk Dogs", "Hot dogs", "Loaded dogs and fries. Sample listing.", 30.396, -88.8853, "Biloxi beachfront"),
  make(10, "Pensacola Pizza Truck", "Pizza", "Wood-fired pies. Sample listing.", 30.4213, -87.2169, "Palafox St", "pending"),
  make(11, "Magnolia Mac Truck", "Comfort food", "Mac and cheese, every way. Sample listing.", 32.2988, -90.1848, "Downtown Jackson"),
  make(12, "Capital City Rib Rig", "Barbecue", "Ribs and sides. Sample listing.", 32.3668, -86.3, "Montgomery riverfront"),
  make(13, "Magic City Birria", "Mexican", "Birria tacos and consome. Sample listing.", 33.5186, -86.8104, "Birmingham, Avondale"),
  make(14, "Peach State Waffles", "Breakfast", "Chicken and waffles. Sample listing.", 33.749, -84.388, "Midtown Atlanta"),
  make(15, "Boudin Bus", "Cajun", "Boudin links and cracklins. Sample listing.", 30.4515, -91.1871, "Baton Rouge, Perkins Rowe"),
];

export function isDemoTruck(truck: { id: string }): boolean {
  return truck.id.startsWith("demo-");
}
