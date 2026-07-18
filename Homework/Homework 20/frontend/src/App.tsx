import { useState } from "react";
import { MatrixRain } from "./components/MatrixRain";
import { Scanlines } from "./components/Scanlines";
import { Toasts } from "./components/Toasts";
import { useSessionStore } from "./store/sessionStore";
import { JoinScreen } from "./screens/JoinScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { QuizScreen } from "./screens/QuizScreen";

type Screen = { name: "lobby" } | { name: "quiz"; quizId: number };

function App() {
  const user = useSessionStore((s) => s.user);
  const [screen, setScreen] = useState<Screen>({ name: "lobby" });

  return (
    <>
      <MatrixRain />
      <Scanlines />
      <Toasts />
      <div className="relative z-10">
        {!user && <JoinScreen />}
        {user && screen.name === "lobby" && (
          <LobbyScreen onPlay={(quizId) => setScreen({ name: "quiz", quizId })} />
        )}
        {user && screen.name === "quiz" && (
          <QuizScreen
            quizId={screen.quizId}
            onExit={() => setScreen({ name: "lobby" })}
          />
        )}
      </div>
    </>
  );
}

export default App;
