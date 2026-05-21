import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';
import logo from '../assets/Logo.png';
import githubIcon from '../assets/logo_github.png';

const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

export default function Navbar() {
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isHome = location.pathname === '/home';
  const avatarSrc = user?.avatar_filename ? `${apiBase}/static/avatars/${user.avatar_filename}`: `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username || 'user'}`;

  const scrollToSection = (sectionId) => {
    if (!isHome) {
      navigate('/home');
      setTimeout(() => {
        const section = document.getElementById(sectionId);
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
      return;
    }

    const section = document.getElementById(sectionId);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src={logo} alt="VoxIndex Logo" className="navbar-logo" height={25} />
        <Link to="/home">VoxIndex</Link>
      </div>

      {token && !user?.is_admin && (
        <div className="navbar-links">
          <Link to="/home">Home</Link>
          <button type="button" className="navbar-link-btn" onClick={() => scrollToSection('about')}>About</button>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/synthesis">Synthesize</Link>
          <Link to="/history">History</Link>
          <button type="button" className="navbar-link-btn" onClick={() => window.open('https://github.com/dimasrag/VoxIndex', '_blank')} title = "View source code">
          <img src={githubIcon} alt="GitHub" height={18} />
          </button>
        </div>
      )}
      {!token && isHome && (
        <>
        <div className="navbar-links">
          <button type="button" className="navbar-link-btn" onClick={() => scrollToSection('start')}>Start</button>
          <button type="button" className="navbar-link-btn" onClick={() => scrollToSection('sample')}>Sample</button>
          <button type="button" className="navbar-link-btn" onClick={() => scrollToSection('about')}>About</button>
          <button type="button" className="navbar-link-btn" onClick={() => window.open('https://github.com/dimasrag/VoxIndex', '_blank')} title = "View source code">
            <img src={githubIcon} alt="GitHub" height={18} />
          </button>
        </div>
        <div style={{ flex: 1 }} />
        </>
      )}

      {!token && !isHome && (
        <div className="navbar-links">
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
      )}

      {token && (
        <div className="navbar-profile" ref={dropdownRef}>
          <div className="profile-avatar" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <img src={avatarSrc} alt="avatar" />
          </div>

        {dropdownOpen && (
          <div className="profile-dropdown">
            <div className="dropdown-header">
              <img src={avatarSrc} alt="avatar" className="dropdown-avatar" />
              <div>
                <div className="dropdown-name">{user?.username || 'Your name'}</div>
                <div className="dropdown-email">{user?.email || 'yourname@gmail.com'}</div>
              </div>
            </div>
            <div className="dropdown-divider" />
            {!user?.is_admin && (
              <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                My Profile
              </Link>
            )}
            <button className="dropdown-item" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
              Log Out
            </button>
          </div>
        )}
        </div>
      )}
    </nav>
  );
}