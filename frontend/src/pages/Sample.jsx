import { useEffect, useMemo, useState } from 'react';
import apiClient from '../api/client';
import './History.css';

const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

export default function Sample() {
  const [sampleData, setSampleData] = useState({ user: null, jobs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    apiClient.get('/sample/history')
      .then((res) => {
        if (!cancelled) {
          setSampleData(res.data);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.detail || 'Sample user history is unavailable right now.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const user = sampleData.user;
  const jobs = sampleData.jobs || [];

  const initials = useMemo(() => {
    if (!user?.username) {
      return 'SD';
    }

    return user.username
      .split(/[_\s.-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'SD';
  }, [user?.username]);

  const completedJobs = user?.completed_jobs ?? jobs.filter((job) => job.status === 'completed').length;
  const totalJobs = user?.total_jobs ?? jobs.length;

  return (
    <div className="page-container sample-page">
      <div className="sample-page-header">
        <div className="sample-profile-card">
          <div className="sample-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="sample-profile-copy">
            <div className="sample-profile-row">
              <h1>{user?.username || 'Sample user history'}</h1>
              <span className="sample-profile-badge">Sample</span>
            </div>
            <p className="sample-profile-handle">@{user?.username || 'loading'}</p>
            <p className="sample-profile-note">
              {user?.email
                ? `Public preview of ${user.email}'s generated history.`
                : 'Public preview of a sample account’s generated history.'}
            </p>
            <div className="sample-profile-meta">
              <span><strong>{totalJobs}</strong> jobs</span>
              <span><strong>{completedJobs}</strong> completed</span>
              <span><strong>{user?.last_active ? new Date(user.last_active).toLocaleString() : '—'}</strong> last active</span>
            </div>
            <p className="sample-profile-email">{user?.email || 'Waiting for sample account data'}</p>
          </div>
        </div>
      </div>

      <div className="history-list" aria-label="Sample synthesis history">
        {loading ? (
          <p className="sample-pending-note">Loading sample user history...</p>
        ) : error ? (
          <p className="sample-pending-note">{error}</p>
        ) : jobs.length === 0 ? (
          <p className="sample-pending-note">No sample history available yet.</p>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="history-item">
              <div className="history-item-header">
                <span className={`status-badge status-${job.status}`}>{job.status}</span>
                <span className="history-date">{new Date(job.created_at).toLocaleString()}</span>
              </div>
              <p className="history-text">{job.input_text}</p>
              {job.status === 'completed' && job.output_filename ? (
                <>
                  <audio controls src={`${apiBase}/static/outputs/${job.output_filename}`} />
                  <a href={`${apiBase}/static/outputs/${job.output_filename}`} download className="download-btn">
                    Download
                  </a>
                </>
              ) : (
                <p className="sample-pending-note">This sample entry is still queued.</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
