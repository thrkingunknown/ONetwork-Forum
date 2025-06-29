/**
 * @file server/models/spaceModel.js
 * @description Defines the Mongoose schema and model for a Space.
 * Spaces could represent categories, forums, or distinct sections within the application.
 */

const mongoose = require("mongoose");

/**
 * Mongoose schema for Space documents.
 * @type {mongoose.Schema}
 * @property {string} name - The name of the space. Should be unique.
 * @property {string} [avatar] - URL to an avatar or icon image for the space.
 * @property {string} [description] - A brief description of the space.
 * @property {mongoose.Schema.Types.ObjectId} [createdBy] - Reference to the User who created the space.
 * @property {Date} createdAt - Timestamp of when the space was created.
 * @property {Date} updatedAt - Timestamp of when the space was last updated.
 */
const SpaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Space name is required."],
      trim: true,
      unique: true, // Ensure space names are unique
      minlength: [2, "Space name must be at least 2 characters long."],
      maxlength: [100, "Space name cannot exceed 100 characters."],
    },
    avatar: { // URL for the space's avatar/icon
      type: String,
      trim: true,
      // match: [/^https?:\/\/.+\..+/, "Avatar must be a valid URL."], // Basic URL validation
      default: null, // Or a default avatar URL: "https://example.com/default-space-avatar.png"
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, "Description cannot exceed 500 characters."],
        default: "",
    },
    // Example: createdBy field if you want to track who created the space
    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'User',
    //   required: true,
    // },
    // topics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }] // If spaces directly contain topics
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Index for space name to speed up searches
SpaceSchema.index({ name: 1 });

/**
 * Mongoose model for Space.
 * @type {mongoose.Model<mongoose.Document & typeof SpaceSchema.methods & typeof SpaceSchema.statics>}
 */
module.exports = mongoose.model("Space", SpaceSchema);
