import publication from '../config/publication.json';
import { type Edition, opponentOf } from '../lib/edition';
import { resolveEditionImage } from '../lib/edition-metadata';

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
    ],
  };
}

export function gameJsonLd(edition: Edition) {
  const opponent = opponentOf(edition, publication.schoolName);
  const pageUrl = `${siteUrl}/games/week-${edition.week}`;
  const imageUrl = resolveEditionImage(edition).url;

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
