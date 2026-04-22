import './About.css';

const COORDINATORS = [
  {
    name: 'Baba Nayak',
    role: 'Co-ordinator',
    rollNumber: 'TBD',
    photo: '/coordinators/baba-nayak.jpg',
    bio: 'Leads event flow and inter-team coordination to keep every fixture and update on schedule.',
  },
  {
    name: 'Rahul Naskar',
    role: 'Co-ordinator',
    rollNumber: 'TBD',
    photo: '/coordinators/rahul-naskar.jpg',
    bio: 'Oversees operations, match readiness, and participant support across all tournament venues.',
  },
];

const WEBSITE_TEAM = [
  {
    name: 'Team Member 1',
    role: 'Frontend Developer',
    contribution: 'Built responsive interfaces and match visualization views.',
    photo: '/eifer-logo-no-bg.png',
    bio: 'Focused on reusable components, UX clarity, and mobile-friendly layouts.',
  },
  {
    name: 'Team Member 2',
    role: 'Backend Developer',
    contribution: 'Designed APIs, scoring logic, and data consistency rules.',
    photo: '/eifer-logo-no-bg.png',
    bio: 'Worked on reliability, validation, and smooth integration with the frontend.',
  },
  {
    name: 'Team Member 3',
    role: 'QA and Release',
    contribution: 'Handled testing workflows, bug triage, and release readiness.',
    photo: '/eifer-logo-no-bg.png',
    bio: 'Ensured stable behavior across sports modules and match-day usage.',
  },
  {
    name: 'Team Member 4',
    role: 'Product and Coordination',
    contribution: 'Managed feature planning, priorities, and cross-team communication.',
    photo: '/eifer-logo-no-bg.png',
    bio: 'Aligned website delivery with event timelines and organizer requirements.',
  },
];

function About() {
  return (
    <div className="about-page">
      <section className="about-hero container" aria-label="about-header">
        <p className="about-tag">ABOUT INFINITO</p>
        <h1 className="about-title">People Behind Infinito</h1>
        <p className="about-description">
          Infinito is powered by both the coordination team and the website team. One group runs event operations,
          while the other builds and maintains the platform used by participants and organizers.
        </p>
        <div className="about-jump-links" aria-label="about-section-navigation">
          <a href="#coordinators" className="about-jump-link">Co-ordinators</a>
          <a href="#website-team" className="about-jump-link">Website Team</a>
        </div>
      </section>

      <section id="coordinators" className="about-section container" aria-label="co-ordinators">
        <div className="about-section-head">
          <h2 className="about-section-title">Co-ordinators</h2>
          <p className="about-section-subtitle">Managed planning, communication, logistics, and on-ground execution.</p>
        </div>
        <div className="about-coordinators-grid">
          {COORDINATORS.map((coordinator) => (
            <article key={coordinator.name} className="about-coordinator-card">
              <img
                src={coordinator.photo}
                alt={coordinator.name}
                className="about-coordinator-photo"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/eifer-logo-no-bg.png';
                }}
              />
              <div className="about-coordinator-content">
                <p className="about-coordinator-role">{coordinator.role}</p>
                <h2 className="about-coordinator-name">{coordinator.name}</h2>
                <p className="about-coordinator-roll">Roll No: {coordinator.rollNumber}</p>
                <p className="about-coordinator-bio">{coordinator.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="website-team" className="about-section container" aria-label="website-team">
        <div className="about-section-head">
          <h2 className="about-section-title">Website Team</h2>
          <p className="about-section-subtitle">Designed, developed, tested, and maintained the Infinito platform.</p>
        </div>
        <div className="about-coordinators-grid">
          {WEBSITE_TEAM.map((member) => (
            <article key={member.name} className="about-coordinator-card">
              <img
                src={member.photo}
                alt={member.name}
                className="about-coordinator-photo"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/eifer-logo-no-bg.png';
                }}
              />
              <div className="about-coordinator-content">
                <p className="about-coordinator-role">{member.role}</p>
                <h2 className="about-coordinator-name">{member.name}</h2>
                <p className="about-coordinator-roll">Built: {member.contribution}</p>
                <p className="about-coordinator-bio">{member.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-summary container">
        <p>
          For event updates and operational queries, reach out through the official Infinito communication channels.
        </p>
      </section>
    </div>
  );
}

export default About;
