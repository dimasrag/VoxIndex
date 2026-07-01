import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import './History.css';

const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

export default function History() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiClient.get('/synthesis/')
      .then(res => { setJobs(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);


  const filteredJobs = jobs
    .filter(job => statusFilter === 'all' || job.status === statusFilter)
    .filter(job => job.input_text.toLowerCase().includes(search.toLowerCase()));

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = filteredJobs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <h1>Synthesis History</h1>
      <div className="history-filters">
  <input
    type="text"
    className="filter-search"
    placeholder="Search by text..."
    value={search}
    onChange={e => { setSearch(e.target.value); setPage(1); }}
  />
  <div className="filter-status">
    {['all', 'completed', 'failed', 'pending'].map(s => (
      <button
        key={s}
        className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
        onClick={() => { setStatusFilter(s); setPage(1); }}
      >
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </button>
    ))}
    </div>
  </div>
      {jobs.length === 0 ? (
        <p className="empty-msg">No synthesis jobs yet.</p>
      ) : (
        <>
          <div className="history-list">
            {paginatedJobs.map(job => (
              <div key={job.id} className="history-item">
                <div className="history-item-header">
                  <span className={`status-badge status-${job.status}`}>{job.status}</span>
                  <span className="history-date">{new Date(job.created_at).toLocaleString()}</span>
                </div>
                {job.language && (
                  <p className="history-language">Language: {job.language.toUpperCase()}</p>
                )}
                <p className="history-text">{job.input_text}</p>
                {job.status === 'completed' && job.output_filename && (
                  <>
                    <audio controls src={`${apiBase}/static/outputs/${job.output_filename}`} />
                    <a href={`${apiBase}/static/outputs/${job.output_filename}`} download className="download-btn">Download</a>
                  </>
                )}
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>←</button>
              {[...Array(totalPages)].map((_, i) => (
                <button key={i} className={`page-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>
                  {i + 1}
                </button>
              ))}
              <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>→</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}