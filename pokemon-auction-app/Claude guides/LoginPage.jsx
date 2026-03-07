import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ============================================================
// HOW THIS FILE WORKS (React Explanation for Beginners)
// ============================================================
//
// This is the Login Page component. Here's what each part does:
//
// IMPORTS (top of file):
//   - React, { useState } → Core React library + useState hook
//   - useNavigate → Lets us redirect user to another page
//   - Link → Creates clickable links that don't reload the page
//   - useAuth → Gets login function from our AuthContext
//
// THE COMPONENT FUNCTION:
//   LoginPage() is just a regular JavaScript function.
//   React calls this function to figure out what to show on screen.
//   Everything inside return() is what the user sees.
//
// STATE (useState):
//   Think of state as variables that React "watches".
//   When a state variable changes, React updates the screen.
//
//   const [email, setEmail] = useState('');
//   │              │                   └── Starting value (empty string)
//   │              └── Function to UPDATE the value
//   └── Current value of email
//
// JSX (the HTML-looking code):
//   JSX is JavaScript + HTML mixed together.
//   Rules:
//   - Use className instead of class
//   - Use onClick instead of onclick
//   - Put JavaScript inside {curly braces}
//   - Every tag must be closed: <input /> or <div></div>
// ============================================================

function LoginPage() {

  // ── STATE ─────────────────────────────────────────────
  // These variables track what the user types in the form.
  // When user types, we call the setter (setEmail, setPassword)
  // which updates the variable and re-renders the component.

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');       // Error message to show user
  const [loading, setLoading] = useState(false); // Disable button while logging in
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility

  // ── HOOKS ─────────────────────────────────────────────
  // Hooks are special React functions that start with "use".
  // They let us use React features inside our component.

  const { login } = useAuth();
  // useAuth() returns an object with login, logout, user, etc.
  // { login } = "destructuring" = grab just the login function

  const navigate = useNavigate();
  // navigate('/path') sends user to a different page

  // ── EVENT HANDLER ──────────────────────────────────────
  // This function runs when user clicks the "Login" button.
  // async/await = handles operations that take time (like API calls)

  const handleLogin = async (e) => {
    e.preventDefault();
    // e.preventDefault() stops the browser from refreshing the page
    // (default form behaviour). We handle it ourselves instead.

    setError('');       // Clear any previous error
    setLoading(true);   // Disable button, show loading state

    try {
      // Call the login function from AuthContext
      // This sends email + password to our backend API
      await login(email, password);

      // If login succeeds, redirect to homepage
      navigate('/');

    } catch (err) {
      // If login fails, show the error message
      // err.response?.data?.message = safely get the error message
      // The ?. is "optional chaining" - won't crash if value is undefined
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      // Always runs whether login succeeded or failed
      setLoading(false); // Re-enable the button
    }
  };

  // ── RENDER ─────────────────────────────────────────────
  // This is what gets shown on screen.
  // return() can only return ONE parent element (the outer div).

  return (
    // Outer container - full height, dark background, centered content
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-16">

      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Login card - the white box in the center */}
      <div className="relative w-full max-w-md">

        {/* Logo / branding at top */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-block">
            <span className="text-3xl font-black bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              PokéAuctions
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4">Welcome back</h1>
          <p className="text-gray-500 mt-2">Sign in to continue bidding</p>
        </div>

        {/* The form card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">

          {/* Error message - only shows if error state is not empty */}
          {/* {error && <div>} means: IF error exists, THEN show this div */}
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* THE FORM */}
          {/* onSubmit={handleLogin} = call handleLogin when form submitted */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* ── EMAIL FIELD ── */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email address
              </label>
              {/* htmlFor="email" links this label to the input with id="email" */}
              <input
                id="email"
                type="email"
                required
                disabled={loading}
                // value={email} = controlled input - React controls the value
                // onChange = called every time user types a character
                // e.target.value = what's currently in the input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
              />
            </div>

            {/* ── PASSWORD FIELD ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300"
                >
                  Password
                </label>
                {/* Forgot password link */}
                <Link
                  to="/forgot-password"
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Password input with show/hide toggle */}
              <div className="relative">
                {/* type changes between "password" and "text" based on state */}
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 pr-12 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                />

                {/* Toggle password visibility button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {/* Show different icon based on showPassword state */}
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* ── SUBMIT BUTTON ── */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/25 mt-2"
            >
              {/* Show different text based on loading state */}
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>

          </form>

          {/* Divider between form and sign up link */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-gray-600 text-xs">OR</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Sign up link */}
          <p className="text-center text-gray-500 text-sm">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
            >
              Create one free
            </Link>
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-gray-700 text-xs mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
