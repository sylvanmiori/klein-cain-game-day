import publication from '../config/publication.json';
import { type Edition, opponentOf } from '../lib/edition';

const siteUrl = 'https://kleincain.gameday.report';

export function JsonLd({ schema }: { schema: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function teamJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: 'Klein Cain Football',
        alternateName: ['Cain Game Day', 'Klein Cain High School Football', 'Klein Cain Hurricanes Football'],
        description: 'Independent coverage of Klein Cain Hurricanes high school football in Houston, TX (District 15-6A). Schedule, live scores, recaps, roster, and statistics.',
        publisher: { '@id': `${siteUrl}/#team` },
        inLanguage: 'en-US',
      },
      {
        '@type': 'SportsTeam',
        '@id': `${siteUrl}/#team`,
        name: `${publication.schoolName} ${publication.schoolMascot} Football`,
        alternateName: [
          'Klein Cain Football',
          'Klein Cain High School Football',
          'Klein Cain Hurricanes',
          'Cain Football',
        ],
        sport: 'American Football',
        gender: 'Male',
        url: `${siteUrl}/`,
        logo: `${siteUrl}/favicon.png`,
        image: `${siteUrl}/og.png`,
        coach: {
          '@type': 'Person',
          name: 'James Clancy',
          jobTitle: 'Head Football Coach & Campus Athletic Coordinator',
        },
        memberOf: {
          '@type': 'SportsOrganization',
          name: 'UIL District 15-6A',
          url: 'https://www.uiltexas.org/',
        },
        location: {
          '@type': 'StadiumOrArena',
          name: 'Klein Memorial Stadium',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '16607 Stuebner Airline Rd',
            addressLocality: 'Klein',
            addressRegion: 'TX',
            postalCode: '77379',
            addressCountry: 'US',
          },
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${siteUrl}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where does Klein Cain play home football games?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Klein Cain plays home games at Klein Memorial Stadium (capacity 8,500), located at 16607 Stuebner Airline Rd in Klein, Texas. The stadium features artificial turf and serves as the home venue for Klein ISD varsity football.',
            },
          },
          {
            '@type': 'Question',
            name: 'What UIL district and classification is Klein Cain football in?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Klein Cain High School competes in Texas UIL Class 6A within District 15-6A. District opponents include Tomball, Tomball Memorial, Klein, Klein Collins, Klein Forest, Klein Oak, Magnolia, and Magnolia West.',
            },
          },
          {
            '@type': 'Question',
            name: 'Who is the head football coach at Klein Cain?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: "James Clancy has served as the head football coach and campus athletic coordinator at Klein Cain High School since the program began varsity play in 2018, leading the Hurricanes to multiple Class 6A playoff appearances.",
            },
          },
          {
            '@type': 'Question',
            name: "What is Klein Cain's current football record?",
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Klein Cain is currently 3–0 overall and 1–0 in District 15-6A play for the 2026 season following victories over Humble (42–14), Oak Ridge (41–20), and Tomball (55–38).',
            },
          },
          {
            '@type': 'Question',
            name: 'Where can I find Klein Cain football box scores, stats, and game recaps?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Cain Game Day (kleincain.gameday.report) publishes comprehensive game recaps, verified box scores, category stat leaders, and Player of the Game honors immediately following every varsity matchup.',
            },
          },
          {
            '@type': 'Question',
            name: 'Where can I see Klein Cain football game photos?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'High-resolution sideline and action game photography by the Klein Cain Football Booster Club is published weekly on the Cain Game Day Photos page with links to full download albums.',
            },
          },
        ],
      },
    ],
  };
}

export function gameJsonLd(edition: Edition) {
  const opponent = opponentOf(edition, publication.schoolName);
  const pageUrl = `${siteUrl}/games/week-${edition.week}`;
  const imageUrl = edition.ogImage && edition.ogImage.length > 0
    ? `${siteUrl}${edition.ogImage.startsWith('/') ? '' : '/'}${edition.ogImage}`
    : `${siteUrl}/og.png`;

  const isFinal = Boolean(edition.final);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SportsEvent',
        '@id': `${pageUrl}#event`,
        name: `Klein Cain vs ${opponent.name} Football`,
        description: edition.metaDescription,
        sport: 'American Football',
        startDate: `${edition.date}T19:00:00-05:00`,
        eventStatus: isFinal ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled',
        location: {
          '@type': 'Place',
          name: edition.venue,
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Klein',
            addressRegion: 'TX',
            addressCountry: 'US',
          },
        },
        competitor: [
          {
            '@type': 'SportsTeam',
            name: edition.home.name,
          },
          {
            '@type': 'SportsTeam',
            name: edition.away.name,
          },
        ],
        homeTeam: {
          '@type': 'SportsTeam',
          name: edition.home.name,
        },
        awayTeam: {
          '@type': 'SportsTeam',
          name: edition.away.name,
        },
      },
      {
        '@type': 'NewsArticle',
        '@id': `${pageUrl}#article`,
        isPartOf: { '@id': `${siteUrl}/#website` },
        headline: edition.pageTitle,
        description: edition.metaDescription,
        datePublished: `${edition.date}T00:00:00-05:00`,
        dateModified: `${edition.date}T00:00:00-05:00`,
        mainEntityOfPage: pageUrl,
        image: [imageUrl],
        author: {
          '@type': 'Organization',
          name: publication.siteName,
          url: `${siteUrl}/`,
        },
        publisher: {
          '@type': 'Organization',
          name: publication.siteName,
          logo: {
            '@type': 'ImageObject',
            url: `${siteUrl}/favicon.png`,
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${siteUrl}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: `Week ${edition.week}: ${opponent.name}`,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

export function photosJsonLd() {
  const pageUrl = `${siteUrl}/photos`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#page`,
        name: 'Klein Cain Football Photos',
        description: 'Game photography and highlights for the 2026 Klein Cain Hurricanes football season.',
        url: pageUrl,
        inLanguage: 'en-US',
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${siteUrl}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Photos',
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
