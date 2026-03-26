import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import logo from '../assets/logo.png';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Psychiatrist',
        license: '',
        practiceName: '',
        agreeToTerms: false
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            // Check the exact structure expected by your backend register endpoint
            const userData = {
                full_name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role, // Ensure backend handles this
                practice_name: formData.practiceName,
                license_number: formData.license
            };

            const response = await authService.register(userData);

            // Assume the backend returns { user: {...}, token: '...' } upon registration
            login(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (err) {
            console.error('Registration failed:', err);
            setError(err.response?.data?.message || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-white flex overflow-hidden">
            {/* Left Side - Image/Banner (flipped for variety) */}
            <div className="hidden lg:block lg:w-1/2 relative bg-slate-900 order-2">
                <img
                    src="/auth-hero.png"
                    alt="Psychiatric Office"
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-16 text-white text-right">
                    <h2 className="text-4xl font-bold font-display mb-4 leading-tight">Join the Future of Mental Health Care</h2>
                    <p className="text-lg text-slate-300 max-w-lg ml-auto">
                        Connect with patients, streamline your practice, and access world-class clinical resources.
                    </p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 h-full overflow-y-auto bg-slate-50 order-1">
                <div className="min-h-full flex flex-col items-center justify-start px-8 sm:px-12 lg:px-16 pt-0">
                    <div className="w-full max-w-lg space-y-8">
                        <div className="text-left">
                            <div className="mb-2 -mt-18">
                                <img src={logo} alt="DynaCare Logo" className="w-80 h-auto object-contain mix-blend-multiply" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 font-display">Create Account</h2>
                            <p className="mt-2 text-slate-600">Start your 30-day free trial. No credit card required.</p>
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
                            {/* Name & Role */}
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Full Name</label>
                                    <input
                                        name="name"
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-secondary-500 focus:ring-4 focus:ring-secondary-50 outline-none transition-all"
                                        placeholder="Dr. John Doe"
                                        value={formData.name}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Role</label>
                                    <select
                                        name="role"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-secondary-500 focus:ring-4 focus:ring-secondary-50 outline-none transition-all appearance-none"
                                        value={formData.role}
                                        onChange={handleChange}
                                    >
                                        <option>Psychiatrist</option>
                                        <option>Psychologist</option>
                                        <option>Therapist</option>
                                        <option>Counselor</option>
                                        <option>Social Worker</option>
                                    </select>
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="text-sm font-semibold text-slate-700 block mb-2">Professional Email</label>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-secondary-500 focus:ring-4 focus:ring-secondary-50 outline-none transition-all"
                                    placeholder="name@practice.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Practice Info */}
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Practice Name</label>
                                    <input
                                        name="practiceName"
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-secondary-500 focus:ring-4 focus:ring-secondary-50 outline-none transition-all"
                                        placeholder="City Wellness Center"
                                        value={formData.practiceName}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">License Number</label>
                                    <input
                                        name="license"
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-secondary-500 focus:ring-4 focus:ring-secondary-50 outline-none transition-all"
                                        placeholder="LIC-123456"
                                        value={formData.license}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Password</label>
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-secondary-500 focus:ring-4 focus:ring-secondary-50 outline-none transition-all"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Confirm Password</label>
                                    <input
                                        name="confirmPassword"
                                        type="password"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-secondary-500 focus:ring-4 focus:ring-secondary-50 outline-none transition-all"
                                        placeholder="••••••••"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <label className="flex items-start space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="agreeToTerms"
                                    required
                                    checked={formData.agreeToTerms}
                                    onChange={handleChange}
                                    className="w-5 h-5 mt-0.5 rounded border-slate-300 text-secondary-600 focus:ring-secondary-500"
                                />
                                <span className="text-sm text-slate-600">
                                    I agree to the <a href="#" className="font-bold text-slate-800 hover:underline">Terms of Service</a> and <a href="#" className="font-bold text-slate-800 hover:underline">Privacy Policy</a>
                                </span>
                            </label>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-secondary-600 to-secondary-700 hover:from-secondary-700 hover:to-secondary-800 text-white font-bold rounded-xl shadow-lg shadow-secondary-200 focus:ring-4 focus:ring-secondary-100 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    "Create Account"
                                )}
                            </button>
                        </form>

                        <p className="text-center text-sm text-slate-600">
                            Already have an account?{' '}
                            <Link to="/login" className="font-bold text-secondary-600 hover:text-secondary-700 transition-colors">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
