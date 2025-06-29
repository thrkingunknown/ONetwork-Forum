/**
 * @file server/models/tagModel.js
 * @description Defines the Mongoose schema and model for a Tag.
 */

const mongoose = require("mongoose");

/**
 * Mongoose schema for Tag documents.
 * @type {mongoose.Schema}
 * @property {string} name - The name of the tag. Should be unique and is case-sensitive by default.
 * @property {string} createdBy - Username of the user who created the tag. Links to User.username via 'author' virtual.
 *                                Consider storing user's ObjectId: `creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }`.
 * @property {Date} createdAt - Timestamp of when the tag was created.
 * @property {Date} updatedAt - Timestamp of when the tag was last updated.
 */
const TagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tag name is required."],
      trim: true,
      unique: true, // Ensures tag names are unique
      lowercase: true, // Store tags in lowercase to avoid duplicates like 'React' and 'react'
      minlength: [1, "Tag name cannot be empty."],
      maxlength: [50, "Tag name cannot exceed 50 characters."],
    },
    createdBy: { // Username of the tag creator
      type: String,
      required: [true, "Tag creator (username) is required."],
      // Consider: createdByRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    // topics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }] // If you want to track topics associated with a tag
    // usageCount: { type: Number, default: 0 } // To track how many times a tag is used
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toObject: { virtuals: true }, // Ensure virtuals are included when converting to an object
    toJSON: { virtuals: true },   // Ensure virtuals are included when converting to JSON
  }
);

/**
 * Virtual property to populate the author (User document) of the tag.
 * It links the `createdBy` field (username) to the `username` field in the User collection.
 */
TagSchema.virtual("author", {
  ref: "User", // The User model
  localField: "createdBy", // Field in TagSchema (stores username)
  foreignField: "username", // Field in UserSchema to match
  justOne: true, // Expect a single creator
  options: { select: 'username firstName lastName avatar' } // Fields to select from User
});

// Index for tag name to speed up searches
TagSchema.index({ name: 1 });

/**
 * Mongoose model for Tag.
 * @type {mongoose.Model<mongoose.Document & typeof TagSchema.methods & typeof TagSchema.statics>}
 */
module.exports = mongoose.model("Tag", TagSchema);
