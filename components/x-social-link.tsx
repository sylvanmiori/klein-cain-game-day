import publication from '../config/publication.json';

export function XSocialLink({ className = 'footer-social-link' }: { className?: string }) {
  const url = (publication as { xUrl?: string }).xUrl ?? 'https://x.com/CainGameday';
  const handle = (publication as { xHandle?: string }).xHandle ?? '@CainGameday';

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={className}
      aria-label={`Follow ${handle} on X`}
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      <span>{handle}</span>
    </a>
  );
}
