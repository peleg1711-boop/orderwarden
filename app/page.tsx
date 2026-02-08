'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { UserButton, useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { NotificationBell } from '../components/NotificationBell';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Order {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string | null;
  lastStatus: string | null;
  lastUpdateAt: string | null;
  riskLevel: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BillingStatus {
  planType: 'free' | 'pro';
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  subscriptionEndsAt: string | null;
  monthlyOrderCount: number;
  limit: number | null;
  canCreateOrder: boolean;
}

interface ImpactSummary {
  trackingChecks: number;
  riskFlagged: number;
  riskResolved: number;
  deliveredAfterRisk: number;
  estimatedRefundsAvoided: number;
  rangeDays: number;
  generatedAt: string;
}

interface TrackingEvent {
  timestamp: string;
  location: string | null;
  description: string;
}

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  
  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fadeInUp flex items-center gap-3`}>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="hover:opacity-70">✕</button>
    </div>
  );
}

function DeliveryRiskOverview({ orders, onOrderClick }: { orders: Order[]; onOrderClick?: (orderId: string) => void }) {
  const healthyCount = orders.filter(o => o.riskLevel === 'green').length;
  const attentionCount = orders.filter(o => o.riskLevel === 'yellow').length;
  const highRiskCount = orders.filter(o => o.riskLevel === 'red').length;
  const total = orders.length || 1;

  const atRiskOrders = orders
    .filter(o => o.riskLevel === 'yellow' || o.riskLevel === 'red')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const ProgressBar = ({ label, count, total, color }: { label: string, count: number, total: number, color: string }) => (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-bold text-slate-300">{label}</span>
        <span className="text-sm font-bold text-white">{count}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${(count / total) * 100}%` }}></div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-800/50 rounded-2xl shadow-xl p-6 border-2 border-slate-700 backdrop-blur-sm h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">Delivery Risk Overview</h3>
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
      </div>
      <div className="space-y-4 mb-6">
        <ProgressBar label="Healthy" count={healthyCount} total={total} color="bg-gradient-to-r from-emerald-500 to-green-600" />
        <ProgressBar label="Needs attention" count={attentionCount} total={total} color="bg-gradient-to-r from-amber-500 to-yellow-600" />
        <ProgressBar label="High risk" count={highRiskCount} total={total} color="bg-gradient-to-r from-red-500 to-rose-600" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-300 mb-3">Recent At-Risk Orders</h4>
        <div className="space-y-3">
          {atRiskOrders.length > 0 ? atRiskOrders.map(order => (
            <div key={order.id}
              onClick={() => onOrderClick?.(order.id)}
              className="flex items-center p-2 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer">
              <span className={`h-3 w-3 rounded-full mr-3 ${order.riskLevel === 'red' ? 'bg-red-500' : 'bg-amber-400'}`}></span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{order.orderId}</p>
                <p className="text-xs text-slate-400">{order.lastStatus || 'Unknown'}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${order.riskLevel === 'red' ? 'text-red-400 bg-red-500/20' : 'text-amber-300 bg-amber-500/20'}`}>
                {order.riskLevel === 'red' ? 'Urgent' : 'Follow up'}
              </span>
            </div>
          )) : (
            <p className="text-sm text-slate-400">No at-risk orders right now. Great job!</p>
          )}
        </div>
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { userId } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      window.location.href = 'https://landing.orderwarden.com';
    }
  }, [isLoaded, isSignedIn]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  
  // Etsy connection state
  const [etsyStatus, setEtsyStatus] = useState<{
    connected: boolean;
    shopName?: string;
    lastSyncAt?: string;
    syncing?: boolean;
  }>({ connected: false });

  // Billing/subscription state
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showProWelcome, setShowProWelcome] = useState(false);
  const [impactSummary, setImpactSummary] = useState<ImpactSummary | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Bulk check tracking state
  const [bulkCheckLoading, setBulkCheckLoading] = useState(false);

  // Per-order check tracking loading state
  const [checkingOrderIds, setCheckingOrderIds] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ORDERS_PER_PAGE = 20;

  // Dashboard date range state
  const [dashboardRange, setDashboardRange] = useState<'today' | '7days' | '30days' | 'all'>('all');

  // Dashboard filtered orders for stat cards
  const dashboardOrders = useMemo(() => {
    if (dashboardRange === 'all') return orders;
    const now = new Date();
    const cutoffs: Record<string, Date> = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      '7days': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30days': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    };
    return orders.filter(o => new Date(o.createdAt) >= cutoffs[dashboardRange]);
  }, [orders, dashboardRange]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.orderId.toLowerCase().includes(query) ||
        o.trackingNumber.toLowerCase().includes(query) ||
        (o.carrier && o.carrier.toLowerCase().includes(query))
      );
    }
    
    // Risk filter
    if (riskFilter !== 'all') {
      result = result.filter(o => o.riskLevel === riskFilter);
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.lastStatus === statusFilter);
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (dateFilter) {
        case '7days': cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30days': cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case '90days': cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
        default: cutoff = new Date(0);
      }
      result = result.filter(o => new Date(o.createdAt) >= cutoff);
    }

    
    // Sorting
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'orderId': aVal = a.orderId; bVal = b.orderId; break;
        case 'trackingNumber': aVal = a.trackingNumber; bVal = b.trackingNumber; break;
        case 'lastStatus': aVal = a.lastStatus || ''; bVal = b.lastStatus || ''; break;
        case 'riskLevel': 
          const riskOrder = { red: 3, yellow: 2, green: 1 };
          aVal = riskOrder[a.riskLevel as keyof typeof riskOrder] || 0;
          bVal = riskOrder[b.riskLevel as keyof typeof riskOrder] || 0;
          break;
        case 'lastUpdateAt': 
          aVal = a.lastUpdateAt ? new Date(a.lastUpdateAt).getTime() : 0;
          bVal = b.lastUpdateAt ? new Date(b.lastUpdateAt).getTime() : 0;
          break;
        default: 
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return result;
  }, [orders, searchQuery, riskFilter, statusFilter, dateFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, riskFilter, statusFilter, dateFilter]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === paginatedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(paginatedOrders.map(o => o.id)));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({ message: 'Tracking number copied!', type: 'success' });
  };


  useEffect(() => {
    if (userId) {
      fetchOrders();
      fetchEtsyStatus();
      fetchBillingStatus();
      fetchImpactSummary();

      const params = new URLSearchParams(window.location.search);
      if (params.get('etsy_connected') === 'true') {
        const shopName = params.get('shop');
        setToast({ message: `Connected to Etsy shop: ${shopName}`, type: 'success' });
        window.history.replaceState({}, '', window.location.pathname);
        fetchEtsyStatus();
      } else if (params.get('etsy_error')) {
        setToast({ message: `Etsy connection failed: ${params.get('etsy_error')}`, type: 'error' });
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Check for Pro upgrade success from LemonSqueezy redirect
      if (params.get('upgraded') === 'true' || params.get('checkout_success') === 'true') {
        setShowProWelcome(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [userId]);

  const fetchOrders = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/orders`, {
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      setOrders(data.orders || []);
      setError(null);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };


  const fetchEtsyStatus = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/etsy/status`, {
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      setEtsyStatus({ ...data, syncing: false });
    } catch (err) {
      console.error('Failed to fetch Etsy status:', err);
    }
  };

  const fetchBillingStatus = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/billing/status`, {
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      setBillingStatus(data);
    } catch (err) {
      console.error('Failed to fetch billing status:', err);
    }
  };

  const fetchImpactSummary = async () => {
    if (!userId) return;
    try {
      setImpactLoading(true);
      setImpactError(null);

      // Calculate days since start of current calendar month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysSinceMonthStart = Math.ceil((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) || 1;

      const response = await fetch(`${API_URL}/api/metrics/summary?range=${daysSinceMonthStart}d`, {
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load impact summary');
      }
      setImpactSummary(data);
    } catch (err) {
      console.error('Failed to fetch impact summary:', err);
      setImpactError('Failed to load impact summary');
    } finally {
      setImpactLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!userId) return;
    setUpgrading(true);
    try {
      const response = await fetch(`/api/billing/create-checkout`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setToast({ message: 'Failed to start upgrade', type: 'error' });
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/billing/portal`, {
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank');
      }
    } catch (err) {
      setToast({ message: 'Failed to open subscription portal', type: 'error' });
    }
  };

  const connectEtsy = () => {
    if (!userId) return;
    window.location.href = `${API_URL}/api/etsy/auth?x-clerk-user-id=${userId}`;
  };

  const syncEtsy = async () => {
    if (!userId) return;
    setEtsyStatus(prev => ({ ...prev, syncing: true }));
    try {
      const response = await fetch(`${API_URL}/api/etsy/sync`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      if (data.success) {
        setToast({ message: `Synced! ${data.imported} new orders imported`, type: 'success' });
        fetchOrders();
        fetchEtsyStatus();
      } else {
        setToast({ message: `Sync failed: ${data.error}`, type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to sync orders', type: 'error' });
    } finally {
      setEtsyStatus(prev => ({ ...prev, syncing: false }));
    }
  };


  const disconnectEtsy = async () => {
    if (!userId) return;
    if (!confirm('Are you sure you want to disconnect your Etsy shop?')) return;
    try {
      await fetch(`${API_URL}/api/etsy/disconnect`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId }
      });
      setEtsyStatus({ connected: false });
      setToast({ message: 'Etsy disconnected', type: 'info' });
    } catch (err) {
      setToast({ message: 'Failed to disconnect', type: 'error' });
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'x-clerk-user-id': userId }
      });
      if (response.ok) {
        setOrders(orders.filter(order => order.id !== orderId));
        setSelectedOrders(prev => { const n = new Set(prev); n.delete(orderId); return n; });
        setToast({ message: 'Order deleted', type: 'success' });
      } else {
        setToast({ message: 'Failed to delete order', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to delete order', type: 'error' });
    }
  };

  const initiateDeleteOrder = (orderId: string) => {
    setConfirmDialog({
      title: 'Delete Order?',
      message: 'Are you sure you want to delete this order? This action cannot be undone.',
      onConfirm: () => {
        setConfirmDialog(null);
        deleteOrder(orderId);
      }
    });
  };

  const deleteSelectedOrders = async () => {
    if (!userId || selectedOrders.size === 0) return;

    let deleted = 0;
    for (const orderId of selectedOrders) {
      try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
          method: 'DELETE',
          headers: { 'x-clerk-user-id': userId }
        });
        if (response.ok) deleted++;
      } catch (err) {}
    }

    setOrders(orders.filter(o => !selectedOrders.has(o.id)));
    setSelectedOrders(new Set());
    setToast({ message: `Deleted ${deleted} orders`, type: 'success' });
  };

  const initiateDeleteSelected = () => {
    if (selectedOrders.size === 0) return;
    setConfirmDialog({
      title: `Delete ${selectedOrders.size} Orders?`,
      message: `Are you sure you want to delete ${selectedOrders.size} selected orders? This action cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog(null);
        deleteSelectedOrders();
      }
    });
  };

  const checkTracking = async (orderId: string) => {
    if (!userId) return;
    setCheckingOrderIds(prev => new Set(prev).add(orderId));
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/check`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check tracking');
      }

      setOrders(orders.map(order => order.id === orderId ? data.order : order));
      setToast({ message: 'Tracking updated', type: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to check tracking', type: 'error' });
    } finally {
      setCheckingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const checkSelectedTracking = async () => {
    if (!userId || selectedOrders.size === 0) return;
    setBulkCheckLoading(true);
    let checked = 0;
    let failed = 0;

    const orderIds = Array.from(selectedOrders);
    const results = await Promise.allSettled(
      orderIds.map(orderId =>
        fetch(`${API_URL}/api/orders/${orderId}/check`, {
          method: 'POST',
          headers: { 'x-clerk-user-id': userId }
        }).then(res => res.json())
      )
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.order) {
        checked++;
        setOrders(prev => prev.map(o => o.id === orderIds[index] ? result.value.order : o));
      } else {
        failed++;
      }
    });

    setBulkCheckLoading(false);
    setSelectedOrders(new Set());
    setToast({
      message: failed > 0 ? `Updated ${checked} orders. ${failed} failed.` : `Updated tracking for ${checked} orders`,
      type: failed > 0 ? 'info' : 'success'
    });
  };

  // CSV Export function
  const exportToCSV = () => {
    const headers = ['Order Name', 'Tracking Number', 'Carrier', 'Status', 'Risk Level', 'Last Update'];
    const rows = filteredOrders.map(o => [
      o.orderId,
      o.trackingNumber,
      o.carrier || '',
      o.lastStatus || '',
      getRiskLabel(o.riskLevel),
      o.lastUpdateAt ? new Date(o.lastUpdateAt).toISOString() : ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orderwarden-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({ message: `Exported ${filteredOrders.length} orders`, type: 'success' });
  };

  // Scroll to order row and highlight it
  const handleScrollToOrder = (orderId: string) => {
    const row = document.querySelector(`[data-order-id="${orderId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('highlight-pulse');
      setTimeout(() => row.classList.remove('highlight-pulse'), 2000);
    }
  };

  const getRiskColor = (riskLevel: string | null | undefined): string => {
    if (!riskLevel) return 'bg-gray-700 text-gray-300';
    switch (riskLevel.toLowerCase()) {
      case 'green': return 'bg-emerald-500 text-white';
      case 'yellow': return 'bg-amber-400 text-gray-900';
      case 'red': return 'bg-red-500 text-white';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  const getRiskLabel = (riskLevel: string | null | undefined): string => {
    if (!riskLevel) return 'Unknown';
    switch (riskLevel.toLowerCase()) {
      case 'green': return 'Healthy';
      case 'yellow': return 'Needs Attention';
      case 'red': return 'High Risk';
      default: return 'Unknown';
    }
  };

  const getStatusBadge = (status: string | null) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'pre_transit': { label: 'Pre-Transit', color: 'bg-blue-500 text-white' },
      'in_transit': { label: 'In Transit', color: 'bg-blue-500 text-white' },
      'out_for_delivery': { label: 'Out for Delivery', color: 'bg-emerald-500 text-white' },
      'delivered': { label: 'Delivered', color: 'bg-emerald-500 text-white' },
      'exception': { label: 'Exception', color: 'bg-red-500 text-white' },
      'delivery_failed': { label: 'Failed', color: 'bg-red-500 text-white' },
      'unknown': { label: 'Unknown', color: 'bg-gray-500 text-white' }
    };
    const info = statusMap[status || 'unknown'] || statusMap['unknown'];
    return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${info.color}`}>{info.label}</span>;
  };

  const SortHeader = ({ field, children, center = false }: { field: string; children: React.ReactNode; center?: boolean }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none ${center ? 'text-center' : 'text-left'}`}
    >
      <div className={`flex items-center gap-1 ${center ? 'justify-center' : ''}`}>
        {children}
        {sortField === field && (
          <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  // Carrier tracking URL helper
  const getCarrierTrackingUrl = (carrier: string, trackingNumber: string): string => {
    const urls: Record<string, string> = {
      usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
      fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    };
    return urls[carrier.toLowerCase()] || `https://www.google.com/search?q=${carrier}+tracking+${trackingNumber}`;
  };

  // Order Details Modal Component
  const OrderDetailsModal = ({ order, onClose, userId }: { order: Order; onClose: () => void; userId: string }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [trackingData, setTrackingData] = useState<{
      status: string;
      location: string | null;
      events: TrackingEvent[];
    } | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Fetch tracking details on mount
    useEffect(() => {
      fetchTrackingDetails();
      return () => {
        abortRef.current?.abort();
      };
    }, []);

    const fetchTrackingDetails = async () => {
      if (!userId) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/orders/${order.id}/check`, {
          method: 'POST',
          headers: { 'x-clerk-user-id': userId },
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('Failed to fetch tracking');
        }
        const data = await response.json();
        if (!data?.tracking) {
          throw new Error('Tracking data unavailable');
        }
        setTrackingData(data.tracking);
        // Update the orders list with the new data
        setOrders(prev => prev.map(o => o.id === order.id ? data.order : o));
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Tracking request timed out. Please try again.');
        } else {
          console.error('Failed to fetch tracking:', err);
          setError('Failed to load tracking history. Please try again.');
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
           onClick={onClose}>
        <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-8 border border-slate-700 max-h-[90vh] overflow-y-auto"
             onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-black text-white">Order {order.orderId}</h2>
              <p className="text-slate-400">{order.carrier || 'Unknown carrier'}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Order Info Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-700/50 rounded-xl p-4">
              <p className="text-slate-400 text-sm mb-1">Tracking Number</p>
              <div className="flex items-center gap-2">
                <p className="text-white font-mono text-sm break-all">{order.trackingNumber}</p>
                <button onClick={() => copyToClipboard(order.trackingNumber)}
                  className="p-1 hover:bg-slate-600 rounded transition-colors flex-shrink-0" title="Copy tracking number">
                  <svg className="w-4 h-4 text-slate-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <p className="text-slate-400 text-sm mb-1">Status</p>
              <div className="mt-1">{getStatusBadge(order.lastStatus)}</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <p className="text-slate-400 text-sm mb-1">Risk Level</p>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-black uppercase ${getRiskColor(order.riskLevel)}`}>
                {getRiskLabel(order.riskLevel)}
              </span>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <p className="text-slate-400 text-sm mb-1">Last Update</p>
              <p className="text-white text-sm">{order.lastUpdateAt ? new Date(order.lastUpdateAt).toLocaleString() : 'Never'}</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex gap-3 mb-6">
            <a
              href={`https://www.etsy.com/your/orders/sold/completed?order_id=${order.orderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 rounded-xl transition-colors text-center text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on Etsy
            </a>
            {order.carrier && (
              <a
                href={getCarrierTrackingUrl(order.carrier, order.trackingNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2.5 rounded-xl transition-colors text-center text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Track on {order.carrier.toUpperCase()}
              </a>
            )}
          </div>

          {/* Close Button */}
          <button onClick={onClose}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Bricolage+Grotesque:wght@400;500;600;700&display=swap');
        body { font-family: 'Bricolage Grotesque', sans-serif; }
        h1, h2, h3, h4, h5, h6 { font-family: 'Syne', sans-serif; }
        .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .highlight-pulse { animation: highlightPulse 2s ease-out; }
        @keyframes highlightPulse {
          0%, 100% { background-color: transparent; }
          25%, 75% { background-color: rgba(59, 130, 246, 0.3); }
        }
      `}</style>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-lg border-b border-slate-700 shadow-xl sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">OrderWarden</h1>
                <p className="text-slate-400 text-sm font-medium mt-1">Protecting your Etsy shop</p>
              </div>

              <div className="flex items-center gap-4">
                {/* Plan Badge */}
                {billingStatus && (
                  <div className="flex items-center gap-2">
                    {billingStatus.planType === 'pro' ? (
                      <>
                        <div className="relative">
                          <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-md opacity-60 animate-pulse"></span>
                          <span className="relative px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-black rounded-full uppercase tracking-wider shadow-lg border border-purple-300/30">
                            ⚡ Pro
                          </span>
                        </div>
                        <span className="text-xs text-purple-300 font-medium">Unlimited</span>
                        <button onClick={handleManageSubscription}
                          className="text-slate-400 hover:text-white text-xs underline">
                          Manage
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="px-3 py-1 bg-slate-700 text-slate-300 text-xs font-bold rounded-full">
                          Free ({billingStatus.monthlyOrderCount}/{billingStatus.limit})
                        </span>
                        <button onClick={handleUpgrade} disabled={upgrading}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full hover:from-purple-400 hover:to-pink-400 transition-all shadow-lg disabled:opacity-50">
                          {upgrading ? '...' : '⚡ Upgrade'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {etsyStatus.connected ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-emerald-400 font-medium">🔗 {etsyStatus.shopName}</span>
                    <button onClick={syncEtsy} disabled={etsyStatus.syncing}
                      className="bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-orange-400 transition-all disabled:opacity-50">
                      {etsyStatus.syncing ? '⏳ Syncing...' : '🔄 Sync'}
                    </button>
                    <button onClick={disconnectEtsy} className="text-slate-400 hover:text-red-400 text-sm" title="Disconnect Etsy">✕</button>
                  </div>
                ) : (
                  <button onClick={connectEtsy} className="bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-orange-400 transition-all">
                    🔗 Connect Etsy
                  </button>
                )}
                <button onClick={() => setShowAddOrder(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold text-base hover:bg-blue-500 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-blue-500/50">
                  + Add Order
                </button>
                {userId && <NotificationBell userId={userId} onOrderClick={(orderId) => {
                  const order = orders.find(o => o.id === orderId || o.orderId === orderId);
                  if (order) setSelectedOrder(order);
                }} />}
                <Link href="/settings" className="p-2 rounded-full hover:bg-slate-700 transition-colors" title="Settings">
                  <svg className="w-6 h-6 text-slate-400 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
                <div className="bg-slate-700 rounded-full p-1 shadow-lg">
                  <UserButton afterSignOutUrl="https://landing.orderwarden.com" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeInUp">
          {error && (
            <div className="bg-red-900/50 border-l-4 border-red-500 text-red-300 px-6 py-4 rounded-lg mb-6">
              <div className="flex items-center"><span className="text-2xl mr-3">⚠️</span><span className="font-semibold">{error}</span></div>
            </div>
          )}

          {/* Pro Welcome Banner */}
          {showProWelcome && billingStatus?.planType === 'pro' && (
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/50 px-6 py-4 rounded-2xl mb-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 animate-pulse"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-3xl mr-4">🎉</span>
                  <div>
                    <span className="font-black text-xl text-white">Welcome to OrderWarden Pro!</span>
                    <p className="text-sm text-purple-200 mt-1">You now have unlimited orders, priority support, and all Pro features unlocked.</p>
                  </div>
                </div>
                <button onClick={() => setShowProWelcome(false)}
                  className="text-purple-300 hover:text-white transition-colors p-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Order Limit Warning Banner */}
          {billingStatus && billingStatus.planType === 'free' && billingStatus.limit && (
            billingStatus.monthlyOrderCount >= billingStatus.limit ? (
              <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-l-4 border-purple-500 px-6 py-4 rounded-lg mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">🚫</span>
                    <div>
                      <span className="font-bold text-white">Monthly order limit reached!</span>
                      <p className="text-sm text-purple-200">You&apos;ve used all {billingStatus.limit} orders this month. Upgrade to Pro for unlimited orders.</p>
                    </div>
                  </div>
                  <button onClick={handleUpgrade} disabled={upgrading}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-full hover:from-purple-400 hover:to-pink-400 transition-all shadow-lg disabled:opacity-50">
                    {upgrading ? 'Loading...' : '⚡ Upgrade to Pro - $19.99/mo'}
                  </button>
                </div>
              </div>
            ) : billingStatus.monthlyOrderCount >= billingStatus.limit - 2 ? (
              <div className="bg-amber-900/30 border-l-4 border-amber-500 px-6 py-4 rounded-lg mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">⚡</span>
                    <span className="font-medium text-amber-200">
                      You&apos;ve used {billingStatus.monthlyOrderCount} of {billingStatus.limit} free orders this month.
                    </span>
                  </div>
                  <button onClick={handleUpgrade} disabled={upgrading}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-full text-sm hover:from-purple-400 hover:to-pink-400 transition-all">
                    Upgrade to Pro
                  </button>
                </div>
              </div>
            ) : null
          )}


          {/* Stats Cards Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Overview</h2>
            <select
              value={dashboardRange}
              onChange={(e) => setDashboardRange(e.target.value as 'today' | '7days' | '30days' | 'all')}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2024%2024%22%20fill%3d%22none%22%20stroke%3d%22%2394a3b8%22%20stroke-width%3d%222%22%20stroke-linecap%3d%22round%22%20stroke-linejoin%3d%22round%22%3e%3cpolyline%20points%3d%226%209%2012%2015%2018%209%22%3e%3c%2fpolyline%3e%3c%2fsvg%3e')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
              <StatCard label="Total Orders" value={dashboardOrders.length} icon="📦" color="from-blue-500 to-sky-600" />
              <StatCard label="At Risk" value={dashboardOrders.filter(o => o.riskLevel === 'red' || o.riskLevel === 'yellow').length} icon="⚠️" color="from-amber-500 to-yellow-600" />
              <StatCard label="In Transit" value={dashboardOrders.filter(o => o.lastStatus === 'in_transit').length} icon="🚚" color="from-indigo-500 to-purple-600" />
              <StatCard label="Delivered" value={dashboardOrders.filter(o => o.lastStatus === 'delivered').length} icon="✅" color="from-emerald-500 to-green-600" />
            </div>
            <div className="lg:col-span-2">
              <DeliveryRiskOverview orders={dashboardOrders} onOrderClick={handleScrollToOrder} />
            </div>
          </div>

          {/* Impact Summary */}
          <div className="bg-slate-800/50 rounded-2xl shadow-xl p-6 border border-slate-700 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Impact This Month</h3>
                <p className="text-xs text-slate-400">This calendar month</p>
              </div>
              <button onClick={fetchImpactSummary} disabled={impactLoading}
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 disabled:opacity-50">
                <svg className={`w-4 h-4 ${impactLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {impactLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {impactError ? (
              <div className="text-center py-4 text-red-400 bg-red-500/10 rounded-xl">
                {impactError}
              </div>
            ) : impactLoading && !impactSummary ? (
              <div className="text-center py-6 text-slate-400">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
                Loading impact summary...
              </div>
            ) : impactSummary ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/40">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Tracking Checks</div>
                  <div className="text-2xl font-black text-white mt-1">{impactSummary.trackingChecks}</div>
                </div>
                <div className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/40">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Risk Flagged</div>
                  <div className="text-2xl font-black text-amber-300 mt-1">{impactSummary.riskFlagged}</div>
                </div>
                <div className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/40">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Risks Resolved</div>
                  <div className="text-2xl font-black text-emerald-300 mt-1">{impactSummary.riskResolved}</div>
                </div>
                <div className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/40">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Refunds Avoided</div>
                  <div className="text-2xl font-black text-emerald-300 mt-1">
                    ${impactSummary.estimatedRefundsAvoided.toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                No impact data yet. Track an order to get started.
              </div>
            )}
          </div>

          {/* Search and Filters */}
          <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-700">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search orders, tracking numbers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              
              {/* Risk Filter */}
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2024%2024%22%20fill%3d%22none%22%20stroke%3d%22%2394a3b8%22%20stroke-width%3d%222%22%20stroke-linecap%3d%22round%22%20stroke-linejoin%3d%22round%22%3e%3cpolyline%20points%3d%226%209%2012%2015%2018%209%22%3e%3c%2fpolyline%3e%3c%2fsvg%3e')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat cursor-pointer">
                <option value="all">All Risks</option>
                <option value="green">Healthy</option>
                <option value="yellow">Needs Attention</option>
                <option value="red">High Risk</option>
              </select>
              
              {/* Status Filter */}
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2024%2024%22%20fill%3d%22none%22%20stroke%3d%22%2394a3b8%22%20stroke-width%3d%222%22%20stroke-linecap%3d%22round%22%20stroke-linejoin%3d%22round%22%3e%3cpolyline%20points%3d%226%209%2012%2015%2018%209%22%3e%3c%2fpolyline%3e%3c%2fsvg%3e')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat cursor-pointer">
                <option value="all">All Statuses</option>
                <option value="pre_transit">Pre-Transit</option>
                <option value="in_transit">In Transit</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="exception">Exception</option>
                <option value="delivery_failed">Failed</option>
              </select>
              
              {/* Date Filter */}
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2024%2024%22%20fill%3d%22none%22%20stroke%3d%22%2394a3b8%22%20stroke-width%3d%222%22%20stroke-linecap%3d%22round%22%20stroke-linejoin%3d%22round%22%3e%3cpolyline%20points%3d%226%209%2012%2015%2018%209%22%3e%3c%2fpolyline%3e%3c%2fsvg%3e')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat cursor-pointer">
                <option value="all">All Time</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
              
              {/* Export CSV */}
              <button
                onClick={exportToCSV}
                disabled={filteredOrders.length === 0}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>

              {/* Bulk Actions */}
              {selectedOrders.size > 0 && (
                <>
                  <button
                    onClick={checkSelectedTracking}
                    disabled={bulkCheckLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {bulkCheckLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Check Tracking ({selectedOrders.size})
                      </>
                    )}
                  </button>
                  <button onClick={initiateDeleteSelected}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete ({selectedOrders.size})
                  </button>
                </>
              )}
            </div>
            
            {/* Filter summary */}
            {(searchQuery || riskFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all') && (
              <div className="mt-3 text-sm text-slate-400">
                Showing {filteredOrders.length} of {orders.length} orders
                <button onClick={() => { setSearchQuery(''); setRiskFilter('all'); setStatusFilter('all'); setDateFilter('all'); }}
                  className="ml-2 text-blue-400 hover:text-blue-300">Clear filters</button>
              </div>
            )}
          </div>


          {/* Orders Table */}
          {orders.length === 0 ? (
            <div className="bg-slate-800/50 rounded-2xl shadow-xl p-16 text-center border-2 border-slate-700">
              <div className="text-6xl mb-6">📭</div>
              <h3 className="text-2xl font-bold text-white mb-3">No orders yet</h3>
              <p className="text-slate-400 text-lg mb-6 max-w-md mx-auto">Add your first order to start tracking deliveries</p>
              <button onClick={() => setShowAddOrder(true)}
                className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-500 transform hover:scale-105 transition-all shadow-lg">
                Add Your First Order
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-slate-800/50 rounded-2xl shadow-xl p-16 text-center border-2 border-slate-700">
              <div className="text-6xl mb-6">🔍</div>
              <h3 className="text-2xl font-bold text-white mb-3">No orders match your filters</h3>
              <p className="text-slate-400 text-lg mb-6">Try adjusting your search or filters</p>
              <button onClick={() => { setSearchQuery(''); setRiskFilter('all'); setStatusFilter('all'); setDateFilter('all'); }}
                className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-500 transition-all">
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-2xl shadow-xl overflow-hidden border-2 border-slate-700">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-4 py-4 text-left">
                        <input type="checkbox" checked={selectedOrders.size === paginatedOrders.length && paginatedOrders.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
                      </th>
                      <SortHeader field="orderId">Order</SortHeader>
                      <SortHeader field="trackingNumber">Tracking</SortHeader>
                      <SortHeader field="lastStatus" center>Status</SortHeader>
                      <SortHeader field="riskLevel" center>Risk</SortHeader>
                      <SortHeader field="lastUpdateAt" center>Last Update</SortHeader>
                      <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-700">
                    {paginatedOrders.map((order) => (
                      <tr key={order.id}
                          data-order-id={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`hover:bg-slate-700/50 transition-colors cursor-pointer ${selectedOrders.has(order.id) ? 'bg-blue-900/20' : ''}`}>
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedOrders.has(order.id)}
                            onChange={() => toggleSelectOrder(order.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                              className="font-bold text-blue-400 hover:text-blue-300 text-base hover:underline text-left"
                            >
                              #{order.orderId}
                            </button>
                          </div>
                          <div className="text-sm text-slate-400 font-medium">{order.carrier || 'Unknown carrier'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-300 font-mono font-semibold">{order.trackingNumber}</span>
                            <button onClick={() => copyToClipboard(order.trackingNumber)}
                              className="p-1 hover:bg-slate-700 rounded transition-colors" title="Copy tracking number">
                              <svg className="w-4 h-4 text-slate-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {order.lastStatus ? getStatusBadge(order.lastStatus) : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {order.riskLevel ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getRiskColor(order.riskLevel)}`}>
                              {getRiskLabel(order.riskLevel)}
                            </span>
                          ) : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 text-center">
                          {order.lastUpdateAt ? new Date(order.lastUpdateAt).toLocaleString() : 'Never'}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => checkTracking(order.id)}
                              disabled={checkingOrderIds.has(order.id)}
                              className="group p-1.5 rounded-lg hover:bg-blue-500/20 transition-all disabled:opacity-50"
                              title="Check tracking">
                              {checkingOrderIds.has(order.id) ? (
                                <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors"
                                  xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                  strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                              )}
                            </button>
                            <button onClick={() => initiateDeleteOrder(order.id)}
                              className="group p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                              title="Delete order">
                              <svg className="w-5 h-5 text-slate-400 group-hover:text-red-400 transition-colors"
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-slate-900/50 border-t border-slate-700">
                  <div className="text-sm text-slate-400">
                    Showing {((currentPage - 1) * ORDERS_PER_PAGE) + 1}-{Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="First page"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="px-4 py-2 text-white font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Last page"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {showAddOrder && userId && (
          <AddOrderModal userId={userId} onClose={() => setShowAddOrder(false)}
            onSuccess={() => { setShowAddOrder(false); fetchOrders(); setToast({ message: 'Order added!', type: 'success' }); }} />
        )}

        {selectedOrder && userId && (
          <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} userId={userId} />
        )}

        {confirmDialog && (
          <ConfirmationModal
            isOpen={true}
            title={confirmDialog.title}
            message={confirmDialog.message}
            confirmText="Delete"
            variant="danger"
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}
      </div>
    </>
  );
}


function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl shadow-lg p-5 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl border border-white/10`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-2xl">{icon}</div>
        <div className="text-3xl font-black text-white">{value}</div>
      </div>
      <div className="text-xs font-bold text-white/80 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function AddOrderModal({ userId, onClose, onSuccess }: { userId: string; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ orderId: '', trackingNumber: '', carrier: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ orderId?: string; trackingNumber?: string }>({});

  const validateForm = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!formData.orderId.trim()) errors.orderId = 'Order name is required';
    if (!formData.trackingNumber.trim()) errors.trackingNumber = 'Tracking number is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    setUpgradeRequired(false);
    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-clerk-user-id': userId },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.upgradeRequired) {
          setUpgradeRequired(true);
          setError(data.message || 'Monthly order limit reached');
        } else {
          throw new Error(data.error || 'Failed to create order');
        }
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeFromModal = async () => {
    try {
      const response = await fetch(`/api/billing/create-checkout`, {
        method: 'POST',
        headers: { 'x-clerk-user-id': userId }
      });
      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError('Failed to start upgrade');
    }
  };


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeInUp">
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black text-white">Add New Order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className={`${upgradeRequired ? 'bg-purple-900/50 border-purple-500' : 'bg-red-900/50 border-red-500'} border-l-4 px-4 py-3 rounded-lg mb-6`}>
            <p className={`font-semibold ${upgradeRequired ? 'text-purple-200' : 'text-red-300'}`}>{error}</p>
            {upgradeRequired && (
              <button onClick={handleUpgradeFromModal}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-full text-sm hover:from-purple-400 hover:to-pink-400 transition-all">
                ⚡ Upgrade to Pro - $19.99/mo
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Order Name *</label>
            <input type="text" value={formData.orderId}
              onChange={(e) => {
                setFormData({ ...formData, orderId: e.target.value });
                if (fieldErrors.orderId) setFieldErrors(prev => ({ ...prev, orderId: undefined }));
              }}
              className={`w-full px-4 py-3 bg-slate-900 border-2 ${fieldErrors.orderId ? 'border-red-500 focus:ring-red-500/50' : 'border-slate-700 focus:ring-blue-500/50 focus:border-blue-500'} text-white rounded-xl focus:ring-4 font-medium`}
              placeholder="e.g., Etsy #3960433496 or Sarah's necklace" />
            {fieldErrors.orderId && (
              <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {fieldErrors.orderId}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Tracking Number *</label>
            <input type="text" value={formData.trackingNumber}
              onChange={(e) => {
                setFormData({ ...formData, trackingNumber: e.target.value });
                if (fieldErrors.trackingNumber) setFieldErrors(prev => ({ ...prev, trackingNumber: undefined }));
              }}
              className={`w-full px-4 py-3 bg-slate-900 border-2 ${fieldErrors.trackingNumber ? 'border-red-500 focus:ring-red-500/50' : 'border-slate-700 focus:ring-blue-500/50 focus:border-blue-500'} text-white rounded-xl focus:ring-4 font-mono`}
              placeholder="e.g., 1Z999AA10123456784" />
            {fieldErrors.trackingNumber && (
              <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {fieldErrors.trackingNumber}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Carrier (optional)</label>
            <select value={formData.carrier} onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 text-white rounded-xl focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500">
              <option value="">Auto-detect</option>
              <option value="USPS">USPS</option>
              <option value="UPS">UPS</option>
              <option value="FedEx">FedEx</option>
              <option value="DHL">DHL</option>
            </select>
          </div>
          <div className="flex space-x-4 pt-4">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-700 rounded-xl text-slate-300 font-bold hover:bg-slate-700 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg hover:shadow-blue-500/50">
              {loading ? 'Adding...' : 'Add Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
