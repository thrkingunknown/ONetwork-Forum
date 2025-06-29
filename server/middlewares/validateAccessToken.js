/**
 * @file server/middlewares/validateAccessToken.js
 * @description Middleware to validate JWT access tokens from the Authorization header.
 */

const jwt = require("jsonwebtoken");
const { TokenExpiredError } = jwt; // Specific error type for expired tokens

/**
 * Express middleware to validate an access token provided in the Authorization header.
 * If valid, it attaches the decoded user information to `req.user`.
 *
 * @async
 * @function validateAccessToken
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Does not return a value directly but calls `next()` or sends an HTTP response.
 */
const validateAccessToken = async (req, res, next) => {
  const authHeader = req.headers.authorization; // Standard way to get Authorization header

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Unauthorized: No token provided or malformed token.",
    });
  }

  const accessToken = authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

  if (!accessToken) {
    return res.status(401).json({
      message: "Unauthorized: Token is missing after Bearer prefix.",
    });
  }

  if (!process.env.ACCESS_TOKEN_SECRET_KEY) {
    console.error("validateAccessToken: ACCESS_TOKEN_SECRET_KEY is not set in environment variables.");
    return res.status(500).json({ message: "Server configuration error." });
  }

  jwt.verify(
    accessToken,
    process.env.ACCESS_TOKEN_SECRET_KEY,
    (err, decoded) => { // Changed to synchronous callback handling as jwt.verify is sync by default with callback
      if (err) {
        if (err instanceof TokenExpiredError) {
          return res.status(401).json({
            message: "Unauthorized: Access Token has expired.",
            code: "TOKEN_EXPIRED", // Optional: provide a code for frontend to handle
          });
        }
        // For other JWT errors (e.g., malformed, invalid signature)
        return res.status(401).json({
          message: "Unauthorized: Invalid Access Token.",
          error: err.name, // Provide error name for debugging if needed
        });
      }

      // Token is valid, attach decoded payload to req.user
      // Ensure the payload structure matches what was signed in generateAccessToken
      // Typically includes userId, email, username, roles etc.
      if (!decoded || !decoded.userId) { // Check for essential payload fields like userId
          console.error("validateAccessToken: Token decoded but essential user information (userId) is missing.", decoded);
          return res.status(401).json({
            message: "Unauthorized: Invalid token payload.",
          });
      }

      // Attach the relevant user information from the token to req.user
      // This should match the payload structure of your access token
      req.user = {
        _id: decoded.userId, // Assuming token payload has userId
        userId: decoded.userId, // Redundant but for clarity if used elsewhere
        email: decoded.email,
        username: decoded.username,
        roles: decoded.roles || ['user'], // Default roles if not in token
      };

      next(); // Proceed to the next middleware or route handler
    }
  );
};

module.exports = validateAccessToken;
