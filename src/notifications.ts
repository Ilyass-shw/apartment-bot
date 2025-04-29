import TelegramBot from "node-telegram-bot-api";
import { Apartment } from "./types";

let bot: TelegramBot | null = null;

export function initializeBot(token: string, chatId: string) {
  console.log("🤖 Initializing Telegram bot...");
  try {
    if (!token) {
      throw new Error("Telegram bot token is required");
    }
    if (!chatId) {
      throw new Error("Telegram chat ID is required");
    }

    bot = new TelegramBot(token, { polling: false });
    console.log("✅ Telegram bot initialized successfully");
    return bot;
  } catch (error) {
    console.error("❌ Failed to initialize Telegram bot:", error);
    throw error;
  }
}

export async function sendApplicationConfirmation(apartment: Apartment) {
  console.log(`📨 Preparing to send application confirmation for: ${apartment.titel}`);
  if (!bot) {
    console.error("❌ Bot not initialized when trying to send confirmation");
    throw new Error("Bot not initialized");
  }

  // Create Google Maps URL
  const address = `${apartment.strasse}, ${apartment.plz} ${apartment.ort}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address
  )}`;

  const message = `
🏠 *New Apartment Application Sent!*

*Title:* ${apartment.titel}
*Price:* ${apartment.preis}€
*Size:* ${apartment.groesse}m²
*Rooms:* ${apartment.anzahl_zimmer}
*Location:* ${apartment.strasse}, ${apartment.plz} ${apartment.ort}

[View on Google Maps](${mapsUrl})
[View Listing](https://www.deutsche-wohnen.com/mieten/mietangebote/${apartment.slug}-${apartment.wrk_id})
    `;

  try {
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, message, {
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    });
    console.log(`✅ Successfully sent application confirmation for: ${apartment.titel}`);
  } catch (error) {
    console.error(`❌ Failed to send application confirmation for ${apartment.titel}:`, error);
    throw error;
  }
}
