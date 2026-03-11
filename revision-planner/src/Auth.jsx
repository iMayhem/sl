import { useState } from 'react';
import { supabase } from './supabaseClient';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setErrorMsg('');

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('Success! Check your email for a confirmation link (or you might be logged in automatically depending on Supabase settings).');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error) {
            setErrorMsg(error.message || 'An error occurred during authentication.');
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
                        <Mail className="input-icon" size={20} />
                        <input
                            type="email"
                            placeholder="Your email address"
                            value={email}
                            required
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <Lock className="input-icon" size={20} />
                        <input
                            type="password"
                            placeholder="Your password"
                            value={password}
                            required
                            minLength={6}
                            onChange={(e) => setPassword(e.target.value)}
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
                        }}
                    >
                        {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                    </button>
                </div>
            </div>
        </div>
    );
}
