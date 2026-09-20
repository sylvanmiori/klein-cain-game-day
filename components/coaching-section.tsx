import publication from '../config/publication.json';
import { type CoachProfile, type CoachingMatchup, schoolCoach } from '../lib/coaches';
import { sitePath } from '../lib/site-path';

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][value % 10] ?? 'th';
  return `${value}${suffix}`;
}

function tenure(coach: CoachProfile): string {
  return `${ordinal(coach.season)} season · ${coach.record}`;
}

function CoachCard({
  coach,
  schoolName,
  mascot,
  side,
  hideBio = false,
}: {
  coach: CoachProfile;
  schoolName: string;
  mascot: string;
  side: 'school' | 'opponent';
  hideBio?: boolean;
}) {
  return (
    <article className={`coach-card ${side}`}>
      {coach.image ? (
        <img src={sitePath(coach.image)} alt="" className="coach-photo" />
      ) : (
        <div className="coach-photo coach-photo-placeholder" aria-hidden="true">
          {coach.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </div>
      )}
      <div className="coach-copy">
        <p className="coach-kicker">
          {schoolName} {mascot}
        </p>
        <h3>{coach.name}</h3>
        <p className="coach-title">{coach.title}</p>
        <p className="coach-tenure">{tenure(coach)}</p>
        {!hideBio && <p className="coach-bio">{coach.bio}</p>}
        <a href={coach.sourceUrl} target="_blank" rel="noreferrer">
          {coach.source}
        </a>
      </div>
    </article>
  );
}

/** The covered school’s head coach, shown on the program page all season. */
export function SchoolCoachSection() {
  const coach = schoolCoach();
  return (
    <section className="coaching coaching-school" aria-labelledby="school-coach-heading">
      <div className="section-head">
        <h2 id="school-coach-heading">{publication.schoolName} head coach</h2>
      </div>
      <CoachCard
        coach={coach}
        schoolName={publication.schoolName}
        mascot={publication.schoolMascot}
        side="school"
      />
    </section>
  );
}

/** Both head coaches for a featured game preview or report. */
export function CoachingMatchupSection({
  matchup,
  spotlightOpponent = false,
}: {
  matchup: CoachingMatchup;
  /** Preview pages lead with an editorial note on the opposing coach. */
  spotlightOpponent?: boolean;
}) {
  return (
    <section className="coaching coaching-matchup" id="coaching" aria-labelledby="coaching-heading">
      <div className="section-head">
        <h2 id="coaching-heading">Head coaches</h2>
      </div>
      {spotlightOpponent && (
        <div className="coach-spotlight">
          <p className="coach-kicker">On the other sideline</p>
          <h3>
            {matchup.opponent.name} · {matchup.opponent.schoolName}
          </h3>
          <p className="coach-spotlight-body">{matchup.opponent.bio}</p>
        </div>
      )}
      <div className="coach-grid">
        <CoachCard
          coach={matchup.school}
          schoolName={matchup.school.schoolName}
          mascot={matchup.school.mascot}
          side="school"
        />
        <CoachCard
          coach={matchup.opponent}
          schoolName={matchup.opponent.schoolName}
          mascot={matchup.opponent.mascot}
          side="opponent"
          hideBio={spotlightOpponent}
        />
      </div>
    </section>
  );
}
