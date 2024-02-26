require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const app = express();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB:", err));

const boardSchema = new mongoose.Schema({
  name: String,
  createdAt: { type: Date, default: Date.now },
});
const Board = mongoose.model("Board", boardSchema);

const drawingSchema = new mongoose.Schema({
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true,
    index: true,
  },
  x1: Number,
  y1: Number,
  x2: Number,
  y2: Number,
  color: String,
  tool: String,
  createdAt: { type: Date, default: Date.now },
});
const Drawing = mongoose.model("Drawing", drawingSchema);

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);


app.get("/boards", async (req, res) => {
  try {
    const boards = await Board.find();
    res.json(boards);
  } catch (error) {
    res.status(500).send({ message: "Error fetching boards" });
  }
});

app.post("/boards", async (req, res) => {
  try {
    const board = new Board({ name: req.body.name });
    await board.save();
    res.status(201).json(board);
  } catch (error) {
    res.status(500).send({ message: "Error creating board" });
  }
});

app.get("/drawings/:boardId", async (req, res) => {
  try {
    const drawings = await Drawing.find({ boardId: req.params.boardId });
    res.json(drawings);
  } catch (error) {
    res.status(500).send({ message: "Error fetching drawings" });
  }
});

app.delete("/boards/:id", async (req, res) => {
  try {
    const board = await Board.findByIdAndDelete(req.params.id);
    if (!board) {
      return res.status(404).send({ message: "Board not found" });
    }
    res.send(board);
  } catch (error) {
    res.status(500).send({ message: "Error deleting board" });
  }
});

app.put("/boards/:id", async (req, res) => {
  try {
    const board = await Board.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { new: true }
    );
    if (!board) {
      return res.status(404).send({ message: "Board not found" });
    }
    res.send(board);
  } catch (error) {
    res.status(500).send({ message: "Error updating board" });
  }
});

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
    const drawing = new Drawing(data);
    drawing.save().then(() => console.log("Drawing saved to database"));
  });

  socket.on("clearBoard", async (data) => {
    try {
      await Drawing.deleteMany({ boardId: data.boardId });
      console.log(`Drawings cleared for board: ${data.boardId}`);
    } catch (error) {
      console.error("Error clearing drawings:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});