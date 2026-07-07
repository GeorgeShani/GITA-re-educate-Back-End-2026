import veryHappy from "@/assets/moods/very-happy.svg";
import happy from "@/assets/moods/happy.svg";
import neutral from "@/assets/moods/neutral.svg";
import sad from "@/assets/moods/sad.svg";
import verySad from "@/assets/moods/very-sad.svg";
import veryHappySm from "@/assets/moods/small/very-happy.svg";
import happySm from "@/assets/moods/small/happy.svg";
import neutralSm from "@/assets/moods/small/neutral.svg";
import sadSm from "@/assets/moods/small/sad.svg";
import verySadSm from "@/assets/moods/small/very-sad.svg";

// Mood -> color mapping, confirmed against the Statistics Section's 5
// populated Figma states (nodes 354:9619/9350/9081/8812/8543): each mood
// category has its own fixed background tone for the Average Mood card.
// `icon` is the original full-color mood illustration (Mood Logger Step 1);
// `iconSm` is the small monochrome variant used in the Statistics Section.
export const MOODS = {
  veryHappy: { label: "Very Happy", color: "bg-amber-300", icon: veryHappy, iconSm: veryHappySm },
  happy: { label: "Happy", color: "bg-green-300", icon: happy, iconSm: happySm },
  neutral: { label: "Neutral", color: "bg-blue-300", icon: neutral, iconSm: neutralSm },
  sad: { label: "Sad", color: "bg-indigo-200", icon: sad, iconSm: sadSm },
  verySad: { label: "Very Sad", color: "bg-red-300", icon: verySad, iconSm: verySadSm },
};
