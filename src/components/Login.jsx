import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import logo from '../assets/logo.png';

const Login = () => {
    const [credentials, setCredentials] = useState({
        email: '',
        password: '',
        rememberMe: false
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCredentials(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authService.login(credentials.email, credentials.password);

            // Assume the backend returns { user: {...}, token: '...' }
            // Adjust according to your actual backend response structure
            login(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (err) {
            console.error('Login failed:', err);
            setError(err.response?.data?.message || 'Failed to login. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-white flex overflow-hidden">
            {/* Left Side - Form */}
            <div className="flex-1 h-full overflow-y-auto bg-slate-50">
                <div className="min-h-full flex flex-col items-center justify-start px-8 sm:px-12 lg:px-16 pt-0">
                    <div className="w-full max-w-md space-y-8">
                        <div className="text-left">
                            <div className="flex justify-center mb-2 mt-10">
                                <img src={logo} alt="DynaCare Logo" className="w-64 h-auto object-contain mix-blend-multiply" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 font-display">Welcome back</h2>
                            <p className="mt-2 text-slate-600">Please enter your details to sign in.</p>
                        </div>

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium flex items-center space-x-2">
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            )}
                            <div className="space-y-5">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Email Address</label>
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-50 outline-none transition-all"
                                        placeholder="doctor@medly.com"
                                        value={credentials.email}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Password</label>
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-50 outline-none transition-all"
                                        placeholder="••••••••"
                                        value={credentials.password}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="rememberMe"
                                        checked={credentials.rememberMe}
                                        onChange={handleChange}
                                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-slate-600 font-medium">Remember me</span>
                                </label>
                                <a href="#" className="text-sm font-bold text-primary-600 hover:text-primary-700 hover:underline">
                                    Forgot password?
                                </a>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold rounded-xl shadow-lg shadow-primary-200 focus:ring-4 focus:ring-primary-100 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    "Sign In"
                                )}
                            </button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-slate-50 text-slate-500 font-medium">Or continue with</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button className="flex items-center justify-center px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all bg-white">
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="h-5 w-5 mr-2" alt="Google" />
                                <span className="text-sm font-semibold text-slate-700">Google</span>
                            </button>
                            <button className="flex items-center justify-center px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all bg-white">
                                <img src="https://www.svgrepo.com/show/448234/microsoft.svg" className="h-5 w-5 mr-2" alt="Microsoft" />
                                <span className="text-sm font-semibold text-slate-700">Microsoft</span>
                            </button>
                        </div>

                        <p className="text-center text-sm text-slate-600">
                            Don't have an account?{' '}
                            <Link to="/signup" className="font-bold text-primary-600 hover:text-primary-700 transition-colors">
                                Sign up for free
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Right Side - Image/Banner */}
                <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-slate-900">
                    <img
                        src="/auth-hero.png"
                        alt="Psychiatric Office"
                        className="absolute inset-0 w-full h-full object-cover opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-16 text-white">
                        <div className="mb-6 inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                            <svg className="w-6 h-6 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-4xl font-bold font-display mb-4 leading-tight">Empowering Mental Healthcare Professionals</h2>
                        <p className="text-lg text-slate-300 max-w-lg">
                            Manage appointments, track patient progress, and access clinical tools all in one secure, HIPAA-compliant platform.
                        </p>

                        <div className="flex items-center space-x-4 mt-8">
                            <div className="flex -space-x-3">
                                <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700 overflow-hidden">
                                    <img src="https://i.pravatar.cc/100?img=1" alt="User" />
                                </div>
                                <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700 overflow-hidden">
                                    <img src="https://i.pravatar.cc/100?img=5" alt="User" />
                                </div>
                                <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700 overflow-hidden">
                                    <img src="https://i.pravatar.cc/100?img=8" alt="User" />
                                </div>
                            </div>
                            <div className="text-sm font-medium text-slate-300">
                                Trusted by 5,000+ professionals
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
