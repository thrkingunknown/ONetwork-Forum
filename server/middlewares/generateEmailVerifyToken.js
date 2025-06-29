/**
 * @file server/middlewares/generateEmailVerifyToken.js
 * @description Utility function to generate a JWT for email verification.
 */

const jwt = require("jsonwebtoken");
// require("dotenv").config(); // dotenv should be configured once in the main server file (server.js)

/**
 * Generates an email verification token (JWT).
 *
 * @function generateEmailVerifyToken
 * @param {string} email - The email address to be included in the token payload.
 * @returns {string | null} The generated JWT string, or null if an error occurs.
 * @throws {Error} If JWT signing fails or environment variables are missing.
 */
const generateEmailVerifyToken = (email) => {
  if (!email) {
    console.error("generateEmailVerifyToken: Email is required.");
    return null; // Or throw new Error("Email is required.");
  }
  if (!process.env.EMAIL_VERIFY_TOKEN_SECRET_KEY || !process.env.EMAIL_VERIFY_TOKEN_EXPIRATION) {
    console.error("generateEmailVerifyToken: Missing required environment variables for email verification token.");
    // Depending on desired behavior, either return null or throw an error.
    // Throwing an error might be better to alert developers of configuration issues.
    throw new Error("Server configuration error: Email verification token secrets are not set.");
  }

  try {
    const emailVerifyToken = jwt.sign(
      { email }, // Payload
      process.env.EMAIL_VERIFY_TOKEN_SECRET_KEY, // Secret key
      {
        expiresIn: process.env.EMAIL_VERIFY_TOKEN_EXPIRATION, // Expiration time
      }
    );
    return emailVerifyToken;
  } catch (err) {
    console.error("Error generating email verification token:", err.message);
    // Instead of trying to send a response, throw the error or return null
    // so the calling function can handle it appropriately.
    // For critical operations like token generation, throwing might be better.
    throw err; // Re-throw the error to be caught by the controller
  }
};

module.exports = generateEmailVerifyToken;
