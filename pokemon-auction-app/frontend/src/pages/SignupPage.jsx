import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const COUNTRIES = [
  'Singapore', 'Malaysia', 'Indonesia', 'Thailand', 'Philippines',
  'Vietnam', 'Australia', 'United States', 'United Kingdom', 'Other',
];

function SignupPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Singapore',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!formData.address_line1 || !formData.city || !formData.postal_code || !formData.country) {
      setError('Address, city, postal code, and country are required');
      return;
    }

    setLoading(true);

    try {
      const { username, email, password, address_line1, address_line2, city, state, postal_code, country, phone } = formData;
      await signup(email, password, username, { address_line1, address_line2, city, state, postal_code, country, phone: phone || null });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50';
  const labelCls = 'block text-sm font-medium text-gray-300 mb-2';

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-16">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        <div className="text-center mb-10">
          <Link to="/" className="inline-block">
            <span className="text-3xl font-black bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              Vaultive Auctions
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4">Create an account</h1>
          <p className="text-gray-500 mt-2">Join the community and start bidding</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">

          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Account fields */}
            <div>
              <label htmlFor="username" className={labelCls}>Username</label>
              <input id="username" name="username" type="text" required disabled={loading}
                value={formData.username} onChange={handleChange}
                placeholder="cooltrainer99" className={inputCls} />
            </div>

            <div>
              <label htmlFor="email" className={labelCls}>Email address</label>
              <input id="email" name="email" type="email" required disabled={loading}
                value={formData.email} onChange={handleChange}
                placeholder="you@example.com" className={inputCls} />
            </div>

            <div>
              <label htmlFor="password" className={labelCls}>Password</label>
              <div className="relative">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'}
                  required disabled={loading} value={formData.password} onChange={handleChange}
                  placeholder="••••••••" className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelCls}>Confirm password</label>
              <div className="relative">
                <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                  required disabled={loading} value={formData.confirmPassword} onChange={handleChange}
                  placeholder="••••••••" className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Address section */}
            <div className="pt-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">
                Delivery / Pickup Address
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="address_line1" className={labelCls}>Address Line 1 *</label>
                  <input id="address_line1" name="address_line1" type="text" required disabled={loading}
                    value={formData.address_line1} onChange={handleChange}
                    placeholder="123 Orchard Road" className={inputCls} />
                </div>

                <div>
                  <label htmlFor="address_line2" className={labelCls}>Address Line 2 / Unit (optional)</label>
                  <input id="address_line2" name="address_line2" type="text" disabled={loading}
                    value={formData.address_line2} onChange={handleChange}
                    placeholder="#05-01" className={inputCls} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="city" className={labelCls}>City *</label>
                    <input id="city" name="city" type="text" required disabled={loading}
                      value={formData.city} onChange={handleChange}
                      placeholder="Singapore" className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="postal_code" className={labelCls}>Postal Code *</label>
                    <input id="postal_code" name="postal_code" type="text" required disabled={loading}
                      value={formData.postal_code} onChange={handleChange}
                      placeholder="238801" className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="state" className={labelCls}>State / Region (optional)</label>
                    <input id="state" name="state" type="text" disabled={loading}
                      value={formData.state} onChange={handleChange}
                      placeholder="—" className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="country" className={labelCls}>Country *</label>
                    <select id="country" name="country" required disabled={loading}
                      value={formData.country} onChange={handleChange}
                      className={inputCls}>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className={labelCls}>Phone number (optional)</label>
                  <input id="phone" name="phone" type="tel" disabled={loading}
                    value={formData.phone} onChange={handleChange}
                    placeholder="+65 9123 4567" className={inputCls} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/25 mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>

          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-gray-600 text-xs">OR</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <p className="text-center text-gray-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>

        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>

      </div>
    </div>
  );
}

export default SignupPage;
