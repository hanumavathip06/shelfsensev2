import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { 
  IndianRupee, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Users, 
  Package, 
  Layers, 
  ArrowRight, 
  ShieldAlert, 
  XCircle 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSummary, getApprovals, approveItem, rejectItem, getTeamActivity } from '../../lib/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface ConfirmState {
  type: 'po' | 'adjustment';
  id: number;
  action: 'approve' | 'reject';
  title: string;
}

export function ManagerDashboard() {
  const queryClient = useQueryClient();
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [reason, setReason] = useState('');

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['manager-summary'],
    queryFn: getSummary,
  });

  const { data: approvals, isLoading: isApprovalsLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: getApprovals,
  });

  const { data: teamActivity } = useQuery({
    queryKey: ['team-activity'],
    queryFn: getTeamActivity,
  });

  const approveMutation = useMutation({
    mutationFn: approveItem,
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Approved successfully');
      setConfirmState(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to approve');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: rejectItem,
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Rejected successfully');
      setConfirmState(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to reject');
    }
  });

  const handleInitiate = (type: 'po' | 'adjustment', id: number, action: 'approve' | 'reject', title: string) => {
    setConfirmState({ type, id, action, title });
    setReason(action === 'approve' ? 'Approved by manager' : '');
  };

  const handleExecuteDoubleCheck = () => {
    if (!confirmState) return;

    if (confirmState.action === 'reject' && !reason.trim()) {
      toast.error('Please enter a mandatory rejection reason');
      return;
    }

    const payload = {
      type: confirmState.type,
      id: confirmState.id,
      reason: reason.trim() || (confirmState.action === 'approve' ? 'Approved by manager' : 'Rejected by manager')
    };

    if (confirmState.action === 'approve') {
      approveMutation.mutate(payload);
    } else {
      rejectMutation.mutate(payload);
    }
  };

  const pendingAdjustments = approvals?.stock_adjustments || [];
  const pendingPOs = approvals?.purchase_orders || [];
  const totalPending = pendingAdjustments.length + pendingPOs.length;

  if (isSummaryLoading && isApprovalsLoading) {
    return <div className="space-y-6"><Skeleton className="h-32 w-full rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-primary">Store Oversight</h1>
          <p className="text-sm text-secondary mt-1">
            Real-time management dashboard, stock approval queue, and store operations.
          </p>
        </div>
        <Link to="/approvals">
          <Button variant="outline" size="sm" className="flex items-center gap-1.5">
            <span>Approvals Desk</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatTile 
          title="Stock Value" 
          value={`₹${summary?.inventory_value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`} 
          icon={IndianRupee} 
          color="text-success" 
        />
        <StatTile 
          title="Low Stock Items" 
          value={summary?.low_stock_count || 0} 
          icon={AlertTriangle} 
          color="text-warning" 
        />
        <StatTile 
          title="Pending Approvals" 
          value={totalPending} 
          icon={CheckCircle2} 
          color={totalPending > 0 ? "text-accent" : "text-secondary"} 
        />
        <StatTile 
          title="Total SKUs" 
          value={summary?.total_skus || 0} 
          icon={TrendingUp} 
          color="text-primary" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Approvals Queue */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent" />
              <CardTitle>Approval Queue</CardTitle>
              {totalPending > 0 && (
                <Badge variant="warning">{totalPending} Pending</Badge>
              )}
            </div>
            <Link to="/approvals" className="text-xs text-accent hover:underline flex items-center gap-1">
              View All Desk <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>

          <CardContent>
            {totalPending === 0 ? (
              <div className="py-12 text-center text-secondary space-y-2">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto opacity-80" />
                <p className="font-medium text-primary">All caught up!</p>
                <p className="text-xs">No pending stock movements or purchase orders requiring review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stock Movement Items */}
                {pendingAdjustments.slice(0, 5).map((adj: any) => {
                  const isSelected = confirmState?.type === 'adjustment' && confirmState?.id === adj.id;
                  const isApproving = isSelected && confirmState?.action === 'approve';
                  const isRejecting = isSelected && confirmState?.action === 'reject';
                  const isPending = approveMutation.isPending || rejectMutation.isPending;

                  return (
                    <div 
                      key={`dash-adj-${adj.id}`}
                      className={`p-4 bg-surface border rounded-lg transition-all ${
                        isSelected ? 'border-accent ring-1 ring-accent' : 'border-border'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-primary">
                              Movement #{adj.id}
                            </span>
                            <Badge 
                              variant={adj.reason === 'inbound' ? 'success' : adj.reason === 'outbound' ? 'warning' : 'default'}
                              className="uppercase text-[10px]"
                            >
                              {adj.reason}
                            </Badge>
                            <span className={`text-xs font-bold ${adj.change_qty > 0 ? 'text-success' : 'text-danger'}`}>
                              {adj.change_qty > 0 ? `+${adj.change_qty}` : adj.change_qty} units
                            </span>
                          </div>
                          <p className="text-xs text-primary font-medium">
                            {adj.product_name} <span className="text-secondary font-mono">({adj.product_sku})</span>
                          </p>
                          <p className="text-[11px] text-secondary">
                            Submitted by <strong className="text-primary">{adj.performed_by_name}</strong>
                          </p>
                        </div>

                        {/* Controls (Step 1 vs Step 2) */}
                        {!isSelected ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button 
                              variant="outline" 
                              className="text-danger border-danger hover:bg-danger/10 text-xs py-1 px-2.5"
                              onClick={() => handleInitiate('adjustment', adj.id, 'reject', `Movement #${adj.id}`)}
                              disabled={isPending}
                            >
                              Reject
                            </Button>
                            <Button 
                              variant="success" 
                              className="text-xs py-1 px-3"
                              onClick={() => handleInitiate('adjustment', adj.id, 'approve', `Movement #${adj.id}`)}
                              disabled={isPending}
                            >
                              Approve
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {/* Step 2: Double-Check Confirmation Banner */}
                      {isSelected && (
                        <div className={`mt-3 pt-3 border-t space-y-2.5 ${
                          isApproving ? 'border-success/30' : 'border-danger/30'
                        }`}>
                          <div className="flex items-center gap-2">
                            {isApproving ? (
                              <ShieldAlert className="h-4 w-4 text-success" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-danger" />
                            )}
                            <span className="text-xs font-semibold text-primary">
                              Double-Check Required: Confirm {isApproving ? 'Approval' : 'Rejection'}
                            </span>
                          </div>

                          <input 
                            type="text"
                            className="w-full bg-background border border-border rounded px-2.5 py-1 text-xs text-primary outline-none focus:border-accent"
                            placeholder={isApproving ? 'Remarks (optional)...' : 'Rejection reason (mandatory)...'}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            autoFocus
                          />

                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs py-1 h-7"
                              onClick={() => { setConfirmState(null); setReason(''); }}
                              disabled={isPending}
                            >
                              Cancel
                            </Button>
                            {isApproving ? (
                              <Button 
                                variant="success" 
                                size="sm"
                                className="text-xs py-1 h-7 font-bold animate-pulse"
                                onClick={handleExecuteDoubleCheck}
                                disabled={isPending}
                              >
                                {isPending ? 'Approving...' : 'Approve Again'}
                              </Button>
                            ) : (
                              <Button 
                                variant="danger" 
                                size="sm"
                                className="text-xs py-1 h-7 font-bold"
                                onClick={handleExecuteDoubleCheck}
                                disabled={isPending}
                              >
                                {isPending ? 'Rejecting...' : 'Reject Again'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Purchase Order Items */}
                {pendingPOs.slice(0, 3).map((po: any) => {
                  const isSelected = confirmState?.type === 'po' && confirmState?.id === po.id;
                  const isApproving = isSelected && confirmState?.action === 'approve';
                  const isRejecting = isSelected && confirmState?.action === 'reject';
                  const isPending = approveMutation.isPending || rejectMutation.isPending;

                  return (
                    <div 
                      key={`dash-po-${po.id}`}
                      className={`p-4 bg-surface border rounded-lg transition-all ${
                        isSelected ? 'border-accent ring-1 ring-accent' : 'border-border'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-primary">PO #{po.id}</span>
                            <Badge variant="warning" className="text-[10px]">PO Pending</Badge>
                          </div>
                          <p className="text-xs text-secondary mt-1">
                            Supplier: {po.supplier || 'N/A'} — ₹{po.total_amount?.toFixed(2)}
                          </p>
                        </div>

                        {!isSelected ? (
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              className="text-danger border-danger hover:bg-danger/10 text-xs py-1 px-2.5"
                              onClick={() => handleInitiate('po', po.id, 'reject', `PO #${po.id}`)}
                              disabled={isPending}
                            >
                              Reject
                            </Button>
                            <Button 
                              variant="primary" 
                              className="text-xs py-1 px-3"
                              onClick={() => handleInitiate('po', po.id, 'approve', `PO #${po.id}`)}
                              disabled={isPending}
                            >
                              Approve
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {isSelected && (
                        <div className={`mt-3 pt-3 border-t space-y-2.5 ${
                          isApproving ? 'border-success/30' : 'border-danger/30'
                        }`}>
                          <div className="flex items-center gap-2">
                            {isApproving ? (
                              <ShieldAlert className="h-4 w-4 text-success" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-danger" />
                            )}
                            <span className="text-xs font-semibold text-primary">
                              Double-Check Required: Confirm {isApproving ? 'Approval' : 'Rejection'} for PO #{po.id}
                            </span>
                          </div>

                          <input 
                            type="text"
                            className="w-full bg-background border border-border rounded px-2.5 py-1 text-xs text-primary outline-none focus:border-accent"
                            placeholder={isApproving ? 'Remarks (optional)...' : 'Rejection reason (mandatory)...'}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            autoFocus
                          />

                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs py-1 h-7"
                              onClick={() => { setConfirmState(null); setReason(''); }}
                              disabled={isPending}
                            >
                              Cancel
                            </Button>
                            {isApproving ? (
                              <Button 
                                variant="success" 
                                size="sm"
                                className="text-xs py-1 h-7 font-bold animate-pulse"
                                onClick={handleExecuteDoubleCheck}
                                disabled={isPending}
                              >
                                {isPending ? 'Approving...' : 'Approve Again'}
                              </Button>
                            ) : (
                              <Button 
                                variant="danger" 
                                size="sm"
                                className="text-xs py-1 h-7 font-bold"
                                onClick={handleExecuteDoubleCheck}
                                disabled={isPending}
                              >
                                {isPending ? 'Rejecting...' : 'Reject Again'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamActivity && teamActivity.length > 0 ? (
              <div className="space-y-3">
                {teamActivity.slice(0, 6).map((item: any) => (
                  <div key={item.id} className="text-xs text-secondary flex flex-col gap-1 pb-2.5 border-b border-border last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">User #{item.performed_by}</span>
                      <span className="text-[10px] text-secondary">
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <span className="capitalize">
                      {item.reason} movement of {item.change_qty > 0 ? `+${item.change_qty}` : item.change_qty} units (Prod #{item.product_id})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-secondary py-8 text-center space-y-1">
                <Users className="h-6 w-6 text-secondary mx-auto opacity-50" />
                <p>No recent activity recorded today.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
