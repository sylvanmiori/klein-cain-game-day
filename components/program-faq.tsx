import publication from '../config/publication.json';
import { seasonRecord } from './season-hub';

const faqs = [
  {
    q: 'Where does Klein Cain play home football games?',
    a: 'Klein Cain plays home games at Klein Memorial Stadium (capacity 8,500), located at 16607 Stuebner Airline Rd in Klein, Texas. The stadium features artificial turf and serves as the home venue for Klein ISD varsity football.',
  },
  {
    q: 'What UIL district and classification is Klein Cain football in?',
    a: 'Klein Cain High School competes in Texas UIL Class 6A within District 15-6A. District opponents include Tomball, Tomball Memorial, Klein, Klein Collins, Klein Forest, Klein Oak, Magnolia, and Magnolia West.',
  },
  {
    q: 'Who is the head football coach at Klein Cain?',
    a: 'James Clancy has served as the head football coach and campus athletic coordinator at Klein Cain High School since the program began varsity play in 2018, leading the Hurricanes to multiple Class 6A playoff appearances.',
  },
  {
    q: "What is Klein Cain's current football record?",
    a: `Klein Cain is currently ${seasonRecord()} overall and 1–0 in District 15-6A play for the 2026 season following victories over Humble (42–14), Oak Ridge (41–20), and Tomball (55–38).`,
  },
  {
    q: 'Where can I find Klein Cain football box scores, stats, and game recaps?',
    a: 'Cain Game Day (kleincain.gameday.report) publishes comprehensive game recaps, verified box scores, category stat leaders, and Player of the Game honors immediately following every varsity matchup.',
  },
  {
    q: 'Where can I see Klein Cain football game photos?',
    a: 'High-resolution sideline and action game photography by the Klein Cain Football Booster Club is published weekly on the Cain Game Day Photos page with links to full download albums.',
  },
];

function ChevronDown() {
  return (
    <svg className="faq-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function ProgramFaqSection() {
  return (
    <section className="program-faq" id="faq" aria-labelledby="faq-heading">
      <div className="compact-head">
        <div>
          <h2 id="faq-heading">{publication.schoolName} Football Quick Facts & FAQ</h2>
          <p>Frequently asked questions about Hurricanes varsity football</p>
        </div>
      </div>

      <div className="faq-grid">
        {faqs.map((faq, index) => (
          <details className="faq-item" key={faq.q} open={index < 2}>
            <summary className="faq-question">
              <span>{faq.q}</span>
              <ChevronDown />
            </summary>
            <p className="faq-answer">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
