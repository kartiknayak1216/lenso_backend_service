import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import userRoutes from './src/routes/userRoutes.js'; 

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware to parse JSON body data
app.use(bodyParser.json());

// Add routes
app.use('/api/user', userRoutes);

// Handle undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong'
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
