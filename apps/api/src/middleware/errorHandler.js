const logger = require("../utils/logger")

const errorHandler = (err, req, res, next) => {

  // Known operational errors
  if (err.isOperational) {
    logger.warn({
      msg: "Operational error",
      error: err.message,
      statusCode: err.statusCode,
      requestId: req.id
    })

    return res.status(err.statusCode).json({
      message: err.message,
      requestId: req.id
    })
  }

  // Prisma errors (optional enhancement)
  if (err.code && err.code.startsWith("P")) {
    logger.error({
      msg: "Database error",
      error: err.message,
      code: err.code,
      requestId: req.id
    })

    return res.status(500).json({
      message: "Internal Server Error",
      requestId: req.id
    })
  }

  // Unknown errors
  logger.error({
    msg: "Unhandled error",
    error: err.stack,
    requestId: req.id
  })

  return res.status(500).json({
    message: "Internal server error",
    requestId: req.id
  })
}

module.exports = errorHandler