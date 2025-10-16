// database.js
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

export async function connectToDatabase() {
    if (db) return db; // Return the existing connection if it's already there
    try {
        await client.connect();
        db = client.db('sarathi'); // We'll name our database 'sarathi'
        console.log("Successfully connected to MongoDB Atlas!");
        return db;
    } catch (error) {
        console.error("Could not connect to MongoDB Atlas:", error);
        process.exit(1); // Exit if we can't connect to the DB
    }
}