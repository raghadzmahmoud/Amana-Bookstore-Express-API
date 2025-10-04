const express = require("express");
const fs = require("fs").promises;
const crypto = require("crypto"); // Native Node.js module for generating unique IDs
const path = require("path");
const morgan = require("morgan"); // Morgan for logging
const fsSync = require("fs"); // Synchronous fs for stream

const app = express();
const PORT = process.env.PORT || 3000;

// Morgan logging setup
const logStream = fsSync.createWriteStream(
  path.join(__dirname, "logging", "log.txt"),
  { flags: "a" },
);
app.use(morgan("combined", { stream: logStream }));

// Middleware
app.use(express.json());

// Helper function to read JSON files
async function readJsonFile(filename) {
  try {
    const filePath = path.join(__dirname, "data", filename);
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    throw error;
  }
}

// Helper function to write to a JSON file
async function writeJsonFile(filename, data) {
  try {
    const filePath = path.join(__dirname, "data", filename);
    // The 'null, 2' argument formats the JSON file for readability
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error(`Error writing to ${filename}:`, error);
    throw error;
  }
}

// --- Authentication Middleware (Bonus Challenge) ---
const VALID_API_KEYS = ["amana-secret-key-12345"]; // In a real app, use environment variables!

const authenticateKey = (req, res, next) => {
  const apiKey = req.get("X-API-Key");
  if (apiKey && VALID_API_KEYS.includes(apiKey)) {
    next(); // API key is valid, proceed to the route handler
  } else {
    res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "A valid X-API-Key header is required.",
    });
  }
};

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Amana Bookstore API",
    status: "Server is running successfully",
    endpoints: {
      books: "/api/books",
      featuredBooks: "/api/books/featured",
      booksByDateRange: "/api/books/date-range?start=YYYY-MM-DD&end=YYYY-MM-DD",
      singleBook: "/api/books/:id",
      reviewsForBook: "/api/reviews/book/:bookId",
    },
  });
});

// GET /api/books - Display all books
app.get("/api/books", async (req, res) => {
  try {
    const booksData = await readJsonFile("books.json");
    res.status(200).json({
      success: true,
      count: booksData.books.length,
      data: booksData.books,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve books",
      message: error.message,
    });
  }
});

// IMPORTANT: This route MUST come BEFORE /api/books/:id
// GET /api/books/date-range - Display books published within a date range
app.get("/api/books/date-range", async (req, res) => {
  try {
    const { start, end } = req.query;

    // Validate query parameters
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message:
          "Please provide both start and end dates in format: YYYY-MM-DD",
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Validate date formats
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format",
        message: "Please use YYYY-MM-DD format for dates",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: "Invalid date range",
        message: "Start date must be before or equal to end date",
      });
    }

    const booksData = await readJsonFile("books.json");

    const filteredBooks = booksData.books.filter((book) => {
      const bookDate = new Date(book.datePublished);
      return bookDate >= startDate && bookDate <= endDate;
    });

    res.status(200).json({
      success: true,
      count: filteredBooks.length,
      dateRange: {
        start: start,
        end: end,
      },
      data: filteredBooks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve books by date range",
      message: error.message,
    });
  }
});

// GET /api/books/featured - Display featured books
app.get("/api/books/featured", async (req, res) => {
  try {
    const booksData = await readJsonFile("books.json");

    const featuredBooks = booksData.books.filter(
      (book) => book.featured === true,
    );

    res.status(200).json({
      success: true,
      count: featuredBooks.length,
      data: featuredBooks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve featured books",
      message: error.message,
    });
  }
});

// GET /api/books/top-rated - Display top 10 rated books
app.get("/api/books/top-rated", async (req, res) => {
  try {
    const booksData = await readJsonFile("books.json");

    // Calculate a score, sort by it, and take the top 10
    const topRatedBooks = booksData.books
      .map((book) => ({
        ...book,
        // A simple scoring metric: rating multiplied by the number of reviews
        score: book.rating * book.reviewCount,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    res.status(200).json({
      success: true,
      count: topRatedBooks.length,
      data: topRatedBooks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve top rated books",
      message: error.message,
    });
  }
});

// GET /api/books/:id - Display a single book by ID
// This route comes AFTER the specific /date-range route
app.get("/api/books/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const booksData = await readJsonFile("books.json");

    const book = booksData.books.find((book) => book.id === bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        error: "Book not found",
        message: `No book found with ID: ${bookId}`,
      });
    }

    res.status(200).json({
      success: true,
      data: book,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve book",
      message: error.message,
    });
  }
});

// GET /api/reviews/book/:bookId - Display all reviews for a specific book
app.get("/api/reviews/book/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    const reviewsData = await readJsonFile("reviews.json");

    const bookReviews = reviewsData.reviews.filter(
      (review) => review.bookId === bookId,
    );

    if (bookReviews.length === 0) {
      // It's not an error if a book has no reviews, so we return an empty array.
      // You could also return a 404 if you prefer.
      return res.status(200).json({
        success: true,
        message: `No reviews found for book with ID: ${bookId}`,
        count: 0,
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      count: bookReviews.length,
      data: bookReviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve reviews for the book",
      message: error.message,
    });
  }
});

// --- POST Routes ---

// POST /api/books - Add a new book to the catalogue
// This route is protected by our authentication middleware
app.post("/api/books", authenticateKey, async (req, res) => {
  try {
    const newBook = req.body;

    // Basic validation
    if (!newBook.title || !newBook.author || !newBook.price) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Please provide title, author, and price for the new book.",
      });
    }

    const booksData = await readJsonFile("books.json");

    // Create a new book object with a unique ID and default values
    const bookToAdd = {
      id: (
        Math.max(...booksData.books.map((b) => parseInt(b.id))) + 1
      ).toString(), // Generate a new ID
      ...newBook,
      rating: newBook.rating || 0,
      reviewCount: newBook.reviewCount || 0,
      inStock: newBook.inStock !== undefined ? newBook.inStock : true,
      featured: newBook.featured !== undefined ? newBook.featured : false,
      datePublished:
        newBook.datePublished || new Date().toISOString().split("T")[0],
    };

    booksData.books.push(bookToAdd);
    await writeJsonFile("books.json", booksData);

    res.status(201).json({
      success: true,
      message: "Book added successfully!",
      data: bookToAdd,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to add new book",
      message: error.message,
    });
  }
});

// POST /api/reviews - Add a new review for a book
// This route is also protected
app.post("/api/reviews", authenticateKey, async (req, res) => {
  try {
    const newReview = req.body;

    // Validation
    if (
      !newReview.bookId ||
      !newReview.author ||
      !newReview.rating ||
      !newReview.comment
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Please provide bookId, author, rating, and comment.",
      });
    }

    const reviewsData = await readJsonFile("reviews.json");

    const reviewToAdd = {
      id: `review-${crypto.randomUUID()}`, // Generate a unique review ID
      ...newReview,
      timestamp: new Date().toISOString(),
      verified: newReview.verified !== undefined ? newReview.verified : false,
    };

    reviewsData.reviews.push(reviewToAdd);
    await writeJsonFile("reviews.json", reviewsData);

    res.status(201).json({
      success: true,
      message: "Review added successfully!",
      data: reviewToAdd,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to add review",
      message: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Amana Bookstore API server is running on port ${PORT}`);
  console.log(`📚 Visit http://localhost:${PORT} to test the API`);
});
