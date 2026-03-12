import { useState, useEffect, useMemo } from 'react';
import { Check, CalendarDays, Award, Clock, Loader2, LogOut } from 'lucide-react';
import scheduleData from './data/schedule.json';
import { supabase } from './supabaseClient';
import Auth from './Auth';

function App() {
  const [session, setSession] = useState(null);
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed'
  const [isLoading, setIsLoading] = useState(true);

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

    const fetchCompletedTasks = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('completed_tasks')
          .select('task_id')
          .eq('user_id', session.user.id);

        if (error) throw error;

        if (data) {
          const taskIds = data.map(row => row.task_id);
          setCompletedTasks(new Set(taskIds));
        }
      } catch (e) {
        console.error('Error fetching completed tasks:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompletedTasks();
  }, [session]);

  const toggleTask = async (taskId) => {
    if (!session?.user) return;

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

  const stats = useMemo(() => {
    const total = scheduleData.reduce((acc, day) => acc + day.tasks.length, 0);
    const completed = completedTasks.size;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, progress };
  }, [completedTasks]);

  const filteredDays = useMemo(() => {
    return scheduleData.filter((day) => {
      const dayCompletedTasks = day.tasks.filter(t => completedTasks.has(t.id)).length;
      const isDayCompleted = dayCompletedTasks === day.tasks.length;

      if (filter === 'completed') return isDayCompleted;
      if (filter === 'active') return !isDayCompleted;
      return true;
    });
  }, [completedTasks, filter]);

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            className="filter-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
        <h1 className="title-glow">Selection</h1>
        <p className="subtitle">53-Day NEET Revision Planner</p>
      </header>

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
          const dayCompletedTasks = day.tasks.filter(t => completedTasks.has(t.id)).length;
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
                  {day.date}
                </div>
              </div>

              <div className="task-list">
                {day.tasks.map(task => {
                  const isCompleted = completedTasks.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`task-item ${isCompleted ? 'completed' : ''}`}
                      onClick={() => toggleTask(task.id)}
                    >
                      <div className="checkbox-wrapper">
                        {isCompleted && <Check size={14} color="#fff" strokeWidth={3} />}
                      </div>
                      <div className="task-content">
                        <span className={`subject-badge ${getSubjectClass(task.subject)}`}>
                          {task.subject}
                        </span>
                        <span className="task-topic">{task.topic}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && filteredDays.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <Clock size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p>No days match your current filter.</p>
        </div>
      )}
    </div>
  );
}

export default App;
