import { userService } from "./user.service";
import type { LeaderboardEntry } from "../types/quiz";

/** How many top players the leaderboard shows. */
const LEADERBOARD_SIZE = 10;

/**
 * Builds the leaderboard from the users collection: the top `LEADERBOARD_SIZE`
 * players by score, ranked. Derived on demand and sorted/limited in Mongo, so
 * it always reflects the source of truth without loading every user.
 */
export const leaderboardService = {
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const users = await userService.getTopUsers(LEADERBOARD_SIZE);
    return users.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      username: user.username,
      score: user.score,
    }));
  },
};
