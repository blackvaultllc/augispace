export type TruckComment = {
  id: string;
  body: string;
  emoji: string | null;
  createdAt: string;
};

export type TruckLocation = {
  latitude: number;
  longitude: number;
  placeNote: string | null;
  active: boolean;
  updatedAt: string;
};

export type Truck = {
  id: string;
  businessName: string;
  cuisine: string | null;
  description: string | null;
  truckPhotoUrl: string | null;
  menuPhotoUrl: string | null;
  verified: boolean;
  location: TruckLocation | null;
  comments: TruckComment[];
};
