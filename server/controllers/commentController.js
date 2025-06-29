/**
 * @file server/controllers/commentController.js
 * @description Handles all comment-related operations such as fetching,
 * adding, deleting, and voting on comments.
 */

const Comment = require("../models/commentModel");
const Topic = require("../models/topicModel");

/**
 * @type {Array<import('mongoose').Types.ObjectId>}
 * @description Stores ObjectIds of replies to be deleted during a cascading delete operation.
 * This is a module-level variable, which can be problematic for concurrent requests.
 * Consider refactoring to pass this within function scopes or use a different approach.
 */
let repliesToDelete = []; // Caution: Module-level mutable state

/**
 * Recursively finds all replies to a given comment.
 * Populates the `repliesToDelete` array with the IDs of nested comments.
 * @param {Array<object>} comments - An array of all comments to search within.
 * @param {string | import('mongoose').Types.ObjectId} id - The ID of the parent comment whose replies are to be found.
 * @todo Refactor to avoid module-level `repliesToDelete` for better concurrency safety.
 */
const findRepliesRecursively = (comments, id) => {
  comments
    .filter((comment) => comment?.parentComment?.toString() === id?.toString())
    .forEach((comment) => { // Changed map to forEach as it's used for side effects
      repliesToDelete.push(comment._id);
      findRepliesRecursively(comments, comment._id.toString());
    });
};

module.exports = {
  /**
   * @async
   * @function getTopicComments
   * @description Retrieves all comments for a specific topic.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.id - The ID of the parent topic.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getTopicComments: async (req, res) => {
    try {
      const { id: parentTopic } = req.params;
      if (!parentTopic) {
        return res.status(400).json({ message: "Parent topic ID is required." });
      }
      const comments = await Comment.find({ parentTopic })
        .populate({
            path: "author",
            select: { password: 0, __v: 0, email: 0, followers: 0, following: 0, isVerified: 0 } // Be more specific about fields
        })
        .sort({ createdAt: -1 }) // Sort by creation date, newest first
        .lean()
        .exec();
      return res.status(200).json({ // Added status
        comments: comments,
        message: "Comments retrieved successfully!",
      });
    } catch (err) {
      console.error("Get Topic Comments Error:", err);
      return res.status(500).json({ message: "Error retrieving comments: " + err.message });
    }
  },

  /**
   * @async
   * @function addComment
   * @description Adds a new comment to a topic or as a reply to another comment.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from authentication middleware.
   * @param {string} req.user.username - Username of the comment author.
   * @param {object} req.body - Request body.
   * @param {string} req.body.id - The ID of the parent topic.
   * @param {string} req.body.comment - The content of the comment.
   * @param {string} [req.body.parentComment] - The ID of the parent comment if this is a reply.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  addComment: async (req, res) => {
    let { id: parentTopicId, comment: content, parentComment } = req.body; // Renamed for clarity

    if (!parentTopicId || !content || content.trim().length === 0) {
      return res.status(400).json({
        message: "Topic ID and comment content cannot be empty.",
      });
    }
    parentComment = parentComment || null; // Ensure parentComment is null if not provided

    try {
      let createdComment = await Comment.create({
        owner: req.user.username, // Assuming req.user is populated by auth middleware
        parentTopic: parentTopicId,
        parentComment: parentComment,
        content: content.trim(),
        author: req.user._id // Store author's ObjectId for easier population
      });

      await Topic.findByIdAndUpdate(parentTopicId, {
        $inc: { totalComments: 1 },
      });

      // Populate author details for the response
      createdComment = await Comment.findById(createdComment._id).populate({
        path: "author",
        select: { password: 0, __v: 0, email: 0, followers: 0, following: 0, isVerified: 0 },
      }).lean();

      return res.status(201).json({
        comment: createdComment,
        message: "Comment created successfully!",
      });
    } catch (err) {
      console.error("Add Comment Error:", err);
      return res.status(500).json({ message: "Error adding comment: " + err.message });
    }
  },

  /**
   * @async
   * @function deleteComment
   * @description Deletes a comment and all its replies.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from authentication middleware.
   * @param {string} req.user.username - Username of the user attempting deletion.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.id - The ID of the comment to delete.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  deleteComment: async (req, res) => {
    const { id: commentId } = req.params;
    try {
      repliesToDelete = []; // Reset module-level variable (caution!)
      const rootComment = await Comment.findById(commentId);

      if (!rootComment) {
        return res.status(404).json({ message: "Comment not found." });
      }

      // Check if the user is authorized to delete (e.g., comment owner or admin)
      // TODO: Add admin role check if applicable
      if (req.user.username !== rootComment.owner) {
        return res.status(403).json({
          message: "You are not allowed to delete this comment.",
        });
      }

      const allCommentsInTopic = await Comment.find({ parentTopic: rootComment.parentTopic }).lean(); // Fetch once
      findRepliesRecursively(allCommentsInTopic, rootComment._id.toString());
      repliesToDelete.push(rootComment._id); // Add the root comment itself to the deletion list

      const deleteResult = await Comment.deleteMany({ _id: { $in: repliesToDelete } });

      if (deleteResult.deletedCount > 0) {
        await Topic.findByIdAndUpdate(rootComment.parentTopic, {
          $inc: { totalComments: -deleteResult.deletedCount },
        });
      }

      return res.status(200).json({
        deletedCommentIds: repliesToDelete, // Changed key name for clarity
        message: `Comment${deleteResult.deletedCount > 1 ? 's' : ''} successfully deleted.`,
      });
    } catch (err) {
      console.error("Delete Comment Error:", err);
      repliesToDelete = []; // Ensure cleanup on error
      return res.status(500).json({ message: "Error deleting comment: " + err.message });
    }
  },

  /**
   * @async
   * @function toggleUpvoteComment
   * @description Toggles an upvote on a comment by the current user.
   * If downvoted, removes the downvote.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from authentication middleware.
   * @param {string} req.user.username - Username of the user upvoting.
   * @param {string} req.user._id - ObjectId of the user upvoting.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.id - The ID of the comment to upvote.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  toggleUpvoteComment: async (req, res) => {
    const { id: commentId } = req.params;
    const userId = req.user._id; // Assuming user ID is available on req.user

    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found." });
      }

      const userHasUpvoted = comment.upvotes.includes(userId);

      if (userHasUpvoted) {
        // User wants to remove their upvote
        comment.upvotes.pull(userId);
      } else {
        // User wants to add an upvote
        comment.upvotes.push(userId);
        // If user had downvoted, remove the downvote
        comment.downvotes.pull(userId);
      }

      await comment.save();
      // Populate author for the updated comment to send back (optional)
      const updatedComment = await Comment.findById(commentId)
                                        .populate({path: "author", select: "username profileImage"})
                                        .lean();

      return res.status(200).json({
        comment: updatedComment, // Send back the updated comment
        message: userHasUpvoted ? "Comment upvote removed." : "Comment upvoted successfully.",
      });
    } catch (err) {
      console.error("Toggle Upvote Comment Error:", err);
      return res.status(500).json({ message: "Error toggling upvote: " + err.message });
    }
  },

  /**
   * @async
   * @function toggleDownvoteComment
   * @description Toggles a downvote on a comment by the current user.
   * If upvoted, removes the upvote.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from authentication middleware.
   * @param {string} req.user.username - Username of the user downvoting.
   * @param {string} req.user._id - ObjectId of the user downvoting.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.id - The ID of the comment to downvote.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  toggleDownvoteComment: async (req, res) => {
    const { id: commentId } = req.params;
    const userId = req.user._id; // Assuming user ID is available on req.user

    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found." });
      }

      const userHasDownvoted = comment.downvotes.includes(userId);

      if (userHasDownvoted) {
        // User wants to remove their downvote
        comment.downvotes.pull(userId);
      } else {
        // User wants to add a downvote
        comment.downvotes.push(userId);
        // If user had upvoted, remove the upvote
        comment.upvotes.pull(userId);
      }

      await comment.save();
      const updatedComment = await Comment.findById(commentId)
                                        .populate({path: "author", select: "username profileImage"})
                                        .lean();

      return res.status(200).json({
        comment: updatedComment, // Send back the updated comment
        message: userHasDownvoted ? "Comment downvote removed." : "Comment downvoted successfully.",
      });
    } catch (err) {
      console.error("Toggle Downvote Comment Error:", err);
      return res.status(500).json({ message: "Error toggling downvote: " + err.message });
    }
  },

  /**
   * @async
   * @function getTopHelpers
   * @description Retrieves a list of top helpers (users with the most comments).
   * @param {import('express').Request} req - Express request object.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getTopHelpers: async (req, res) => {
    try {
      // The original aggregation used 'owner' (username). If 'author' (ObjectId) is stored, adjust accordingly.
      // Assuming 'owner' is still the username field on comments.
      const topHelpers = await Comment.aggregate([
        { $group: { _id: "$owner", count: { $sum: 1 } } }, // Group by username
        { $sort: { count: -1 } },
        { $limit: 3 }, // Get top 3
        {
          $lookup: {
            from: "users", // The collection name for users
            localField: "_id", // This is the 'owner' (username) from the $group stage
            foreignField: "username", // Match with 'username' field in the users collection
            as: "authorDetails",
            pipeline: [{ $project: { password: 0, __v: 0, email: 0, followers: 0, following: 0, isVerified: 0, topics:0, comments:0 } }], // Select specific fields from user
          },
        },
        { $unwind: "$authorDetails" }, // Unwind the authorDetails array
        {
          $project: { // Project to desired output shape
            username: "$_id",
            commentCount: "$count",
            author: "$authorDetails"
          }
        }
      ]);
      return res.status(200).json(topHelpers);
    } catch (err) {
      console.error("Get Top Helpers Error:", err);
      return res.status(500).json({ message: "Error retrieving top helpers: " + err.message });
    }
  },
};
