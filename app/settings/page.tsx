'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Settings {
  emailOnRiskChange: boolean;
  emailOnDelivery: boolean;
  emailOnException: boolean;
  autoCheckInterval: string;
  riskSensitivity: string;
}

interface EtsyStatus {
  connected: boolean;
  shopName?: string;
  lastSyncAt?: string;
}

interface BillingStatus {
  planType: 'free' | 'pro';
  subscriptionStatus: string | null;
  monthlyOrderCount: number;
  limit: number | null;
}

// Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-white font-medium">{label}</p>
        {description && <p className="text-sm text-slate-400">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// Select Field Component
function SelectField({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="py-3">
      <label className="block">
        <p className="text-white font-medium mb-1">{label}</p>
        {description && <p className="text-sm text-slate-400 mb-2">{description}</p>}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2024%2024%22%20fill%3d%22none%22%20stroke%3d%22%2394a3b8%22%20stroke-width%3d%222%22%20stroke-linecap%3d%22round%22%20stroke-linejoin%3d%22round%22%3e%3cpolyline%20points%3d%226%209%2012%2015%2018%209%22%3e%3c%2fpolyline%3e%3c%2fsvg%3e')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10 cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default function SettingsPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { userId } = useAuth();

  const [settings, setSettings] = useState<Settings>({
    emailOnRiskChange: true,
    emailOnDelivery: false,
    emailOnException: true,
    autoCheckInterval: '6hours',
    riskSensitivity: 'medium',
  });
  const [originalSettings, setOriginalSettings] = useState<Settings | null>(null);
  const [etsyStatus, setEtsyStatus] = useState<EtsyStatus>({ connected: false });
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const hasChanges = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch Etsy status
      const etsyRes = await fetch(`${API_URL}/api/etsy/status`, {
        headers: { 'x-clerk-user-id': userId },
      });
      if (etsyRes.ok) {
        const etsyData = await etsyRes.json();
        setEtsyStatus(etsyData);
      }

      // Fetch billing status
      const billingRes = await fetch(`${API_URL}/api/billing/status`, {
        headers: { 'x-clerk-user-id': userId },
      });
      if (billingRes.ok) {
        const billingData = await billingRes.json();
        setBillingStatus(billingData);
      }

      // TODO: Fetch user settings from API when endpoint is available
      // For now, use default settings
      setOriginalSettings(settings);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!userId || !hasChanges) return;
    setSaving(true);
    try {
      // TODO: Save settings to backend when endpoint is available
      // const response = await fetch(`${API_URL}/api/settings`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json', 'x-clerk-user-id': userId },
      //   body: JSON.stringify(settings),
      // });

      // Simulate save for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setOriginalSettings(settings);
      setToast({ message: 'Settings saved successfully', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to save settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const disconnectEtsy = async () => {
    if (!userId) return;
    try {
      await fetch(`${API_URL}/api/etsy/disconnect`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId },
      });
      setEtsyStatus({ connected: false });
      setShowDisconnectConfirm(false);
      setToast({ message: 'Etsy shop disconnected', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to disconnect Etsy', type: 'error' });
    }
  };

  const connectEtsy = () => {
    window.location.href = `${API_URL}/api/etsy/auth?x-clerk-user-id=${userId}`;
  };

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!userLoaded || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
            </div>
            <UserButton afterSignOutUrl="/landing" />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notification Preferences */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notification Preferences
          </h3>
          <p className="text-slate-400 text-sm mb-4">Choose when you want to receive email notifications</p>
          <div className="divide-y divide-slate-700">
            <ToggleSwitch
              checked={settings.emailOnRiskChange}
              onChange={(v) => setSettings({ ...settings, emailOnRiskChange: v })}
              label="Risk level changes"
              description="Get notified when an order's risk changes to yellow or red"
            />
            <ToggleSwitch
              checked={settings.emailOnDelivery}
              onChange={(v) => setSettings({ ...settings, emailOnDelivery: v })}
              label="Delivery confirmations"
              description="Get notified when packages are marked as delivered"
            />
            <ToggleSwitch
              checked={settings.emailOnException}
              onChange={(v) => setSettings({ ...settings, emailOnException: v })}
              label="Tracking exceptions"
              description="Get notified when there's a tracking exception or delivery failure"
            />
          </div>
          {/* TODO: Add actual email sending logic in backend */}
        </div>

        {/* Tracking Preferences */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Tracking Preferences
          </h3>
          <div className="space-y-2">
            <SelectField
              label="Auto-check interval"
              description="How often to automatically check tracking status for active orders"
              value={settings.autoCheckInterval}
              onChange={(v) => setSettings({ ...settings, autoCheckInterval: v })}
              options={[
                { value: '6hours', label: 'Every 6 hours' },
                { value: '12hours', label: 'Every 12 hours' },
                { value: '24hours', label: 'Every 24 hours (default)' },
                { value: '48hours', label: 'Every 48 hours' },
              ]}
            />
            <SelectField
              label="Risk sensitivity"
              description="How aggressively to flag potential delivery issues"
              value={settings.riskSensitivity}
              onChange={(v) => setSettings({ ...settings, riskSensitivity: v })}
              options={[
                { value: 'low', label: 'Low - Only flag critical issues' },
                { value: 'medium', label: 'Medium - Balanced (default)' },
                { value: 'high', label: 'High - Flag any anomaly early' },
              ]}
            />
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Account
          </h3>
          <div className="divide-y divide-slate-700">
            <div className="flex justify-between py-3">
              <span className="text-slate-400">Email</span>
              <span className="text-white">{user?.primaryEmailAddress?.emailAddress || '-'}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-400">Plan</span>
              <span className={`font-bold ${billingStatus?.planType === 'pro' ? 'text-purple-400' : 'text-slate-300'}`}>
                {billingStatus?.planType === 'pro' ? 'Pro' : 'Free'}
                {billingStatus?.planType === 'free' && billingStatus?.limit && (
                  <span className="text-slate-500 font-normal ml-2">
                    ({billingStatus.monthlyOrderCount}/{billingStatus.limit} orders)
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-slate-400">Connected Etsy Shop</span>
              {etsyStatus.connected ? (
                <span className="text-emerald-400 font-medium">{etsyStatus.shopName}</span>
              ) : (
                <button
                  onClick={connectEtsy}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Connect Shop
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        {etsyStatus.connected && (
          <div className="bg-red-900/20 rounded-2xl p-6 border border-red-500/30 mb-6">
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Danger Zone
            </h3>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-medium">Disconnect Etsy Shop</p>
                <p className="text-sm text-slate-400">Remove the connection to your Etsy shop</p>
              </div>
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="px-4 py-2 bg-red-600/20 border border-red-500/50 text-red-400 rounded-xl font-bold hover:bg-red-600/30 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Save Button */}
        {hasChanges && (
          <div className="sticky bottom-4 flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fadeInUp flex items-center gap-3`}>
          <span className="font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="hover:opacity-70">✕</button>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowDisconnectConfirm(false)}
        >
          <div
            className="bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-red-500/20">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-black text-white text-center mb-3">Disconnect Etsy Shop?</h2>
            <p className="text-slate-400 text-center mb-8">
              Are you sure you want to disconnect your Etsy shop? You'll need to reconnect to sync orders again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={disconnectEtsy}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .animate-fadeInUp {
          animation: fadeInUp 0.3s ease-out forwards;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
