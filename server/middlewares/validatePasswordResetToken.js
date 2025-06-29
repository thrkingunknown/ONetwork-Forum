/**
 * @file server/middlewares/validatePasswordResetToken.js
 * @description Middleware to validate JWTs specifically created for password reset requests.
 */

const jwt = require("jsonwebtoken");
const { TokenExpiredError } = jwt;

/**
 * Express middleware to validate a password reset token.
 * The token is expected in the `req.body.token`.
 * If valid, it attaches the decoded email to `req.user`.
 *
 * @async
 * @function validatePasswordResetToken
 * @param {import('express').Request} req - Express request object.
 * @param {object} req.body - Request body, expected to contain the token.
 * @param {string} req.body.token - The password reset token.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Does not return a value directly but calls `next()` or sends an HTTP response.
 * @todo Consider supporting token delivery via query parameters as well (common for email links).
 */
const validatePasswordResetToken = async (req, res, next) => {
  // Token can also be passed via query params (e.g., req.query.token) for GET requests
  // from password reset email links, which then lead to a page where the new password is entered.
  // Current implementation expects it in req.body.token (suitable for POST request after user clicks link).
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ // 400 Bad Request is more appropriate than 404
      message: "Password reset token is missing.",
    });
  }

  if (!process.env.RESET_PASSWORD_TOKEN_SECRET_KEY) {
    console.error("validatePasswordResetToken: RESET_PASSWORD_TOKEN_SECRET_KEY is not set.");
    return res.status(500).json({ message: "Server configuration error." });
  }

  // console.log(token); // This console.log can be removed for production

  jwt.verify(
    token,
    process.env.RESET_PASSWORD_TOKEN_SECRET_KEY,
    (err, decoded) => { // jwt.verify callback is synchronous here
      if (err) {
        if (err instanceof TokenExpiredError) {
          return res.status(400).json({ // Or 401 Unauthorized
            message: "Password reset token has expired. Please request a new one.",
            code: "TOKEN_EXPIRED",
          });
        }
        // For other JWT errors
        return res.status(400).json({ // Or 401
          message: "Password reset token is invalid. Please request a new one.",
          error: err.name,
        });
      }

      // Token is valid. Ensure the decoded payload contains the expected email.
      if (!decoded || !decoded.email) {
        console.error("validatePasswordResetToken: Token decoded but email is missing in payload.", decoded);
        return res.status(400).json({ // Or 401
          message: "Invalid password reset token payload.",
        });
      }

      // Attach the email (and potentially other relevant info from token) to req.user
      // This will be used by the controller that handles the actual password update.
      req.user = {
        email: decoded.email,
        // token_type: 'password_reset' // Optional: for clarity if req.user is used by various middlewares
      };

      next(); // Proceed to the password reset controller
    }
  );
};

module.exports = validatePasswordResetToken;
