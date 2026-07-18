import { userService } from "./user.service";
import type { LeaderboardEntry } from "../types/quiz";

/**
 * Builds the leaderboard from the users collection. The list is derived on
 * demand (users are already sorted by score in `userService.getUsers`), so the
 * leaderboard is always consistent with the source of truth in Mongo.
 */
export const leaderboardService = {
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const users = await userService.getUsers();
    return users.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      username: user.username,
      score: user.score,
    }));
  },
};
