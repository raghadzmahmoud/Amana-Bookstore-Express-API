const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Helper function to read JSON files
async function readJsonFile(filename) {
  try {
    const filePath = path.join(__dirname, 'data', filename);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    throw error;
  }
}

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Amana Bookstore API',
    status: 'Server is running successfully',
    endpoints: {
      books: '/api/books',
      booksByDateRange: '/api/books/date-range?start=YYYY-MM-DD&end=YYYY-MM-DD',
      singleBook: '/api/books/:id'
    }
  });
});

// GET /api/books - Display all books
app.get('/api/books', async (req, res) => {
  try {
    const booksData = await readJsonFile('books.json');
    res.status(200).json({
      success: true,
      count: booksData.books.length,
      data: booksData.books
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve books',
      message: error.message
    });
  }
});

// IMPORTANT: This route MUST come BEFORE /api/books/:id
// GET /api/books/date-range - Display books published within a date range
app.get('/api/books/date-range', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Validate query parameters
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Please provide both start and end dates in format: YYYY-MM-DD'
      });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Validate date formats
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        message: 'Please use YYYY-MM-DD format for dates'
      });
    }
    
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range',
        message: 'Start date must be before or equal to end date'
      });
    }
    
    const booksData = await readJsonFile('books.json');
    
    const filteredBooks = booksData.books.filter(book => {
      const bookDate = new Date(book.datePublished);
      return bookDate >= startDate && bookDate <= endDate;
    });
    
    res.status(200).json({
      success: true,
      count: filteredBooks.length,
      dateRange: {
        start: start,
        end: end
      },
      data: filteredBooks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve books by date range',
      message: error.message
    });
  }
});

// GET /api/books/:id - Display a single book by ID
// This route comes AFTER the specific /date-range route
app.get('/api/books/:id', async (req, res) => {
  try {
    const bookId = req.params.id;
    const booksData = await readJsonFile('books.json');
    
    const book = booksData.books.find(book => book.id === bookId);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Book not found',
        message: `No book found with ID: ${bookId}`
      });
    }
    
    res.status(200).json({
      success: true,
      data: book
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve book',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Amana Bookstore API server is running on port ${PORT}`);
  console.log(`📚 Visit http://localhost:${PORT} to test the API`);
});