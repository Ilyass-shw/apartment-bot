import axios from "axios";
import cron from "node-cron";
import dotenv from "dotenv";
import {
  initializeDatabase,
  isListingSeen,
  markListingAsSeen,
} from "./database";
import { initializeBot, sendApplicationConfirmation } from "./notifications";
import { ApiResponse, Apartment } from "./types";

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
  "APPLICATION_TEXT",
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
      process.env.APPLICATION_TEXT!
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

    // Run every 20 seconds, all day, every day
    console.log("⏰ Setting up cron job...");
    cron.schedule("*/20 * * * * *", async () => {
      console.log("🔄 Running scheduled check...");
      await processNewListings();
    });
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
