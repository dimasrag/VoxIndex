import { useEffect, useState } from 'react';
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

  const jobs = sampleData.jobs || [];

  return (
    <div className="page-container sample-page">
      <h1>Sample</h1>
      <p className="sample-page-intro">Public preview of generated history.</p>

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
