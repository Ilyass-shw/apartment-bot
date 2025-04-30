import { Pool } from "pg";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

let pool: Pool | null = null;
let sqliteDb: any = null;

export async function initializeDatabase() {
  console.log("💾 Starting database initialization...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  try {
    // Use PostgreSQL in production (Railway), SQLite locally
    if (process.env.DATABASE_URL) {
      console.log("📡 Using PostgreSQL database (production)");
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      });

      // Test the connection
      await pool.query("SELECT NOW()");
      console.log("✅ PostgreSQL connection established");

      // Create the table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS seen_listings (
          wrk_id TEXT PRIMARY KEY,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      console.log("💿 Using SQLite database (local development)");
      sqliteDb = await open({
        filename: "./apartments.db",
        driver: sqlite3.Database,
      });

      await sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS seen_listings (
          wrk_id TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    console.log("✅ Database schema verified/created");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  }
}

export async function isListingSeen(wrkId: string): Promise<boolean> {
  console.log(`🔍 Checking if listing ${wrkId} has been seen...`);
  try {
    if (pool) {
      const result = await pool.query(
        "SELECT wrk_id FROM seen_listings WHERE wrk_id = $1",
        [wrkId]
      );
      const isSeen = result.rows.length > 0;
      console.log(`📌 Listing ${wrkId} seen status: ${isSeen}`);
      return isSeen;
    } else if (sqliteDb) {
      const result = await sqliteDb.get(
        "SELECT wrk_id FROM seen_listings WHERE wrk_id = ?",
        wrkId
      );
      const isSeen = !!result;
      console.log(`📌 Listing ${wrkId} seen status: ${isSeen}`);
      return isSeen;
    } else {
      throw new Error("Database not initialized");
    }
  } catch (error) {
    console.error(
      `❌ Error checking if listing ${wrkId} has been seen:`,
      error
    );
    throw error;
  }
}

export async function markListingAsSeen(wrkId: string) {
  console.log(`📝 Marking listing ${wrkId} as seen...`);
  try {
    if (pool) {
      await pool.query(
        "INSERT INTO seen_listings (wrk_id) VALUES ($1) ON CONFLICT (wrk_id) DO NOTHING",
        [wrkId]
      );
    } else if (sqliteDb) {
      await sqliteDb.run(
        "INSERT OR IGNORE INTO seen_listings (wrk_id) VALUES (?)",
        wrkId
      );
    } else {
      throw new Error("Database not initialized");
    }
    console.log(`✅ Successfully marked listing ${wrkId} as seen`);
  } catch (error) {
    console.error(`❌ Error marking listing ${wrkId} as seen:`, error);
    throw error;
  }
}

export async function getSeenListings(): Promise<string[]> {
  console.log("📋 Retrieving all seen listings...");
  try {
    if (pool) {
      const result = await pool.query("SELECT wrk_id FROM seen_listings");
      console.log(`✅ Retrieved ${result.rows.length} seen listings`);
      return result.rows.map((row) => row.wrk_id);
    } else if (sqliteDb) {
      const results = await sqliteDb.all("SELECT wrk_id FROM seen_listings");
      console.log(`✅ Retrieved ${results.length} seen listings`);
      return results.map((row: any) => row.wrk_id);
    } else {
      throw new Error("Database not initialized");
    }
  } catch (error) {
    console.error("❌ Error retrieving seen listings:", error);
    throw error;
  }
}
