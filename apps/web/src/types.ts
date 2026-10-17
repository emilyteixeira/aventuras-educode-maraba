export interface Appearance {
  cls: string;
  color: string;
  hair_style?: string;
  hair_color?: string;
  accessories: string[];
}

export interface Catalog {
  classes: Record<string, string>;
  robot_colors: string[];
  skin_tones: string[];
  hair_styles: string[];
  hair_colors: string[];
  accessories: Record<string, string>;
  locked_accessories: string[];
  max_accessories: number;
  tools: Record<string, string>;
  tools_to_pick: number;
  scenarios: Record<string, string>;
  worlds: Record<string, string>;
}

export interface Me {
  id: number;
  nickname: string;
  role: "student" | "tutor";
  xp: number;
  level: number;
  onboarding_done: boolean;
  character: {
    appearance: Partial<Appearance>;
    tools: string[];
    scenario: string;
    world: string;
    unlocked: string[];
  } | null;
}

export type Phase = "lobby" | "intro" | "question" | "reveal" | "podium" | "unlock" | "finished";

export interface Question {
  id: string;
  type: "mc" | "order";
  prompt: string;
  seconds: number;
  boss: boolean;
  options?: string[];
  items?: { i: number; text: string }[];
  correct?: number | number[];
  difficulty?: number;
  explanation?: string;
}

export interface PlayerCard {
  nickname: string;
  appearance: Partial<Appearance>;
  points: number;
}

export interface GroupCard {
  no: number;
  name: string;
  points: number;
  unlocked: boolean;
  members: { nickname: string; appearance: Partial<Appearance> }[];
}

export interface MeState {
  uid: number;
  nickname: string;
  appearance: Partial<Appearance>;
  tools: string[];
  group: number | null;
  points: number;
  xp: number;
  level: number;
  rank: number;
  answered?: boolean;
  my_value?: number | number[];
  fx?: { hint?: string; comic?: string; eliminated?: number; lantern?: boolean; shovel?: boolean; difficulty?: number };
  tools_left?: string[];
  result?: { answered: boolean; correct: boolean; points: number; value: number | number[] | null };
  mission_points?: number;
  xp_gain?: number;
  unlock?: {
    ok: boolean;
    feedback: { correct: number; total: number; by: string; ok: boolean } | null;
    reward?: { title: string; text: string; item: string };
  };
}

export interface GameState {
  t: "state";
  code: string;
  role: "student" | "tutor";
  phase: Phase;
  paused: boolean;
  era: { title: string; missions: number };
  mission: { no: number; name: string; pillar: string; intro: string; boss: boolean; questions: number } | null;
  qindex: number;
  mult: number;
  mult_now?: number;
  auto: boolean;
  players: number;
  connected: number;
  answered?: number;
  remaining_ms?: number;
  total_ms?: number;
  question?: Question;
  reveal?: { correct: number | number[]; explanation: string; counts?: number[] };
  podium?: { mission: number; individuals: PlayerCard[]; groups: GroupCard[] };
  unlock?: { template: string; blanks: string[] };
  leaderboard: PlayerCard[];
  groups: GroupCard[];
  me?: MeState;
  tutor?: {
    players: { uid: number; nickname: string; group: number | null; connected: boolean; answered: boolean; points: number }[];
    secret: string[];
  };
}
