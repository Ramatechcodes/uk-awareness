require("dotenv").config();

const mongoose = require("mongoose");

async function clearDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI was not found in .env");
    }

    console.log("Connecting to MongoDB...");

    await mongoose.connect(mongoUri);

    console.log("✅ MongoDB connected.");

    const db = mongoose.connection.db;

    console.log("Database:", db.databaseName);

    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log("No collections found.");
      return;
    }

    console.log(`Found ${collections.length} collections.\n`);

    for (const collection of collections) {
      const result = await db
        .collection(collection.name)
        .deleteMany({});

      console.log(
        `🗑️ ${collection.name}: ${result.deletedCount} documents deleted`
      );
    }

    console.log("\n====================================");
    console.log("✅ ALL DATA HAS BEEN CLEARED");
    console.log("====================================");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("MongoDB disconnected.");
    }
  }
}

clearDatabase();