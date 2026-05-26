import { useEffect, useMemo, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import './AdminDashboard.css';

const TAB_LABELS = {
  overview: 'Overview',
  users: 'Users',
  activity: 'Activity',
};

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function formatDateOnly(value) {
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPercentChange(value) {
  return `${value > 0 ? '+' : ''}${value}%`;
}

function formatCompactCount(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatGrowthLabel(value, period) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (period === 'daily') return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (period === 'yearly') return String(date.getFullYear());
  return date.toLocaleDateString(undefined, { month: 'short' });
}

function formatActivityLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function getInitials(username = '') {
  return username
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

function getAvatarTone(seed = '') {
  const tones = ['tone-a', 'tone-b', 'tone-c', 'tone-d'];
  const index = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

function buildMonthlySeries(activityItems) {
  const buckets = new Map();
  activityItems.forEach((item) => {
    const createdAt = new Date(item.created_at);
    const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  const points = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - offset);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    points.push({
      label: date.toLocaleDateString(undefined, { month: 'short' }),
      value: buckets.get(key) || 0,
      year: date.getFullYear(),
    });
  }
  return points;
}

function buildYearlySeries(activityItems) {
  const buckets = new Map();
  activityItems.forEach((item) => {
    const createdAt = new Date(item.created_at);
    const key = createdAt.getFullYear();
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  const years = Array.from(buckets.keys()).sort((a, b) => a - b);
  return years.map((year) => ({ label: String(year), value: buckets.get(year) || 0, year }));
}

function buildDailySeries(activityItems) {
  const buckets = new Map();
  activityItems.forEach((item) => {
    const createdAt = new Date(item.created_at);
    const key = createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  const recent = Array.from(buckets.entries()).slice(-7);
  return recent.map(([label, value]) => ({ label, value }));
}

function buildPath(points) {
  if (!points.length) return '';
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const stepX = points.length > 1 ? 100 / (points.length - 1) : 0;
  return points
    .map((point, index) => {
      const x = index * stepX;
      const y = 100 - (point.value / maxValue) * 100;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function StatusBadge({ status }) {
  return <span className={`admin-badge admin-badge-${status}`}>{status}</span>;
}

function ActivityStatusBadge({ item }) {
  if (item.status === 'failed') {
    return (
      <span className="admin-badge admin-badge-failed admin-badge-code">
        Error Code: {item.error_code || 'TTS_FAILED'}
      </span>
    );
  }

  return <StatusBadge status={item.status} />;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [chartPeriod, setChartPeriod] = useState('yearly');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [statsOverview, setStatsOverview] = useState(null);
  const [growthDaily, setGrowthDaily] = useState([]);
  const [growthMonthly, setGrowthMonthly] = useState([]);
  const [growthYearly, setGrowthYearly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, activityRes, statsRes, growthDailyRes, growthMonthlyRes, growthYearlyRes] = await Promise.all([
        apiClient.get('/admin/users'),
        apiClient.get('/admin/activity'),
        apiClient.get('/admin/stats/overview'),
        apiClient.get('/admin/stats/users/growth?period=daily'),
        apiClient.get('/admin/stats/users/growth?period=monthly'),
        apiClient.get('/admin/stats/users/growth?period=yearly'),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.items || []);
      setActivity(Array.isArray(activityRes.data) ? activityRes.data : activityRes.data.items || []);
      setStatsOverview(statsRes.data || null);
      setGrowthDaily(Array.isArray(growthDailyRes.data) ? growthDailyRes.data : growthDailyRes.data.items || []);
      setGrowthMonthly(Array.isArray(growthMonthlyRes.data) ? growthMonthlyRes.data : growthMonthlyRes.data.items || []);
      setGrowthYearly(Array.isArray(growthYearlyRes.data) ? growthYearlyRes.data : growthYearlyRes.data.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure? This will permanently delete the user and all their data.')) {
      return;
    }
    setDeleting(userId);
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      setUsers((currentUsers) => currentUsers.filter((u) => u.id !== userId));
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const latestActivity = activity.slice(0, 5);
  const rankedUsers = useMemo(() => {
    return [...users].sort((left, right) => {
      if (left.is_admin !== right.is_admin) return Number(right.is_admin) - Number(left.is_admin);
      return left.username.localeCompare(right.username);
    });
  }, [users]);

  const chartSeries = useMemo(() => {
    const source = chartPeriod === 'daily' ? growthDaily : chartPeriod === 'yearly' ? growthYearly : growthMonthly;
    return source.map((point) => ({
      label: formatGrowthLabel(point.date, chartPeriod),
      value: Number(point.new_users ?? point.user_count ?? 0),
    }));
  }, [chartPeriod, growthDaily, growthMonthly, growthYearly]);

  const chartMax = useMemo(() => {
    return Math.max(...chartSeries.map((point) => point.value), 1);
  }, [chartSeries]);

  const chartTicks = useMemo(() => {
    const tickRatios = [1, 0.75, 0.5, 0.25, 0];
    return tickRatios.map((ratio) => ({
      ratio,
      label: formatCompactCount(Math.round(chartMax * ratio)),
    }));
  }, [chartMax]);

  const chartPath = buildPath(chartSeries);
  const topMonth = useMemo(() => {
    if (!activity.length) return { label: 'N/A', value: 0 };
    let best = { label: 'N/A', subtitle: '', value: 0 };
    const monthBuckets = new Map();
    activity.forEach((item) => {
      const createdAt = new Date(item.created_at);
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
      monthBuckets.set(key, (monthBuckets.get(key) || 0) + 1);
    });

    for (const [key, value] of monthBuckets.entries()) {
      if (value > best.value) {
        const [year, month] = key.split('-').map(Number);
        const date = new Date(year, month, 1);
        best = {
          label: date.toLocaleDateString(undefined, { month: 'long' }),
          subtitle: String(date.getFullYear()),
          value,
        };
      }
    }
    return best;
  }, [activity]);

  const topYear = useMemo(() => {
    if (!activity.length) return { label: 'N/A', value: 0 };
    let best = { label: 'N/A', value: 0 };
    const yearBuckets = new Map();
    activity.forEach((item) => {
      const createdAt = new Date(item.created_at);
      const key = createdAt.getFullYear();
      yearBuckets.set(key, (yearBuckets.get(key) || 0) + 1);
    });

    for (const [key, value] of yearBuckets.entries()) {
      if (value > best.value) {
        best = { label: String(key), value };
      }
    }
    return best;
  }, [activity]);

  const activeUsers = statsOverview?.active_users ?? 0;
  const activeUsersChange = statsOverview?.active_users_change_percent ?? 0;
  const activeUsersArrow = activeUsersChange >= 0 ? '↗' : '↘';
  const selectedPeriodLabel = chartPeriod[0].toUpperCase() + chartPeriod.slice(1);

  return (
    <div className="page-container admin-page">
      <div className="admin-shell">
        <div className="admin-header">
          <div className="admin-tabs" role="tablist" aria-label="Admin sections">
            {Object.entries(TAB_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`admin-tab ${activeTab === key ? 'active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {loading ? (
          <div className="admin-loading">Loading admin data...</div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <section className="admin-section">
                <div className="admin-hero-card">
                  <div className="admin-hero-copy">
                    <h2>Active Users</h2>
                    <div className="admin-hero-value">
                      <span>{activeUsers}</span>
                      <span className={`admin-trend-arrow ${activeUsersChange < 0 ? 'is-down' : ''}`}>{activeUsersArrow}</span>
                    </div>
                    <p>{formatPercentChange(activeUsersChange)} vs previous period</p>
                  </div>
                </div>

                <div className="admin-overview-grid">
                  <section className="admin-panel admin-users-panel">
                    <div className="admin-panel-header admin-panel-header-spread">
                      <h2>Users</h2>
                      <button className="admin-inline-link" type="button" onClick={() => setActiveTab('users')}>
                        Sort by Newest <span aria-hidden="true">⌄</span>
                      </button>
                    </div>
                    {rankedUsers.length === 0 ? (
                      <p className="empty-msg">No users found.</p>
                    ) : (
                      <div className="admin-user-list">
                        {rankedUsers.slice(0, 4).map((item) => (
                          <div key={item.id} className="admin-user-row">
                            <div className={`admin-avatar ${getAvatarTone(item.username)}`}>{getInitials(item.username)}</div>
                            <div className="admin-user-meta">
                              <strong>{item.username}</strong>
                              <span>{item.email}</span>
                            </div>
                            <div className={`admin-role-swap ${item.is_admin ? 'is-admin' : 'is-user'}`}>
                              <span className="admin-role-label">{item.is_admin ? 'Admin' : 'User'}</span>
                              {!item.is_admin ? (
                                <button
                                  type="button"
                                  className="admin-role-delete"
                                  onClick={() => handleDeleteUser(item.id)}
                                  disabled={deleting === item.id}
                                >
                                  {deleting === item.id ? 'Deleting...' : 'Delete User'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button className="admin-inline-link admin-all-users" type="button" onClick={() => setActiveTab('users')}>
                      All Users <span aria-hidden="true">→</span>
                    </button>
                  </section>

                  <section className="admin-panel admin-chart-panel">
                    <div className="admin-panel-header admin-panel-header-spread">
                      <h2>Growth</h2>
                      <div className="admin-period-dropdown">
                        <button
                          type="button"
                          className="admin-period-toggle"
                          onClick={() => setPeriodMenuOpen((current) => !current)}
                        >
                          <span>{selectedPeriodLabel}</span>
                          <span className="admin-period-toggle-icons" aria-hidden="true">⌄⌃</span>
                        </button>
                        {periodMenuOpen ? (
                          <div className="admin-period-menu" role="menu" aria-label="Growth period">
                            {['daily', 'monthly', 'yearly']
                              .filter((period) => period !== chartPeriod)
                              .map((period) => (
                                <button
                                  key={period}
                                  type="button"
                                  className="admin-period-menu-item"
                                  onClick={() => {
                                    setChartPeriod(period);
                                    setPeriodMenuOpen(false);
                                  }}
                                >
                                  {period[0].toUpperCase() + period.slice(1)}
                                </button>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-chart-wrap">
                      <div className="admin-chart-y-axis" aria-hidden="true">
                        {chartTicks.map((tick) => (
                          <span key={tick.ratio}>{tick.label}</span>
                        ))}
                      </div>

                      <div className="admin-chart-stage">
                        <svg viewBox="0 0 100 100" className="admin-growth-chart" preserveAspectRatio="none" aria-hidden="true">
                          <defs>
                            <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3fae3f" stopOpacity="0.75" />
                              <stop offset="100%" stopColor="#3fae3f" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {[0, 20, 40, 60, 80, 100].map((gridY) => (
                            <line key={gridY} x1="0" x2="100" y1={gridY} y2={gridY} className="admin-chart-grid" />
                          ))}
                          {chartSeries.map((point, index) => {
                            const stepX = chartSeries.length > 1 ? 100 / (chartSeries.length - 1) : 0;
                            const x = index * stepX;
                            return <line key={`${point.label}-${index}`} x1={x} x2={x} y1="0" y2="100" className="admin-chart-grid admin-chart-grid-vertical" />;
                          })}
                          <path d={`${chartPath} L 100 100 L 0 100 Z`} className="admin-growth-area" />
                          <path d={chartPath} className="admin-growth-line" />
                        </svg>

                        <div className="admin-chart-labels">
                          {chartSeries.map((point, index) => (
                            <span key={`${point.label}-${index}`}>{point.label}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="admin-chart-summary-grid">
                      <div>
                        <p className="admin-summary-label">Top month</p>
                        <strong>{topMonth.label}</strong>
                        <span>{topMonth.subtitle}</span>
                      </div>
                      <div>
                        <p className="admin-summary-label">Top year</p>
                        <strong>{topYear.label}</strong>
                        <span>{formatCompactCount(topYear.value)} activities so far</span>
                      </div>
                    </div>
                  </section>
                </div>
              </section>
            )}

            {activeTab === 'users' && (
              <section className="admin-section admin-table-section">
                <div className="admin-panel admin-table-card">
                  <div className="admin-panel-header admin-panel-header-spread">
                    <h2>Users</h2>
                    <button className="admin-inline-link" type="button">Sort by Newest <span aria-hidden="true">⌄</span></button>
                  </div>
                  {users.length === 0 ? (
                    <p className="empty-msg">No users found.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table admin-users-table">
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Joined Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <div className="admin-table-user">
                                  <div className={`admin-avatar admin-avatar-sm ${getAvatarTone(item.username)}`}>{getInitials(item.username)}</div>
                                  <span>{item.username}</span>
                                </div>
                              </td>
                              <td>{item.email}</td>
                              <td>
                                <div className={`admin-role-swap admin-role-swap-table ${item.is_admin ? 'is-admin' : 'is-user'}`}>
                                  <span className="admin-role-label">{item.is_admin ? 'Admin' : 'User'}</span>
                                  {!item.is_admin ? (
                                    <button
                                      type="button"
                                      className="admin-role-delete"
                                      onClick={() => handleDeleteUser(item.id)}
                                      disabled={deleting === item.id}
                                    >
                                      {deleting === item.id ? 'Deleting...' : 'Delete User'}
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                              <td>{formatDateOnly(item.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'activity' && (
              <section className="admin-section admin-table-section">
                <div className="admin-panel admin-table-card">
                  <div className="admin-panel-header admin-panel-header-spread">
                    <h2>Activity</h2>
                    <button className="admin-inline-link" type="button">Sort by Newest <span aria-hidden="true">⌄</span></button>
                  </div>
                  {activity.length === 0 ? (
                    <p className="empty-msg">No activity found.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table admin-activity-table">
                        <thead>
                          <tr>
                            <th>UserID</th>
                            <th>Voice_refID</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.map((item) => (
                            <tr key={item.id}>
                              <td>{item.user_id}</td>
                              <td>{item.voice_ref_id}</td>
                              <td><ActivityStatusBadge item={item} /></td>
                              <td>{formatDateOnly(item.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}