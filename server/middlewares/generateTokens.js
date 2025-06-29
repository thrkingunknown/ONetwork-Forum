/**
 * @file server/middlewares/generateTokens.js
 * @description Utility functions to generate JWT access and refresh tokens for user authentication.
 */

const jwt = require("jsonwebtoken");
// const dotenv = require("dotenv"); // dotenv should be configured once in the main server file
// dotenv.config(); // Called in server.js

/**
 * Generates an access token for a user.
 *
 * @function generateAccessToken
 * @param {object} user - The user object for whom the token is generated.
 * @param {string} user._id - The unique identifier of the user.
 * @param {string} user.email - The email of the user.
 * @param {string} user.username - The username of the user.
 * @param {Array<string>} [user.roles] - Optional: User roles for role-based access control.
 * @returns {string | null} The generated JWT access token, or null if an error occurs.
 * @throws {Error} If JWT signing fails or necessary environment variables are missing.
 */
const generateAccessToken = (user) => {
  if (!user || !user._id || !user.email || !user.username) {
    console.error("generateAccessToken: User object with _id, email, and username is required.");
    // Or throw new Error("User data is incomplete for generating access token.");
    return null;
  }
  if (!process.env.ACCESS_TOKEN_SECRET_KEY || !process.env.ACCESS_TOKEN_EXPIRATION) {
    console.error("generateAccessToken: Missing required environment variables for access token.");
    throw new Error("Server configuration error: Access token secrets are not set.");
  }

  try {
    // Payload should contain essential, non-sensitive user information.
    // User ID is crucial for identifying the user.
    const payload = {
      userId: user._id, // Standard claim for user ID is often 'sub' (subject)
      email: user.email,
      username: user.username,
      // roles: user.roles || ['user'] // Example: include roles if your app uses them
    };

    const accessToken = jwt.sign(
      payload,
      process.env.ACCESS_TOKEN_SECRET_KEY,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRATION,
      }
    );
    return accessToken;
  } catch (err) {
    console.error("Error generating access token:", err.message);
    throw err; // Re-throw to be handled by the controller
  }
};

/**
 * Generates a refresh token for a user.
 *
 * @function generateRefreshToken
 * @param {object} user - The user object for whom the token is generated.
 * @param {string} user._id - The unique identifier of the user.
 * @param {string} user.email - The email of the user.
 * @param {string} user.username - The username of the user.
 * @param {string | number} expiration - The expiration time for the refresh token (e.g., "7d", "3600s").
 * @returns {string | null} The generated JWT refresh token, or null if an error occurs.
 * @throws {Error} If JWT signing fails or necessary environment variables are missing.
 */
const generateRefreshToken = (user, expiration) => {
  if (!user || !user._id || !user.email || !user.username) {
    console.error("generateRefreshToken: User object with _id, email, and username is required.");
    return null;
  }
  if (!expiration) {
    console.error("generateRefreshToken: Expiration is required for refresh token.");
    return null;
  }
  if (!process.env.REFRESH_TOKEN_SECRET_KEY) {
    console.error("generateRefreshToken: Missing REFRESH_TOKEN_SECRET_KEY environment variable.");
    throw new Error("Server configuration error: Refresh token secret is not set.");
  }

  try {
    const payload = {
      userId: user._id,
      email: user.email,
      username: user.username,
      // Add a claim to differentiate refresh tokens if needed, e.g., type: 'refresh'
    };

    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_SECRET_KEY,
      {
        expiresIn: expiration,
      }
    );
    return refreshToken;
  } catch (err) {
    console.error("Error generating refresh token:", err.message);
    throw err; // Re-throw to be handled by the controller
  }
};

module.exports = { generateAccessToken, generateRefreshToken };
