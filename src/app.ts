import axios from "axios";
import cron from "node-cron";
import {
  initializeDatabase,
  isListingSeen,
  markListingAsSeen,
} from "./database";
import {
  initializeBot,
  sendNewListingNotification,
  sendApplicationConfirmation,
} from "./notifications";
import { ApiResponse, Apartment } from "./types";

const API_URL = "https://www.wohnraumkarte.de/api/getImmoList";
const APPLICATION_URL = "https://www.wohnraumkarte.de/Api/sendMailRequest";

async function fetchListings(): Promise<Apartment[]> {
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
    return response.data.results;
  } catch (error) {
    console.error("Error fetching listings:", error);
    return [];
  }
}

async function sendApplication(apartment: Apartment) {
  try {
    const formData = new URLSearchParams();
    formData.append("wrkID", apartment.wrk_id);
    formData.append("name", process.env.APPLICANT_NAME!);
    formData.append("prename", process.env.APPLICANT_FIRST_NAME!);
    formData.append("phone", process.env.APPLICANT_PHONE!);
    formData.append("email", process.env.APPLICANT_EMAIL!);
    formData.append("emailText", process.env.APPLICATION_TEXT!);
    formData.append("currentEmployment", "angestellte");
    formData.append("incomeType", "1");
    formData.append("monthlyNetIncome", "M_3");
    formData.append("referrer", "DeuWo");
    formData.append("dataSet", "deuwo");

    await axios.post(APPLICATION_URL, formData.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    await sendApplicationConfirmation(apartment);
  } catch (error) {
    console.error("Error sending application:", error);
  }
}

async function processNewListings() {
  const listings = await fetchListings();

  for (const listing of listings) {
    const isSeen = await isListingSeen(listing.wrk_id);

    if (!isSeen) {
      await sendNewListingNotification(listing);
      await sendApplication(listing);
      await markListingAsSeen(listing.wrk_id);
    }
  }
}

async function main() {
  await initializeDatabase();
  initializeBot(process.env.TELEGRAM_BOT_TOKEN!, process.env.TELEGRAM_CHAT_ID!);

  // Run every 2 minutes from Monday to Friday, between 8 AM and 6 PM
  cron.schedule("*/2 * * * 1-5", async () => {
    const hour = new Date().getHours();
    if (hour >= 8 && hour < 18) {
      await processNewListings();
    }
  });
}

main().catch(console.error);
