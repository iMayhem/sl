import { useState, useEffect, useMemo } from 'react';
import { Check, CalendarDays, Award, Clock, Loader2, LogOut, Users, Search, Trophy } from 'lucide-react';
import fallbackScheduleData from './data/schedule.json';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import Admin from './Admin';

function App() {
  const [session, setSession] = useState(null);
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed'
  const [isLoading, setIsLoading] = useState(true);
  const [startDateStr, setStartDateStr] = useState('');

  // Global Schedule State
  const [scheduleData, setScheduleData] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Friends Feature States
  const [viewMode, setViewMode] = useState('me'); // 'me' | 'friend'
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendProfile, setFriendProfile] = useState(null);
  const [friendCompletedTasks, setFriendCompletedTasks] = useState(new Set());
  const [isFriendLoading, setIsFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState('');

  // User/Leaderboard State
  const [username, setUsername] = useState('');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  // Handle Authentication setup
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch initial data from Supabase once logged in
  useEffect(() => {
    if (!session?.user) return;

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Fetch tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('completed_tasks')
          .select('task_id')
          .eq('user_id', session.user.id);

        if (!tasksError && tasksData) {
          setCompletedTasks(new Set(tasksData.map(row => row.task_id)));
        }

        // Fetch Global Schedule
        const { data: scheduleRows, error: schedErr } = await supabase
          .from('global_schedule')
          .select('schedule_data')
          .eq('id', 1)
          .single();

        if (schedErr || !scheduleRows?.schedule_data || scheduleRows.schedule_data.length === 0) {
          setScheduleData(fallbackScheduleData);
        } else {
          // Merge: use DB data as base, then fill in any days from local JSON that are missing
          const dbData = scheduleRows.schedule_data;
          const dbDayNumbers = new Set(dbData.map(d => d.day));
          const missingDays = fallbackScheduleData.filter(d => !dbDayNumbers.has(d.day));
          const merged = [...dbData, ...missingDays].sort((a, b) => a.day - b.day);
          setScheduleData(merged);
        }

        // Check if Admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUsername(profile.username);
          if (profile.username === 'sujeet') {
            setIsAdmin(true);
          }
        }

      } catch (e) {
        console.error('Error fetching initial data:', e);
        if (scheduleData.length === 0) setScheduleData(fallbackScheduleData);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();

    // Load custom start date if any
    const savedStartDate = localStorage.getItem(`startDate_${session.user.id}`);
    if (savedStartDate) {
      setStartDateStr(savedStartDate);
    } else {
      // Default to 2nd March
      const currentYear = new Date().getFullYear();
      setStartDateStr(`${currentYear}-03-02`);
    }
  }, [session]);

  const handleStartDateChange = (e) => {
    const newDate = e.target.value;
    setStartDateStr(newDate);
    if (session?.user) {
      localStorage.setItem(`startDate_${session.user.id}`, newDate);
    }
  };

  const getDynamicDate = (dayNumber, dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // JS dates can be tricky with timezones, so we add UTC days
    date.setUTCDate(date.getUTCDate() + (dayNumber - 1));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    // Example: "9 March"
  };

  const toggleTask = async (taskId) => {
    if (!session?.user) return;
    if (viewMode === 'friend') return; // Cannot edit friend's tasks

    // Optimistic update
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });

    // Background sync to Supabase
    try {
      if (completedTasks.has(taskId)) {
        // Was checked, now unchecked: remove from db
        const { error } = await supabase
          .from('completed_tasks')
          .delete()
          .match({ task_id: taskId, user_id: session.user.id });
        if (error) throw error;
      } else {
        // Was unchecked, now checked: add to db
        const { error } = await supabase
          .from('completed_tasks')
          .insert([{ task_id: taskId, user_id: session.user.id }]);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Error syncing task state to Supabase:', e);
      // Revert optimistic update on failure
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
    }
  };

  const getSubjectClass = (subject) => {
    const s = subject.toLowerCase();
    if (s.includes('physics')) return 'subject-physics';
    if (s.includes('inorganic')) return 'subject-inorganic';
    if (s.includes('organic')) return 'subject-organic';
    if (s.includes('physical')) return 'subject-physical';
    if (s.includes('biology')) return 'subject-biology';
    return '';
  };

  const activeCompletedTasks = viewMode === 'me' ? completedTasks : friendCompletedTasks;

  const stats = useMemo(() => {
    const total = scheduleData.reduce((acc, day) => acc + day.tasks.length, 0);
    const completed = activeCompletedTasks.size;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, progress };
  }, [activeCompletedTasks, scheduleData]);

  const filteredDays = useMemo(() => {
    return scheduleData.filter((day) => {
      const dayCompletedTasks = day.tasks.filter(t => activeCompletedTasks.has(t.id)).length;
      const isDayCompleted = dayCompletedTasks === day.tasks.length;

      if (filter === 'completed') return isDayCompleted;
      if (filter === 'active') return !isDayCompleted;
      return true;
    });
  }, [activeCompletedTasks, filter, scheduleData]);

  const handleFriendSearch = async (e) => {
    e.preventDefault();
    if (!friendSearchQuery.trim()) return;

    setIsFriendLoading(true);
    setFriendError('');
    setFriendProfile(null);
    setFriendCompletedTasks(new Set());

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', friendSearchQuery.trim().toLowerCase())
        .single();

      if (profileError || !profileData) {
        throw new Error('User not found! Make sure you typed the username correctly.');
      }

      setFriendProfile(profileData);

      const { data: tasksData, error: tasksError } = await supabase
        .from('completed_tasks')
        .select('task_id')
        .eq('user_id', profileData.id);

      if (tasksError) throw tasksError;

      if (tasksData) {
        setFriendCompletedTasks(new Set(tasksData.map(r => r.task_id)));
      }
    } catch (err) {
      setFriendError(err.message);
    } finally {
      setIsFriendLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    setIsLeaderboardLoading(true);
    try {
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('id, username');

      if (profileErr) throw profileErr;

      const { data: allTasks, error: tasksErr } = await supabase
        .from('completed_tasks')
        .select('user_id');

      if (tasksErr) throw tasksErr;

      const counts = allTasks.reduce((acc, task) => {
        acc[task.user_id] = (acc[task.user_id] || 0) + 1;
        return acc;
      }, {});

      const totalTasks = scheduleData.reduce((acc, day) => acc + day.tasks.length, 0);

      const leaderboard = profiles.map(p => ({
        username: p.username,
        completed: counts[p.id] || 0,
        progress: totalTasks === 0 ? 0 : Math.round(((counts[p.id] || 0) / totalTasks) * 100)
      })).sort((a, b) => b.completed - a.completed);

      setLeaderboardData(leaderboard);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'people') {
      fetchLeaderboard();
    }
  }, [viewMode, scheduleData]);

  const baseRevise = {
    'REVISE A': 'Reproduction in flowering plants, Biological classification, Plant Kingdom, Anatomy of flowering plants, Reproductive Health',
    'REVISE B': 'Photosynthesis in higher plants, Ecosystem, Respiration in plants, Human Reproduction',
    'REVISE C': 'Animal kingdom, Biotechnology: Principle & processes, Biotechnology & its applications, Cell cycle & cell division, Biomolecules, Neural Control & Coordination',
    'REVISE D': 'Morphology of flowering plants, Human health & diseases, Principle of inheritance & variation, Evolution, Chemical control & integration',
    'REVISE E': 'Molecular basis of inheritance, Breathing & exchange of gases, The living world, Animal tissues, Microbes in human welfare, Cell: the unit of life',
    'REVISE F': 'Plant growth & development, Body fluid & circulation, Organism & population, Excretory products & elimination, Locomotion & movement, Biodiversity & conservation',
  };

  const reviseMapping = {
    ...baseRevise,
    'REVISE A+C': `${baseRevise['REVISE A']}, ${baseRevise['REVISE C']}`,
    'REVISE B+D': `${baseRevise['REVISE B']}, ${baseRevise['REVISE D']}`,
    'REVISE E+F': `${baseRevise['REVISE E']}, ${baseRevise['REVISE F']}`,
    'REVISE A+F': `${baseRevise['REVISE A']}, ${baseRevise['REVISE F']}`,
    'REVISE B+E': `${baseRevise['REVISE B']}, ${baseRevise['REVISE E']}`,
  };

  const expandTopic = (topic) => {
    // If it's exactly a revise block, return the mapped chapters
    if (reviseMapping[topic]) {
      return reviseMapping[topic];
    }
    // If it contains a revise block, replace it. Match longest keys first.
    let expanded = topic;
    Object.keys(reviseMapping)
      .sort((a, b) => b.length - a.length)
      .forEach(key => {
        if (expanded.includes(key)) {
          expanded = expanded.replace(key, reviseMapping[key]);
        }
      });
    return expanded;
  };
  const splitTopics = (topicString) => {
    const parts = topicString
      .split(/[+,]/)
      .map(s => s.trim())
      .filter(Boolean);
    // Deduplicate case-insensitively (keep first occurrence)
    const seen = new Set();
    return parts.filter(c => {
      const key = c.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const chapterFrequencies = useMemo(() => {
    const freqs = {};
    const normalize = (s) => s.trim().toLowerCase().replace(/[\.+]*$/, '');

    if (scheduleData && scheduleData.length > 0) {
      scheduleData.forEach(day => {
        if (day && day.tasks) {
          day.tasks.forEach(task => {
            const subjectKey = normalize(task.subject);
            const expanded = expandTopic(task.topic);
            const chapters = splitTopics(expanded);
            chapters.forEach(c => {
              const key = `${subjectKey}:${normalize(c)}`;
              freqs[key] = (freqs[key] || 0) + 1;
            });
          });
        }
      });
    }
    return freqs;
  }, [scheduleData]);

  const renderTopicWithFrequency = (topicString, subject) => {
    const normalize = (s) => s.trim().toLowerCase().replace(/[\.+]*$/, '');
    const subjectKey = normalize(subject || '');
    const chapters = splitTopics(topicString);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
        {chapters.map((c, idx) => {
          const key = `${subjectKey}:${normalize(c)}`;
          const freq = chapterFrequencies[key] || 1;
          return (
            <span key={idx} style={{ display: 'block', lineHeight: '1.4' }}>
              {c} <span style={{ opacity: 0.6, fontSize: '0.85em', fontWeight: 500 }}>({freq}x)</span>
            </span>
          );
        })}
      </div>
    );
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              className="filter-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: showAdmin ? 'var(--accent-primary)' : '', color: showAdmin ? '#fff' : '' }}
              onClick={() => setShowAdmin(!showAdmin)}
            >
              🛠️ Admin
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Started:</span>
            <input
              type="date"
              value={startDateStr}
              onChange={handleStartDateChange}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.4rem 0.5rem',
                borderRadius: '0.5rem',
                fontFamily: 'inherit',
                colorScheme: 'dark',
                fontSize: '0.9rem'
              }}
            />
          </div>
          <button
            className="filter-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
        <h1 className="title-glow" style={{ marginBottom: '2rem' }}>Selection <span style={{ fontSize: '0.4em', opacity: 0.5 }}>v1.2</span></h1>
      </header>

      {showAdmin && isAdmin ? (
        <Admin
          scheduleData={scheduleData}
          onSave={(newData) => {
            setScheduleData(newData);
            setShowAdmin(false);
          }}
        />
      ) : (
        <>
          <div className="progress-container">
            <div className="progress-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award className="text-accent-primary" size={24} color="var(--accent-primary)" />
                <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>Overall Progress</span>
              </div>
              <div className="progress-stats">
                {stats.completed} / {stats.total} Tasks ({stats.progress}%)
              </div>
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
          </div>

          <div className="filters">
            <button
              className={`filter-btn ${viewMode === 'me' ? 'active' : ''}`}
              onClick={() => setViewMode('me')}
            >
              My Plan
            </button>
            <button
              className={`filter-btn ${viewMode === 'friend' ? 'active' : ''}`}
              onClick={() => setViewMode('friend')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Users size={16} /> Friends
            </button>
            <button
              className={`filter-btn ${viewMode === 'people' ? 'active' : ''}`}
              onClick={() => setViewMode('people')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Trophy size={16} /> People
            </button>
          </div>

          {viewMode === 'friend' && (
            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
              <form onSubmit={handleFriendSearch} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Enter friend's username..."
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem 0.8rem 2.8rem',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.75rem',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="auth-button"
                  style={{ marginTop: 0, padding: '0.8rem 1.5rem' }}
                  disabled={isFriendLoading || !friendSearchQuery.trim()}
                >
                  {isFriendLoading ? <Loader2 className="animate-spin" size={18} /> : 'Search'}
                </button>
              </form>

              {friendError && (
                <div className="auth-message error" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  {friendError}
                </div>
              )}

              {friendProfile && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '0.75rem', color: '#6ee7b7' }}>
                  Viewing progress for <strong>@{friendProfile.username}</strong>
                </div>
              )}
            </div>
          )}

          {viewMode === 'people' && (
            <div className="leaderboard-container animate-fade-in">
              <div className="leaderboard-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', padding: '0 0.5rem' }}>
                <Trophy size={28} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>People</h2>
              </div>

              {isLeaderboardLoading ? (
                <div style={{ padding: '4rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '1.5rem' }}>
                  <Loader2 className="animate-spin" size={40} style={{ margin: '0 auto 1.5rem', color: 'var(--accent-primary)' }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Updating rankings...</p>
                </div>
              ) : (
                <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {leaderboardData.map((user, idx) => (
                    <div
                      key={user.username}
                      className={`leaderboard-item ${user.username === username ? 'current-user-rank' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5rem',
                        padding: '1.25rem 1.5rem',
                        background: user.username === username ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255,255,255,0.03)',
                        borderRadius: '1.25rem',
                        border: user.username === username ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div className="rank" style={{ fontSize: '1.5rem', fontWeight: 800, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#92400e' : 'var(--text-secondary)', width: '3rem', textAlign: 'center' }}>
                        #{idx + 1}
                      </div>
                      <div className="user-info" style={{ flex: 1 }}>
                        <div className="username" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          @{user.username} {user.username === username && <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>(You)</span>}
                        </div>
                        <div className="progress-text" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{user.completed} tasks solved</div>
                      </div>
                      <div className="progress-percent" style={{ textAlign: 'right', minWidth: '100px' }}>
                        <div className="percent-label" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{user.progress}%</div>
                        <div className="mini-bar" style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' }}>
                          <div className="mini-bar-fill" style={{ width: `${user.progress}%`, height: '100%', background: 'var(--accent-primary)', boxShadow: '0 0 10px var(--accent-primary)' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Show Days Filters only if viewing 'me', or if viewing 'friend' and a friend is loaded */}
          {(viewMode === 'me' || (viewMode === 'friend' && friendProfile)) && (
            <>
              <div className="filters">
                <button
                  className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All Days
                </button>
                <button
                  className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                  onClick={() => setFilter('active')}
                >
                  Active
                </button>
                <button
                  className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                  onClick={() => setFilter('completed')}
                >
                  Completed
                </button>
              </div>

              <div className="days-grid">
                {isLoading ? (
                  <div style={{ padding: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
                    <Loader2 className="animate-spin" size={48} style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }} />
                    <p>Loading your progress...</p>
                  </div>
                ) : filteredDays.map((day, index) => {
                  const dayCompletedTasks = day.tasks.filter(t => activeCompletedTasks.has(t.id)).length;
                  const isDayCompleted = dayCompletedTasks === day.tasks.length;

                  return (
                    <div
                      key={day.day}
                      className={`day-card animate-fade-in ${isDayCompleted ? 'completed' : ''}`}
                      style={{ animationDelay: `${(index % 10) * 50}ms` }}
                    >
                      <div className="day-header">
                        <div className="day-title">
                          {isDayCompleted ? <Check size={20} color="var(--success)" /> : <CalendarDays size={20} />}
                          Day {day.day}
                        </div>
                        <div className="day-date">
                          {getDynamicDate(day.day, startDateStr) || day.date}
                        </div>
                      </div>

                      <div className="task-list">
                        {day.tasks.map(task => {
                          const isCompleted = activeCompletedTasks.has(task.id);
                          return (
                            <div
                              key={task.id}
                              className={`task-item ${isCompleted ? 'completed' : ''}`}
                              onClick={() => toggleTask(task.id)}
                              style={viewMode === 'friend' ? { cursor: 'default' } : {}}
                            >
                              <div className="checkbox-wrapper">
                                {isCompleted && <Check size={14} color="#fff" strokeWidth={3} />}
                              </div>
                              <div className="task-content">
                                <span className={`subject-badge ${getSubjectClass(task.subject)}`}>
                                  {task.subject}
                                </span>
                                <span className="task-topic">{renderTopicWithFrequency(expandTopic(task.topic), task.subject)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isLoading && !isFriendLoading && filteredDays.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                  <Clock size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>No days match your current filter.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div >
  );
}

export default App;
