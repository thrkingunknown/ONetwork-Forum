/**
 * @file server/middlewares/validateEmailVerifyToken.js
 * @description Middleware to validate JWTs specifically created for email verification.
 */

const jwt = require("jsonwebtoken");
const { TokenExpiredError } = jwt;

/**
 * Express middleware to validate an email verification token.
 * The token is expected in the `req.body.token`.
 * If valid, it attaches the decoded email to `req.user`.
 *
 * @async
 * @function validateEmailVerifyToken
 * @param {import('express').Request} req - Express request object.
 * @param {object} req.body - Request body, expected to contain the token.
 * @param {string} req.body.token - The email verification token.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Does not return a value directly but calls `next()` or sends an HTTP response.
 * @todo Consider supporting token delivery via query parameters as well (common for email links).
 */
const validateEmailVerifyToken = async (req, res, next) => {
  // Token can also be passed via query params (e.g., req.query.token) for GET requests from email links.
  // Current implementation expects it in req.body.token.
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ // 400 Bad Request is more appropriate than 404
      message: "Email verification token is missing.",
    });
  }

  if (!process.env.EMAIL_VERIFY_TOKEN_SECRET_KEY) {
    console.error("validateEmailVerifyToken: EMAIL_VERIFY_TOKEN_SECRET_KEY is not set.");
    return res.status(500).json({ message: "Server configuration error." });
  }

  jwt.verify(
    token,
    process.env.EMAIL_VERIFY_TOKEN_SECRET_KEY,
    (err, decoded) => { // jwt.verify callback is synchronous here
      if (err) {
        if (err instanceof TokenExpiredError) {
          return res.status(400).json({ // Or 401 Unauthorized
            message: "Email verification token has expired. Please request a new activation link.",
            code: "TOKEN_EXPIRED",
          });
        }
        // For other JWT errors (malformed, invalid signature)
        return res.status(400).json({ // Or 401
          message: "Email verification token is invalid. Please request a new activation link.",
          error: err.name,
        });
      }

      // Token is valid. Ensure the decoded payload contains the expected email.
      if (!decoded || !decoded.email) {
        console.error("validateEmailVerifyToken: Token decoded but email is missing in payload.", decoded);
        return res.status(400).json({ // Or 401
          message: "Invalid email verification token payload.",
        });
      }

      // Attach the email (and potentially other relevant info from token) to req.user
      // This middleware is specifically for email verification, so req.user might be simpler.
      req.user = {
        email: decoded.email,
        // You might add a flag to indicate the purpose of this user object
        // e.g., token_type: 'email_verification'
      };

      next(); // Proceed to the next handler (likely the controller that performs email verification)
    }
  );
};

module.exports = validateEmailVerifyToken;
