import type { Request, Response } from "express";
import { userService } from "../services/user.service";

/** REST controllers for the /api/users resource. */
export const userController = {
  async create(req: Request, res: Response): Promise<void> {
    const { username } = req.body as { username?: unknown };
    if (typeof username !== "string" || username.trim() === "") {
      res.status(400).json({ message: "A non-empty 'username' is required" });
      return;
    }
    
    const user = await userService.createUser(username.trim());
    res.status(201).json(user);
  },

  async list(_req: Request, res: Response): Promise<void> {
    const users = await userService.getUsers();
    res.json(users);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = await userService.getUserById(req.params.id as string);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    res.json(user);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { username } = req.body as { username?: unknown };

    if (typeof username !== "string" || username.trim() === "") {
      res
        .status(400)
        .json({ message: "'username' must be a non-empty string" });
      return;
    }

    const user = await userService.updateUser(req.params.id as string, {
      username: username.trim(),
    });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    res.json(user);
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = await userService.deleteUser(req.params.id as string);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    res.status(204).send();
  },
};
