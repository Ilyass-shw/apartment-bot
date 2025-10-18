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
} from "./database";
import { initializeBot, sendApplicationConfirmation } from "./notifications";
import { ApiResponse, Apartment, GewobagApartment } from "./types";

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
