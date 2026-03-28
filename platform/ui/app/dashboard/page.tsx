"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface APIKey {
  key: string;
  keyId: string;
  name: string;
  env: string;
  createdAt: string;
  revoked: boolean;
}

interface UsageStats {
  authRequests: number;
  tokenMints: number;
  authQuota: number;
  tokenQuota: number;
  resetDate: string;
}

export default function DashboardPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"live" | "test">("test");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // TODO: Replace with actual API calls
      // Mock data for now
      setApiKeys([
        {
          key: "lelu_test_***************",
          keyId: "abc123",
          name: "Development Key",
          env: "test",
          createdAt: new Date().toISOString(),
          revoked: false,
        },
      ]);

      setUsage({
        authRequests: 1234,
        tokenMints: 56,
        authQuota: 10000,
        tokenQuota: 1000,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      // TODO: Replace with actual API call
      const mockKey = `lelu_${newKeyEnv}_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      setGeneratedKey(mockKey);
      
      // Reload keys
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to generate key:", error);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }

    try {
      // TODO: Replace with actual API call
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to revoke key:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Lelu Developer Dashboard</h1>
            <Link href="/docs" className="text-blue-600 hover:text-blue-700">
              Documentation →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Usage Stats */}
        {usage && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage This Month</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Authorization Requests</div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900">{usage.authRequests.toLocaleString()}</span>
                  <span className="ml-2 text-sm text-gray-500">/ {usage.authQuota.toLocaleString()}</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(usage.authRequests / usage.authQuota) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Token Mints</div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900">{usage.tokenMints.toLocaleString()}</span>
                  <span className="ml-2 text-sm text-gray-500">/ {usage.tokenQuota.toLocaleString()}</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${(usage.tokenMints / usage.tokenQuota) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Quota resets on {new Date(usage.resetDate).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* API Keys */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
            <button
              onClick={() => setShowNewKeyModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Generate New Key
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {apiKeys.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No API keys yet. Generate your first key to get started.
              </div>
            ) : (
              apiKeys.map((key) => (
                <div key={key.keyId} className="px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-gray-900">{key.key}</span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          key.env === "live" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {key.env}
                        </span>
                        {key.revoked && (
                          <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">{key.name}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {!key.revoked && (
                      <button
                        onClick={() => handleRevokeKey(key.keyId)}
                        className="ml-4 text-sm text-red-600 hover:text-red-700"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Start */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Start</h3>
          <p className="text-gray-700 mb-4">
            Use your API key to connect to the Lelu SaaS engine. No infrastructure setup required!
          </p>
          <div className="bg-white rounded border border-blue-200 p-4 font-mono text-sm">
            <div className="text-gray-600">// TypeScript</div>
            <div className="mt-2">
              <span className="text-purple-600">const</span> lelu = <span className="text-purple-600">new</span> LeluClient({"{"}
            </div>
            <div className="ml-4">
              apiKey: <span className="text-green-600">"lelu_live_your_key_here"</span>
            </div>
            <div>{"}"});</div>
          </div>
          <Link href="/docs/quickstart" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
            View full documentation →
          </Link>
        </div>
      </main>

      {/* New Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            {generatedKey ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">API Key Generated</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                  <p className="text-sm text-yellow-800 mb-2">
                    ⚠️ Save this key now. You won't be able to see it again!
                  </p>
                  <div className="font-mono text-sm bg-white p-3 rounded border border-yellow-300 break-all">
                    {generatedKey}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => copyToClipboard(generatedKey)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Copy Key
                  </button>
                  <button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setGeneratedKey(null);
                      setNewKeyName("");
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate New API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Key Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production Key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Environment
                    </label>
                    <select
                      value={newKeyEnv}
                      onChange={(e) => setNewKeyEnv(e.target.value as "live" | "test")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="test">Test</option>
                      <option value="live">Live</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleGenerateKey}
                    disabled={!newKeyName}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Generate
                  </button>
                  <button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setNewKeyName("");
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
