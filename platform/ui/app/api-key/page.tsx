"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function BetaPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{
    requests: number;
    dailyLimit: number;
    minuteLimit: number;
    requestsThisMinute: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Check localStorage for existing key
    const savedKey = localStorage.getItem("lelu_beta_key");
    if (savedKey) {
      setApiKey(savedKey);
      loadUsageStats(savedKey);
    }
  }, []);

  const generateKey = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/beta/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to generate key");
        return;
      }

      const data = await response.json();
      setApiKey(data.apiKey);
      
      // Save to localStorage
      localStorage.setItem("lelu_beta_key", data.apiKey);
      
      // Load usage stats
      await loadUsageStats(data.apiKey);
    } catch (error) {
      console.error("Failed to generate key:", error);
      alert("Failed to generate key. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async (key: string) => {
    try {
      const response = await fetch(`/api/beta/usage?key=${encodeURIComponent(key)}`);
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (error) {
      console.error("Failed to load usage stats:", error);
    }
  };

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const deleteKey = () => {
    if (confirm("Are you sure you want to delete your beta key? This cannot be undone.")) {
      localStorage.removeItem("lelu_beta_key");
      setApiKey(null);
      setUsage(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              Lelu
            </Link>
            <div className="flex gap-4">
              <Link href="/docs" className="text-gray-600 hover:text-gray-900">
                Docs
              </Link>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            🚀 Beta Access
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Try Lelu Instantly
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            No signup required. Generate an anonymous API key and start building AI agent authorization in seconds.
          </p>
        </div>

        {!apiKey ? (
          /* Generate Key Section */
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Get Your Free Beta Key
              </h2>
              <p className="text-gray-600">
                Zero registration. Zero friction. Just click and code.
              </p>
            </div>

            <button
              onClick={generateKey}
              disabled={loading}
              className="w-full max-w-md mx-auto block px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "Generating..." : "Generate Anonymous Key"}
            </button>

            {/* Cold Start Warning */}
            <div className="mt-6 max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-xl">⚡</div>
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-amber-900 mb-1">
                    First Request May Take 30-60 Seconds
                  </div>
                  <div className="text-amber-800">
                    The engine warms up on first use. Subsequent requests are instant (&lt;100ms).
                  </div>
                </div>
              </div>
            </div>

            {/* Discord Support Link */}
            <div className="mt-4 max-w-md mx-auto bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-purple-900 mb-1">
                    Need Help? Join Our Discord
                  </div>
                  <div className="text-purple-800 mb-2">
                    Get real-time support from the community and team
                  </div>
                  <a 
                    href="https://discord.gg/lelu" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium"
                  >
                    discord.gg/lelu
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 grid md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl mb-2">⚡</div>
                <div className="font-semibold text-gray-900">Instant Access</div>
                <div className="text-sm text-gray-600">No email required</div>
              </div>
              <div>
                <div className="text-3xl mb-2">🔒</div>
                <div className="font-semibold text-gray-900">Privacy First</div>
                <div className="text-sm text-gray-600">Completely anonymous</div>
              </div>
              <div>
                <div className="text-3xl mb-2">🎯</div>
                <div className="font-semibold text-gray-900">500 Requests/Day</div>
                <div className="text-sm text-gray-600">Perfect for testing</div>
              </div>
            </div>
          </div>
        ) : (
          /* Key Display Section */
          <>
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Beta Key</h2>
                  <p className="text-gray-600">Save this key - you won't see it again!</p>
                </div>
                <button
                  onClick={deleteKey}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete Key
                </button>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-900 mb-1">
                      Save This Key Now
                    </div>
                    <div className="text-sm text-yellow-800">
                      This key is stored only in your browser. Copy it to your .env file before closing this page.
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <code className="text-green-400 font-mono text-sm break-all flex-1">
                    {apiKey}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {usage && (
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 mb-1">Requests Today</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {usage.requests} / {usage.dailyLimit}
                    </div>
                    <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${(usage.requests / usage.dailyLimit) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-purple-600 mb-1">This Minute</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {usage.requestsThisMinute} / {usage.minuteLimit}
                    </div>
                    <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${(usage.requestsThisMinute / usage.minuteLimit) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Start */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Start</h3>
              
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">1. Install the SDK</div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <code className="text-green-400 font-mono text-sm">
                      npm install @lelu/sdk
                    </code>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">2. Add to your .env</div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <code className="text-green-400 font-mono text-sm">
                      LELU_API_KEY={apiKey}
                    </code>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">3. Use in your code</div>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 font-mono text-sm">
{`import { LeluClient } from "@lelu/sdk";

const lelu = new LeluClient({
  apiKey: process.env.LELU_API_KEY
});

const decision = await lelu.agentAuthorize({
  actor: "invoice_bot",
  action: "approve_refunds",
  resource: { amount: "500" },
  context: { confidence: 0.92 }
});

if (!decision.allowed) {
  console.log("Denied:", decision.reason);
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <Link
                  href="/docs/quickstart"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg text-center font-semibold hover:bg-blue-700 transition-colors"
                >
                  Full Documentation
                </Link>
                <Link
                  href="/docs/examples"
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg text-center font-semibold hover:bg-gray-300 transition-colors"
                >
                  View Examples
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Features */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Beta Limits</h3>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>500 authorization requests per day</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>10 requests per minute</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>50 token mints per day</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>30-day key expiration (with activity)</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Need More?</h3>
            <p className="text-gray-600 mb-4">
              Create a registered account for higher limits and advanced features:
            </p>
            <ul className="space-y-2 text-gray-600 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">→</span>
                <span>10,000 requests per month</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">→</span>
                <span>Persistent data storage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">→</span>
                <span>Team collaboration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">→</span>
                <span>Priority support</span>
              </li>
            </ul>
            <Link
              href="/dashboard"
              className="block w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-center font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h3>
          <div className="space-y-6">
            <div>
              <div className="font-semibold text-gray-900 mb-2">Do I need to create an account?</div>
              <div className="text-gray-600">
                No! During beta, you can use anonymous keys without any registration. Perfect for testing and evaluation.
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">How long does my key last?</div>
              <div className="text-gray-600">
                30 days from last use. As long as you keep using it, it won't expire.
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">What happens when I hit the limit?</div>
              <div className="text-gray-600">
                You'll receive a 429 error. Limits reset daily at midnight UTC. For higher limits, create a registered account.
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">Is my data safe?</div>
              <div className="text-gray-600">
                We don't collect personal information with anonymous keys. Your key is stored only in your browser's localStorage.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p>© 2024 Lelu. Open source under MIT License.</p>
            <div className="mt-2 flex justify-center gap-6">
              <Link href="/docs" className="hover:text-gray-900">Documentation</Link>
              <Link href="https://github.com/lelu-ai/lelu" className="hover:text-gray-900">GitHub</Link>
              <Link href="/about" className="hover:text-gray-900">About</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
