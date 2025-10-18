import axios from "axios";
import cron from "node-cron";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import {
  initializeDatabase,
  isListingSeen,
  markListingAsSeen,
  isGewobagListingSeen,
  markGewobagListingAsSeen,
  isDegewoListingSeen,
  markDegewoListingAsSeen,
} from "./database";
import { initializeBot, sendApplicationConfirmation } from "./notifications";
import {
  ApiResponse,
  Apartment,
  GewobagApartment,
  DegewoApartment,
} from "./types";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "APPLICANT_NAME",
  "APPLICANT_FIRST_NAME",
  "APPLICANT_PHONE",
  "APPLICANT_EMAIL",
  "DATABASE_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  console.error("Please create a .env file with the required variables");
  process.exit(1);
}

const API_URL = "https://www.wohnraumkarte.de/api/getImmoList";
const APPLICATION_URL = "https://www.wohnraumkarte.de/Api/sendMailRequest";

// Gewobag URL with your filter parameters
const GEWOBAG_URL =
  "https://www.gewobag.de/fuer-mietinteressentinnen/mietangebote/?bezirke%5B%5D=charlottenburg-wilmersdorf-charlottenburg&bezirke%5B%5D=friedrichshain-kreuzberg&bezirke%5B%5D=friedrichshain-kreuzberg-friedrichshain&bezirke%5B%5D=friedrichshain-kreuzberg-kreuzberg&bezirke%5B%5D=mitte&bezirke%5B%5D=mitte-gesundbrunnen&bezirke%5B%5D=mitte-moabit&bezirke%5B%5D=mitte-wedding&bezirke%5B%5D=neukoelln&bezirke%5B%5D=neukoelln-britz&bezirke%5B%5D=neukoelln-buckow&bezirke%5B%5D=neukoelln-neukoelln&bezirke%5B%5D=neukoelln-rudow&bezirke%5B%5D=pankow&bezirke%5B%5D=pankow-pankow&bezirke%5B%5D=pankow-prenzlauer-berg&objekttyp%5B%5D=wohnung&gesamtmiete_von=&gesamtmiete_bis=1100&gesamtflaeche_von=34&gesamtflaeche_bis=80&zimmer_von=&zimmer_bis=&keinwbs=1&sort-by=";

// Degewo constants
const DEGEWO_URL = "https://www.degewo.de/immosuche";
const DEGEWO_SEARCH_URL =
  "https://www.degewo.de/immosuche#openimmo-search-result";

// Session management for degewo
let degewoSessionCookies: string | null = null;
let degewoLastRefresh: number = 0;
const DEGEWO_SESSION_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

// Hardcoded application text
const APPLICATION_TEXT = `Sehr geehrte Damen und Herren,

meine Freundin Luisa (Psychotherapeutin) und ich (Senior Software Engineer) suchen derzeit eine langfristige Mietwohnung in Berlin und sind sehr an Ihrem Angebot interessiert. Unser gemeinsames Nettoeinkommen liegt bei über 5.100 € monatlich, und wir haben Ersparnisse von 40.000 €, die kontinuierlich wachsen. Wir sind Nichtraucher, haben keine Haustiere und legen großen Wert auf einen gepflegten und ruhigen Wohnstil.
Da Luisas Eltern in Berlin leben, sind wir eng mit der Stadt verbunden und möchten hier gerne dauerhaft leben. Über eine Rückmeldung und die Möglichkeit einer Besichtigung würden wir uns sehr freuen!

Mit freundlichen Grüßen,
Ilyass Fourkani & Luisa Pauline Angel`;

async function fetchListings(): Promise<Apartment[]> {
  console.log("🔄 Fetching listings from API...");
  try {
    const response = await axios.get<ApiResponse>(API_URL, {
      params: {
        rentType: "miete",
        city: "Berlin",
        perimeter: "7",
        immoType: "wohnung",
        priceMax: "720",
        sizeMin: "50",
        minRooms: "Beliebig",
        floor: "Beliebig",
        bathtub: "0",
        bathwindow: "0",
        bathshower: "0",
        furnished: "0",
        kitchenEBK: "0",
        toiletSeparate: "0",
        disabilityAccess: "egal",
        seniorFriendly: "0",
        balcony: "egal",
        subsidizedHousingPermit: "egal",
        limit: "15",
        offset: "0",
        orderBy: "dist_asc",
        dataSet: "deuwo",
      },
    });
    console.log(
      `✅ Successfully fetched ${response.data.results.length} listings`
    );
    return response.data.results;
  } catch (error) {
    console.error("❌ Error fetching listings:", error);
    return [];
  }
}

async function sendApplication(apartment: Apartment) {
  console.log(`📝 Sending application for apartment: ${apartment.titel}`);
  try {
    // Create the form data as a string
    const formData = `wrkID=${apartment.wrk_id}&name=${encodeURIComponent(
      process.env.APPLICANT_NAME!
    )}&prename=${encodeURIComponent(
      process.env.APPLICANT_FIRST_NAME!
    )}&phone=${encodeURIComponent(
      process.env.APPLICANT_PHONE!
    )}&email=${encodeURIComponent(
      process.env.APPLICANT_EMAIL!
    )}&emailText=${encodeURIComponent(
      APPLICATION_TEXT
    )}&currentEmployment=angestellte&incomeType=1&monthlyNetIncome=M_3&referrer=DeuWo&dataSet=deuwo`;

    // Log the raw form data
    console.log("Raw form data:", decodeURIComponent(formData));

    const response = await axios.post(APPLICATION_URL, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    // Log response details
    console.log("📥 Response Details:");
    console.log("Status:", response.status);
    console.log("Status Text:", response.statusText);
    console.log("Headers:", response.headers);
    console.log("Data:", response.data);

    console.log(`✅ Application sent successfully for: ${apartment.titel}`);
    await sendApplicationConfirmation(apartment);
  } catch (error) {
    console.error(
      `❌ Error sending application for ${apartment.titel}:`,
      error
    );
    if (axios.isAxiosError(error)) {
      console.error("Error Details:");
      console.error("Status:", error.response?.status);
      console.error("Status Text:", error.response?.statusText);
      console.error("Headers:", error.response?.headers);
      console.error("Data:", error.response?.data);
    }
  }
}

async function processNewListings() {
  console.log("🔄 Starting to process new listings...");
  const listings = await fetchListings();
  console.log(`📊 Found ${listings.length} total listings to process`);

  for (const listing of listings) {
    console.log(`🔍 Checking listing: ${listing.titel}`);
    const isSeen = await isListingSeen(listing.wrk_id);
    console.log(`📌 Listing ${listing.titel} seen status: ${isSeen}`);

    if (!isSeen) {
      console.log(`✨ New listing found: ${listing.titel}`);
      await sendApplication(listing);
      await markListingAsSeen(listing.wrk_id);
      console.log(`✅ Completed processing for new listing: ${listing.titel}`);
    }
  }
  console.log("✅ Finished processing all listings");
}

// Gewobag functions
async function fetchGewobagListings(): Promise<string> {
  console.log("🔄 Fetching Gewobag listings from website...");
  try {
    const response = await axios.get(GEWOBAG_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 30000, // 30 second timeout
    });
    console.log(
      `✅ Successfully fetched Gewobag page (${response.data.length} characters)`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching Gewobag listings:", error);
    throw error;
  }
}

function parseGewobagHTML(html: string): GewobagApartment[] {
  console.log("🔍 Parsing Gewobag HTML...");
  const $ = cheerio.load(html);
  const apartments: GewobagApartment[] = [];

  $(".angebot-big-box").each((index, element) => {
    const $el = $(element);

    // Extract apartment ID
    const id = $el.attr("id") || `gewobag-${index}`;

    // Extract address
    const address = $el.find(".angebot-address address").text().trim();

    // Extract title
    const title = $el.find(".angebot-title").text().trim();

    // Extract size
    const size = $el.find(".angebot-area td").text().trim();

    // Extract rent
    const rent = $el.find(".angebot-kosten td").text().trim();

    // Extract link
    const link = $el.find(".read-more-link").attr("href") || "";
    const fullLink = link.startsWith("http")
      ? link
      : `https://www.gewobag.de${link}`;

    // Extract first image URL
    const imageUrl = $el.find(".slider-element img").first().attr("src") || "";

    // Generate Google Maps link
    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address
    )}`;

    if (address && title && size && rent) {
      apartments.push({
        id,
        address,
        title,
        size,
        rent,
        link: fullLink,
        imageUrl,
        googleMapsLink,
      });
    }
  });

  console.log(`✅ Parsed ${apartments.length} Gewobag apartments`);
  return apartments;
}

async function sendGewobagNotification(apartment: GewobagApartment) {
  console.log(`📱 Sending Gewobag notification for: ${apartment.title}`);

  const message = `🏠 **New Gewobag Apartment Found!**

📍 **Address:** ${apartment.address}
📝 **Title:** ${apartment.title}
🏠 **Size:** ${apartment.size}
💰 **Rent:** ${apartment.rent}

🔗 **View Listing:** [Click here](${apartment.link})
🗺️ **Google Maps:** [View Location](${apartment.googleMapsLink})`;

  try {
    await sendApplicationConfirmation({
      wrk_id: apartment.id,
      strasse: apartment.address,
      plz: "",
      ort: "Berlin",
      land: "Deutschland",
      objektnr_extern: "",
      lat: "",
      lon: "",
      titel: `GEWOBAG: ${apartment.title}`,
      preis: apartment.rent,
      groesse: apartment.size,
      anzahl_zimmer: "",
      preview_img_url: apartment.imageUrl,
      has_grundriss: false,
      has_video: false,
      slug: "",
      images: apartment.imageUrl
        ? [{ url: apartment.imageUrl, type: "image" }]
        : [],
    });

    // Send custom message with proper formatting
    const botToken = process.env.TELEGRAM_BOT_TOKEN!;
    const chatId = process.env.TELEGRAM_CHAT_ID!;

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    });

    console.log(`✅ Gewobag notification sent for: ${apartment.title}`);
  } catch (error) {
    console.error(
      `❌ Error sending Gewobag notification for ${apartment.title}:`,
      error
    );
  }
}

async function processGewobagListings() {
  console.log("🔄 Starting to process Gewobag listings...");
  try {
    const html = await fetchGewobagListings();
    const apartments = parseGewobagHTML(html);

    console.log(`📊 Found ${apartments.length} Gewobag apartments to process`);

    for (const apartment of apartments) {
      try {
        console.log(`🔍 Checking Gewobag listing: ${apartment.title}`);
        const isSeen = await isGewobagListingSeen(apartment.id);
        console.log(
          `📌 Gewobag listing ${apartment.title} seen status: ${isSeen}`
        );

        if (!isSeen) {
          console.log(`✨ New Gewobag listing found: ${apartment.title}`);
          await sendGewobagNotification(apartment);
          await markGewobagListingAsSeen(apartment.id);
          console.log(
            `✅ Completed processing for new Gewobag listing: ${apartment.title}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error processing Gewobag listing ${apartment.title}:`,
          error
        );
        continue;
      }
    }

    console.log("✅ Finished processing all Gewobag listings");
  } catch (error) {
    console.error("❌ Error in processGewobagListings:", error);
  }
}

// Degewo functions
async function refreshDegewoSession(): Promise<string> {
  console.log("🔄 Refreshing Degewo session...");
  try {
    const response = await axios.get(DEGEWO_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 30000,
    });

    const setCookieHeaders = response.headers["set-cookie"];
    if (setCookieHeaders) {
      const cookies = setCookieHeaders
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
      degewoSessionCookies = cookies;
      degewoLastRefresh = Date.now();
      console.log("✅ Degewo session refreshed successfully");
      return cookies;
    } else {
      throw new Error("No cookies received from Degewo");
    }
  } catch (error) {
    console.error("❌ Error refreshing Degewo session:", error);
    throw error;
  }
}

async function getDegewoSessionCookies(): Promise<string> {
  const now = Date.now();

  // Check if we need to refresh the session
  if (
    !degewoSessionCookies ||
    now - degewoLastRefresh > DEGEWO_SESSION_REFRESH_INTERVAL
  ) {
    console.log("🔄 Degewo session expired or not initialized, refreshing...");
    return await refreshDegewoSession();
  }

  return degewoSessionCookies;
}

async function fetchDegewoListings(): Promise<string> {
  console.log("🔄 Fetching Degewo listings...");
  try {
    // Get fresh session cookies
    const cookies = await getDegewoSessionCookies();

    // Create the filtered payload (same as in parse-degewo-correct.js)
    const formData = new URLSearchParams();
    formData.append(
      "tx_openimmo_immobilie[__referrer][@extension]",
      "Openimmo"
    );
    formData.append(
      "tx_openimmo_immobilie[__referrer][@controller]",
      "Immobilie"
    );
    formData.append("tx_openimmo_immobilie[__referrer][@action]", "search");
    formData.append(
      "tx_openimmo_immobilie[__referrer][arguments]",
      "YToyMzp7czo2OiJzZWFyY2giO3M6Njoic2VhcmNoIjtzOjQ6InBhZ2UiO3M6MToiMSI7czo4OiJsYXRpdHVkZSI7czowOiIiO3M6OToibG9uZ2l0dWRlIjtzOjA6IiI7czo4OiJsb2NhdGlvbiI7czowOiIiO3M6ODoiZGlzdGFuY2UiO3M6MToiMSI7czoxNDoibmV0dG9rYWx0bWlldGUiO3M6NToiMF85MDAiO3M6MjA6Im5ldHRva2FsdG1pZXRlX3N0YXJ0IjtzOjA6IiI7czoxODoibmV0dG9rYWx0bWlldGVfZW5kIjtzOjA6IiI7czo5OiJ3YXJtbWlldGUiO3M6MDoiIjtzOjE1OiJ3YXJtbWlldGVfc3RhcnQiO3M6MDoiIjtzOjEzOiJ3YXJtbWlldGVfZW5kIjtzOjA6IiI7czoxMToid29obmZsYWVjaGUiO3M6MDoiIiB..."
    );
    formData.append(
      "tx_openimmo_immobilie[__referrer][@request]",
      '{"@extension":"Openimmo","@controller":"Immobilie","@action":"search"}53dd4f0226cd686d2566450b5ce9bcce5bc791a4'
    );
    formData.append(
      "tx_openimmo_immobilie[__trustedProperties]",
      '{"search":1,"page":1,"latitude":1,"longitude":1,"distance":1,"nettokaltmiete":1,"nettokaltmiete_start":1,"nettokaltmiete_end":1,"warmmiete":1,"warmmiete_start":1,"warmmiete_end":1,"wohnflaeche":1,"anzahlZimmer":1,"ausstattung":[1,1,1,1,1,1,1,1,1,1,1,1,1,1],"wbsSozialwohnung":1,"sortBy":1,"sortOrder":1,"regionalerZusatz":[1,1,1,1,1,1,1,1,1,1,1,1,1]}1ce6a043e74a2d313c077ab1feb945feaf24c953'
    );
    formData.append("tx_openimmo_immobilie[search]", "search");
    formData.append("tx_openimmo_immobilie[page]", "1");
    formData.append("tx_openimmo_immobilie[latitude]", "");
    formData.append("tx_openimmo_immobilie[longitude]", "");
    formData.append("tx_openimmo_immobilie[location]", "");
    formData.append("tx_openimmo_immobilie[distance]", "1");
    formData.append("tx_openimmo_immobilie[nettokaltmiete]", "0_900");
    formData.append("tx_openimmo_immobilie[nettokaltmiete_start]", "");
    formData.append("tx_openimmo_immobilie[nettokaltmiete_end]", "");
    formData.append("tx_openimmo_immobilie[warmmiete]", "");
    formData.append("tx_openimmo_immobilie[warmmiete_start]", "");
    formData.append("tx_openimmo_immobilie[warmmiete_end]", "");
    formData.append("tx_openimmo_immobilie[wohnflaeche]", "");
    formData.append("tx_openimmo_immobilie[wohnflaeche_start]", "");
    formData.append("tx_openimmo_immobilie[wohnflaeche_end]", "");
    formData.append("tx_openimmo_immobilie[anzahlZimmer]", "");
    formData.append("tx_openimmo_immobilie[anzahlZimmer_start]", "");
    formData.append("tx_openimmo_immobilie[anzahlZimmer_end]", "");
    formData.append("tx_openimmo_immobilie[ausstattung][]", "");
    formData.append("tx_openimmo_immobilie[ausstattung]", "");
    formData.append("tx_openimmo_immobilie[wbsSozialwohnung]", "0");
    formData.append(
      "tx_openimmo_immobilie[sortBy]",
      "immobilie_preise_warmmiete"
    );
    formData.append("tx_openimmo_immobilie[sortOrder]", "asc");
    formData.append("tx_openimmo_immobilie[regionalerZusatz]", "");
    formData.append(
      "tx_openimmo_immobilie[regionalerZusatz][]",
      "charlottenburg-wilmersdorf"
    );
    formData.append(
      "tx_openimmo_immobilie[regionalerZusatz][]",
      "friedrichshain-kreuzberg"
    );
    formData.append("tx_openimmo_immobilie[regionalerZusatz][]", "lichtenberg");
    formData.append("tx_openimmo_immobilie[regionalerZusatz][]", "mitte");
    formData.append("tx_openimmo_immobilie[regionalerZusatz][]", "neukolln");
    formData.append("tx_openimmo_immobilie[regionalerZusatz][]", "pankow");
    formData.append(
      "tx_openimmo_immobilie[regionalerZusatz][]",
      "tempelhof-schoneberg"
    );

    const response = await axios.post(DEGEWO_URL, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.degewo.de/immosuche",
        Origin: "https://www.degewo.de",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 30000,
    });

    console.log(
      `✅ Successfully fetched Degewo page (${response.data.length} characters)`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching Degewo listings:", error);
    throw error;
  }
}

function parseDegewoHTML(html: string): DegewoApartment[] {
  console.log("🔍 Parsing Degewo HTML...");
  const $ = cheerio.load(html);
  const apartments: DegewoApartment[] = [];

  $(".article-list__item--immosearch").each((index, element) => {
    const $apartment = $(element);

    const apartment: DegewoApartment = {
      id: $apartment.attr("id") || `degewo-${index}`,
      address: $apartment.find(".article__meta").text().trim(),
      title: $apartment.find(".article__title").text().trim(),
      size: "",
      rooms: "",
      availableFrom: "",
      rent: $apartment.find(".article__price-tag .price").text().trim(),
      link: $apartment.find("a").attr("href") || "",
      imageUrl:
        $apartment.find("img").attr("src") ||
        $apartment.find("img").attr("data-srcset")?.split(" ")[0] ||
        "",
      features: [],
      googleMapsLink: "",
    };

    // Extract size, rooms, and available from
    $apartment.find(".article__properties-item").each((i, prop) => {
      const $prop = $(prop);
      const text = $prop.find(".text").text().trim();
      const svg =
        $prop.find("svg use").attr("xlink:href") ||
        $prop.find("svg use").attr("href");

      if (svg === "#i-squares") {
        apartment.size = text;
      } else if (svg === "#i-room") {
        apartment.rooms = text;
      } else if (svg === "#i-calendar2") {
        apartment.availableFrom = text;
      }
    });

    // Extract features
    $apartment.find(".article__tags-item").each((i, tag) => {
      apartment.features.push($(tag).text().trim());
    });

    // Generate Google Maps link
    if (apartment.address) {
      apartment.googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        apartment.address
      )}`;
    }

    // Only add if we have essential data
    if (apartment.address && apartment.title && apartment.rent) {
      apartments.push(apartment);
    }
  });

  console.log(`✅ Parsed ${apartments.length} Degewo apartments`);
  return apartments;
}

async function sendDegewoNotification(apartment: DegewoApartment) {
  console.log(`📱 Sending Degewo notification for: ${apartment.title}`);

  const featuresText =
    apartment.features.length > 0
      ? `\n🏷️ **Features:** ${apartment.features.join(", ")}`
      : "";

  const message = `🏠 **New Degewo Apartment Found!**

📍 **Address:** ${apartment.address}
📝 **Title:** ${apartment.title}
🏠 **Size:** ${apartment.size || "N/A"}
🛏️ **Rooms:** ${apartment.rooms || "N/A"}
📅 **Available:** ${apartment.availableFrom || "N/A"}
💰 **Rent:** ${apartment.rent}${featuresText}

🔗 **View Listing:** [Click here](${apartment.link})
🗺️ **Google Maps:** [View Location](${apartment.googleMapsLink})`;

  try {
    await sendApplicationConfirmation({
      wrk_id: apartment.id,
      strasse: apartment.address,
      plz: "",
      ort: "Berlin",
      land: "Deutschland",
      objektnr_extern: "",
      lat: "",
      lon: "",
      titel: `DEGEWO: ${apartment.title}`,
      preis: apartment.rent,
      groesse: apartment.size,
      anzahl_zimmer: apartment.rooms,
      preview_img_url: apartment.imageUrl,
      has_grundriss: false,
      has_video: false,
      slug: "",
      images: apartment.imageUrl
        ? [{ url: apartment.imageUrl, type: "image" }]
        : [],
    });

    // Send custom message with proper formatting
    const botToken = process.env.TELEGRAM_BOT_TOKEN!;
    const chatId = process.env.TELEGRAM_CHAT_ID!;

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    });

    console.log(`✅ Degewo notification sent for: ${apartment.title}`);
  } catch (error) {
    console.error(
      `❌ Error sending Degewo notification for ${apartment.title}:`,
      error
    );
  }
}

async function processDegewoListings() {
  console.log("🔄 Starting to process Degewo listings...");
  try {
    const html = await fetchDegewoListings();
    const apartments = parseDegewoHTML(html);

    console.log(`📊 Found ${apartments.length} Degewo apartments to process`);

    for (const apartment of apartments) {
      try {
        console.log(`🔍 Checking Degewo listing: ${apartment.title}`);
        const isSeen = await isDegewoListingSeen(apartment.id);
        console.log(
          `📌 Degewo listing ${apartment.title} seen status: ${isSeen}`
        );

        if (!isSeen) {
          console.log(`✨ New Degewo listing found: ${apartment.title}`);
          await sendDegewoNotification(apartment);
          await markDegewoListingAsSeen(apartment.id);
          console.log(
            `✅ Completed processing for new Degewo listing: ${apartment.title}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error processing Degewo listing ${apartment.title}:`,
          error
        );
        continue;
      }
    }

    console.log("✅ Finished processing all Degewo listings");
  } catch (error) {
    console.error("❌ Error in processDegewoListings:", error);
  }
}

async function main() {
  console.log("🚀 Starting apartment bot...");
  try {
    console.log("💾 Initializing database...");
    await initializeDatabase();

    console.log("🤖 Initializing Telegram bot...");
    const botToken = process.env.TELEGRAM_BOT_TOKEN!;
    const chatId = process.env.TELEGRAM_CHAT_ID!;

    if (!botToken || !chatId) {
      throw new Error("Telegram bot token or chat ID is missing");
    }

    initializeBot(botToken, chatId);

    // Run every 2 minutes from 7:00 to 18:59, Monday to Friday, Europe/Berlin time
    console.log("⏰ Setting up wohnraumkarte.de cron job...");
    cron.schedule(
      "*/2 7-18 * * 1-5",
      async () => {
        console.log("🔄 Running scheduled wohnraumkarte.de check...");
        await processNewListings();
      },
      {
        timezone: "Europe/Berlin",
      }
    );

    // Run Gewobag check every 3 minutes from 7:00 to 22:00, Monday to Friday, Europe/Berlin time
    console.log("⏰ Setting up Gewobag cron job...");
    cron.schedule(
      "*/3 7-22 * * 1-5",
      async () => {
        console.log("🔄 Running scheduled Gewobag check...");
        await processGewobagListings();
      },
      {
        timezone: "Europe/Berlin",
      }
    );

    // Run Degewo check every 15 minutes from 7:00 to 22:00, Monday to Friday, Europe/Berlin time
    console.log("⏰ Setting up Degewo cron job...");
    cron.schedule(
      "*/15 7-22 * * 1-5",
      async () => {
        console.log("🔄 Running scheduled Degewo check...");
        await processDegewoListings();
      },
      {
        timezone: "Europe/Berlin",
      }
    );
    console.log("✅ Bot setup completed successfully");
  } catch (error) {
    console.error("❌ Error during bot initialization:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error in main:", error);
  process.exit(1);
});
