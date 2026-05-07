import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import './Synthesis.css';

const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

const Waveform = ({ audioUrl, currentTime, duration, onSeek }) => {
  const canvasRef = useRef(null);
  const ampsRef = useRef([]);

  const draw = (amps, canvas, ctx, progress) => {
    const dpr = window.devicePixelRatio || 1;
    const viewWidth = Math.max(1, canvas.clientWidth);
    const viewHeight = Math.max(1, canvas.clientHeight);
    canvas.width = Math.floor(viewWidth * dpr);
    canvas.height = Math.floor(viewHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = viewWidth;
    const height = viewHeight;
    const maxAmp = Math.max(...amps, 0.001);
    const barWidth = Math.max(1, width / amps.length - 1);
    const centerY = height / 2;
    const playedX = width * progress;

    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < amps.length; i++) {
      const normalized = amps[i] / maxAmp;
      const barHeight = Math.max(2, normalized * (height * 0.8));
      const x = i * (barWidth + 1);
      const y = centerY - barHeight / 2;
      ctx.fillStyle = x < playedX ? '#f97316' : '#c8d1dc';
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // playhead line
    if (progress > 0) {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(playedX - 1, 0, 2, height);
    }
  };

  useEffect(() => {
    if (!audioUrl || !canvasRef.current) return;
    let cancelled = false;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    fetch(audioUrl)
      .then(r => r.arrayBuffer())
      .then(ab => audioContext.decodeAudioData(ab))
      .then(buffer => {
        if (cancelled || !canvasRef.current) return;
        const data = buffer.getChannelData(0);
        const canvas = canvasRef.current;
        const bars = Math.max(80, Math.floor(canvas.clientWidth / 3));
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
        ampsRef.current = amps;
        draw(amps, canvas, canvas.getContext('2d'), 0);
      })
      .catch(() => {})
      .finally(() => audioContext.close().catch(() => {}));

    return () => { cancelled = true; audioContext.close().catch(() => {}); };
  }, [audioUrl]);

  // redraw on time change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ampsRef.current.length) return;
    const progress = duration ? currentTime / duration : 0;
    draw(ampsRef.current, canvas, canvas.getContext('2d'), progress);
  }, [currentTime, duration]);

  const handleClick = (e) => {
    if (!onSeek || !duration) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek((x / rect.width) * duration);
  };

  return <canvas ref={canvasRef} className="waveform-canvas" onClick={handleClick} style={{ cursor: 'pointer' }} />;
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
  const refAudioRef = useRef(null);
  const outAudioRef = useRef(null);
  const [refPlaying, setRefPlaying] = useState(false);
  const [refTime, setRefTime] = useState(0);
  const [outPlaying, setOutPlaying] = useState(false);
  const [outTime, setOutTime] = useState(0);
  const [outLooping, setOutLooping] = useState(false);
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
      if (ref) setSelectedRefUrl(`${apiBase}/static/voice_refs/${ref.filename}`);
    } else {
      setSelectedRefUrl('');
    }
  }, [selectedRef, voiceRefs]);

  useEffect(() => {
    if (selectedRefUrl) getAudioDuration(selectedRefUrl).then(setSelectedRefDuration);
    else setSelectedRefDuration(0);
  }, [selectedRefUrl]);

  useEffect(() => {
    if (result?.output_filename) {
      getAudioDuration(`${apiBase}/static/outputs/${result.output_filename}`).then(setResultDuration);
    } else {
      setResultDuration(0);
    }
  }, [result]);

  useEffect(() => {
    const el = refAudioRef.current;
    if (!el) return;
    const onTime = () => setRefTime(el.currentTime);
    const onEnded = () => setRefPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('ended', onEnded); };
  }, [selectedRefUrl]);

  useEffect(() => {
    const el = outAudioRef.current;
    if (!el) return;
    const onTime = () => setOutTime(el.currentTime);
    const onEnded = () => setOutPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('ended', onEnded); };
  }, [result]);

  const toggleRefPlay = () => {
    const el = refAudioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setRefPlaying(true); } else { el.pause(); setRefPlaying(false); }
  };
  const skipRef = (s) => {
    const el = refAudioRef.current;
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + s));
  };

  const toggleOutPlay = () => {
    const el = outAudioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setOutPlaying(true); } else { el.pause(); setOutPlaying(false); }
  };
  const skipOut = (s) => {
    const el = outAudioRef.current;
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + s));
  };
  const toggleOutLoop = () => {
    const el = outAudioRef.current;
    if (!el) return;
    el.loop = !el.loop;
    setOutLooping(el.loop);
  };
  const saveOut = () => {
    const a = document.createElement('a');
    a.href = `${apiBase}/static/outputs/${result.output_filename}`;
    a.download = '';
    a.click();
  };

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
                  <Waveform audioUrl={selectedRefUrl} currentTime={refTime} duration={selectedRefDuration} onSeek={t => { const el = refAudioRef.current; if (el) el.currentTime = t; }}/>
                </div>
                <audio ref={refAudioRef} src={selectedRefUrl} style={{ display: 'none' }} />
                <div className="audio-controls">
                  <span>{formatTime(refTime)}</span>
                  <span style={{flex:1}} />
                  <span>{formatTime(selectedRefDuration)}</span>
                  </div>
                  <div className="audio-controls" style={{ justifyContent: 'center' }}>
                  <button type="button" className="ap-btn" onClick={() => skipRef(-5)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    <text x="12" y="15" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">5</text>
                    </svg>
                  </button>
                  <button type="button" className="ap-btn" onClick={toggleRefPlay}>
                  {refPlaying
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  }
                  </button>
                  <button type="button" className="ap-btn" onClick={() => skipRef(5)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                    <text x="12" y="15" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">5</text>
                    </svg>
                  </button>
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
                  <Waveform audioUrl={`${apiBase}/static/outputs/${result.output_filename}`} currentTime={outTime} duration={resultDuration} onSeek={t => { const el = outAudioRef.current; if (el) el.currentTime = t; }} />
                </div>
                <audio ref={outAudioRef} src={`${apiBase}/static/outputs/${result.output_filename}`} style={{ display: 'none' }} />
                <div className="audio-controls">
                  <span>{formatTime(outTime)}</span>
                  <span style={{flex:1}} />
                  <span>{formatTime(resultDuration)}</span>
                </div>
                <div className="audio-controls" style={{ justifyContent: 'center' }}>
                  <button type="button" className="ap-btn" onClick={() => skipOut(-5)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    <text x="12" y="15" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">5</text>
                  </svg>
                  </button>
                  <button type="button" className="ap-btn" onClick={toggleOutPlay}>
                  {outPlaying
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  }
                  </button>
                  <button type="button" className="ap-btn" onClick={() => skipOut(5)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                    <text x="12" y="15" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">5</text>
                    </svg>
                  </button>
                  <button type="button" className={`ap-btn ${outLooping ? 'active' : ''}`} onClick={toggleOutLoop}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
                  </button>
                  <button type="button" className="ap-btn" onClick={saveOut}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>
                  </button>
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