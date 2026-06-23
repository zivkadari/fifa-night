import { FPPair } from "@/types/fivePlayerTypes";
import { Club } from "@/types/tournament";

export interface MatchIntroProps {
  pairA: FPPair;
  pairB: FPPair;
  clubA?: Club | null;
  clubB?: Club | null;
}

export const MatchIntro = (_props: MatchIntroProps) => null;

