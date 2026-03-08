import { useState, useEffect } from 'react';
import apiClient from '../api/client';

const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

export default function Synthesis() {
  const [voiceRefs, setVoiceRefs] = useState([]);
  const [selectedRef, setSelectedRef] = useState('');
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/voice-refs/').then(res => {
      setVoiceRefs(res.data);
      if (res.data.length > 0) setSelectedRef(res.data[0].id);
    }).catch(() => {});
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/voice-refs/upload', formData);
      setVoiceRefs(prev => [...prev, res.data]);
      setSelectedRef(res.data.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRef) { setError('Please select or upload a voice reference'); return; }
    if (!text.trim()) { setError('Please enter text to synthesize'); return; }
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const res = await apiClient.post('/synthesis/', { voice_ref_id: parseInt(selectedRef), text });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Synthesis failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <h1>🎙️ Text to Speech</h1>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit} className="synthesis-form">
        <div className="form-group">
          <label>Voice Reference</label>
          <select value={selectedRef} onChange={e => setSelectedRef(e.target.value)}>
            <option value="">-- Select a voice reference --</option>
            {voiceRefs.map(ref => (
              <option key={ref.id} value={ref.id}>{ref.original_name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Upload New Voice Reference</label>
          <input type="file" accept="audio/*" onChange={handleFileUpload} disabled={uploading} />
          {uploading && <span className="loading-text">Uploading...</span>}
        </div>
        <div className="form-group">
          <label>Text to Synthesize</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            placeholder="Enter the text you want to convert to speech..."
            required
          />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Synthesizing...' : 'Synthesize'}
        </button>
      </form>
      {result && result.status === 'completed' && (
        <div className="result-section">
          <h3>✅ Synthesis Complete</h3>
          <audio controls src={`${apiBase}/static/outputs/${result.output_filename}`} />
        </div>
      )}
      {result && result.status === 'failed' && (
        <div className="error-msg">Synthesis failed. Please try again.</div>
      )}
    </div>
  );
}
