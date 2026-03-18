const pino = require("pino")

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty", // optional for dev readability
    options: {
      colorize: true
    }
  }
})

module.exports = logger