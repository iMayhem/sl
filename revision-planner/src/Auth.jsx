import { useState } from 'react';
import { supabase } from './supabaseClient';
import { User, Loader2, ArrowRight, Award } from 'lucide-react';

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
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: fakeEmail,
                    password: dummyPassword,
                });
                if (signInError) throw signInError;
                if (onComplete) onComplete();
            } else {
                // Try to sign up first
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email: fakeEmail,
                    password: dummyPassword,
                });

                // If Supabase complains the user already exists (e.g. email taken but profile missing locally),
                // we gracefully fall back to signing in instead of showing an error.
                if (signUpError && signUpError.message.toLowerCase().includes('already registered')) {
                    const { error: fallbackSignInError } = await supabase.auth.signInWithPassword({
                        email: fakeEmail,
                        password: dummyPassword,
                    });
                    if (fallbackSignInError) throw fallbackSignInError;
                    if (onComplete) onComplete();
                    return; // Exit successfully
                } else if (signUpError) {
                    throw signUpError; // Throw any other sign up errors
                }

                if (data?.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([{ id: data.user.id, username: normalizedUsername }]);

                    if (profileError) {
                        console.error("Could not create profile", profileError);
                    }
                }

                setMessage('Progress synced! Opening planner...');
                if (onComplete) onComplete();
            }
        } catch (error) {
            console.error("Auth Error:", error);
            if (error.message.toLowerCase().includes('rate limit')) {
                setErrorMsg('Too many attempts! Please try again later.');
            } else if (error.message.toLowerCase().includes('already registered')) {
                // Fallback attempt just in case it slips to the catch block
                const { error: finalSignInError } = await supabase.auth.signInWithPassword({
                    email: fakeEmail,
                    password: dummyPassword,
                });
                if (!finalSignInError) {
                    if (onComplete) onComplete();
                    return;
                }
                setErrorMsg('Account exists but login failed. Please try again.');
            } else {
                setErrorMsg(error.message || 'Connection failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card animate-fade-in" style={{ textAlign: 'center', padding: '1.75rem' }}>
            <div style={{ background: 'rgba(var(--accent-primary-rgb), 0.1)', width: '48px', height: '48px', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <Award size={24} color="var(--accent-primary)" />
            </div>
            <h2 className="title-glow" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Cloud Sync</h2>
            <p className="subtitle" style={{ marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: '1.4' }}>
                Enter your name to sync progress and open your planner.
            </p>

            {message && <div className="auth-message success" style={{ padding: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{message}</div>}
            {errorMsg && <div className="auth-message error" style={{ padding: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{errorMsg}</div>}

            <form onSubmit={handleAuth} className="auth-form">
                <div className="input-group" style={{ marginBottom: '1rem' }}>
                    <User className="input-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Your name"
                        value={username}
                        required
                        autoFocus
                        style={{ padding: '0.75rem 1rem 0.75rem 2.5rem', fontSize: '0.95rem' }}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <button
                    className="auth-button"
                    disabled={loading}
                    style={{ marginTop: '0', padding: '0.875rem' }}
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={20} />
                    ) : (
                        <>
                            Save & Sync <ArrowRight size={18} />
                        </>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => onComplete && onComplete()}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        marginTop: '1rem',
                        cursor: 'pointer',
                        opacity: 0.7
                    }}
                >
                    Maybe later
                </button>
            </form>
        </div>
    );
}
