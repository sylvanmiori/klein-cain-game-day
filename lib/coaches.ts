import coaches from '../config/coaches.json';
import publication from '../config/publication.json';

export type CoachProfile = {
  name: string;
  title: string;
  image?: string;
  season: number;
  record: string;
  bio: string;
  career: string[];
  source: string;
  sourceUrl: string;
};

export type CoachingMatchup = {
  school: CoachProfile & { schoolName: string; mascot: string };
  opponent: CoachProfile & { schoolName: string; mascot: string };
};

export function schoolCoach(): CoachProfile {
  return coaches.school;
}

export function opponentCoach(opponentName: string): CoachProfile | null {
  return coaches.opponents[opponentName as keyof typeof coaches.opponents] ?? null;
}

export function coachingMatchup(opponentName: string, opponentMascot: string): CoachingMatchup | null {
  const opponent = opponentCoach(opponentName);
  if (!opponent) return null;
  return {
    school: {
      ...coaches.school,
      schoolName: publication.schoolName,
      mascot: publication.schoolMascot,
    },
    opponent: {
      ...opponent,
      schoolName: opponentName,
      mascot: opponentMascot,
    },
  };
}
