/**
 * @file server/config/db.js
 * @description MongoDB connection setup using Mongoose.
 */

const mongoose = require('mongoose');

/**
 * Asynchronously connects to the MongoDB database using the connection string
 * from the environment variables.
 *
 * @async
 * @function connectDB
 * @returns {Promise<void>} A promise that resolves when the connection is successful.
 * @throws {Error} If the connection to MongoDB fails, it logs the error message
 *                 and exits the process.
 */
const connectDB = async () => {
    try {
        // Mongoose 6+ defaults strictQuery to false. Explicitly setting it to true
        // prepares for Mongoose 7 behavior where it defaults to true.
        // Or set to false if you prefer the less strict querying.
        // For now, keeping it as it was in the original code.
        await mongoose.set("strictQuery", false);

        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URL_CONNECTION, {
            // useNewUrlParser: true, // Deprecated in Mongoose 6+
            // useUnifiedTopology: true, // Deprecated in Mongoose 6+
        });
        console.log('MongoDB Connected!');
    } catch(err) {
        console.error('MongoDB Connection Error: ', err.message);
        // Exit process with failure
        process.exit(1);
    }
}

module.exports = connectDB;
