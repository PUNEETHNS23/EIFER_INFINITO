import React from 'react';
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

function About() {
  return (
    <div className="about-page">
      <section className="about-hero container" aria-label="about-header">
        <p className="about-tag">ABOUT INFINITO</p>
        <h1 className="about-title">Meet the Co-ordinators</h1>
        <p className="about-description">
          The Sports Fest Infinito operations are led by the co-ordinators below. They manage planning,
          communication, scheduling, and smooth execution across all events.
        </p>
      </section>

      <section className="about-coordinators container" aria-label="co-ordinators">
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

      <section className="about-summary container">
        <p>
          For event updates and operational queries, reach out through the official Infinito communication channels.
        </p>
      </section>
    </div>
  );
}

export default About;
