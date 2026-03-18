const pinoHttp = require("pino-http")

const loggerMiddleware = pinoHttp({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true
    }
  },
  customProps: (req) => {
    return {
      requestId: req.id
    }
  }
})

module.exports = loggerMiddleware