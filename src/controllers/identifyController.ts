import { Request, Response } from "express";
import { identifyService } from "../services/identifyService";

export const identify = async (req: Request, res: Response) => {
  try {
    const result = await identifyService(req.body);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Identify Error:", error);

    if (error.message === "INVALID_INPUT") {
      return res.status(400).json({
        message: "Either email or phoneNumber must be provided",
      });
    }

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};