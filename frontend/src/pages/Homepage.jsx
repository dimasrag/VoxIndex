import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/Logo.png';
import './Homepage.css';

// Features intentionally removed to match design; show compact about section instead

export default function Homepage() {
  const subtitlePhrases = [
    'Convert text into high-quality speech with controllable style and emotion.',
    'Turn scripts into expressive voiceovers in seconds.',
    'Craft natural narration with precise tone control.',
    'Build lifelike speech with fast, reliable synthesis.'
  ];
  const [typedSubtitle, setTypedSubtitle] = useState('');

  const scrollToAbout = () => {
    const section = document.getElementById('about');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId;

    const tick = () => {
      const current = subtitlePhrases[phraseIndex];
      if (!deleting) {
        charIndex += 1;
        setTypedSubtitle(current.slice(0, charIndex));
        if (charIndex >= current.length) {
          deleting = true;
          timeoutId = setTimeout(tick, 1400);
          return;
        }
        timeoutId = setTimeout(tick, 50);
        return;
      }

      charIndex -= 1;
      setTypedSubtitle(current.slice(0, charIndex));
      if (charIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % subtitlePhrases.length;
        timeoutId = setTimeout(tick, 220);
        return;
      }
      timeoutId = setTimeout(tick, 35);
    };

    tick();
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <main className="home-page">
      <section className="home-hero" id="start">
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          <h1>
            <span>Vox</span>Index
          </h1>
          <p className="home-tagline">Transform Text into Natural, Expressive Speech</p>
          <p className="home-subtitle home-subtitle-typing" aria-live="polite">
            {typedSubtitle}
            <span className="typing-cursor" aria-hidden="true">|</span>
          </p>

          <div className="home-cta-row">
            <Link to="/register" className="home-btn home-btn-primary">Get started</Link>
            <button type="button" className="home-btn home-btn-ghost" onClick={scrollToAbout}>About</button>
          </div>
        </div>

        <button type="button" className="home-scroll-btn" onClick={scrollToAbout} aria-label="Scroll to why VoxIndex section">
          ↓
        </button>
      </section>

      <section className="home-about" id="about">
        <div className="home-about-mark" aria-hidden="true">
          <img src={logo} alt="" />
        </div>

        <div className="home-about-copy">
          <h2>Why VoxIndex?</h2>
          <p>
            VoxIndex is designed to simplify expressive text-to-speech workflows through a web-based interface.
            Upload voice references, configure synthesis settings, and manage generated output in one integrated platform.
          </p>
        </div>
      </section>
    </main>
  );
}
