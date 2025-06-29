/**
 * @file server/models/topicModel.js
 * @description Defines the Mongoose schema and model for a Topic.
 */

const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose); // For auto-incrementing TopicID

/**
 * @typedef {mongoose.Schema.Types.ObjectId} ObjectId - Mongoose ObjectId type.
 */

/**
 * @typedef {mongoose.SchemaDefinitionProperty<string[]>} StringArrayUserRef
 * Array of strings, likely usernames, intended to refer to Users.
 * For robust referencing, Mongoose ObjectIds (`type: mongoose.Schema.Types.ObjectId, ref: 'User'`) are preferred.
 */

/**
 * @typedef {mongoose.SchemaDefinitionProperty<ObjectId[]>} ObjectIdArrayTagRef
 * Array of Mongoose ObjectIds, referring to Tag documents.
 */

/**
 * Mongoose schema for Topic documents.
 * @type {mongoose.Schema}
 * @property {string} owner - Username of the user who created the topic. Links to User.username via 'author' virtual.
 *                            Consider storing user's ObjectId for direct referencing: `author: { type: ObjectId, ref: 'User' }`.
 * @property {string} title - The title of the topic.
 * @property {string} content - The main content/body of the topic.
 * @property {string} slug - URL-friendly slug generated from the title. Should be unique.
 * @property {StringArrayUserRef} upvotes - Array of usernames who upvoted the topic.
 * @property {StringArrayUserRef} downvotes - Array of usernames who downvoted the topic.
 * @property {number} viewsCount - Number of times the topic has been viewed. Defaults to 0.
 * @property {number} totalComments - Total number of comments on the topic. Defaults to 0.
 * @property {ObjectIdArrayTagRef} tags - Array of ObjectIds referencing Tag documents associated with the topic.
 * @property {Date} createdAt - Timestamp of when the topic was created.
 * @property {Date} updatedAt - Timestamp of when the topic was last updated.
 * @property {number} TopicID - Auto-incrementing topic ID, separate from MongoDB's _id.
 */
const TopicSchema = new mongoose.Schema(
  {
    owner: { // Username of the topic creator
      type: String,
      required: [true, "Topic owner (username) is required."],
      index: true,
    },
    // It's often better to store the author's ObjectId directly:
    // author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: {
      type: String,
      required: [true, "Topic title is required."],
      trim: true,
      maxlength: [200, "Topic title cannot be more than 200 characters."],
    },
    content: {
      type: String,
      required: [true, "Topic content is required."],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Topic slug is required."],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // Storing arrays of User ObjectIds is generally more robust for votes:
    // upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // The current model stores strings (assumed usernames) but also has a `ref`.
    // This might be intended for virtual population or specific Mongoose features.
    upvotes: [
      {
        type: String, // Assuming these are usernames.
        // ref: 'User' here with type String might be for specific virtual population logic.
      },
    ],
    downvotes: [
      {
        type: String, // Assuming these are usernames.
      },
    ],
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalComments: {
      type: Number,
      default: 0,
      min: 0,
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId, // Correctly using ObjectId for refs
        ref: "Tag",
      },
    ],
    // space: { type: mongoose.Schema.Types.ObjectId, ref: 'Space' }, // Example: if topics belong to a space
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

// Auto-incrementing 'TopicID' field
TopicSchema.plugin(AutoIncrement, { inc_field: "TopicID" });

/**
 * Virtual property to populate the author (User document) of the topic.
 * It links the `owner` field (which stores a username) to the `username` field in the User collection.
 */
TopicSchema.virtual("author", {
  ref: "User", // The model to use for population
  localField: "owner", // Field in TopicSchema (stores username)
  foreignField: "username", // Field in UserSchema to match with localField
  justOne: true, // We expect to find a single author
  options: { select: 'username firstName lastName avatar bio' } // Select specific fields from the User document
});

/**
 * Mongoose model for Topic.
 * @type {mongoose.Model<mongoose.Document & typeof TopicSchema.methods & typeof TopicSchema.statics>}
 */
module.exports = mongoose.model("Topic", TopicSchema);
