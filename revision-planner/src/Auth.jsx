import { useState } from 'react';
import { supabase } from './supabaseClient';
import { User, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Auth({ onComplete }) {
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setErrorMsg('');

        // Supabase requires an email format to use its built-in password auth.
        // We append a standard dummy domain to the username.
        const normalizedUsername = username.trim().toLowerCase();
        const fakeEmail = `${normalizedUsername}@example.com`;
        const dummyPassword = normalizedUsername + '_selection_2026';

        try {
            // First, check if the username already exists in the profiles table
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', normalizedUsername)
                .single();

            if (existingProfile) {
                // If it exists, we perform a Sign In
                const { error } = await supabase.auth.signInWithPassword({
                    email: fakeEmail,
                    password: dummyPassword,
                });
                if (error) throw error;
                if (onComplete) onComplete();
            } else {
                // If it doesn't exist, we perform a Sign Up
                const { data, error } = await supabase.auth.signUp({
                    email: fakeEmail,
                    password: dummyPassword,
                });
                if (error) throw error;

                if (data?.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([{ id: data.user.id, username: normalizedUsername }]);

                    if (profileError) {
                        console.error("Could not create profile", profileError);
                    }
                }

                setMessage('Progress saved successfully!');
                if (onComplete) onComplete();
            }
        } catch (error) {
            if (error.message.toLowerCase().includes('rate limit')) {
                setErrorMsg('Too many attempts! Please try again later.');
            } else {
                setErrorMsg(error.message || 'Connection failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card animate-fade-in" style={{ textAlign: 'center' }}>
                <div style={{ background: 'rgba(var(--accent-primary-rgb), 0.1)', width: '64px', height: '64px', borderRadius: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <Award size={32} color="var(--accent-primary)" />
                </div>
                <h2 className="title-glow" style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>Cloud Sync</h2>
                <p className="subtitle" style={{ marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    Choose a unique username to save your progress permanently in the cloud.
                </p>

                {message && <div className="auth-message success">{message}</div>}
                {errorMsg && <div className="auth-message error">{errorMsg}</div>}

                <form onSubmit={handleAuth} className="auth-form">
                    <div className="input-group">
                        <User className="input-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={username}
                            required
                            autoFocus
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <button
                        className="auth-button"
                        disabled={loading}
                        style={{ marginTop: '0.5rem' }}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                Save & Sync progress <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
