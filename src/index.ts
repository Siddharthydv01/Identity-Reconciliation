import { prisma } from "./prisma";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { identify } from "./controllers/identifyController";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Bitespeed Identity Service is Running");
});

app.get("/test-db", async (req, res) => {
  const contacts = await prisma.contact.findMany();
  res.json(contacts);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.post("/identify", identify);
