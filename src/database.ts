import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { Apartment } from "./types";

let db: any = null;

export async function initializeDatabase() {
  db = await open({
    filename: "./apartments.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
        CREATE TABLE IF NOT EXISTS seen_listings (
            wrk_id TEXT PRIMARY KEY,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

export async function isListingSeen(wrkId: string): Promise<boolean> {
  const result = await db.get(
    "SELECT wrk_id FROM seen_listings WHERE wrk_id = ?",
    wrkId
  );
  return !!result;
}

export async function markListingAsSeen(wrkId: string) {
  await db.run(
    "INSERT OR IGNORE INTO seen_listings (wrk_id) VALUES (?)",
    wrkId
  );
}

export async function getSeenListings(): Promise<string[]> {
  const results = await db.all("SELECT wrk_id FROM seen_listings");
  return results.map((row: any) => row.wrk_id);
}
