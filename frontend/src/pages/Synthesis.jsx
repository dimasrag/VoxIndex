import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import './Synthesis.css';

const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

// Emotion presets: [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]
const EMOTION_PRESETS = {
  neutral: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  happy: [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0],
  sad: [0.0, 0.0, 1.0, 0.0, 0.0, 0.5, 0.0, 0.0],
  angry: [0.0, 1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0],
  calm: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0],
  excited: [1.0, 0.2, 0.0, 0.0, 0.0, 0.0, 0.8, 0.0],
  sleepy: [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.5],
  surprised: [0.5, 0.0, 0.0, 0.3, 0.0, 0.0, 1.0, 0.0],
};

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Indonesian' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ru', label: 'Russian' },
  { value: 'tr', label: 'Turkish' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh-cn', label: 'Chinese (Simplified)' },
  { value: 'ko', label: 'Korean' },
];

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

const LoadingCard = ({ title, subtitle }) => (
  <div className="loading-card" role="status" aria-live="polite">
    <div className="loading-spinner" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <div className="loading-copy">
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </div>
  </div>
);

const RecordingIndicator = () => (
  <div className="recording-indicator" aria-live="polite" aria-label="Recording voice reference">
    <span className="recording-dot" />
    <span className="recording-label">Recording voice reference</span>
    <span className="recording-wave" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  </div>
);

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
  const voiceUploadRef = useRef(null);
  const emotionUploadRef = useRef(null);
  const micRecorderRef = useRef(null);
  const micChunksRef = useRef([]);
  const [refPlaying, setRefPlaying] = useState(false);
  const [refTime, setRefTime] = useState(0);
  const [outPlaying, setOutPlaying] = useState(false);
  const [outTime, setOutTime] = useState(0);
  const [outLooping, setOutLooping] = useState(false);
  const [voiceRefs, setVoiceRefs] = useState([]);
  const [selectedRef, setSelectedRef] = useState('');
  const [selectedRefUrl, setSelectedRefUrl] = useState('');
  const [selectedRefDuration, setSelectedRefDuration] = useState(0);
  const [emotionRefId, setEmotionRefId] = useState('');
  const [emotionRefUrl, setEmotionRefUrl] = useState('');
  const [emotionRefDuration, setEmotionRefDuration] = useState(0);
  const [emotionText, setEmotionText] = useState('calm and natural');
  const [language, setLanguage] = useState('en');
  const [voiceUploadName, setVoiceUploadName] = useState('No file chosen');
  const [emotionUploadName, setEmotionUploadName] = useState('No file chosen');
  const [text, setText] = useState('El gato condujo el coche');
  const [uploading, setUploading] = useState(false);
  const [emotionUploading, setEmotionUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [resultDuration, setResultDuration] = useState(0);
  const [error, setError] = useState('');
  const [isMicRecording, setIsMicRecording] = useState(false);
  const [micStatus, setMicStatus] = useState('');
  // Emotion controls
  const [emotionControlMethod, setEmotionControlMethod] = useState('emotion_vector'); // 'same_as_ref', 'emotion_audio', 'emotion_vector', 'emotion_text'
  const [emotionVector, setEmotionVector] = useState([0, 0, 0, 0, 0, 0, 0, 0]); // [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]
  const [useRandom, setUseRandom] = useState(false);
  const [randomIntensity, setRandomIntensity] = useState(0.5);
  const [emotionStrength, setEmotionStrength] = useState(0.6);
  const [maxTextTokensPerSegment, setMaxTextTokensPerSegment] = useState(160);
  const [intervalSilence, setIntervalSilence] = useState(30);
  const [refsLoading, setRefsLoading] = useState(true);

  useEffect(() => {
    setRefsLoading(true);
    apiClient.get('/voice-refs/').then(res => {
      setVoiceRefs(res.data);
    }).catch(() => {
      setError("Could not fetch voice references.");
    }).finally(() => {
      setRefsLoading(false);
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
    if (emotionRefUrl) getAudioDuration(emotionRefUrl).then(setEmotionRefDuration);
    else setEmotionRefDuration(0);
  }, [emotionRefUrl]);

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

  const uploadVoiceReference = async (file, { selectAsEmotion = false } = {}) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/voice-refs/upload', formData);
    const newRef = res.data;
    setVoiceRefs(prev => [...prev, newRef]);

    if (selectAsEmotion) {
      setEmotionRefId(newRef.id.toString());
      setEmotionRefUrl(`${apiBase}/static/voice_refs/${newRef.filename}`);
      setEmotionUploadName(file.name);
    } else {
      setSelectedRef(newRef.id.toString());
      setSelectedRefUrl(`${apiBase}/static/voice_refs/${newRef.filename}`);
      setVoiceUploadName(file.name);
    }

    return newRef;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await uploadVoiceReference(file);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleEmotionFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEmotionUploading(true);
    setError('');
    try {
      await uploadVoiceReference(file, { selectAsEmotion: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Emotion reference upload failed');
    } finally {
      setEmotionUploading(false);
    }
  };

  const handleMicRecord = async () => {
    if (isMicRecording) {
      const recorder = micRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    setError('');
    setMicStatus('Requesting microphone access for voice reference recording...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      micChunksRef.current = [];
      micRecorderRef.current = recorder;
      setIsMicRecording(true);
      setMicStatus('Recording voice reference... click again to stop and upload.');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          micChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(micChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        setIsMicRecording(false);
        setMicStatus('Uploading voice reference recording...');
        try {
          const file = new File([audioBlob], `mic-recording-${Date.now()}.webm`, { type: 'audio/webm' });
          await uploadVoiceReference(file);
          setMicStatus('Voice reference uploaded.');
        } catch (err) {
          setError(err.response?.data?.detail || 'Voice reference upload failed');
          setMicStatus('');
        } finally {
          micRecorderRef.current = null;
          micChunksRef.current = [];
        }
      };

      recorder.start();
    } catch (err) {
      setIsMicRecording(false);
      setMicStatus('');
      setError('Could not access the microphone. Please allow mic permissions and try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRef) { setError('Please select or upload a voice reference'); return; }
    if (!text.trim()) { setError('Please enter text to synthesize'); return; }
    setSubmitting(true);
    setError('');
    setResult(null);

    const normalizedText = text.trim().replace(/\//g, ' slash ').replace(/\\/g, ' slash ').replace(/\s+/g, ' ');

    const recoverLatestCompletedJob = async () => {
      try {
        const historyRes = await apiClient.get('/synthesis/');
        const recovered = historyRes.data.find(job => {
          const jobText = (job.input_text || '').replace(/\//g, ' slash ').replace(/\\/g, ' slash ').replace(/\s+/g, ' ');
          return job.status === 'completed'
            && job.voice_ref_id === parseInt(selectedRef, 10)
            && (job.language || 'en') === language
            && jobText === normalizedText;
        });

        if (recovered) {
          setError('');
          setResult(recovered);
          return true;
        }
      } catch {
        // ignore recovery failures and fall through to the original error
      }

      return false;
    };

    try {
      const payload = {
        text,
        voice_ref_id: parseInt(selectedRef),
        language,
      };
      
      if (emotionControlMethod === 'emotion_audio') {
        if (!emotionRefId) {
          setError('Please select or upload an emotion reference audio');
          setSubmitting(false);
          return;
        }
        payload.emo_voice_ref_id = parseInt(emotionRefId, 10);
        payload.emo_alpha = emotionStrength;
      }

      if (emotionControlMethod === 'emotion_vector') {
        payload.emo_vector = emotionVector;
        payload.emo_alpha = emotionStrength;
        payload.use_random = useRandom;
      }

      if (emotionControlMethod === 'emotion_text') {
        if (!emotionText.trim()) {
          setError('Please enter an emotion description');
          setSubmitting(false);
          return;
        }
        payload.use_emo_text = true;
        payload.emo_text = emotionText.trim();
        payload.emo_alpha = emotionStrength;
        payload.use_random = useRandom;
      }

      payload.max_text_tokens_per_segment = maxTextTokensPerSegment;
      payload.interval_silence = intervalSilence;
      
      const res = await apiClient.post('/synthesis/', payload);
      setResult(res.data);
    } catch (err) {
      const recovered = await recoverLatestCompletedJob();
      if (!recovered) {
        setError(err.response?.data?.detail || 'Synthesis failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmotionChange = (emotion, value) => {
    // Deprecated - kept for compatibility
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
            {refsLoading && !selectedRefUrl ? (
              <LoadingCard
                title="Loading voice references"
                subtitle="Fetching your uploaded voice clips and preparing the preview panel."
              />
            ) : null}
            {isMicRecording ? <RecordingIndicator /> : null}
            {micStatus ? <div className="mic-status">{micStatus}</div> : null}
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
              <button type="button" className={`ghost-tool ${isMicRecording ? 'is-recording' : ''}`} onClick={handleMicRecord} disabled={uploading || emotionUploading}>
                {isMicRecording ? 'Stop Recording' : 'Record Voice Reference'}
              </button>
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
              <div className="file-upload-row">
                <button
                  type="button"
                  className="file-upload-btn"
                  onClick={() => voiceUploadRef.current?.click()}
                  disabled={uploading}
                >
                  Choose file
                </button>
                <span className="file-upload-name">{voiceUploadName}</span>
              </div>
              <input
                ref={voiceUploadRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {uploading && <span className="loading-text">Uploading...</span>}
            </div>
          </section>

          <section className="synthesis-panel text-panel">
            <div className="panel-chip">Text</div>
            <p className="model-version">Current model version 2.0</p>
            <div className="form-group">
              <label>Target language</label>
              <select value={language} onChange={e => setLanguage(e.target.value)}>
                {LANGUAGE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
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
                {submitting ? (
                  <LoadingCard
                    title="Generating speech"
                    subtitle="The model is working. This can take a while for longer text or slower hardware."
                  />
                ) : (
                  <div className="result-placeholder-copy">Result will appear here</div>
                )}
              </div>
            )}
          </section>
        </div>
      </form>

      <div className="settings-section">
        <div className="settings-title">Settings</div>
        <div className="settings-panel">
          <div className="settings-subtitle">Emotion Control Method</div>
          <div className="control-method-buttons">
            <button
              type="button"
              className={`method-btn ${emotionControlMethod === 'same_as_ref' ? 'active' : ''}`}
              onClick={() => setEmotionControlMethod('same_as_ref')}
            >
              Same as the voice reference
            </button>
            <button
              type="button"
              className={`method-btn ${emotionControlMethod === 'emotion_audio' ? 'active' : ''}`}
              onClick={() => setEmotionControlMethod('emotion_audio')}
            >
              Use emotion reference audio
            </button>
            <button
              type="button"
              className={`method-btn ${emotionControlMethod === 'emotion_vector' ? 'active' : ''}`}
              onClick={() => setEmotionControlMethod('emotion_vector')}
            >
              Use emotion vector
            </button>
            <button
              type="button"
              className={`method-btn ${emotionControlMethod === 'emotion_text' ? 'active' : ''}`}
              onClick={() => setEmotionControlMethod('emotion_text')}
            >
              Use text description to control emotion
            </button>
          </div>

          {emotionControlMethod !== 'same_as_ref' && (
            <div className="slider-group" style={{ marginTop: '18px' }}>
              <label>Emotion strength</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={emotionStrength}
                onChange={e => setEmotionStrength(parseFloat(e.target.value))}
                className="emotion-slider"
              />
              <span>{emotionStrength.toFixed(2)}</span>
            </div>
          )}

          {emotionControlMethod === 'same_as_ref' && (
            <div className="settings-hint" style={{ marginTop: '18px' }}>
              Uses the selected voice reference as the emotion reference, matching the default IndexTTS2 behavior.
            </div>
          )}

          {emotionControlMethod === 'emotion_audio' && (
            <div style={{ marginTop: '18px' }}>
              <div className="settings-subtitle">Emotion reference audio</div>
              {emotionRefUrl ? (
                <div className="upload-preview" style={{ marginBottom: '12px' }}>
                  <audio controls src={emotionRefUrl} style={{ width: '100%' }} />
                  <div className="audio-controls" style={{ justifyContent: 'space-between' }}>
                    <span>{formatTime(0)}</span>
                    <span>{formatTime(emotionRefDuration)}</span>
                  </div>
                </div>
              ) : (
                <div className="settings-hint" style={{ marginBottom: '12px' }}>
                  Upload or choose a separate audio clip that represents the target emotion.
                </div>
              )}
              <div className="form-group">
                <label>Select emotion audio</label>
                <select value={emotionRefId} onChange={e => setEmotionRefId(e.target.value)} disabled={emotionUploading}>
                  <option value="">-- Select an emotion audio --</option>
                  {voiceRefs.map(ref => (
                    <option key={ref.id} value={ref.id}>{ref.original_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Upload emotion audio</label>
                <div className="file-upload-row">
                  <button
                    type="button"
                    className="file-upload-btn"
                    onClick={() => emotionUploadRef.current?.click()}
                    disabled={emotionUploading}
                  >
                    Choose file
                  </button>
                  <span className="file-upload-name">{emotionUploadName}</span>
                </div>
                <input
                  ref={emotionUploadRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleEmotionFileUpload}
                  disabled={emotionUploading}
                  style={{ display: 'none' }}
                />
                {emotionUploading && <span className="loading-text">Uploading...</span>}
              </div>
            </div>
          )}

          {emotionControlMethod === 'emotion_text' && (
            <div style={{ marginTop: '18px' }}>
              <div className="settings-subtitle">Emotion description</div>
              <div className="form-group">
                <label>Describe the emotion</label>
                <textarea
                  value={emotionText}
                  onChange={e => setEmotionText(e.target.value)}
                  rows={4}
                  placeholder="e.g. calm and reassuring, excited but gentle, sad and reflective"
                />
              </div>
              <div className="settings-hint">
                IndexTTS2 converts this description into emotion vectors automatically.
              </div>
              <div className="checkbox-group" style={{ marginTop: '12px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={useRandom}
                    onChange={e => setUseRandom(e.target.checked)}
                  />
                  Enable random emotion variation
                </label>
              </div>
            </div>
          )}

          {emotionControlMethod === 'emotion_vector' && (
            <>
              <div className="settings-subtitle" style={{ marginTop: '24px' }}>Random emotion sampling</div>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={useRandom}
                    onChange={e => setUseRandom(e.target.checked)}
                  />
                  Enable random emotion variation
                </label>
              </div>
              {useRandom && (
                <div className="slider-group" style={{ marginTop: '12px' }}>
                  <label>Random Intensity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={randomIntensity}
                    onChange={e => setRandomIntensity(parseFloat(e.target.value))}
                    className="emotion-slider"
                  />
                  <span>{randomIntensity.toFixed(1)}</span>
                </div>
              )}

              <div className="settings-subtitle" style={{ marginTop: '24px' }}>Emotion Vector</div>
              <div className="emotion-sliders-grid">
                <div className="emotion-slider-row">
                  <div className="emotion-slider-column">
                    <label>Happy</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emotionVector[0]}
                      onChange={e => setEmotionVector([parseFloat(e.target.value), ...emotionVector.slice(1)])}
                      className="emotion-slider"
                    />
                    <span className="slider-value">{emotionVector[0].toFixed(1)}</span>
                  </div>
                  <div className="emotion-slider-column">
                    <label>Angry</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emotionVector[1]}
                      onChange={e => setEmotionVector([emotionVector[0], parseFloat(e.target.value), ...emotionVector.slice(2)])}
                      className="emotion-slider"
                    />
                    <span className="slider-value">{emotionVector[1].toFixed(1)}</span>
                  </div>
                </div>
                <div className="emotion-slider-row">
                  <div className="emotion-slider-column">
                    <label>Sad</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emotionVector[2]}
                      onChange={e => setEmotionVector([emotionVector[0], emotionVector[1], parseFloat(e.target.value), ...emotionVector.slice(3)])}
                      className="emotion-slider"
                    />
                    <span className="slider-value">{emotionVector[2].toFixed(1)}</span>
                  </div>
                  <div className="emotion-slider-column">
                    <label>Surprised</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emotionVector[6]}
                      onChange={e => {
                        const newVector = [...emotionVector];
                        newVector[6] = parseFloat(e.target.value);
                        setEmotionVector(newVector);
                      }}
                      className="emotion-slider"
                    />
                    <span className="slider-value">{emotionVector[6].toFixed(1)}</span>
                  </div>
                </div>
                <div className="emotion-slider-row">
                  <div className="emotion-slider-column">
                    <label>Afraid</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emotionVector[3]}
                      onChange={e => {
                        const newVector = [...emotionVector];
                        newVector[3] = parseFloat(e.target.value);
                        setEmotionVector(newVector);
                      }}
                      className="emotion-slider"
                    />
                    <span className="slider-value">{emotionVector[3].toFixed(1)}</span>
                  </div>
                  <div className="emotion-slider-column">
                    <label>Natural</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emotionVector[7]}
                      onChange={e => {
                        const newVector = [...emotionVector];
                        newVector[7] = parseFloat(e.target.value);
                        setEmotionVector(newVector);
                      }}
                      className="emotion-slider"
                    />
                    <span className="slider-value">{emotionVector[7].toFixed(1)}</span>
                  </div>
                </div>
                <div className="emotion-slider-row">
                  <div className="emotion-slider-column">
                    <label>Disgusted</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emotionVector[4]}
                      onChange={e => {
                        const newVector = [...emotionVector];
                        newVector[4] = parseFloat(e.target.value);
                        setEmotionVector(newVector);
                      }}
                      className="emotion-slider"
                    />
                    <span className="slider-value">{emotionVector[4].toFixed(1)}</span>
                  </div>
                  <div className="emotion-slider-column">
                    <label>Low</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emotionVector[5]}
                      onChange={e => {
                        const newVector = [...emotionVector];
                        newVector[5] = parseFloat(e.target.value);
                        setEmotionVector(newVector);
                      }}
                      className="emotion-slider"
                    />
                    <span className="slider-value">{emotionVector[5].toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="settings-subtitle" style={{ marginTop: '24px' }}>Pacing</div>
          <div className="slider-group">
            <label>Text chunk size</label>
            <input
              type="range"
              min="40"
              max="220"
              step="10"
              value={maxTextTokensPerSegment}
              onChange={e => setMaxTextTokensPerSegment(parseInt(e.target.value, 10))}
              className="emotion-slider"
            />
            <span>{maxTextTokensPerSegment}</span>
          </div>
          <div className="slider-group" style={{ marginTop: '12px' }}>
            <label>Pause between chunks (ms)</label>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={intervalSilence}
              onChange={e => setIntervalSilence(parseInt(e.target.value, 10))}
              className="emotion-slider"
            />
            <span>{intervalSilence}</span>
          </div>
          <div className="settings-hint" style={{ marginTop: '10px' }}>
            Lower pause values reduce gaps between segments. Larger chunk sizes keep more text together.
          </div>
        </div>
      </div>
    </div>
  );
}