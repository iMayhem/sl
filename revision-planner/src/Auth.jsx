import { useState } from 'react';
import { supabase } from './supabaseClient';
import { User, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Auth({ onComplete }) {
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
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
            if (isSignUp) {
                // Check if username already exists in profiles
                const { data: existingUser } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('username', normalizedUsername)
                    .single();

                if (existingUser) {
                    throw new Error('This username is already taken. Please choose another one.');
                }

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
                        console.error("Could not save username to profile table", profileError);
                    }
                }

                setMessage('Account created! Welcome to Selection.');
                if (onComplete) onComplete();
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: fakeEmail,
                    password: dummyPassword,
                });
                if (error) throw error;
                if (onComplete) onComplete();
            }
        } catch (error) {
            if (error.message.toLowerCase().includes('rate limit')) {
                setErrorMsg('Supabase Rate Limit Reached! Turn off "Confirm email" and increase "Email signups limit" in Supabase -> Authentication -> Rate Limits.');
            } else if (error.message.toLowerCase().includes('invalid')) {
                setErrorMsg('Supabase rejected the username! Go to Supabase -> Authentication -> Providers -> Email, and make sure "Verify email domain (MX record)" is turned OFF.');
            } else {
                setErrorMsg(error.message || 'An error occurred during authentication.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card animate-fade-in">
                <h2 className="title-glow" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Selection</h2>
                <p className="subtitle" style={{ marginBottom: '2rem' }}>
                    {isSignUp ? 'Create an account to save your progress' : 'Welcome back! Log in to continue.'}
                </p>

                {message && <div className="auth-message success">{message}</div>}
                {errorMsg && <div className="auth-message error">{errorMsg}</div>}

                <form onSubmit={handleAuth} className="auth-form">
                    <div className="input-group">
                        <User className="input-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Your username"
                            value={username}
                            required
                            autoFocus
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <button
                        className="auth-button"
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                {isSignUp ? 'Sign Up' : 'Log In'} <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <button
                        type="button"
                        className="toggle-auth-btn"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setMessage('');
                            setErrorMsg('');
                            setUsername('');
                        }}
                    >
                        {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                    </button>
                </div>
            </div>
        </div>
    );
}
