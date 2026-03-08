import { useState, useEffect } from 'react';
import apiClient from '../api/client';

const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

export default function History() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/synthesis/')
      .then(res => { setJobs(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <h1>📋 Synthesis History</h1>
      {jobs.length === 0 ? (
        <p className="empty-msg">No synthesis jobs yet.</p>
      ) : (
        <div className="history-list">
          {jobs.map(job => (
            <div key={job.id} className="history-item">
              <div className="history-item-header">
                <span className={`status-badge status-${job.status}`}>{job.status}</span>
                <span className="history-date">{new Date(job.created_at).toLocaleString()}</span>
              </div>
              <p className="history-text">{job.input_text}</p>
              {job.status === 'completed' && job.output_filename && (
                <audio controls src={`${apiBase}/static/outputs/${job.output_filename}`} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
