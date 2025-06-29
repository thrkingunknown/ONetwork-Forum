/**
 * @file server.js
 * @description Main entry point for the Express application.
 * Sets up middleware, routes, database connection, and starts the server.
 */

// Import necessary modules
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const dotenv = require("dotenv");

// Import custom modules
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const topicRoutes = require("./routes/topicRoutes");
const commentRoutes = require("./routes/commentRoutes");
const userRoutes = require("./routes/userRoutes");

// Load environment variables from .env file
dotenv.config();

// Define the port for the server
const PORT = process.env.PORT || 5000;

// Connect to MongoDB database
connectDB();

// Initialize the Express application
const app = express();

// --- Middleware Setup ---

// Parse incoming JSON requests
app.use(express.json());
// Parse incoming URL-encoded requests with extended options
app.use(express.urlencoded({ extended: true }));
// Parse cookies attached to the client request object
app.use(cookieParser());
// HTTP request logger middleware for node.js (dev format)
app.use(morgan("dev"));
// Secure Express apps by setting various HTTP headers
app.use(helmet());
// Middleware for handling file uploads
app.use(fileUpload({ useTempFiles: true, tempFileDir: "./tmp" }));

// Configure Cross-Origin Resource Sharing (CORS)
// Allows requests from the specified React application URL with credentials
app.use(
  cors({
    origin: process.env.REACT_APP_URL, // Note: This will need to be updated to VITE_APP_URL later
    credentials: true,
  })
);

// --- Route Setup ---

// Mount authentication routes at the root path
app.use("/", authRoutes);
// Mount topic-related API routes under /api/topics
app.use("/api/topics", topicRoutes);
// Mount comment-related API routes under /api/comments
app.use("/api/comments", commentRoutes);
// Mount user-related API routes under /api/user
app.use("/api/user", userRoutes);

// --- Server Initialization ---

/**
 * Starts the Express server and listens on the defined PORT.
 */
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
