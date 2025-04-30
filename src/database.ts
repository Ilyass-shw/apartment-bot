import { Pool } from "pg";

let pool: Pool | null = null;

export async function initializeDatabase() {
  console.log("💾 Starting database initialization...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL environment variable is not set. PostgreSQL is required."
      );
    }
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
    console.log("✅ Database schema verified/created");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  }
}

export async function isListingSeen(wrkId: string): Promise<boolean> {
  console.log(`🔍 Checking if listing ${wrkId} has been seen...`);
  try {
    if (!pool) throw new Error("Database not initialized");
    const result = await pool.query(
      "SELECT wrk_id FROM seen_listings WHERE wrk_id = $1",
      [wrkId]
    );
    const isSeen = result.rows.length > 0;
    console.log(`📌 Listing ${wrkId} seen status: ${isSeen}`);
    return isSeen;
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
    if (!pool) throw new Error("Database not initialized");
    await pool.query(
      "INSERT INTO seen_listings (wrk_id) VALUES ($1) ON CONFLICT (wrk_id) DO NOTHING",
      [wrkId]
    );
    console.log(`✅ Successfully marked listing ${wrkId} as seen`);
  } catch (error) {
    console.error(`❌ Error marking listing ${wrkId} as seen:`, error);
    throw error;
  }
}

export async function getSeenListings(): Promise<string[]> {
  console.log("📋 Retrieving all seen listings...");
  try {
    if (!pool) throw new Error("Database not initialized");
    const result = await pool.query("SELECT wrk_id FROM seen_listings");
    console.log(`✅ Retrieved ${result.rows.length} seen listings`);
    return result.rows.map((row) => row.wrk_id);
  } catch (error) {
    console.error("❌ Error retrieving seen listings:", error);
    throw error;
  }
}
