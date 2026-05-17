import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';
import logo from '../assets/logo.png';

export default function Navbar() {
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
        <Link to="/">VoxIndex</Link>
      </div>

      {token && !user?.is_admin && (
        <div className="navbar-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/synthesis">Synthesize</Link>
          <Link to="/history">History</Link>
        </div>
      )}
      {!token && (
        <div className="navbar-links">
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
      )}

      {token && (
        <div className="navbar-profile" ref={dropdownRef}>
          <div className="profile-avatar" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.username || 'user'}`} alt="avatar" />
          </div>

        {dropdownOpen && (
          <div className="profile-dropdown">
            <div className="dropdown-header">
              <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.username || 'user'}`} alt="avatar" className="dropdown-avatar" />
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