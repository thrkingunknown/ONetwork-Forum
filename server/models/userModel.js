/**
 * @file server/models/userModel.js
 * @description Defines the Mongoose schema and model for a User.
 */

const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose); // For auto-incrementing userID

/**
 * @typedef {object} SocialNetworkLinks
 * @property {string} [facebook] - Facebook profile URL.
 * @property {string} [twitter] - Twitter profile URL.
 * @property {string} [github] - GitHub profile URL.
 */

/**
 * @typedef {object} CloudinaryImage
 * @property {string} [public_id] - The public ID of the image in Cloudinary.
 * @property {string} url - The URL of the image.
 */

/**
 * @typedef {mongoose.SchemaDefinitionProperty<string[]>} StringArray
 * Array of strings, typically usernames for following/followers.
 */

/**
 * Mongoose schema for User documents.
 * @type {mongoose.Schema}
 * @property {string} firstName - User's first name.
 * @property {string} lastName - User's last name.
 * @property {string} email - User's email address. Must be unique.
 * @property {string} username - User's username. Must be unique.
 * @property {string} password - User's hashed password. (Selected false by default in queries usually)
 * @property {CloudinaryImage} avatar - User's avatar image details.
 * @property {CloudinaryImage} cover - User's profile cover image details.
 * @property {SocialNetworkLinks} socialNetwork - Links to user's social media profiles.
 * @property {string} bio - Short biography of the user. Max length 500 characters.
 * @property {boolean} isVerified - Flag indicating if the user's email is verified. Defaults to false.
 * @property {StringArray} following - Array of usernames that this user is following.
 *                                   Consider using ObjectId refs for robustness: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
 * @property {StringArray} followers - Array of usernames that are following this user.
 *                                   Consider using ObjectId refs for robustness.
 * @property {number} userID - Auto-incrementing user ID, separate from MongoDB's _id.
 */
const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      required: [true, "First name is required."],
    },
    lastName: {
      type: String,
      trim: true,
      required: [true, "Last name is required."],
    },
    email: {
      type: String,
      unique: true,
      required: [true, "Email is required."],
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please use a valid email address."],
    },
    username: {
      type: String,
      unique: true,
      required: [true, "Username is required."],
      trim: true,
      minlength: [3, "Username must be at least 3 characters long."],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain alphanumeric characters and underscores."],
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      select: false, // Exclude password by default from query results
    },
    avatar: {
      public_id: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: "https://i.imgur.com/iV7Sdgm.jpg", // Default avatar
      },
    },
    cover: {
      public_id: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: "https://i.imgur.com/CAFy1oY.jpg", // Default cover
      },
    },
    socialNetwork: {
      facebook: {
        type: String,
        trim: true,
        // Removed complex regex for brevity, consider validating in controller or service layer if needed
        default: "",
      },
      twitter: {
        type: String,
        trim: true,
        default: "",
      },
      github: {
        type: String,
        trim: true,
        default: "",
      },
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot be more than 500 characters."],
      default: "A new user of ONetwork forum",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // It's generally more robust to store ObjectId references to other users
    // e.g., following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    // This makes population easier and avoids issues if usernames change.
    // The current implementation uses an array of usernames.
    following: [
      {
        type: String, // Assuming these are usernames
        // Consider ref: 'User' and type: mongoose.Schema.Types.ObjectId if these were ObjectIds
      },
    ],
    followers: [
      {
        type: String, // Assuming these are usernames
      },
    ],
    // topics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }], // Example: if tracking user's topics
    // comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }], // Example: if tracking user's comments
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

/**
 * Virtual property to populate the User documents of those the current user is following.
 * This relies on 'following' field storing usernames and matching them against 'username' field in User collection.
 */
UserSchema.virtual("user_following_details", { // Renamed to avoid conflict if 'following' was a direct ref
  ref: "User",
  localField: "following", // Array of usernames
  foreignField: "username", // Match these usernames in the User collection
  justOne: false, // We expect an array of users
  options: { select: 'username firstName lastName avatar bio' } // Select specific fields
});

/**
 * Virtual property to populate the User documents of those following the current user.
 * This relies on 'followers' field storing usernames.
 */
UserSchema.virtual("user_followers_details", { // Renamed
  ref: "User",
  localField: "followers", // Array of usernames
  foreignField: "username", // Match these usernames in the User collection
  justOne: false,
  options: { select: 'username firstName lastName avatar bio' }
});


// Plugin for auto-incrementing 'userID' field.
// Note: MongoDB's default _id is usually preferred as the primary unique identifier.
// 'userID' here serves as a separate, sequential numerical ID.
UserSchema.plugin(AutoIncrement, { inc_field: "userID" });

/**
 * Mongoose model for User.
 * @type {mongoose.Model<mongoose.Document & typeof UserSchema.methods & typeof UserSchema.statics>}
 */
module.exports = mongoose.model("User", UserSchema);
