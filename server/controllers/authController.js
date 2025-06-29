/**
 * @file server/controllers/authController.js
 * @description Handles authentication related functionalities like register, login, logout,
 * token refresh, email verification, and password reset.
 */

const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../middlewares/generateTokens");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/nodemailer");
const verifyEmailTemplate = require("../utils/Emails_Templates/verifyEmailTemplate");
const forgotPasswordTemplate = require("../utils/Emails_Templates/forgotPasswordTemplate");
const generateEmailVerifyToken = require("../middlewares/generateEmailVerifyToken");
const generatePasswordResetToken = require("../middlewares/generatePasswordResetToken");

module.exports = {
  /**
   * @async
   * @function register
   * @description Registers a new user.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.body - Request body.
   * @param {string} req.body.username - User's username.
   * @param {string} req.body.email - User's email.
   * @param {string} req.body.password - User's password.
   * @param {string} req.body.firstName - User's first name.
   * @param {string} req.body.lastName - User's last name.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  register: async (req, res) => {
    const { username, email, password, firstName, lastName } = req.body;
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(422).json({
        message: "Required field(s) are missing!",
      });
    }
    try {
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          message: "An account already exists with this email!",
        });
      }
      existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          message: "An account already exists with this username!",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        firstName,
        lastName,
        email,
        username,
        password: hashedPassword,
      });
      
      const token = generateEmailVerifyToken(email);
      const emailOptions = {
        email: email,
        subject: "Verify your email address",
        html: verifyEmailTemplate(user, token),
      };

      await sendEmail(emailOptions);

      return res.status(201).json({
        message: `Email has been sent to ${email}. Follow the instructions to activate your account.`,
      });
    } catch (err) {
      console.error("Register Error:", err);
      return res.status(500).json({
        message: "Error registering user: " + err.message,
      });
    }
  },

  /**
   * @async
   * @function login
   * @description Logs in an existing user.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.body - Request body.
   * @param {string} req.body.email - User's email.
   * @param {string} req.body.password - User's password.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  login: async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        message: "Email or password are missing!",
      });
    }
    try {
      const userExisted = await User.findOne({ email }).select('+password'); // Explicitly select password
      if (!userExisted) {
        return res.status(400).json({
          message: "No such user with this email!",
        });
      }
      const passwordValid = await bcrypt.compare(
        password,
        userExisted.password
      );
      if (!passwordValid) {
        return res.status(400).json({
          message: "Invalid password!",
        });
      }
      if (!userExisted.isVerified) {
        return res.status(400).json({
          message: "You must activate your account before you can login!",
        });
      }
      const accessToken = generateAccessToken(userExisted);
      const refreshToken = generateRefreshToken(
        userExisted,
        process.env.REFRESH_TOKEN_EXPIRATION
      );

      res.cookie("refreshToken", refreshToken, {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Send only over HTTPS in production
        sameSite: "Strict",
        path: "/refresh_token", // Ensure this path matches where refresh_token expects it
      });

      // Prepare user object for response (remove sensitive data)
      const userResponse = userExisted.toObject();
      delete userResponse.password;
      delete userResponse.__v;

      return res.status(200).json({
        message: "User logged-in successfully!",
        token: accessToken,
        user: userResponse,
        isLoggedIn: true,
      });
    } catch (err) {
      console.error("Login Error:", err);
      return res.status(500).json({
        message: "Error logging in: " + err.message,
      });
    }
  },

  /**
   * @async
   * @function refresh_token
   * @description Refreshes the access token using a refresh token.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.cookies - Cookies from the request.
   * @param {string} req.cookies.refreshToken - The refresh token.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  refresh_token: async (req, res) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(403).json({
        message: "Unauthorized, You must login!",
      });
    }
    try {
      const payload = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET_KEY
      );

      const user = await User.findOne(
        { email: payload.email },
        { __v: 0, password: 0 } // Exclude password and version key
      );

      if (!user) {
        // Clear potentially compromised refresh token
        res.cookie("refreshToken", "", {
          maxAge: 0,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Strict",
          path: "/refresh_token",
        });
        return res.status(403).json({ // Changed from res.json to res.status().json()
          message: "Unauthorized, user not found!",
        });
      }

      const expiration = payload.exp - Math.floor(Date.now() / 1000);
      if (expiration <= 0) {
        return res.status(403).json({ message: "Refresh token expired." });
      }

      const newAccessToken = generateAccessToken(user);
      // Optionally, generate a new refresh token (e.g., for token rotation)
      // For simplicity here, we use the existing expiration for the new one if not rotating
      const newRefreshToken = generateRefreshToken(user, `${expiration}s`);


      res.cookie("refreshToken", newRefreshToken, {
        maxAge: expiration * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        path: "/refresh_token",
      });

      return res.status(200).json({ // Added status
        user: user, // user object already excludes password here
        token: newAccessToken,
      });
    } catch (err) {
      console.error("Refresh Token Error:", err);
      // Handle specific JWT errors
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Refresh token expired.' });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ message: 'Invalid refresh token.' });
      }
      return res.status(500).json({
        message: "Error refreshing token: " + err.message,
      });
    }
  },

  /**
   * @async
   * @function logout
   * @description Logs out the current user by clearing the refresh token cookie.
   * @param {import('express').Request} req - Express request object (user attached by auth middleware).
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  logout: async (req, res) => {
    try {
      // req.user should be populated by an authentication middleware if logout is a protected route
      // If not, this check might not be necessary or might need to rely on cookie presence
      if (!req.cookies.refreshToken) {
         return res.status(400).json({
          message: "You're not logged-in or no refresh token found!",
        });
      }

      res.cookie("refreshToken", "", { // Clear the cookie
        maxAge: 0, // Expire immediately
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        path: "/refresh_token",
      });
      return res.status(200).json({ // Added status
        message: "User successfully logged out!",
      });
    } catch (err) {
      console.error("Logout Error:", err);
      return res.status(500).json({ message: "Error logging out: " + err.message }); // Standardized error
    }
  },

  /**
   * @async
   * @function emailVerify
   * @description Verifies a user's email using a token (presumably from req.user populated by a token validation middleware).
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from token validation middleware.
   * @param {string} req.user.email - User's email from token.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  emailVerify: async (req, res) => {
    try {
      // req.user is expected to be populated by validateEmailVerifyToken middleware
      const { email } = req.user;
      if (!email) {
        // This case should ideally be caught by the middleware itself
        return res.status(400).json({
          message: "Email verification token is invalid or missing user data.",
        });
      }
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          message: "No such user with this email!",
        });
      }
      if (user.isVerified) {
        return res.status(400).json({
          message: "Your e-mail is already verified!",
        });
      }

      await User.findOneAndUpdate(
        { email },
        { isVerified: true },
        { new: true } // Return the updated document
      );
      return res.status(200).json({
        message: "Your e-mail has been successfully verified!",
      });

    } catch (err) {
      console.error("Email Verify Error:", err);
      return res.status(500).json({ message: "Error verifying email: " + err.message });
    }
  },

  /**
   * @async
   * @function sendEmailVerification
   * @description Sends or re-sends an email verification link to the user.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.body - Request body.
   * @param {string} req.body.email - User's email.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  sendEmailVerification: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          message: "No email was provided, Please enter an email!",
        });
      }
      const user = await User.findOne({ email }, { __v: 0, password: 0 });
      if (!user) {
        return res.status(404).json({
          message: "No such user with this email!",
        });
      }
      if (user.isVerified) {
        return res.status(400).json({
          message: "Your e-mail is already verified!",
        });
      }

      const token = generateEmailVerifyToken(email);
      const emailOptions = {
        email: email,
        subject: "Verify your email address",
        html: verifyEmailTemplate(user, token),
      };

      await sendEmail(emailOptions);
      return res.status(200).json({
        message: `An account activation link has been sent to ${email}`,
      });

    } catch (err) {
      console.error("Send Email Verification Error:", err);
      return res.status(500).json({ message: "Error sending verification email: " + err.message });
    }
  },

  /**
   * @async
   * @function resetPassword
   * @description Resets the user's password using a token (from req.user populated by middleware).
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from token validation middleware.
   * @param {string} req.user.email - User's email from token.
   * @param {object} req.body - Request body.
   * @param {string} req.body.newPassword - The new password.
   * @param {string} req.body.confirmNewPassword - Confirmation of the new password.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  resetPassword: async (req, res) => {
    try {
      // req.user is expected to be populated by validatePasswordResetToken middleware
      const { email } = req.user;
      const { newPassword, confirmNewPassword } = req.body;

      if (!email) {
         // This case should ideally be caught by the middleware itself
        return res.status(400).json({
          message: "Password reset token is invalid or missing user data.",
        });
      }
      if (!newPassword?.trim() || !confirmNewPassword?.trim()) {
        return res.status(400).json({ // Changed from 404
          message: "You have to enter both the new password and confirmation!",
        });
      }
      if (newPassword.trim() !== confirmNewPassword.trim()) {
        return res.status(400).json({ // Changed from 404
          message:
            "The two passwords that you entered must be the same. Try again!",
        });
      }
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          message: "No such user with this email!",
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
      user.password = hashedPassword;
      await user.save();
      return res.status(200).json({
        message: "Your password has been reset successfully.",
      });
    } catch (err) {
      console.error("Reset Password Error:", err);
      return res.status(500).json({ message: "Error resetting password: " + err.message });
    }
  },

  /**
   * @async
   * @function sendForgotPassword
   * @description Sends a password reset link to the user's email.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.body - Request body.
   * @param {string} req.body.email - User's email.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  sendForgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          message: "No email was provided, Please enter an email!",
        });
      }
      const user = await User.findOne({ email }, { __v: 0, password: 0 });
      if (!user) {
        return res.status(404).json({
          message: "No such user with this email!",
        });
      }
      // Optionally, check if user is verified before sending password reset
      // if (!user.isVerified) {
      //   return res.status(400).json({
      //     message: "Please verify your email address first.",
      //   });
      // }

      const token = generatePasswordResetToken(email);
      const emailOptions = {
        email: email,
        subject: "Reset your password",
        html: forgotPasswordTemplate(user, token),
      };

      await sendEmail(emailOptions);
      return res.status(200).json({
        message: `Reset password email has been sent to ${email}`,
      });
    } catch (err) {
      console.error("Send Forgot Password Error:", err);
      return res.status(500).json({ message: "Error sending password reset email: " + err.message });
    }
  },
};
