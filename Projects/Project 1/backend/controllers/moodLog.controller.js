import { createMoodLog, getMoodLogs } from "../services/moodLog.service.js";

export async function createLog(req, res) {
  try {
    const log = await createMoodLog(req.userId, req.body);
    return res.status(201).json({ log });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function listLogs(req, res) {
  try {
    const logs = await getMoodLogs(req.userId);
    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}
