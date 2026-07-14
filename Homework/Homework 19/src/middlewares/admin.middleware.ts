import type { NextFunction, Request, Response } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = req.headers["role"];

  if (role !== "admin") {
    res.status(403).json({ message: "Access denied: admin role required" });
    return;
  }

  next();
}
