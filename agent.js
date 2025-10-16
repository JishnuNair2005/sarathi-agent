// agent.js
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import fs from 'fs';
import { connectToDatabase } from './database.js';
import { handleOnboarding } from "./onboarding.js";


// Using the initialization from your working code
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Function to load our database from the JSON file
function loadDatabase() {
  const data = fs.readFileSync('database.json', 'utf8');
  return JSON.parse(data);
}

// Function to SAVE our database to the JSON file
function saveDatabase(db) {
  const data = JSON.stringify(db, null, 2);
  fs.writeFileSync('database.json', data);
}

export async function handleIncomingMessage(message, userId) {
  try {
   const db = await connectToDatabase();
    const usersCollection = db.collection('users'); // Get the 'users' collection
    let user = await usersCollection.findOne({ _id: userId }); // Find user by their ID

    if (!user || user.state !== 'onboarded') {
      if (!user) {
        // Create a new user if they don't exist
        // db[userId] = {
        //   profile: {
        //     // Initialize all profile fields here, with health and financials nested inside
        //     name: "", 
        //     vehicle: "", 
        //     last_service_km: 0, 
        //     current_km: 0,
        //     health: { conditions: [], notes: "" },
        //     financials: { income_per_day_avg: 0, current_balance: 0, loans: [] }
        //   },
        //   history: [],
        //   transactions: [],
        //   state: "awaiting_name"
        // };
         const newUser= {
          _id: userId,
          profile: {
            language: "English", // Default language
            name: "", vehicle: "", last_service_km: 0, current_km: 0,
            health: { conditions: [], notes: "" },
            financials: { income_per_day_avg: 0, current_balance: 0, loans: [] }
          },
          history: [], transactions: [],
          state: "awaiting_language" // New initial state
        };

        await usersCollection.insertOne(newUser);
        
        // **THIS IS THE FIX:** Immediately return the welcome message and stop.
        return "Welcome to Sarathi! For English, reply with '1'. हिंदी के लिए, '2' के साथ उत्तर दें।";
      }
      
      const onboardingResponse = handleOnboarding(user, message);
      // Update the user's document in the DB with the new state and profile info
      await usersCollection.updateOne({ _id: userId }, { $set: { profile: user.profile, state: user.state } });
      return onboardingResponse;
    }
    if(user.state === 'onboarded'){
    const { name, vehicle, last_service_km, current_km, health, financials ,language} = user.profile;

  const system_instruction = `
    You are Sarathi, an AI resilience agent for a gig worker in Mumbai. Your goal is to be a guardian angel, protecting the user's vehicle, health, and finances.

    --- YOUR PERSONALITY ---
    - Always be friendly, positive, and encouraging. Your tone should be like a helpful and caring friend.
    - Use emojis frequently to make the conversation feel lively and human. Some good ones are 👍, 😊, 💰, 🎉, 🛵, and 💪.

    --- YOUR FORMATTING RULES ---
    - You are communicating via WhatsApp. To make a word or phrase bold, you MUST enclose it in single asterisks. For example: *This is important*.
    - When you mention specific monetary amounts (like income, savings, profits, or costs), always make them bold.
    - **CRITICAL RULE:** All of your responses MUST be less than 1500 characters to fit within WhatsApp's limits. Be concise and to the point.

    --- TRANSACTION PARSING ---
        CRITICAL RULE: Your entire response MUST be a valid JSON object. It must have two keys: "reply" and "transactions".
        1. "reply": This key holds your friendly, conversational response to the user in text format.
        2. "transactions": This key holds an array of transaction objects you find in the user's message.
        
        - If the user mentions earning money (e.g., 'kamaya', 'earned', 'mila'), create an income object: { "type": "income", "amount": <number>, "category": "<category>" }.
        - If the user mentions spending money (e.g., 'kharch', 'spent', 'lag gaya'), create an expense object: { "type": "expense", "amount": <number>, "category": "<category>" }.
        - Infer the category from the context (e.g., 'chai', 'petrol', 'auto' -> 'Food', 'Fuel', 'Transport').
        - If no transactions are mentioned, the "transactions" array MUST be empty: [].

    --- USER CONTEXT ---
    - Name: ${name}
    - Vehicle: ${vehicle}
    - Language Preference: ${language}
    - Health Info: Conditions: ${health.conditions.join(', ') || 'None'}. Notes: ${health.notes}
    - Financials: Avg Daily Income: ₹${financials.income_per_day_avg}, Current Balance: ₹${financials.current_balance}, Active Loans: ${financials.loans.length} (Total EMI: ₹${financials.loans.reduce((sum, loan) => sum + loan.monthly_emi, 0)}/month)

    --- YOUR CORE INSTRUCTIONS ---
    1.  **Vehicle Health:** If the user's vehicle is not 'None' and they mention a problem, use their mileage to give advice.
    2.  **Personal Health:** If the user mentions feeling unwell, be empathetic and use the health notes for context.
    3.  **Financial Advice:** Give realistic financial advice based on the user's income, balance, and loans.
    4.  **Be a Coach:** Always be actionable and focus on empowering the user.
    `;

    // --- HISTORY IMPLEMENTATION (Corrected for your working code) ---

    // 1. Combine the instructions, history, and new message into a single "contents" array
    const contents = [
      ...(user.history || []), // Add the past conversation
      { role: "user", parts: [{ text: system_instruction + "\n\nUser: " + message }] } // Add the new message WITH instructions
    ];

    // 2. Call the API using the exact `ai.models.generateContent` pattern that works for you
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
    });

    // 3. Parse the response using the direct access method that works for you
    const rawText = response.text;
    // --- THIS IS THE FIX ---
        // 1. Find the first '{' and the last '}' in the AI's response.
        const firstBracket = rawText.indexOf('{');
        const lastBracket = rawText.lastIndexOf('}');

        // 2. If we found both, slice the string to get only the JSON part.
        const jsonString = (firstBracket !== -1 && lastBracket !== -1) 
            ? rawText.substring(firstBracket, lastBracket + 1)
            : rawText;
        // -----------------------
    let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonString);
        } catch (e) {
            console.error("Failed to parse JSON from AI:", rawText);
            return "Sorry, I had a little trouble understanding that. Could you try again?";
        }

        const { reply, transactions } = parsedResponse;

        // Save the conversational part to history
        await usersCollection.updateOne({ _id: userId }, {
            $push: {
                history: { $each: [
                    { role: 'user', parts: [{ text: message }], timestamp: new Date() },
                    { role: 'model', parts: [{ text: reply }], timestamp: new Date() }
                ]}
            }
        });
        
        // Save the structured transaction data to the transactions array
        if (transactions && transactions.length > 0) {
            // First, add a timestamp to each transaction object from the AI
            const transactionsWithTimestamp = transactions.map(tx => ({
                ...tx,
                timestamp: new Date()
            }));

            // Now, push all the new transactions to the database in one go
            await usersCollection.updateOne({ _id: userId }, {
                $push: {
                    transactions: { $each: transactionsWithTimestamp }
                }
            });
        }
        return reply;

}
  } catch (error) {
    console.error("Error in handleIncomingMessage:", error);
    return "Sorry, my brain is having some trouble with its memory right now.";
  }

}