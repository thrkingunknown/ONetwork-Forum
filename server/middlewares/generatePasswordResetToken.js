/**
 * @file server/middlewares/generatePasswordResetToken.js
 * @description Utility function to generate a JWT for password reset.
 */

const jwt = require("jsonwebtoken");
// require("dotenv").config(); // dotenv should be configured once in the main server file (server.js)

/**
 * Generates a password reset token (JWT).
 *
 * @function generatePasswordResetToken
 * @param {string} email - The email address to be included in the token payload.
 *                         This identifies the user for whom the password reset is intended.
 * @returns {string | null} The generated JWT string, or null if an error occurs or email is not provided.
 * @throws {Error} If JWT signing fails or environment variables are missing.
 */
const generatePasswordResetToken = (email) => {
  if (!email) {
    console.error("generatePasswordResetToken: Email is required.");
    return null; // Or throw new Error("Email is required for password reset token.");
  }
  if (!process.env.RESET_PASSWORD_TOKEN_SECRET_KEY || !process.env.RESET_PASSWORD_TOKEN_EXPIRATION) {
    console.error("generatePasswordResetToken: Missing required environment variables for password reset token.");
    // Throwing an error is generally better for configuration issues.
    throw new Error("Server configuration error: Password reset token secrets are not set.");
  }

  try {
    const resetPasswordToken = jwt.sign(
      { email }, // Payload containing the user's email
      process.env.RESET_PASSWORD_TOKEN_SECRET_KEY, // Secret key from environment variables
      {
        expiresIn: process.env.RESET_PASSWORD_TOKEN_EXPIRATION, // Expiration time from environment variables
      }
    );
    return resetPasswordToken;
  } catch (err) {
    console.error("Error generating password reset token:", err.message);
    // Re-throw the error to be handled by the calling controller,
    // which can then decide on the appropriate HTTP response.
    throw err;
  }
};

module.exports = generatePasswordResetToken;
