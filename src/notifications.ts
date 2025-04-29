import TelegramBot from "node-telegram-bot-api";
import { Apartment } from "./types";

let bot: TelegramBot | null = null;

export function initializeBot(token: string, chatId: string) {
  bot = new TelegramBot(token, { polling: false });
  return bot;
}

export async function sendNewListingNotification(apartment: Apartment) {
  if (!bot) {
    throw new Error("Bot not initialized");
  }

  const message = `
🏠 *New Apartment Listing!*

*Title:* ${apartment.titel}
*Price:* ${apartment.preis}€
*Size:* ${apartment.groesse}m²
*Rooms:* ${apartment.anzahl_zimmer}
*Location:* ${apartment.strasse}, ${apartment.plz} ${apartment.ort}

[View Listing](https://www.wohnraumkarte.de/${apartment.slug})
    `;

  await bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, message, {
    parse_mode: "Markdown",
    disable_web_page_preview: false,
  });
}

export async function sendApplicationConfirmation(apartment: Apartment) {
  if (!bot) {
    throw new Error("Bot not initialized");
  }

  const message = `
✅ *Application Sent!*

Successfully applied for:
${apartment.titel}
${apartment.strasse}, ${apartment.plz} ${apartment.ort}
    `;

  await bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, message, {
    parse_mode: "Markdown",
  });
}
