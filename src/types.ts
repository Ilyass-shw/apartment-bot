export interface ApartmentImage {
  url: string;
  type: string;
}

export interface Apartment {
  wrk_id: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  objektnr_extern: string;
  lat: string;
  lon: string;
  titel: string;
  preis: string;
  groesse: string;
  anzahl_zimmer: string;
  preview_img_url: string;
  has_grundriss: boolean;
  has_video: boolean;
  slug: string;
  images: ApartmentImage[];
}

export interface ApiResponse {
  results: Apartment[];
  paging: {
    info: {
      limit: number;
      count: number;
    };
    next: boolean;
    previous: boolean;
  };
}

export interface GewobagApartment {
  id: string; // post-197664
  address: string; // "Gaudystr. 18, 10437 Berlin/Pankow"
  title: string; // "Singlewohnung am Mauerpark"
  size: string; // "35,94 m²"
  rent: string; // "ab 682,06€"
  link: string; // Direct link to apartment
  imageUrl: string; // First image URL
  googleMapsLink: string; // Generated from address
}

export interface DegewoApartment {
  id: string; // immobilie-list-item-20208
  address: string; // "Horstwalder Straße 3 | Lichtenrade"
  title: string; // "Anmietung ab 50+ Jahren möglich"
  size: string; // "40,37 m²"
  rooms: string; // "2 Zimmer"
  availableFrom: string; // "ab sofort"
  rent: string; // "680,97 €"
  features: string[]; // ["Balkon/Loggia", "Aufzug"]
  link: string; // Direct link to apartment
  imageUrl: string; // First image URL
  googleMapsLink: string; // Generated from address
}
