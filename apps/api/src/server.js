const express = require("express")
const loggerMiddleware = require("./middleware/loggerMiddleware")
const errorHandler = require("./middleware/errorHandler")

const app = express()

app.use(express.json())

// ✅ request logging
app.use(loggerMiddleware)

app.get('/', (req, res) => {
  res.json({name: "Hello"});
}) 

// your routes here
// app.use("/api/party", partyRoutes)

// ❗ global error handler MUST be last
app.use(errorHandler)

const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});