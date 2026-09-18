"use client";

interface Props {
  icon: React.ReactNode;
  title: string;
}

export default function UnderDevelopment({ icon, title }: Props) {
  return (
    <div className="ud-shell">
      {/* Animated gears / construction SVG */}
      <div className="ud-animation">
        {/* Outer ring pulse */}
        <div className="ud-ring ud-ring-1" />
        <div className="ud-ring ud-ring-2" />
        <div className="ud-ring ud-ring-3" />

        {/* Central gear */}
        <div className="ud-gear-wrap">
          <svg className="ud-gear ud-gear-main" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M43.3 5.4l-2.2 8.2a32 32 0 0 0-8.3 3.4l-7.8-3.5-9.4 9.4 3.5 7.8a32 32 0 0 0-3.4 8.3l-8.2 2.2v13.4l8.2 2.2a32 32 0 0 0 3.4 8.3l-3.5 7.8 9.4 9.4 7.8-3.5a32 32 0 0 0 8.3 3.4l2.2 8.2h13.4l2.2-8.2a32 32 0 0 0 8.3-3.4l7.8 3.5 9.4-9.4-3.5-7.8a32 32 0 0 0 3.4-8.3l8.2-2.2V43.3l-8.2-2.2a32 32 0 0 0-3.4-8.3l3.5-7.8-9.4-9.4-7.8 3.5a32 32 0 0 0-8.3-3.4L56.7 5.4H43.3z"
              fill="var(--accent)"
              opacity="0.15"
            />
            <path
              d="M43.3 5.4l-2.2 8.2a32 32 0 0 0-8.3 3.4l-7.8-3.5-9.4 9.4 3.5 7.8a32 32 0 0 0-3.4 8.3l-8.2 2.2v13.4l8.2 2.2a32 32 0 0 0 3.4 8.3l-3.5 7.8 9.4 9.4 7.8-3.5a32 32 0 0 0 8.3 3.4l2.2 8.2h13.4l2.2-8.2a32 32 0 0 0 8.3-3.4l7.8 3.5 9.4-9.4-3.5-7.8a32 32 0 0 0 3.4-8.3l8.2-2.2V43.3l-8.2-2.2a32 32 0 0 0-3.4-8.3l3.5-7.8-9.4-9.4-7.8 3.5a32 32 0 0 0-8.3-3.4L56.7 5.4H43.3z"
              stroke="var(--accent)"
              strokeWidth="2"
              fill="none"
            />
            <circle cx="50" cy="50" r="14" fill="var(--accent)" opacity="0.2" />
            <circle cx="50" cy="50" r="14" stroke="var(--accent)" strokeWidth="2" fill="none" />
          </svg>

          {/* Small satellite gear (spins opposite) */}
          <svg className="ud-gear ud-gear-small" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M26 3.2l-1.3 4.9a19 19 0 0 0-5 2l-4.7-2.1-5.6 5.6 2.1 4.7a19 19 0 0 0-2 5L5 24.6V31l4.9 1.3a19 19 0 0 0 2 5l-2.1 4.7 5.6 5.6 4.7-2.1a19 19 0 0 0 5 2L26 52.5H33l1.3-4.9a19 19 0 0 0 5-2l4.7 2.1 5.6-5.6-2.1-4.7a19 19 0 0 0 2-5L54.8 31v-6.4l-4.9-1.3a19 19 0 0 0-2-5l2.1-4.7-5.6-5.6-4.7 2.1a19 19 0 0 0-5-2L33 3.2H26z"
              fill="var(--accent)"
              opacity="0.1"
            />
            <path
              d="M26 3.2l-1.3 4.9a19 19 0 0 0-5 2l-4.7-2.1-5.6 5.6 2.1 4.7a19 19 0 0 0-2 5L5 24.6V31l4.9 1.3a19 19 0 0 0 2 5l-2.1 4.7 5.6 5.6 4.7-2.1a19 19 0 0 0 5 2L26 52.5H33l1.3-4.9a19 19 0 0 0 5-2l4.7 2.1 5.6-5.6-2.1-4.7a19 19 0 0 0 2-5L54.8 31v-6.4l-4.9-1.3a19 19 0 0 0-2-5l2.1-4.7-5.6-5.6-4.7 2.1a19 19 0 0 0-5-2L33 3.2H26z"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeOpacity="0.5"
              fill="none"
            />
            <circle cx="30" cy="30" r="8" stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeOpacity="0.5" />
          </svg>
        </div>

        {/* Floating dots */}
        <div className="ud-dot ud-dot-1" />
        <div className="ud-dot ud-dot-2" />
        <div className="ud-dot ud-dot-3" />
        <div className="ud-dot ud-dot-4" />
        <div className="ud-dot ud-dot-5" />

        {/* Progress bar */}
        <div className="ud-progress-wrap">
          <div className="ud-progress-bar" />
        </div>
      </div>

      {/* Text content */}
      <div className="ud-content">
        <div className="ud-icon-badge">{icon}</div>
        <h2 className="ud-title">{title}</h2>
        <p className="ud-subtitle">This module is currently under development.</p>
        <p className="ud-desc">
          We&apos;re building something great. Check back soon — this feature will be available in the next release.
        </p>
        <div className="ud-tags">
          <span className="ud-tag">In Progress</span>
          <span className="ud-tag ud-tag-outline">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
