import { useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Save, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Pencil, Check, X, Trash2 } from 'lucide-react';

// Helper: extract unique chapters per subject from schedule data
function extractChaptersBySubject(scheduleData) {
    const subjects = {};
    scheduleData.forEach(day => {
        if (!day.tasks) return;
        day.tasks.forEach(task => {
            const subj = task.subject;
            if (!subjects[subj]) subjects[subj] = new Set();
            // Split on + and , to get individual chapter tokens
            task.topic.split(/[+,]/).map(s => s.trim()).filter(Boolean).forEach(c => {
                subjects[subj].add(c);
            });
        });
    });
    // Convert sets to arrays, sorted
    return Object.fromEntries(
        Object.entries(subjects).map(([subj, set]) => [subj, [...set].sort()])
    );
}

// Recursively replace ALL occurrences of oldName with newName in a topic string
function replaceChapterInTopic(topic, oldName, newName) {
    // Escape special regex chars in oldName
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return topic.replace(new RegExp(escaped, 'g'), newName);
}

export default function Admin({ scheduleData, onSave }) {
    const [activeTab, setActiveTab] = useState('chapters'); // 'chapters' | 'json'
    const [localData, setLocalData] = useState(scheduleData);
    const [jsonText, setJsonText] = useState(JSON.stringify(scheduleData, null, 2));
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [editingChapter, setEditingChapter] = useState(null); // { subject, oldName }
    const [editValue, setEditValue] = useState('');
    const [collapsed, setCollapsed] = useState({});

    const chaptersBySubject = useMemo(() => extractChaptersBySubject(localData), [localData]);

    const subjectOrder = ['Physics', 'Biology', 'Inorganic', 'Organic', 'Physical'];
    const orderedSubjects = [
        ...subjectOrder.filter(s => chaptersBySubject[s]),
        ...Object.keys(chaptersBySubject).filter(s => !subjectOrder.includes(s))
    ];

    const subjectColors = {
        Physics: '#60a5fa',
        Biology: '#34d399',
        Inorganic: '#a78bfa',
        Organic: '#fb923c',
        Physical: '#f472b6',
    };

    const startEdit = (subject, chapterName) => {
        setEditingChapter({ subject, oldName: chapterName });
        setEditValue(chapterName);
    };

    const cancelEdit = () => {
        setEditingChapter(null);
        setEditValue('');
    };

    const commitEdit = () => {
        if (!editingChapter || !editValue.trim() || editValue.trim() === editingChapter.oldName) {
            cancelEdit();
            return;
        }

        const newName = editValue.trim();
        const { subject, oldName } = editingChapter;

        // Update all tasks in the schedule that have this chapter under this subject
        const updatedData = localData.map(day => ({
            ...day,
            tasks: day.tasks.map(task => {
                if (task.subject !== subject) return task;
                return { ...task, topic: replaceChapterInTopic(task.topic, oldName, newName) };
            })
        }));

        setLocalData(updatedData);
        setJsonText(JSON.stringify(updatedData, null, 2));
        cancelEdit();
    };

    const deleteChapter = (subject, chapterName) => {
        if (!window.confirm(`Delete "${chapterName}" from all ${subject} tasks? This cannot be undone.`)) return;

        const escaped = chapterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const updatedData = localData.map(day => ({
            ...day,
            tasks: day.tasks.map(task => {
                if (task.subject !== subject) return task;
                // Remove the chapter name and clean up leftover delimiters
                const newTopic = task.topic
                    .replace(new RegExp(`\\s*[+,]?\\s*${escaped}\\s*[+,]?\\s*`, 'g'), (match) => {
                        // Preserve a separator if needed
                        if (match.trim().startsWith(',') || match.trim().startsWith('+')) return ', ';
                        return ', ';
                    })
                    .replace(/^[,\s]+|[,\s]+$/g, '') // trim leading/trailing commas
                    .replace(/,\s*,/g, ',') // remove double commas
                    .trim();
                return { ...task, topic: newTopic };
            })
        }));

        setLocalData(updatedData);
        setJsonText(JSON.stringify(updatedData, null, 2));
    };

    const handleSave = async (dataToSave) => {
        setIsSaving(true);
        setMessage({ text: '', type: '' });
        try {
            const parsedData = dataToSave || JSON.parse(jsonText);
            const { error } = await supabase
                .from('global_schedule')
                .update({ schedule_data: parsedData, updated_at: new Date() })
                .eq('id', 1);
            if (error) throw error;
            setMessage({ text: 'Schedule saved successfully!', type: 'success' });
            if (onSave) onSave(parsedData);
        } catch (err) {
            console.error(err);
            setMessage({
                text: err instanceof SyntaxError ? 'Invalid JSON. Check for missing commas or quotes.' : err.message,
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleCollapse = (subj) => {
        setCollapsed(prev => ({ ...prev, [subj]: !prev[subj] }));
    };

    const statusBar = message.text && (
        <div style={{
            padding: '0.8rem 1rem', marginBottom: '1.5rem', borderRadius: '0.5rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            backgroundColor: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            color: message.type === 'error' ? '#fca5a5' : '#6ee7b7'
        }}>
            {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {message.text}
        </div>
    );

    return (
        <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: 'var(--accent-primary)', margin: 0 }}>🛠️ Admin Dashboard</h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        className={`filter-btn ${activeTab === 'chapters' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chapters')}
                    >📚 Chapter Editor</button>
                    <button
                        className={`filter-btn ${activeTab === 'json' ? 'active' : ''}`}
                        onClick={() => setActiveTab('json')}
                    >{"{ }"} Raw JSON</button>
                    <button
                        className="auth-button"
                        onClick={() => handleSave(activeTab === 'chapters' ? localData : null)}
                        disabled={isSaving}
                        style={{ marginTop: 0, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Save to Site
                    </button>
                </div>
            </div>

            {statusBar}

            {/* Chapter Editor Tab */}
            {activeTab === 'chapters' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Click the ✏️ icon next to any chapter name to rename it. Changes are reflected across the entire site after saving.
                    </p>
                    {orderedSubjects.map(subj => {
                        const chapters = chaptersBySubject[subj];
                        const color = subjectColors[subj] || '#94a3b8';
                        const isCollapsed = collapsed[subj];
                        return (
                            <div key={subj} style={{
                                border: `1px solid rgba(${color.slice(1).match(/.{2}/g).map(h => parseInt(h, 16)).join(',')}, 0.25)`,
                                borderRadius: '0.75rem',
                                overflow: 'hidden',
                                background: 'rgba(255,255,255,0.02)'
                            }}>
                                {/* Subject Header */}
                                <button
                                    onClick={() => toggleCollapse(subj)}
                                    style={{
                                        width: '100%', display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', padding: '0.85rem 1.2rem',
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{
                                            background: color, color: '#000', fontWeight: 700, fontSize: '0.75rem',
                                            padding: '0.2rem 0.6rem', borderRadius: '0.4rem', letterSpacing: '0.05em'
                                        }}>{subj.toUpperCase()}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{chapters.length} chapters</span>
                                    </div>
                                    {isCollapsed ? <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-secondary)' }} />}
                                </button>

                                {/* Chapter List */}
                                {!isCollapsed && (
                                    <div style={{ padding: '0 1.2rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        {chapters.map((chapter) => {
                                            const isEditing = editingChapter?.subject === subj && editingChapter?.oldName === chapter;
                                            return (
                                                <div key={chapter} style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    padding: '0.4rem 0.6rem', borderRadius: '0.4rem',
                                                    background: isEditing ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                    transition: 'background 0.2s'
                                                }}>
                                                    {isEditing ? (
                                                        <>
                                                            <input
                                                                autoFocus
                                                                value={editValue}
                                                                onChange={e => setEditValue(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                                style={{
                                                                    flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--accent-primary)',
                                                                    borderRadius: '0.35rem', padding: '0.3rem 0.5rem',
                                                                    color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.95rem'
                                                                }}
                                                            />
                                                            <button onClick={commitEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#34d399', padding: '2px' }}><Check size={16} /></button>
                                                            <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '2px' }}><X size={16} /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span style={{ flex: 1, fontSize: '0.95rem' }}>{chapter}</span>
                                                            <button
                                                                onClick={() => startEdit(subj, chapter)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', opacity: 0.6 }}
                                                                title="Rename chapter"
                                                            ><Pencil size={14} /></button>
                                                            <button
                                                                onClick={() => deleteChapter(subj, chapter)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '2px', opacity: 0.6 }}
                                                                title="Delete chapter"
                                                            ><Trash2 size={14} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Raw JSON Tab */}
            {activeTab === 'json' && (
                <div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Advanced: edit raw schedule JSON directly. Changes here are independent of the Chapter Editor tab.
                    </p>
                    <textarea
                        value={jsonText}
                        onChange={(e) => setJsonText(e.target.value)}
                        style={{
                            width: '100%', height: '600px', backgroundColor: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-color)', borderRadius: '0.5rem',
                            padding: '1rem', color: 'var(--text-primary)',
                            fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5', resize: 'vertical'
                        }}
                        spellCheck="false"
                    />
                </div>
            )}
        </div>
    );
}
