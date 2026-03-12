import { useState } from 'react';
import { supabase } from './supabaseClient';
import { Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Admin({ scheduleData, onSave }) {
    const [jsonText, setJsonText] = useState(JSON.stringify(scheduleData, null, 2));
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const handleSave = async () => {
        setIsSaving(true);
        setMessage({ text: '', type: '' });

        try {
            // Validate JSON
            const parsedData = JSON.parse(jsonText);

            // Save to Supabase
            const { error } = await supabase
                .from('global_schedule')
                .update({ schedule_data: parsedData, updated_at: new Date() })
                .eq('id', 1);

            if (error) throw error;

            setMessage({ text: 'Schedule updated successfully!', type: 'success' });

            // Update parent state
            if (onSave) onSave(parsedData);

        } catch (err) {
            console.error(err);
            setMessage({
                text: err instanceof SyntaxError ? 'Invalid JSON format. Please check for missing quotes or commas.' : err.message,
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="admin-container animate-fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Admin Dashboard
                </h2>

                <button
                    className="auth-button"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ marginTop: 0, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}
                >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Changes
                </button>
            </div>

            {message.text && (
                <div
                    style={{
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        color: message.type === 'error' ? '#fca5a5' : '#6ee7b7'
                    }}
                >
                    {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    {message.text}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Edit the global revision schedule JSON below. This will instantly update the view for all users.
                    Make sure it remains a valid JSON array of day objects.
                </p>

                <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    style={{
                        width: '100%',
                        height: '600px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        resize: 'vertical'
                    }}
                    spellCheck="false"
                />
            </div>
        </div>
    );
}
