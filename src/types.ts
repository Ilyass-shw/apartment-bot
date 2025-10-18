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
