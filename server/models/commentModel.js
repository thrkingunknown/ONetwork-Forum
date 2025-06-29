/**
 * @file server/models/commentModel.js
 * @description Defines the Mongoose schema and model for a Comment.
 */

const mongoose = require("mongoose");

/**
 * @typedef {mongoose.Schema.Types.ObjectId} ObjectId - Mongoose ObjectId type.
 */

/**
 * @typedef {mongoose.SchemaDefinitionProperty<string[]>} StringArrayUserRef
 * Array of strings, likely usernames, intended to refer to Users.
 * For robust referencing, Mongoose ObjectIds (`type: mongoose.Schema.Types.ObjectId, ref: 'User'`) are preferred.
 */

/**
 * Mongoose schema for Comment documents.
 * @type {mongoose.Schema}
 * @property {string} owner - Username of the user who created the comment. Links to User.username via 'author' virtual.
 *                            Consider storing user's ObjectId: `authorRef: { type: ObjectId, ref: 'User' }`.
 * @property {string} content - The text content of the comment.
 * @property {ObjectId} parentTopic - ObjectId referencing the Topic to which this comment belongs.
 * @property {ObjectId | null} parentComment - ObjectId referencing the parent Comment if this is a reply. Null for top-level comments.
 * @property {StringArrayUserRef} upvotes - Array of usernames who upvoted the comment.
 * @property {StringArrayUserRef} downvotes - Array of usernames who downvoted the comment.
 * @property {Date} createdAt - Timestamp of when the comment was created.
 * @property {Date} updatedAt - Timestamp of when the comment was last updated.
 */
const CommentSchema = new mongoose.Schema(
  {
    owner: { // Username of the comment creator
      type: String,
      required: [true, "Comment owner (username) is required."],
      index: true,
    },
    // Storing the author's ObjectId directly is generally more robust:
    // author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: {
      type: String,
      required: [true, "Comment content cannot be empty."],
      trim: true,
      minlength: [1, "Comment cannot be empty."],
      maxlength: [5000, "Comment cannot exceed 5000 characters."], // Example max length
    },
    parentTopic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: [true, "Comment must belong to a topic."],
      index: true,
    },
    parentComment: { // For threaded comments/replies
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment", // Self-reference for replies
      default: null, // null if it's a top-level comment on a topic
      index: true,
    },
    // As with Topic, storing arrays of User ObjectIds is generally more robust for votes.
    upvotes: [
      {
        type: String, // Assuming these are usernames.
        // ref: 'User' with type String might be for specific virtual population.
      },
    ],
    downvotes: [
      {
        type: String, // Assuming these are usernames.
      },
    ],
    // replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }] // Alternative for replies
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

/**
 * Virtual property to populate the author (User document) of the comment.
 * It links the `owner` field (username) to the `username` field in the User collection.
 */
CommentSchema.virtual("author", {
  ref: "User", // The User model
  localField: "owner", // Field in CommentSchema (stores username)
  foreignField: "username", // Field in UserSchema to match
  justOne: true, // Expect a single author
  options: { select: 'username firstName lastName avatar' } // Fields to select from User
});

// Index to improve query performance for finding replies to a comment
CommentSchema.index({ parentComment: 1, createdAt: -1 });
// Index to improve query performance for finding comments on a topic
CommentSchema.index({ parentTopic: 1, createdAt: -1 });


/**
 * Mongoose model for Comment.
 * @type {mongoose.Model<mongoose.Document & typeof CommentSchema.methods & typeof CommentSchema.statics>}
 */
module.exports = mongoose.model("Comment", CommentSchema);
