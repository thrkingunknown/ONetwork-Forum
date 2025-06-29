/**
 * @file server/controllers/userController.js
 * @description Handles user profile related operations like fetching profile,
 * comments, followers, following, and updating profile information.
 */

const bcrypt = require("bcrypt");
const { cloudinary } = require("../utils/cloudinary");
const fs = require("fs-extra"); // For cleaning up temporary files
const User = require("../models/userModel");
const Comment = require("../models/commentModel");
const Topic = require("../models/topicModel");
// const Tag = require("../models/tagModel"); // Tag model is imported but not used in this controller

module.exports = {
  /**
   * @async
   * @function getUserProfile
   * @description Retrieves a user's public profile information.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.username - The username of the profile to retrieve.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getUserProfile: async (req, res) => {
    const { username } = req.params;
    try {
      const user = await User.findOne({ username }, { password: 0, __v: 0, email: 0 }); // Exclude sensitive fields
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(200).json(user);
    } catch (err) {
      console.error("Get User Profile Error:", err);
      return res.status(500).json({ message: "Error retrieving user profile: " + err.message });
    }
  },

  /**
   * @async
   * @function getUserComments
   * @description Retrieves all comments made by a specific user.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.username - The username of the user whose comments to retrieve.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getUserComments: async (req, res) => {
    const { username } = req.params;
    try {
      // Check if user exists first (optional, but good practice)
      const user = await User.findOne({ username }, '_id');
      if (!user) {
          return res.status(404).json({ message: "User not found." });
      }

      const comments = await Comment.find({ owner: username }) // Assuming 'owner' stores username
        .populate({
            path: "author", // This should ideally be populated using user's ObjectId if available on comment
            select: { username: 1, avatar: 1, firstName:1, lastName:1 }
        })
        .populate({
            path: "parentTopic",
            select: "title slug" // Select only necessary fields from topic
        })
        .sort({ createdAt: -1 }) // Sort by newest first
        .lean()
        .exec();
      return res.status(200).json(comments);
    } catch (err) {
      console.error("Get User Comments Error:", err);
      return res.status(500).json({ message: "Error retrieving user comments: " + err.message });
    }
  },

  /**
   * @async
   * @function getUserFollowing
   * @description Retrieves the list of users a specific user is following.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.username - The username of the user.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getUserFollowing: async (req, res) => {
    const { username } = req.params;
    try {
      const user = await User.findOne({ username })
        .populate({
            path: "following", // Assuming 'following' stores array of User ObjectIds or usernames
            select: { password: 0, __v: 0, email: 0, followers: 0, following: 0 } // Be specific with fields
        })
        .lean()
        .exec();
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      // The original code used 'user_following'. Assuming the model field is 'following'.
      return res.status(200).json(user.following || []);
    } catch (err) {
      console.error("Get User Following Error:", err);
      return res.status(500).json({ message: "Error retrieving user following list: " + err.message });
    }
  },

  /**
   * @async
   * @function getUserFollowers
   * @description Retrieves the list of users following a specific user.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.username - The username of the user.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getUserFollowers: async (req, res) => {
    const { username } = req.params;
    try {
      const user = await User.findOne({ username })
        .populate({
            path: "followers", // Assuming 'followers' stores array of User ObjectIds or usernames
            select: { password: 0, __v: 0, email: 0, followers: 0, following: 0 } // Be specific
        })
        .lean()
        .exec();
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      // The original code used 'user_followers'. Assuming the model field is 'followers'.
      return res.status(200).json(user.followers || []);
    } catch (err) {
      console.error("Get User Followers Error:", err);
      return res.status(500).json({ message: "Error retrieving user followers list: " + err.message });
    }
  },

  /**
   * @async
   * @function toggleUserFollow
   * @description Allows a logged-in user to follow or unfollow another user.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - Logged-in user from auth middleware (should have _id and username).
   * @param {string} req.user.username - Username of the logged-in user.
   * @param {string} req.user._id - ObjectId of the logged-in user.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.username - Username of the user to follow/unfollow.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  toggleUserFollow: async (req, res) => {
    const { username: usernameToToggleFollow } = req.params;
    const loggedInUserId = req.user._id; // Use ObjectId for current user
    const loggedInUsername = req.user.username;


    if (usernameToToggleFollow === loggedInUsername) {
      return res.status(422).json({
        message: "You can't follow or unfollow yourself!",
      });
    }
    try {
      const currentUser = await User.findById(loggedInUserId); // Find by ID
      const userToToggleFollow = await User.findOne({ username: usernameToToggleFollow });

      if (!currentUser || !userToToggleFollow) {
        return res.status(404).json({ message: "User not found." });
      }

      // Check if current user is already following userToToggleFollow
      // Assuming 'following' on currentUser stores ObjectIds of users being followed
      // And 'followers' on userToToggleFollow stores ObjectIds of users following them
      const isFollowing = currentUser.following.includes(userToToggleFollow._id);

      let message;
      if (isFollowing) {
        // Unfollow
        currentUser.following.pull(userToToggleFollow._id);
        userToToggleFollow.followers.pull(currentUser._id);
        message = `Successfully unfollowed ${userToToggleFollow.username}.`;
      } else {
        // Follow
        currentUser.following.push(userToToggleFollow._id);
        userToToggleFollow.followers.push(currentUser._id);
        message = `Successfully followed ${userToToggleFollow.username}.`;
      }

      await currentUser.save();
      await userToToggleFollow.save();

      // Return updated current user's profile (or just a success message)
      const updatedCurrentUser = await User.findById(loggedInUserId, { password: 0, __v: 0 }).populate('following', 'username avatar').populate('followers', 'username avatar');

      return res.status(200).json({
        message,
        user: updatedCurrentUser // Send back the updated user object
      });
    } catch (err) {
      console.error("Toggle User Follow Error:", err);
      return res.status(500).json({ message: "Error toggling user follow: " + err.message });
    }
  },

  /**
   * @async
   * @function updateUserProfile
   * @description Updates the profile of the logged-in user.
   * This is a large function; consider refactoring into smaller helper functions.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - Logged-in user from auth middleware.
   * @param {string} req.user.username - Username of the logged-in user.
   * @param {string} req.user._id - ObjectId of the logged-in user.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.username - Username from URL (should match logged-in user).
   * @param {object} req.body - Request body with fields to update.
   * @param {object} [req.files] - Uploaded files (avatar, cover).
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  updateUserProfile: async (req, res) => {
    const { username: paramUsername } = req.params;
    const loggedInUserId = req.user._id; // Use ID for querying current user

    if (paramUsername !== req.user.username) {
      return res.status(403).json({ // 403 Forbidden is more appropriate
        message: "Unauthorized! You can only update your own profile.",
      });
    }

    try {
      let user = await User.findById(loggedInUserId).select('+password'); // Select password for comparison
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      const { firstName, lastName, email, userName: newUsername, bio, password, newPassword, confirmNewPassword } = req.body;
      let updateData = {};
      let oldUsername = user.username;
      let usernameChanged = false;

      // Update text fields if provided and different
      if (firstName && firstName.trim() !== "" && firstName.trim() !== user.firstName) updateData.firstName = firstName.trim();
      if (lastName && lastName.trim() !== "" && lastName.trim() !== user.lastName) updateData.lastName = lastName.trim();
      if (bio && bio.trim() !== "" && bio.trim() !== user.bio) updateData.bio = bio.trim();

      // Username update
      if (newUsername && newUsername.trim() !== "" && newUsername.trim() !== user.username) {
        const existingUserWithNewUsername = await User.findOne({ username: newUsername.trim(), _id: { $ne: user._id } });
        if (existingUserWithNewUsername) {
          return res.status(422).json({ message: "Username is already taken." });
        }
        updateData.username = newUsername.trim();
        usernameChanged = true;
      }

      // Email update
      if (email && email.trim() !== "" && email.trim() !== user.email) {
        const existingUserWithNewEmail = await User.findOne({ email: email.trim(), _id: { $ne: user._id } });
        if (existingUserWithNewEmail) {
          return res.status(422).json({ message: "Email is already registered." });
        }
        updateData.email = email.trim();
        // Consider requiring email re-verification if email changes
        updateData.isVerified = false; // Example: force re-verification
      }

      // Password update
      if (password && password.trim() !== "" && newPassword && newPassword.trim() !== "") {
        if (newPassword.trim() !== confirmNewPassword?.trim()) {
          return res.status(400).json({ message: "New passwords do not match." });
        }
        const passwordValid = await bcrypt.compare(password.trim(), user.password);
        if (!passwordValid) {
          return res.status(400).json({ message: "Current password invalid." });
        }
        updateData.password = await bcrypt.hash(newPassword.trim(), 10);
      }

      // File uploads (Avatar and Cover) - refactor potential
      const processImageUpload = async (fileKey, currentImageData, options) => {
        if (req.files && req.files[fileKey]) {
          const file = req.files[fileKey];
          // Validate size and type (example, adjust as needed)
          if (file.size > options.maxSize) { // options.maxSize in bytes
            await fs.unlink(file.tempFilePath);
            throw new Error(`${options.fieldName} image size too big (max ${options.maxSize / (1024*1024)}MB).`);
          }
          if (!options.allowedTypes.includes(file.mimetype)) {
            await fs.unlink(file.tempFilePath);
            throw new Error(`Invalid ${options.fieldName} image format. Only ${options.allowedTypes.join(', ')} accepted.`);
          }

          if (currentImageData && currentImageData.public_id) {
            await cloudinary.uploader.destroy(currentImageData.public_id);
          }

          const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, -4); // YYYYMMDDHHMMSS
          const publicId = `${user.username}_${options.fieldName.toLowerCase()}_${timestamp}`;

          const result = await cloudinary.uploader.upload(file.tempFilePath, {
            resource_type: "auto",
            public_id: publicId,
            folder: options.folder,
            width: options.width,
            height: options.height,
            crop: "fill",
          });
          await fs.unlink(file.tempFilePath);
          return { public_id: result.public_id, url: result.secure_url };
        }
        return null; // No new file uploaded
      };

      try {
        const newAvatarData = await processImageUpload('avatar', user.avatar, {
            maxSize: 2 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png'],
            fieldName: 'Avatar', folder: 'avatars', width: 400, height: 400
        });
        if (newAvatarData) updateData.avatar = newAvatarData;

        const newCoverData = await processImageUpload('cover', user.cover, {
            maxSize: 3 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png'],
            fieldName: 'Cover', folder: 'covers', width: 1920, height: 620
        });
        if (newCoverData) updateData.cover = newCoverData;

      } catch (uploadError) {
        return res.status(400).json({ message: uploadError.message });
      }

      // Apply updates if any changes were made
      if (Object.keys(updateData).length > 0) {
        Object.assign(user, updateData);
        const savedUser = await user.save();

        if (usernameChanged && updateData.username) {
          // Update username in related collections (run these in background or carefully)
          await Topic.updateMany({ owner: oldUsername }, { $set: { owner: savedUser.username } });
          await Comment.updateMany({ owner: oldUsername }, { $set: { owner: savedUser.username } });
          // Also update any other collections where username is stored denormalized
        }

        const responseUser = savedUser.toObject();
        delete responseUser.password; // Ensure password is not sent back

        return res.status(200).json({
          user: responseUser,
          message: "User profile has been updated successfully!",
        });
      } else {
        return res.status(200).json({
            user: user.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } }), // Send existing user data (no password)
            message: "No changes were made to the profile."
        });
      }

    } catch (err) {
      console.error("Update User Profile Error:", err);
      // Clean up temp files if any exist and an error occurred before unlinking
      if (req.files) {
        for (const key in req.files) {
          if (req.files[key] && req.files[key].tempFilePath) {
            await fs.pathExists(req.files[key].tempFilePath) && await fs.unlink(req.files[key].tempFilePath);
          }
        }
      }
      if (err.code === 11000) { // Duplicate key error (e.g. if username/email check somehow missed)
          return res.status(422).json({ message: "A unique field (like username or email) is already taken."});
      }
      return res.status(500).json({ message: "Error updating user profile: " + err.message });
    }
  },
};
