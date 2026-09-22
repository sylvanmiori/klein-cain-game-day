import type { SocialPost } from '../lib/edition';

/**
 * Embedded X post, rendered as a self-contained card in the site's own
 * visual language rather than X's official widget. No third-party scripts,
 * no hotlinked assets; the card links out to the original post.
 */

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const second = words.length > 1 ? words[1]?.[0] ?? '' : '';
  return (first + second).toUpperCase();
}

function VerifiedBadge() {
  return (
    <svg className="tweet-verified" viewBox="0 0 24 24" width="15" height="15" aria-label="Verified account" role="img">
      <path
        fill="#1d9bf0"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"
      />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function TweetCard({ post }: { post: SocialPost }) {
  return (
    <article className="tweet-card">
      <div className="tweet-head">
        <span className="tweet-avatar" aria-hidden="true">{initials(post.author)}</span>
        <div className="tweet-who">
          <span className="tweet-name">
            {post.author}
            {post.verified && <VerifiedBadge />}
          </span>
          <span className="tweet-meta">@{post.handle} · {post.timestamp}</span>
        </div>
        <span className="tweet-x" aria-hidden="true"><XGlyph /></span>
      </div>
      <p className="tweet-text">{post.text}</p>
      {post.media?.file ? (
        <figure className="tweet-video">
          <video
            className="tweet-video-player"
            poster={post.media.poster}
            controls
            playsInline
            preload="metadata"
          >
            <source src={post.media.file} type="video/mp4" />
            <track kind="captions" label="English" srcLang="en" />
            Your browser does not support video playback.
          </video>
          <figcaption className="tweet-video-credit">
            Video: {post.author} ·{' '}
            <a href={post.url} target="_blank" rel="noreferrer">
              View post on X
            </a>
          </figcaption>
        </figure>
      ) : post.media ? (
        <a
          className="tweet-media"
          href={post.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${post.media.label} on X (opens in a new tab)`}
        >
          <span className="tweet-media-play" aria-hidden="true"><PlayGlyph /></span>
          <span className="tweet-media-label">{post.media.label}</span>
          {post.media.duration && <span className="tweet-media-duration">{post.media.duration}</span>}
        </a>
      ) : null}
      <div className="tweet-foot">
        <a href={post.url} target="_blank" rel="noreferrer">
          View post on X
        </a>
      </div>
    </article>
  );
}

export function SocialBuzz({ posts }: { posts: SocialPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section className="social-buzz" aria-label="What they're saying on X">
      <div className="section-head">
        <p className="home-kicker">On X</p>
        <h2>What they&rsquo;re saying</h2>
      </div>
      <div className="tweet-grid">
        {posts.map((post) => (
          <TweetCard key={post.url} post={post} />
        ))}
      </div>
    </section>
  );
}
