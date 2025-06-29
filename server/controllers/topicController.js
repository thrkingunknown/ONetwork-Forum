/**
 * @file server/controllers/topicController.js
 * @description Handles all topic-related operations such as fetching,
 * adding, deleting, voting on topics, and managing related entities like tags and spaces.
 */

const Topic = require("../models/topicModel");
const Tag = require("../models/tagModel");
const Comment = require("../models/commentModel");
const Space = require("../models/spaceModel"); // Assuming Space model is used, though not in all provided functions.

/**
 * Generates a URL-friendly slug from a string.
 * @param {string} title - The string to slugify.
 * @returns {string} The generated slug.
 */
const generateSlug = (title) => {
  if (!title) return "";
  return title
    .toString()
    .normalize("NFKD") // Normalize unicode characters
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars (except hyphen)
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
};

module.exports = {
  /**
   * @async
   * @function getAllTopics
   * @description Retrieves all topics, with optional search and sorting.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.query - Query parameters.
   * @param {string} [req.query.search] - Search term for topic titles.
   * @param {string} [req.query.sort] - Sorting option ('latest', 'popular', 'most_replied', 'most_upvoted').
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getAllTopics: async (req, res) => {
    try {
      const { search, sort } = req.query;
      let sortOptions = { createdAt: -1 }; // Default sort by latest
      let searchQuery = {};

      if (search && search.trim().length > 0) {
        searchQuery = { title: new RegExp(search.trim(), "i") }; // Use trimmed search
      }

      switch (sort) {
        case "latest":
          sortOptions = { createdAt: -1 };
          break;
        case "popular": // Assuming 'popular' means most views
          sortOptions = { viewsCount: -1 };
          break;
        case "most_replied":
          sortOptions = { totalComments: -1 };
          break;
        case "most_upvoted": // Assuming upvotes field stores count or array length
          sortOptions = { "upvotes.length": -1 }; // Or just 'upvotes: -1' if it's a count
          break;
        // default: sortOptions remains { createdAt: -1 }
      }

      const topics = await Topic.find(searchQuery)
        .sort(sortOptions)
        .populate("tags")
        .populate({
            path: "author",
            select: { password: 0, __v: 0, email: 0, followers: 0, following: 0, isVerified: 0 }
        })
        .lean()
        .exec();

      return res.status(200).json(topics); // Send proper status
    } catch (err) {
      console.error("Get All Topics Error:", err);
      return res.status(500).json({ message: "Error retrieving topics: " + err.message });
    }
  },

  /**
   * @async
   * @function getTopic
   * @description Retrieves a single topic by its slug and increments its view count.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.slug - The slug of the topic.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getTopic: async (req, res) => {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ message: "Topic slug is required." });
    }
    try {
      const topic = await Topic.findOneAndUpdate(
        { slug },
        { $inc: { viewsCount: 1 } },
        { new: true } // Use new: true to return the updated document
      )
        .populate("tags")
        .populate({
            path: "author",
            select: { password: 0, __v: 0, email: 0, followers: 0, following: 0, isVerified: 0 }
        })
        .lean()
        .exec();

      if (!topic) {
        return res.status(404).json({ message: "Topic not found." });
      }
      return res.status(200).json(topic);
    } catch (err) {
      console.error("Get Topic Error:", err);
      return res.status(500).json({ message: "Error retrieving topic: " + err.message });
    }
  },

  /**
   * @async
   * @function addTopic
   * @description Adds a new topic, creating tags if they don't exist.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from auth middleware.
   * @param {string} req.user.username - Username of the topic author.
   * @param {string} req.user._id - ObjectId of the topic author.
   * @param {object} req.body - Request body.
   * @param {string} req.body.title - Title of the topic.
   * @param {string} req.body.content - Content of the topic.
   * @param {Array<{value: string, label: string}>} req.body.selectedTags - Array of tag objects.
   * @param {string} [req.body.selectedSpace] - ID of the selected space (currently unused in logic).
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  addTopic: async (req, res) => {
    try {
      const { title, content, selectedTags } = req.body; // selectedSpace is in body but not used
      const { username: ownerName, _id: ownerId } = req.user;

      if (!title || !content || !selectedTags || selectedTags.length === 0) {
        return res.status(400).json({ message: "Title, content, and at least one tag are required." });
      }

      const tagIds = await Promise.all(
        selectedTags.map(async (tagObj) => {
          const tagName = tagObj.value.trim();
          if (!tagName) return null; // Skip empty tags
          let tag = await Tag.findOne({ name: { $regex: new RegExp(`^${tagName}$`, "i") } }); // Case-insensitive find
          if (!tag) {
            tag = await Tag.create({
              name: tagName,
              createdBy: ownerName, // Store username of creator
            });
          }
          return tag._id;
        })
      );

      const finalTagIds = tagIds.filter(id => id !== null); // Remove nulls from skipped tags

      if (finalTagIds.length === 0) {
          return res.status(400).json({ message: "Valid tags are required." });
      }

      const slug = generateSlug(title.trim());
      // Check if slug already exists
      const existingTopicWithSlug = await Topic.findOne({ slug });
      if (existingTopicWithSlug) {
          return res.status(400).json({ message: "A topic with a similar title already exists, please choose a different title." });
      }

      let newTopic = await Topic.create({
        owner: ownerName,
        author: ownerId, // Store author ObjectId
        title: title.trim(),
        content: content.trim(),
        slug: slug,
        tags: finalTagIds,
        // space: selectedSpace, // If you intend to use selectedSpace
      });

      newTopic = await newTopic.populate([
        { path: "tags" },
        { path: "author", select: { password: 0, __v: 0, email: 0 } }
      ]);

      return res.status(201).json({
        topic: newTopic,
        message: "Topic successfully created!",
      });
    } catch (err) {
      console.error("Add Topic Error:", err);
      if (err.code === 11000) { // Handle duplicate key errors for slug (though checked above, good fallback)
        return res.status(400).json({ message: "Topic title results in a duplicate slug. Please modify the title." });
      }
      return res.status(500).json({ message: "Error creating topic: " + err.message });
    }
  },

  /**
   * @async
   * @function deleteTopic
   * @description Deletes a topic and its associated comments.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from auth middleware.
   * @param {string} req.user.username - Username of the user.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.id - The ID of the topic to delete.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  deleteTopic: async (req, res) => {
    try {
      const { id: topicId } = req.params;
      const topic = await Topic.findById(topicId).populate("author", "username"); // Only populate username

      if (!topic) {
        return res.status(404).json({
          message: "Could not find topic for the provided ID.",
        });
      }
      // Ensure topic.author is populated and has username
      if (!topic.author || req.user.username !== topic.author.username) {
        // Add admin check here if admins can delete any topic
        return res.status(403).json({
          message: "You are not allowed to delete this topic.",
        });
      }

      await Comment.deleteMany({ parentTopic: topicId });
      await Topic.findByIdAndDelete(topicId);

      return res.status(200).json({ topicId: topicId, message: "Topic and associated comments deleted successfully!" });
    } catch (err) {
      console.error("Delete Topic Error:", err);
      return res.status(500).json({ message: "Error deleting topic: " + err.message });
    }
  },

  /**
   * @async
   * @function toggleUpvoteTopic
   * @description Toggles an upvote on a topic by the current user.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from auth middleware.
   * @param {string} req.user._id - ObjectId of the user.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.id - The ID of the topic to upvote.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  toggleUpvoteTopic: async (req, res) => {
    const { id: topicId } = req.params;
    const userId = req.user._id; // Use user's ObjectId for voting

    try {
      const topic = await Topic.findById(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found." });
      }

      const upvotedIndex = topic.upvotes.indexOf(userId);
      const downvotedIndex = topic.downvotes.indexOf(userId);

      if (upvotedIndex > -1) { // User wants to remove upvote
        topic.upvotes.splice(upvotedIndex, 1);
      } else { // User wants to add upvote
        topic.upvotes.push(userId);
        if (downvotedIndex > -1) { // Remove downvote if it exists
          topic.downvotes.splice(downvotedIndex, 1);
        }
      }

      await topic.save();
      // Optionally, send back the updated topic or just vote counts
      return res.status(200).json({
        topicId: topic._id,
        upvotes: topic.upvotes.length,
        downvotes: topic.downvotes.length,
        message: upvotedIndex > -1 ? "Topic upvote removed." : "Topic upvoted successfully.",
      });
    } catch (err) {
      console.error("Toggle Upvote Topic Error:", err);
      return res.status(500).json({ message: "Error toggling upvote on topic: " + err.message });
    }
  },

  /**
   * @async
   * @function toggleDownvoteTopic
   * @description Toggles a downvote on a topic by the current user.
   * @param {import('express').Request} req - Express request object.
   * @param {object} req.user - User object from auth middleware.
   * @param {string} req.user._id - ObjectId of the user.
   * @param {object} req.params - URL parameters.
   * @param {string} req.params.id - The ID of the topic to downvote.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  toggleDownvoteTopic: async (req, res) => {
    const { id: topicId } = req.params;
    const userId = req.user._id; // Use user's ObjectId for voting

    try {
      const topic = await Topic.findById(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found." });
      }

      const downvotedIndex = topic.downvotes.indexOf(userId);
      const upvotedIndex = topic.upvotes.indexOf(userId);

      if (downvotedIndex > -1) { // User wants to remove downvote
        topic.downvotes.splice(downvotedIndex, 1);
      } else { // User wants to add downvote
        topic.downvotes.push(userId);
        if (upvotedIndex > -1) { // Remove upvote if it exists
          topic.upvotes.splice(upvotedIndex, 1);
        }
      }

      await topic.save();
      // Optionally, send back the updated topic or just vote counts
      return res.status(200).json({
        topicId: topic._id,
        upvotes: topic.upvotes.length,
        downvotes: topic.downvotes.length,
        message: downvotedIndex > -1 ? "Topic downvote removed." : "Topic downvoted successfully.",
      });
    } catch (err) {
      console.error("Toggle Downvote Topic Error:", err);
      return res.status(500).json({ message: "Error toggling downvote on topic: " + err.message });
    }
  },

  /**
   * @async
   * @function getTopContributors
   * @description Retrieves a list of top contributors (users with the most topics).
   * @param {import('express').Request} req - Express request object.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getTopContributors: async (req, res) => {
    try {
      // Assuming 'owner' field in Topic stores username. If it stores ObjectId, adjust $group and $lookup.
      const topContributors = await Topic.aggregate([
        { $group: { _id: "$owner", topicCount: { $sum: 1 } } }, // Group by owner (username)
        { $sort: { topicCount: -1 } },
        { $limit: 3 },
        {
          $lookup: {
            from: "users", // Collection name for users
            localField: "_id", // This is the 'owner' (username)
            foreignField: "username", // Match with 'username' in users collection
            as: "authorDetails",
            pipeline: [{ $project: { password: 0, __v: 0, email: 0, followers: 0, following: 0, isVerified: 0, topics:0, comments:0 } }],
          },
        },
        { $unwind: "$authorDetails" },
        {
          $project: {
            username: "$_id",
            topicCount: "$topicCount",
            author: "$authorDetails"
          }
        }
      ]);
      return res.status(200).json(topContributors);
    } catch (err) {
      console.error("Get Top Contributors Error:", err);
      return res.status(500).json({ message: "Error retrieving top contributors: " + err.message });
    }
  },

  /**
   * @async
   * @function getSpaces
   * @description Retrieves all available spaces.
   * @param {import('express').Request} req - Express request object.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<void>}
   */
  getSpaces: async (req, res) => {
    try {
      const spaces = await Space.find({}).sort({ name: 1 }).lean(); // Sort spaces by name
      return res.status(200).json(spaces);
    } catch (err) {
      console.error("Get Spaces Error:", err);
      return res.status(500).json({ message: "Error retrieving spaces: " + err.message });
    }
  },
};
