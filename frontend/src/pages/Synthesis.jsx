import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import './Synthesis.css'; // Import custom CSS for this component

const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

const Waveform = ({ audioUrl }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioUrl || !canvasRef.current) return;
    let cancelled = false;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const drawWaveform = (buffer, canvas, ctx) => {
      const dpr = window.devicePixelRatio || 1;
      const viewWidth = Math.max(1, canvas.clientWidth);
      const viewHeight = Math.max(1, canvas.clientHeight);
      canvas.width = Math.floor(viewWidth * dpr);
      canvas.height = Math.floor(viewHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = viewWidth;
      const height = viewHeight;
      const data = buffer.getChannelData(0);
      const bars = Math.max(80, Math.floor(width / 3));
      const samplesPerBar = Math.max(1, Math.floor(data.length / bars));
      const amps = new Array(bars).fill(0);

      for (let i = 0; i < bars; i++) {
        const start = i * samplesPerBar;
        const end = Math.min(data.length, start + samplesPerBar);
        let peak = 0;
        for (let j = start; j < end; j++) {
          const v = Math.abs(data[j]);
          if (v > peak) peak = v;
        }
        amps[i] = peak;
      }

      const maxAmp = Math.max(...amps, 0.001);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#c8d1dc';

      const barWidth = Math.max(1, width / bars - 1);
      const centerY = height / 2;
      for (let i = 0; i < bars; i++) {
        const normalized = amps[i] / maxAmp;
        const barHeight = Math.max(2, normalized * (height * 0.8));
        const x = i * (barWidth + 1);
        const y = centerY - barHeight / 2;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    fetch(audioUrl)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        drawWaveform(audioBuffer, canvas, ctx);
      })
      .catch(() => {})
      .finally(() => {
        audioContext.close().catch(() => {});
      });

    return () => {
      cancelled = true;
      audioContext.close().catch(() => {});
    };
  }, [audioUrl]);

  return <canvas ref={canvasRef} className="waveform-canvas"></canvas>;
};

const UploadPlaceholder = ({ onFileSelect }) => (
  <div className="upload-placeholder" onClick={() => document.getElementById('file-upload-input')?.click()}>
    <div className="upload-main">Drop Audio Here</div>
    <div className="upload-separator">or</div>
    <div className="upload-sub">Click to Upload</div>
    <input id="file-upload-input" type="file" accept="audio/*" onChange={onFileSelect} style={{ display: 'none' }} />
  </div>
);

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getAudioDuration = async (url) => {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioContext.close();
    return audioBuffer.duration;
  } catch (err) {
    return 0;
  }
};

export default function Synthesis() {
  const [voiceRefs, setVoiceRefs] = useState([]);
  const [selectedRef, setSelectedRef] = useState('');
  const [selectedRefUrl, setSelectedRefUrl] = useState('');
  const [selectedRefDuration, setSelectedRefDuration] = useState(0);
  const [text, setText] = useState('El gato condujo el coche');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [resultDuration, setResultDuration] = useState(0);
  const [error, setError] = useState('');
  const [emotionControl, setEmotionControl] = useState('same-as-the-voice-reference');
  const [emotions, setEmotions] = useState({
    happy: 0,
    angry: 0.75,
    sad: 0,
    low: 0,
    hate: 0,
    surprise: 0,
    fear: 0,
    neutral: 0,
  });

  useEffect(() => {
    apiClient.get('/voice-refs/').then(res => {
      setVoiceRefs(res.data);
    }).catch(() => {
      setError("Could not fetch voice references.");
    });
  }, []);

  useEffect(() => {
    if (selectedRef) {
      const ref = voiceRefs.find(r => r.id === parseInt(selectedRef));
      if (ref) {
        setSelectedRefUrl(`${apiBase}/static/voice_refs/${ref.filename}`);
      }
    } else {
      setSelectedRefUrl('');
    }
  }, [selectedRef, voiceRefs]);

  useEffect(() => {
    if (selectedRefUrl) {
      getAudioDuration(selectedRefUrl).then(duration => {
        setSelectedRefDuration(duration);
      });
    } else {
      setSelectedRefDuration(0);
    }
  }, [selectedRefUrl]);

  useEffect(() => {
    if (result && result.output_filename) {
      getAudioDuration(`${apiBase}/static/outputs/${result.output_filename}`).then(duration => {
        setResultDuration(duration);
      });
    } else {
      setResultDuration(0);
    }
  }, [result]);



  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/voice-refs/upload', formData);
      const newRef = res.data;
      setVoiceRefs(prev => [...prev, newRef]);
      setSelectedRef(newRef.id.toString());
      setSelectedRefUrl(`${apiBase}/static/voice_refs/${newRef.filename}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRef && emotionControl !== 'use-emotion-vector') { setError('Please select or upload a voice reference'); return; }
    if (!text.trim()) { setError('Please enter text to synthesize'); return; }
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        text,
        voice_ref_id: selectedRef ? parseInt(selectedRef) : null,
        emotion_control: emotionControl,
        emotions: emotionControl === 'use-emotion-vector' ? emotions : null,
      };
      const res = await apiClient.post('/synthesis/', payload);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Synthesis failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmotionChange = (emotion, value) => {
    setEmotions(prev => ({ ...prev, [emotion]: parseFloat(value) }));
  };

  return (
    <div className="page-container synth-page">
      <div className="synth-header">
        <h1>Speech Synthesis</h1>
      </div>
      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="synthesis-grid">
          <section className="synthesis-panel voice-panel">
            <div className="panel-chip">Voice reference</div>
            {selectedRefUrl ? (
              <>
                <div className="wave-shell">
                  <Waveform audioUrl={selectedRefUrl} />
                </div>
                <div className="audio-controls">
                  <span>0:00</span>
                  <div className="control-buttons">Back Pause Next</div>
                  <span>{formatTime(selectedRefDuration)}</span>
                </div>
              </>
            ) : (
              <UploadPlaceholder onFileSelect={handleFileUpload} />
            )}
            <div className="upload-tools">
              <button type="button" className="ghost-tool">Upload</button>
              <button type="button" className="ghost-tool">Mic</button>
            </div>
            <div className="form-group">
              <label>Select Existing Reference</label>
              <select value={selectedRef} onChange={e => setSelectedRef(e.target.value)} disabled={uploading}>
                <option value="">-- Select a voice --</option>
                {voiceRefs.map(ref => (
                  <option key={ref.id} value={ref.id}>{ref.original_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Upload New Reference</label>
              <input id="file-upload-input-button" type="file" accept="audio/*" onChange={handleFileUpload} disabled={uploading} />
              {uploading && <span className="loading-text">Uploading...</span>}
            </div>
          </section>

          <section className="synthesis-panel text-panel">
            <div className="panel-chip">Text</div>
            <p className="model-version">Current model version 2.0</p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              placeholder="Please input text to synthesize"
              required
            />
            <button type="submit" className="btn-synthesize" disabled={submitting}>
              {submitting ? 'Working...' : 'Synthesize'}
            </button>
          </section>

          <section className="synthesis-panel result-panel">
            <div className="panel-chip">Synthesis Result</div>
            {result && result.status === 'completed' ? (
              <>
                <div className="wave-shell">
                  <Waveform audioUrl={`${apiBase}/static/outputs/${result.output_filename}`} />
                </div>
                <audio controls src={`${apiBase}/static/outputs/${result.output_filename}`} className="result-audio" />
                <div className="audio-controls">
                  <span>0:00</span>
                  <div className="control-buttons">Play Loop Save</div>
                  <span>{formatTime(resultDuration)}</span>
                </div>
              </>
            ) : (
              <div className="result-placeholder">
                {submitting ? 'Synthesizing...' : 'Result will appear here'}
              </div>
            )}
          </section>
        </div>
      </form>

      <div className="settings-section">
        <div className="settings-title">Settings</div>
        <div className="settings-panel">
          <div className="settings-subtitle">Emotion control method</div>
          <div className="emotion-controls">
            {['Same as the voice reference', 'Use emotion reference audio', 'Use emotion vector', 'Use text description to control emotion'].map(method => {
              const id = method.toLowerCase().replace(/\s/g, '-');
              return (
                <button
                  key={id}
                  type="button"
                  className={`emotion-btn ${emotionControl === id ? 'active' : ''}`}
                  onClick={() => setEmotionControl(id)}
                >
                  {method}
                </button>
              );
            })}
          </div>

          {emotionControl === 'use-emotion-vector' && (
            <div className="emotion-sliders">
              <h4>Random emotion sampling</h4>
              <div className="sliders-grid">
                {Object.keys(emotions).map(emotion => (
                  <div key={emotion} className="slider-group">
                    <label>{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</label>
                    <input
                      type="range"
                      min="0"
                      max="1.4"
                      step="0.01"
                      value={emotions[emotion]}
                      onChange={e => handleEmotionChange(emotion, e.target.value)}
                    />
                    <span>{emotions[emotion]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
