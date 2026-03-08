import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

export default function Dashboard() {
  const { user } = useAuth();
  const [recentJobs, setRecentJobs] = useState([]);

  useEffect(() => {
    apiClient.get('/synthesis/')
      .then(res => setRecentJobs(res.data.slice(0, 5)))
      .catch(() => {});
  }, []);

  return (
    <div className="page-container">
      <h1>Welcome{user?.username ? `, ${user.username}` : ''}!</h1>
      <div className="dashboard-cards">
        <Link to="/synthesis" className="dashboard-card">
          <h3>🎙️ New Synthesis</h3>
          <p>Generate speech from text</p>
        </Link>
        <Link to="/history" className="dashboard-card">
          <h3>📋 History</h3>
          <p>View all synthesis jobs</p>
        </Link>
      </div>
      <div className="recent-section">
        <h2>Recent Synthesis</h2>
        {recentJobs.length === 0 ? (
          <p className="empty-msg">No synthesis jobs yet. <Link to="/synthesis">Create one!</Link></p>
        ) : (
          <table className="jobs-table">
            <thead>
              <tr><th>Text</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recentJobs.map(job => (
                <tr key={job.id}>
                  <td className="text-preview">{job.input_text.slice(0, 60)}{job.input_text.length > 60 ? '...' : ''}</td>
                  <td><span className={`status-badge status-${job.status}`}>{job.status}</span></td>
                  <td>{new Date(job.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
