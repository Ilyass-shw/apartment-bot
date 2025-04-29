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
