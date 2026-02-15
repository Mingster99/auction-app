const errorMiddleware = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
  }

  if (err.code === '23505') { // PostgreSQL unique violation
    status = 409;
    message = 'Resource already exists';
  }

  if (err.code === '23503') { // PostgreSQL foreign key violation
    status = 400;
    message = 'Referenced resource does not exist';
  }

  res.status(status).json({
    error: {
      message,
      status,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorMiddleware;
