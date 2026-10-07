import publication from '../config/publication.json';
import { XSocialLink } from './x-social-link';

const social = publication as typeof publication & {
  instagramUrl?: string;
  instagramHandle?: string;
  facebookUrl?: string;
};

export function FooterSocialLinks() {
  return (
    <nav className="footer-social-links" aria-label="Cain Game Day social accounts">
      <XSocialLink />
      {social.instagramUrl && (
        <a
          href={social.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-social-link"
          aria-label={`Follow ${social.instagramHandle ?? 'Cain Game Day'} on Instagram`}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="18" cy="6" r="1" fill="currentColor" stroke="none" />
          </svg>
          <span>Instagram</span>
        </a>
      )}
      {social.facebookUrl && (
        <a
          href={social.facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-social-link"
          aria-label="Follow Cain Game Day on Facebook"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.5 1.6-1.5h1.7V3.1a22 22 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V21h3.4Z" />
          </svg>
          <span>Facebook</span>
        </a>
      )}
    </nav>
  );
}
