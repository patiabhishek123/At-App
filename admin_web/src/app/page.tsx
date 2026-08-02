'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// SVGs for Premium Monochrome Icons
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const WifiIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const LockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const KeyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
  </svg>
);

export default function LandingPage() {
  // Parallax Scroll Offset
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Interactive Audience Tabs
  const [activeAudience, setActiveAudience] = useState<'students' | 'teachers' | 'admins'>('students');

  // Interactive Simulator States
  const [simCode, setSimCode] = useState('842 109');
  const [simTimer, setSimTimer] = useState(10);
  const [simTerminalLines, setSimTerminalLines] = useState<string[]>([
    '[System] Server online. Awaiting classroom session creation...',
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simPresentCount, setSimPresentCount] = useState(14);
  const [simProgress, setSimProgress] = useState(0); // For student check-in meter

  // FAQ states
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Demo Modal state
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Contact Form state (demo booker)
  const [showBookerModal, setShowBookerModal] = useState(false);
  const [bookerName, setBookerName] = useState('');
  const [bookerEmail, setBookerEmail] = useState('');
  const [bookerOrg, setBookerOrg] = useState('');
  const [bookerFeedback, setBookerFeedback] = useState('');

  // Scroll Reveal elements
  const revealRefs = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);

      // Trigger scroll reveal
      revealRefs.current.forEach((el) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const triggerPoint = window.innerHeight - 80;
        if (rect.top < triggerPoint) {
          el.classList.add('reveal-active');
        }
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX - window.innerWidth / 2) / 50,
        y: (e.clientY - window.innerHeight / 2) / 50,
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);

    // Initial check
    setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Simulator ticking loop
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setSimTimer((prev) => {
        if (prev <= 1) {
          // Reset timer and generate new code
          const newCode = Math.floor(100000 + Math.random() * 900000).toString();
          const spacedCode = `${newCode.substring(0, 3)} ${newCode.substring(3)}`;
          setSimCode(spacedCode);
          setSimTerminalLines((lines) => [
            ...lines.slice(-10),
            `[System] Code rotated: [${spacedCode}] (Valid for 10s)`,
          ]);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Simulator function
  const startCheckInSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimProgress(0);

    const steps = [
      { text: '[Client] Scanning local network & GPS parameters...', delay: 400 },
      { text: '[WiFi] Connected to Class WiFi AP: "Edu-Staff-5G" - BSSID matches [00:0a:95:9d:68:16]', delay: 1000 },
      { text: '[GPS] Geofence verified: Inside classroom radius (4.8m from center) - PASS', delay: 1600 },
      { text: `[Auth] Exchanging rotating token: Validating [${simCode}] ...`, delay: 2200 },
      { text: '[Success] Secure handshakes approved. Student marked present!', delay: 2800 },
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setSimTerminalLines((lines) => [...lines.slice(-10), step.text]);
        setSimProgress(((idx + 1) / steps.length) * 100);

        if (idx === steps.length - 1) {
          setIsSimulating(false);
          setSimPresentCount((c) => c + 1);
        }
      }, step.delay);
    });
  };

  const handleBookDemo = (e: React.FormEvent) => {
    e.preventDefault();
    setBookerFeedback(`Thank you, ${bookerName}! Our team will email pilot materials to ${bookerEmail} within 2 hours.`);
    setTimeout(() => {
      setShowBookerModal(false);
      setBookerName('');
      setBookerEmail('');
      setBookerOrg('');
      setBookerFeedback('');
    }, 3000);
  };

  return (
    <div className="landing-container">
      {/* 1. Header Navigation */}
      <header className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            backgroundColor: 'var(--accent-gold)',
            color: '#000000',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: '900',
            border: '2.5px solid #000000',
            boxShadow: '2.5px 2.5px 0px #000000',
            fontSize: '18px'
          }}>A</div>
          <span style={{ fontSize: '20px', fontWeight: '900', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>AtApp</span>
        </div>

        <nav className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#how-it-works" className="landing-nav-link">How it works</a>
          <a href="#pricing" className="landing-nav-link">Pricing</a>
          <a href="#faq" className="landing-nav-link">FAQ</a>
          <Link href="/admin" className="landing-nav-link" style={{ color: 'var(--accent-gold)' }}>Tenant Console</Link>
        </nav>

        <button className="btn btn-primary cta-btn-gold" style={{ padding: '8px 18px', fontSize: '13px' }} onClick={() => setShowBookerModal(true)}>
          Book a demo
        </button>
      </header>

      {/* 2. Hero Section (with Parallax Background) */}
      <section className="hero-parallax-wrapper" style={{ position: 'relative' }}>
        <div className="parallax-background">
          {/* Floating layers reacting to scroll and mouse */}
          <div className="parallax-shape shape-1 float-slow-anim" style={{
            transform: `translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.4 - scrollY * 0.15}px) rotate(15deg)`,
          }} />
          <div className="parallax-shape shape-2 float-medium-anim" style={{
            transform: `translate(${mousePos.x * -0.6}px, ${mousePos.y * -0.6 - scrollY * 0.05}px) rotate(85deg)`,
          }} />
          <div className="parallax-shape shape-3 float-slow-anim" style={{
            transform: `translate(${mousePos.x * 0.8}px, ${mousePos.y * 0.8 - scrollY * 0.25}px) rotate(-35deg)`,
          }} />
        </div>

        <div className="hero-content-grid">
          {/* Left Content */}
          <div className="reveal-init reveal-active" ref={(el) => { if (el) revealRefs.current[0] = el; }}>
            <span className="eyebrow-badge">For colleges tired of paper sheets</span>
            <h1 className="hero-title">
              Attendance that <span style={{ textDecoration: 'underline', decorationColor: 'var(--accent-gold)' }}>can't</span> be faked.
            </h1>
            <p className="hero-description">
              AtApp verifies who's actually in the room using combined network BSSID matching, micro-GPS geofences, and rotating teacher codes. It shows every student exactly where they stand in real time.
            </p>

            <div className="hero-cta-row">
              <button className="btn btn-primary cta-btn-gold" style={{ padding: '14px 28px' }} onClick={() => setShowBookerModal(true)}>
                Book a demo
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => setShowDemoModal(true)}
              >
                <PlayIcon /> Watch 90-sec Video
              </button>
            </div>
            <p className="hero-micro-text">
              ★ No credit card needed for a pilot. Set up your first department in a day.
            </p>
          </div>

          {/* Right Visual (Interactive Simulator / Parallax Card Stack) */}
          <div className="hero-mockup-wrapper reveal-init reveal-active" ref={(el) => { if (el) revealRefs.current[1] = el; }}>
            {/* Main card with our generated classroom photo */}
            <div className="mockup-card-main" style={{
              transform: `translateY(${scrollY * 0.05}px) rotate(-1deg)`,
            }}>
              <div className="mockup-image-container">
                <img src="/classroom_discussion.png" alt="Classroom Discussion" />
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  backgroundColor: 'rgba(6, 8, 14, 0.95)',
                  border: '1.5px solid var(--accent-gold)',
                  borderRadius: '30px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: 'var(--accent-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4AD66D', display: 'inline-block' }} />
                  Verification Active
                </div>
              </div>
              <div className="mockup-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-light)' }}>Physics 101: Quantum Mechanics</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Dr. Richard Feynman · Fall Semester</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--accent-gold)' }}>96.4%</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Average Roster</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Overlapping Floating widget 1: Verification signal badge */}
            <div className="floating-widget widget-stats" style={{
              transform: `translate(${mousePos.x * -0.3}px, ${-30 + scrollY * 0.08}px) rotate(4deg)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldIcon />
                <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.8 }}>TRIPLE-LOCK</div>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '900', lineHeight: 1.1 }}>RLS Secure</div>
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>Wi-Fi + GPS + Token</div>
            </div>

            {/* Overlapping Floating widget 2: Teacher quote */}
            <div className="floating-widget widget-testimonial" style={{
              transform: `translate(${mousePos.x * 0.3}px, ${-20 + scrollY * 0.03}px) rotate(-2deg)`,
            }}>
              <p style={{ fontSize: '12px', fontStyle: 'italic', margin: 0, lineHeight: 1.4, color: 'var(--text-light)' }}>
                "Starting attendance takes me less than 10 seconds. Students check in from their seats before I finish writing the first equation."
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#ffffff',
                  border: '1.5px solid #000000'
                }}>RF</div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-light)' }}>Dr. Richard Feynman</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Physics Department Head</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Partner Logo Bar */}
      <section className="partners-bar">
        <div className="partner-logo">
          <span>🏛️</span> Massachusetts Institute of Technology
        </div>
        <div className="partner-logo">
          <span>🌲</span> Stanford University
        </div>
        <div className="partner-logo">
          <span>🔬</span> California Institute of Technology
        </div>
        <div className="partner-logo">
          <span>🔴</span> Harvard University
        </div>
      </section>

      {/* 4. The Problem Section */}
      <section className="light-section-wrap" id="features">
        <div className="section-intro reveal-init" ref={(el) => { if (el) revealRefs.current[2] = el; }}>
          <span className="eyebrow-badge" style={{ backgroundColor: 'rgba(108, 99, 255, 0.1)', color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)' }}>
            The Reality of Campus Administration
          </span>
          <h2>The paper sheet is costing you more than time</h2>
          <p>Traditional methods ignore the realities of modern classrooms. Here is why signatures fail.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', maxWidth: '1200px', margin: '0 auto' }}>
          <div className="card reveal-init" ref={(el) => { if (el) revealRefs.current[3] = el; }} style={{ padding: '36px', border: '3px solid #000000', borderRadius: '18px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#ff8b9e',
              border: '2px solid #000000',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              marginBottom: '20px',
              boxShadow: '3px 3px 0 #000000'
            }}>📝</div>
            <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '12px' }}>Proxy attendance is easy</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#4a5568' }}>
              A signature sheet is incredibly easy to fake or fill in for someone else. Everyone knows it happens, but until now, colleges lacked a seamless mechanism to verify actual presence.
            </p>
          </div>

          <div className="card reveal-init" ref={(el) => { if (el) revealRefs.current[4] = el; }} style={{ padding: '36px', border: '3px solid #000000', borderRadius: '18px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: 'var(--accent-gold)',
              border: '2px solid #000000',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              marginBottom: '20px',
              boxShadow: '3px 3px 0 #000000'
            }}>⏳</div>
            <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '12px' }}>Students find out too late</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#4a5568' }}>
              Delayed spreadsheet uploads mean a student can slide below critical thresholds for weeks without warning. AtApp resolves this by showing live dashboard telemetry to the students directly.
            </p>
          </div>

          <div className="card reveal-init" ref={(el) => { if (el) revealRefs.current[5] = el; }} style={{ padding: '36px', border: '3px solid #000000', borderRadius: '18px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: 'var(--color-primary)',
              border: '2px solid #000000',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: '#ffffff',
              marginBottom: '20px',
              boxShadow: '3px 3px 0 #000000'
            }}>💡</div>
            <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '12px' }}>Teachers lose instruction time</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#4a5568' }}>
              Passing around sheets, taking roll calls, or scanning QR codes blocks lectures. AtApp runs silently: the professor taps one button on their phone, and checks-ins process automatically.
            </p>
          </div>
        </div>
      </section>

      {/* 5. How It Works (Sequential 3 Steps + Simulator Widget) */}
      <section className="light-section-wrap" id="how-it-works" style={{ borderTop: 'none', backgroundColor: '#EDE9DE' }}>
        <div className="section-intro">
          <span className="eyebrow-badge" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)', color: '#000000', border: '1.5px solid #000000' }}>
            Interactive Demo
          </span>
          <h2>How AtApp replaces the sheet</h2>
          <p>A true verification sequence designed to connect professors and students securely.</p>
        </div>

        <div className="metrics-section">
          {/* Left Side: 3-step sequence list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="reveal-init" ref={(el) => { if (el) revealRefs.current[6] = el; }} style={{ display: 'flex', gap: '20px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                border: '2.5px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontWeight: '900',
                fontSize: '18px',
                flexShrink: 0,
                boxShadow: '3px 3px 0 #000000'
              }}>1</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '6px' }}>Teacher starts a session</h3>
                <p style={{ fontSize: '14px', color: '#4a5568', lineHeight: 1.4 }}>
                  One tap generates a temporary security check-in code. This token rotates automatically on the server, preventing code sharing.
                </p>
              </div>
            </div>

            <div className="reveal-init" ref={(el) => { if (el) revealRefs.current[7] = el; }} style={{ display: 'flex', gap: '20px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-gold)',
                color: '#000000',
                border: '2.5px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontWeight: '900',
                fontSize: '18px',
                flexShrink: 0,
                boxShadow: '3px 3px 0 #000000'
              }}>2</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '6px' }}>Students check in from their seat</h3>
                <p style={{ fontSize: '14px', color: '#4a5568', lineHeight: 1.4 }}>
                  The student app matches the classroom router BSSID signature, checks GPS geofence coordinates, and confirms the active code.
                </p>
              </div>
            </div>

            <div className="reveal-init" ref={(el) => { if (el) revealRefs.current[8] = el; }} style={{ display: 'flex', gap: '20px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: '#ff8b9e',
                color: '#000000',
                border: '2.5px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontWeight: '900',
                fontSize: '18px',
                flexShrink: 0,
                boxShadow: '3px 3px 0 #000000'
              }}>3</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '6px' }}>Real-time statistics for everyone</h3>
                <p style={{ fontSize: '14px', color: '#4a5568', lineHeight: 1.4 }}>
                  Students immediately see their safe percentage boundaries. Instructors review live check-in rosters. Admins query logs at will.
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Interactive Check-in Simulator widget */}
          <div className="reveal-init" ref={(el) => { if (el) revealRefs.current[9] = el; }}>
            <div className="interactive-simulator">
              <div className="simulator-header">
                <div className="simulator-dots">
                  <span className="sim-dot sim-dot-red" />
                  <span className="sim-dot sim-dot-yellow" />
                  <span className="sim-dot sim-dot-green" />
                </div>
                <div className="simulator-title">ATAPP VERIFICATION ENGINE v1.2</div>
                <div style={{ width: '30px' }} />
              </div>

              <div className="simulator-body">
                <div className="sim-screen-grid">
                  {/* Phone screen */}
                  <div className="sim-phone">
                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Teacher Session
                    </span>
                    <div className="sim-code-box">{simCode}</div>
                    <div className="sim-timer-container">
                      <div className="sim-radial-timer" />
                      <span>CODE EXPIRES IN {simTimer}s</span>
                    </div>

                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', marginTop: '20px', padding: '10px 14px', fontSize: '12px' }}
                      onClick={startCheckInSimulation}
                      disabled={isSimulating}
                    >
                      {isSimulating ? 'Verifying Student...' : 'Check-In Student'}
                    </button>
                  </div>

                  {/* Terminal log */}
                  <div className="sim-terminal">
                    <div style={{ flex: 1 }}>
                      {simTerminalLines.map((line, idx) => (
                        <div key={idx} className="sim-term-line" style={{
                          color: line.includes('[Success]') ? '#4AD66D' : 
                                 line.includes('[WiFi]') || line.includes('[GPS]') ? '#FFB000' : 
                                 line.includes('[Client]') ? '#a855f7' : '#38bdf8'
                        }}>
                          {line}
                        </div>
                      ))}
                    </div>
                    
                    {/* Simulated Roster Info */}
                    <div style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      paddingTop: '10px',
                      marginTop: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: 'var(--text-muted)'
                    }}>
                      <span>Class Size: 30</span>
                      <span style={{ color: '#4AD66D', fontWeight: '800' }}>Present: {simPresentCount} / 30</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Feature Depth Split by Audience (Tabs System) */}
      <section className="light-section-wrap" style={{ borderTop: 'none', backgroundColor: '#F4F0E6' }}>
        <div className="section-intro">
          <span className="eyebrow-badge" style={{ backgroundColor: 'rgba(108, 99, 255, 0.1)', color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)' }}>
            Feature Matrix
          </span>
          <h2>Tailored for every campus user</h2>
          <p>AtApp features are customized to support student confidence, teacher control, and admin audit metrics.</p>
        </div>

        {/* Tab Buttons */}
        <div className="audience-tabs-nav">
          <button 
            className={`audience-tab-btn ${activeAudience === 'students' ? 'active' : ''}`}
            onClick={() => setActiveAudience('students')}
          >
            For Students
          </button>
          <button 
            className={`audience-tab-btn ${activeAudience === 'teachers' ? 'active' : ''}`}
            onClick={() => setActiveAudience('teachers')}
          >
            For Teachers
          </button>
          <button 
            className={`audience-tab-btn ${activeAudience === 'admins' ? 'active' : ''}`}
            onClick={() => setActiveAudience('admins')}
          >
            For Admins
          </button>
        </div>

        {/* Tab Cards */}
        <div className="audience-tab-content-card">
          {/* Benefit items list */}
          <div>
            {activeAudience === 'students' && (
              <div className="benefit-list">
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>Real-time attendance score</h4>
                    <p>Access your live class-percentage metric instantly. No more waiting for monthly uploads.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>Detailed failure feedback</h4>
                    <p>If a check-in fails, the app lists the exact reason (e.g. WiFi mismatch, expired code) so you can fix it.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>Threshold warnings</h4>
                    <p>Get notified when attendance slips close to course limits, giving you time to course-correct.</p>
                  </div>
                </div>
              </div>
            )}

            {activeAudience === 'teachers' && (
              <div className="benefit-list">
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>One-tap session creation</h4>
                    <p>Spawn an active class session in seconds. The rotating security code renders automatically.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>Live student check-in counters</h4>
                    <p>Watch your roster populate as students check in from their seats. Immediate validation feedback.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>Manual teacher override log</h4>
                    <p>Always stay in control. Manually override verification parameters with logged reasons whenever needed.</p>
                  </div>
                </div>
              </div>
            )}

            {activeAudience === 'admins' && (
              <div className="benefit-list">
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>Multi-department telemetry dashboard</h4>
                    <p>Review comprehensive statistics and aggregate metrics across the entire college console in a click.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>Configurable security controls</h4>
                    <p>Enforce signals required: BSSID-only, GPS-only, or full triple-handshake limits per course.</p>
                  </div>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div className="benefit-text">
                    <h4>Postgres RLS audit trails</h4>
                    <p>Query searchable records of every override, validation mismatch, and check-in success.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Simulated Mobile Mockup for visual wow factor */}
          <div style={{
            backgroundColor: '#06080E',
            border: '3px solid #000000',
            borderRadius: '24px',
            padding: '24px',
            color: '#ffffff',
            boxShadow: '6px 6px 0px #000000',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px'
          }}>
            {activeAudience === 'students' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '14px' }}>
                  <span>STUDENT MOBILE</span>
                  <span style={{ color: 'var(--accent-gold)' }}>● ONLINE</span>
                </div>
                <div style={{ border: '2px solid #ffffff', borderRadius: '12px', padding: '16px', backgroundColor: '#121620' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CURRENT COURSE</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', margin: '4px 0 10px', color: '#ffffff' }}>Intro to Computer Science</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Your Attendance:</span>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#ff8b9e' }}>74.2%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginTop: '10px' }}>
                    <div style={{ width: '74.2%', height: '100%', backgroundColor: '#ff8b9e' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: '#ff8b9e', marginTop: '6px', fontWeight: 'bold' }}>⚠️ WARNING: Below 75% threshold</div>
                </div>
              </div>
            )}

            {activeAudience === 'teachers' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '14px' }}>
                  <span>TEACHER CONTROL</span>
                  <span style={{ color: '#4AD66D' }}>● SESSION LIVE</span>
                </div>
                <div style={{ border: '2px solid #ffffff', borderRadius: '12px', padding: '16px', backgroundColor: '#121620' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px' }}>Active check-in details</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Alice Smith</span>
                      <span style={{ color: '#4AD66D' }}>PRESENT (GPS + WiFi)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Bob Miller</span>
                      <span style={{ color: '#ff8b9e' }}>FAIL (BSSID Mismatch)</span>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '10px', width: '100%', marginTop: '6px' }}>
                      Override Bob Miller
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeAudience === 'admins' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '14px' }}>
                  <span>ADMIN TELEMETRY</span>
                  <span style={{ color: 'var(--color-primary)' }}>● CONSOLE v1.0</span>
                </div>
                <div style={{ border: '2px solid #ffffff', borderRadius: '12px', padding: '16px', backgroundColor: '#121620' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '8px' }}>Security Calibration</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0' }}>
                    <span>Verify WiFi BSSID</span>
                    <span style={{ color: '#4AD66D', fontWeight: 'bold' }}>ENABLED</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0' }}>
                    <span>Verify GPS Boundary</span>
                    <span style={{ color: '#4AD66D', fontWeight: 'bold' }}>ENABLED</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', marginTop: '10px' }}>
                    Row-level isolation status: SECURE
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. Proof & Trust Section */}
      <section className="light-section-wrap" style={{ borderTop: 'none', backgroundColor: '#EDE9DE' }}>
        <div className="section-intro">
          <span className="eyebrow-badge" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)', color: '#000000', border: '1.5px solid #000000' }}>
            Pilot Program
          </span>
          <h2>Built for how colleges actually run</h2>
          <p>Transparency is our single source of truth. Here is our security and compliance standard.</p>
        </div>

        {/* Short honest line */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontStyle: 'italic', fontSize: '18px', fontWeight: '700', color: 'var(--bg-dark)' }}>
            "AtApp is currently piloting with select colleges. Want to be one of the first?"
          </p>
        </div>

        {/* Security parameters grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', maxWidth: '1200px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '28px', border: '2.5px solid #000000', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: 'var(--color-primary)' }}>
              <LockIcon />
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--bg-dark)' }}>Data encrypted at rest</h3>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.4, color: '#5d6878', margin: 0 }}>
              All database schemas containing student identifiers and verify signals are stored using military-grade AES-256 keys.
            </p>
          </div>

          <div className="card" style={{ padding: '28px', border: '2.5px solid #000000', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: 'var(--accent-gold)' }}>
              <KeyIcon />
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--bg-dark)' }}>Row-level tenant isolation</h3>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.4, color: '#5d6878', margin: 0 }}>
              Database records enforce Postgres RLS policies, making cross-college data leaks mathematically impossible.
            </p>
          </div>

          <div className="card" style={{ padding: '28px', border: '2.5px solid #000000', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: '#ff8b9e' }}>
              <ShieldIcon />
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--bg-dark)' }}>Limited data retention</h3>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.4, color: '#5d6878', margin: 0 }}>
              Raw location coordinates and router logs are deleted after verification, leaving only clean present/absent outcomes.
            </p>
          </div>
        </div>
      </section>

      {/* 8. Impact / Stats Bar */}
      <section className="light-section-wrap" style={{ borderTop: 'none', backgroundColor: '#F4F0E6' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '48px', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <div>
            <div className="metric-number" style={{ color: 'var(--color-primary)' }}>&lt; 10 sec</div>
            <div className="metric-label">To start a session</div>
          </div>
          <div>
            <div className="metric-number" style={{ color: 'var(--accent-gold)' }}>&lt; 5 sec</div>
            <div className="metric-label">For student check-in</div>
          </div>
          <div>
            <div className="metric-number" style={{ color: '#ff8b9e' }}>Pending</div>
            <div className="metric-label">Pilot data pending</div>
          </div>
        </div>
      </section>

      {/* 9. Pricing Section */}
      <section className="light-section-wrap" id="pricing" style={{ borderTop: 'none', backgroundColor: '#EDE9DE' }}>
        <div className="section-intro">
          <span className="eyebrow-badge" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)', color: '#000000', border: '1.5px solid #000000' }}>
            Flexible Tiers
          </span>
          <h2>Simple, per-department pricing</h2>
          <p>Transparent rates to help your institution get off paper sheets confidently.</p>
        </div>

        <div className="pricing-grid">
          {/* Card 1: Pilot */}
          <div className="pricing-card">
            <h3 className="pricing-title">Pilot</h3>
            <p className="pricing-desc">Perfect for small teams testing the system</p>
            <div className="pricing-price">Free</div>
            <div className="pricing-feature-list">
              <div className="pricing-feature-item">
                <CheckIcon /> Up to 300 students
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> One department, one term
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> Standard verification checks
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> Email support
              </div>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => setShowBookerModal(true)}>
              Start Pilot
            </button>
          </div>

          {/* Card 2: Department (Highlighted) */}
          <div className="pricing-card highlighted">
            <div style={{
              position: 'absolute',
              top: '-14px',
              right: '24px',
              backgroundColor: 'var(--accent-gold)',
              color: '#000000',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '900',
              border: '2px solid #000000',
              letterSpacing: '0.5px'
            }}>POPULAR</div>
            <h3 className="pricing-title">Department</h3>
            <p className="pricing-desc">For ongoing single-department use</p>
            <div className="pricing-price">Contact us</div>
            <div className="pricing-feature-list">
              <div className="pricing-feature-item">
                <CheckIcon /> Unlimited students
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> Full system access
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> Custom verification thresholds
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> Priority email & chat support
              </div>
            </div>
            <button className="btn btn-primary cta-btn-gold" style={{ width: '100%', padding: '12px' }} onClick={() => setShowBookerModal(true)}>
              Contact Sales
            </button>
          </div>

          {/* Card 3: Institution */}
          <div className="pricing-card">
            <h3 className="pricing-title">Institution</h3>
            <p className="pricing-desc">For multi-department campus integration</p>
            <div className="pricing-price">Contact us</div>
            <div className="pricing-feature-list">
              <div className="pricing-feature-item">
                <CheckIcon /> Cross-college deployment
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> SSO & Active Directory sync
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> Dedicated onboarding SLA
              </div>
              <div className="pricing-feature-item">
                <CheckIcon /> 24/7 Phone support
              </div>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => setShowBookerModal(true)}>
              Contact Admin
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '36px' }}>
          <button 
            style={{ background: 'none', border: 'none', textDecoration: 'underline', fontWeight: '800', cursor: 'pointer', fontSize: '14px', color: 'var(--bg-dark)' }}
            onClick={() => setShowBookerModal(true)}
          >
            Book a demo to get pricing for your college
          </button>
        </div>
      </section>

      {/* 10. FAQ Accordions */}
      <section className="light-section-wrap" id="faq" style={{ borderTop: 'none', backgroundColor: '#F4F0E6' }}>
        <div className="section-intro">
          <span className="eyebrow-badge" style={{ backgroundColor: 'rgba(108, 99, 255, 0.1)', color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)' }}>
            Got Questions?
          </span>
          <h2>Frequently Asked Questions</h2>
          <p>Read explanations about locations, network security, and backup methods.</p>
        </div>

        <div className="faq-accordion">
          {[
            {
              q: "What happens if a student's phone dies or has no signal?",
              a: "Instructors always retain final authority. A teacher can manually mark any student present directly in their mobile app. Every manual override is secure and logged to the central admin audit trail with an associated explanation reason."
            },
            {
              q: "Can students spoof their location to check in from home?",
              a: "No. AtApp utilizes a triple-lock system. We don't trust GPS alone; the student must also connect to the specific classroom Wi-Fi BSSID access point address and enter the teacher's active rotating code which resets every 10 seconds. Spoofing all three is mathematically and logistically unfeasible."
            },
            {
              q: "What data do you store?",
              a: "We only store what is required to verify class attendance. Raw geofence lat/lng values and local network router packets are checked in-memory and immediately destroyed post-verification. We do not track student locations outside check-in windows."
            },
            {
              q: "Do we need to buy new hardware?",
              a: "No new equipment is needed. AtApp utilizes the local college Wi-Fi routers and access points that your campus already owns. Calibration of access point BSSID codes is handled in minutes during the initial pilot onboarding."
            },
            {
              q: "How long does setup take for a new college?",
              a: "A single department can run active pilots in under 24 hours. The admin web console has bulk CSV roster imports ready to map classes, teachers, and classrooms immediately."
            }
          ].map((item, idx) => (
            <div className="faq-item" key={idx}>
              <button 
                className="faq-question-btn"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span>{item.q}</span>
                <span style={{ fontSize: '20px', fontWeight: '800' }}>
                  {openFaq === idx ? '−' : '+'}
                </span>
              </button>
              {openFaq === idx && (
                <div className="faq-answer">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 11. Final CTA */}
      <section style={{ backgroundColor: 'var(--bg-dark)', padding: '100px 48px', textAlign: 'center', borderTop: 'var(--border-width) solid var(--border-ink)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '48px', fontWeight: '900', color: 'var(--text-light)', marginBottom: '24px', letterSpacing: '-0.5px' }}>
            See attendance that actually holds up.
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
            <button className="btn btn-primary cta-btn-gold" style={{ padding: '14px 28px' }} onClick={() => setShowBookerModal(true)}>
              Book a demo
            </button>
            <Link href="/admin" className="btn btn-secondary" style={{ padding: '14px 28px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Tenant Portal <ArrowRightIcon />
            </Link>
          </div>
          <p className="hero-micro-text" style={{ margin: 0 }}>
            No credit card needed for a pilot. Set up your first department in a day.
          </p>
        </div>
      </section>

      {/* 12. Footer */}
      <footer style={{ backgroundColor: 'var(--bg-sidebar)', padding: '48px', borderTop: 'var(--border-width) solid var(--border-ink)', fontSize: '13px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '32px', maxWidth: '1200px', margin: '0 auto', marginBottom: '40px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{
                backgroundColor: 'var(--accent-gold)',
                color: '#000000',
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: '900',
                border: '1.5px solid #000000',
                fontSize: '13px'
              }}>A</div>
              <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-light)', fontFamily: 'var(--font-display)' }}>AtApp</span>
            </div>
            <p style={{ lineHeight: 1.5, maxWidth: '280px' }}>
              Securing college attendance verification through high-fidelity, triple-handshake mobile authentication.
            </p>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-light)', fontWeight: '800', marginBottom: '14px', fontSize: '14px' }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>Features</a>
              <a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Pricing</a>
              <a href="#faq" style={{ color: 'inherit', textDecoration: 'none' }}>Security Standard</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-light)', fontWeight: '800', marginBottom: '14px', fontSize: '14px' }}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ color: 'inherit' }}>About Us</span>
              <span style={{ color: 'inherit' }}>Contact</span>
              <span style={{ color: 'inherit' }}>Pilots</span>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-light)', fontWeight: '800', marginBottom: '14px', fontSize: '14px' }}>Legal</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ color: 'inherit' }}>Privacy Policy</span>
              <span style={{ color: 'inherit' }}>Terms of Service</span>
              <span style={{ color: 'inherit' }}>GDPR Compliance</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          <span>© 2026 AtApp Systems, Inc. All rights reserved.</span>
          <span>Designed with Hall Pass conventions.</span>
        </div>
      </footer>

      {/* Demo Modal (Watch Video popup) */}
      {showDemoModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '700px', padding: '0', overflow: 'hidden', border: '3px solid #000000', borderRadius: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-sidebar)', padding: '12px 20px', borderBottom: '2px solid #000000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '800', fontFamily: 'var(--font-mono)' }}>AtApp 90-Second Demo</span>
              <button onClick={() => setShowDemoModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#ffffff', fontWeight: '900' }}>×</button>
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, backgroundColor: '#000000' }}>
              {/* Fallback to simulated demo video using canvas/animation since we don't have actual YouTube */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)',
                padding: '40px',
                textAlign: 'center'
              }}>
                <SparklesIcon />
                <h3 style={{ fontSize: '20px', fontWeight: '900', margin: '16px 0 8px' }}>AtApp Product Demonstration</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 0 20px' }}>
                  This video demonstrates how a professor spawns a session, BSSID routers are scanned, and locations are calculated on Postgres.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-primary cta-btn-gold" onClick={() => { setShowDemoModal(false); setShowBookerModal(true); }}>
                    Book Live Demo instead
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowDemoModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booker Modal (Demo scheduler) */}
      {showBookerModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '450px', border: '3px solid #000000', borderRadius: '16px', boxShadow: '8px 8px 0px #000000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, fontFamily: 'var(--font-display)' }}>Book a Pilot Demo</h2>
              <button onClick={() => setShowBookerModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--bg-dark)', fontWeight: '900' }}>×</button>
            </div>
            
            {bookerFeedback ? (
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1.5px solid #10b981',
                padding: '16px',
                borderRadius: '8px',
                color: '#10b981',
                fontWeight: '600',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {bookerFeedback}
              </div>
            ) : (
              <form onSubmit={handleBookDemo}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--bg-dark)' }}>Your Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Dr. Sarah Jenkins" 
                    value={bookerName}
                    onChange={(e) => setBookerName(e.target.value)}
                    required 
                    style={{ border: '2px solid #000000', borderRadius: '8px', backgroundColor: '#ffffff', color: '#000000' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--bg-dark)' }}>Academic Email</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="sjenkins@university.edu" 
                    value={bookerEmail}
                    onChange={(e) => setBookerEmail(e.target.value)}
                    required 
                    style={{ border: '2px solid #000000', borderRadius: '8px', backgroundColor: '#ffffff', color: '#000000' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--bg-dark)' }}>College or Organization</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Stanford University" 
                    value={bookerOrg}
                    onChange={(e) => setBookerOrg(e.target.value)}
                    required 
                    style={{ border: '2px solid #000000', borderRadius: '8px', backgroundColor: '#ffffff', color: '#000000' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary cta-btn-gold" style={{ width: '100%', padding: '12px', marginTop: '10px' }}>
                  Submit Booker Details
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
