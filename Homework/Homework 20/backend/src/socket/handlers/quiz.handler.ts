import type { Server, Socket } from "socket.io";
import {
  SocketEvent,
  POINTS_PER_CORRECT_ANSWER,
  type AnswerResultPayload,
  type AnswerSubmitPayload,
  type SessionKickedPayload,
  type UserJoinPayload,
  type UsersOnlinePayload,
} from "../events";
import { onlineUsers } from "../onlineUsers";
import { userService, questionKey } from "../../services/user.service";
import { quizService } from "../../services/quiz.service";
import { leaderboardService } from "../../services/leaderboard.service";

/** Broadcast the current online users to everyone. */
function broadcastOnlineUsers(io: Server): void {
  const payload: UsersOnlinePayload = {
    count: onlineUsers.count(),
    users: onlineUsers.list(),
  };
  
  io.emit(SocketEvent.USERS_ONLINE, payload);
}

/** Recompute the leaderboard from Mongo and push it to every client. */
async function broadcastLeaderboard(io: Server): Promise<void> {
  const leaderboard = await leaderboardService.getLeaderboard();
  io.emit(SocketEvent.LEADERBOARD_UPDATE, leaderboard);
}

/** Registers all handlers for a single connected socket. */
export function registerQuizHandlers(io: Server, socket: Socket): void {
  // --- A user announces they are online ---
  socket.on(SocketEvent.USER_JOIN, async (payload: UserJoinPayload) => {
    try {
      const userId = payload?.userId;
      if (typeof userId !== "string") {
        socket.emit(SocketEvent.ERROR, { message: "A 'userId' is required" });
        return;
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        socket.emit(SocketEvent.ERROR, { message: "Unknown user" });
        return;
      }

      // Enforce a single active session per account: evict any socket already
      // registered for this user before adding the new one, so there is never
      // a moment with two live sessions for the same userId. We evict rather
      // than reject the newcomer because a dead connection can take up to ~45s
      // to be detected, which would otherwise lock the real owner out.
      const kicked: SessionKickedPayload = {
        message: `"${user.username}" was opened in another session. You have been signed out.`,
      };

      for (const staleId of onlineUsers.findSocketIdsByUserId(user.id)) {
        if (staleId === socket.id) continue;

        const staleSocket = io.sockets.sockets.get(staleId);
        if (staleSocket) {
          staleSocket.emit(SocketEvent.SESSION_KICKED, kicked);
          staleSocket.disconnect(true);
        }

        // Remove now rather than waiting on the evicted socket's own disconnect
        // handler; keyed by socketId, so it can never touch the new session.
        onlineUsers.remove(staleId);
      }

      onlineUsers.add(socket.id, { userId: user.id, username: user.username });
      broadcastOnlineUsers(io);

      // Give the freshly joined client the current standings right away.
      const leaderboard = await leaderboardService.getLeaderboard();
      socket.emit(SocketEvent.LEADERBOARD_UPDATE, leaderboard);
    } catch (error) {
      console.error("user:join failed", error);
      socket.emit(SocketEvent.ERROR, { message: "Failed to join" });
    }
  });

  // --- A user submits an answer to a quiz ---
  socket.on(SocketEvent.ANSWER_SUBMIT, async (payload: AnswerSubmitPayload) => {
    try {
      const { userId, quizId, questionId, answer } = payload ?? {};
      if (
        typeof userId !== "string" ||
        typeof quizId !== "number" ||
        typeof questionId !== "number" ||
        typeof answer !== "string"
      ) {
        socket.emit(SocketEvent.ERROR, {
          message: "userId, quizId, questionId and answer are required",
        });
        return;
      }

      const grading = quizService.grade(quizId, questionId, answer);
      if (!grading) {
        socket.emit(SocketEvent.ERROR, { message: "Unknown quiz or question" });
        return;
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        socket.emit(SocketEvent.ERROR, { message: "Unknown user" });
        return;
      }

      const key = questionKey(quizId, questionId);
      
      let awardedPoints = 0;
      let totalScore = user.score;
      let alreadyAnswered = user.answeredQuestions.includes(key);

      if (grading.correct && !alreadyAnswered) {
        const updated = await userService.awardPointsForQuestion(
          userId,
          key,
          POINTS_PER_CORRECT_ANSWER
        );
        
        if (updated) {
          awardedPoints = POINTS_PER_CORRECT_ANSWER;
          totalScore = updated.score;
        } else {
          // Lost the race: another submission scored this question first.
          alreadyAnswered = true;
        }
      }

      const result: AnswerResultPayload = {
        quizId,
        questionId,
        correct: grading.correct,
        correctAnswer: grading.correctAnswer,
        awardedPoints,
        totalScore,
        alreadyAnswered,
      };
      
      socket.emit(SocketEvent.ANSWER_RESULT, result);

      // Every submission refreshes the leaderboard for all clients.
      await broadcastLeaderboard(io);
    } catch (error) {
      console.error("answer:submit failed", error);
      socket.emit(SocketEvent.ERROR, { message: "Failed to submit answer" });
    }
  });

  // --- The user disconnected ---
  socket.on(SocketEvent.DISCONNECT, (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
    onlineUsers.remove(socket.id);
    broadcastOnlineUsers(io);
  });
}
