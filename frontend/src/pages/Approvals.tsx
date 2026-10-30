import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApprovals, approveItem, rejectItem } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Skeleton } from '../components/ui/Skeleton';
import { PurchaseOrders } from './PurchaseOrders';
import { Discrepancies } from './Discrepancies';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldAlert, 
  ArrowRight, 
  User, 
  Calendar, 
  Package, 
  Layers
} from 'lucide-react';

interface ConfirmState {
  type: 'po' | 'adjustment';
  id: number;
  action: 'approve' | 'reject';
  itemTitle?: string;
  itemDetail?: string;
}

export function Approvals() {
  const [activeTab, setActiveTab] = useState<'adjustments' | 'pos' | 'discrepancies'>('adjustments');
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  
  const { data: approvals, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: getApprovals
  });

  const approveMutation = useMutation({
    mutationFn: approveItem,
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Approved successfully');
      setReason('');
      setConfirmState(null);
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
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Rejected successfully');
      setReason('');
      setConfirmState(null);
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to reject');
    }
  });

  // Step 1: Initiate action (opens double-checking confirmation box)
  const handleInitiate = (
    type: 'po' | 'adjustment', 
    id: number, 
    action: 'approve' | 'reject',
    itemTitle: string,
    itemDetail: string
  ) => {
    setConfirmState({ type, id, action, itemTitle, itemDetail });
    setReason(action === 'approve' ? 'Approved by manager' : '');
  };

  // Step 2: Confirm action (second click - "Approve Again" or "Reject Again")
  const handleExecuteDoubleCheck = () => {
    if (!confirmState) return;

    if (confirmState.action === 'reject' && !reason.trim()) {
      toast.error('Please enter a mandatory reason for rejection');
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

  const handleCancel = () => {
    setConfirmState(null);
    setReason('');
  };

  const pendingMovementsCount = approvals?.stock_adjustments?.length || 0;
  const pendingPosCount = approvals?.purchase_orders?.length || 0;

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary">Approvals Desk</h1>
          <p className="text-sm text-secondary mt-1">
            Review and double-check stock movements submitted by staff and automated purchase orders.
          </p>
        </div>
        <div className="flex bg-surface border border-border p-1 rounded-lg self-start">
          <button
            onClick={() => { setActiveTab('adjustments'); setConfirmState(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'adjustments' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-primary'
            }`}
          >
            <span>Stock Movements</span>
            {pendingMovementsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'adjustments' ? 'bg-white text-primary' : 'bg-accent text-white'
              }`}>
                {pendingMovementsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('pos'); setConfirmState(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'pos' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-primary'
            }`}
          >
            <span>Purchase Orders</span>
            {pendingPosCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'pos' ? 'bg-white text-primary' : 'bg-accent text-white'
              }`}>
                {pendingPosCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('discrepancies'); setConfirmState(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'discrepancies' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-primary'
            }`}
          >
            Discrepancies
          </button>
        </div>
      </div>

      {/* TAB 1: Stock Movements / Adjustments from Staff */}
      {activeTab === 'adjustments' && (
        <div className="space-y-6">
          {!approvals?.stock_adjustments?.length ? (
            <Card>
              <CardContent className="py-16 text-center text-secondary space-y-2">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto opacity-70" />
                <h3 className="font-semibold text-primary text-lg">No Pending Stock Movements</h3>
                <p className="text-sm">All staff stock movement submissions have been reviewed.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <Layers className="h-5 w-5 text-accent" />
                  Staff Stock Movements Requiring Approval ({pendingMovementsCount})
                </h2>
                <span className="text-xs text-secondary">Two-step confirmation required for decisions</span>
              </div>

              {approvals.stock_adjustments.map((adj: any) => {
                const isSelected = confirmState?.type === 'adjustment' && confirmState?.id === adj.id;
                const isApproving = isSelected && confirmState?.action === 'approve';
                const isRejecting = isSelected && confirmState?.action === 'reject';
                const isPending = approveMutation.isPending || rejectMutation.isPending;

                return (
                  <Card key={`adj-${adj.id}`} className={`border transition-all ${
                    isSelected ? 'ring-2 ring-accent border-accent shadow-md' : 'border-border'
                  }`}>
                    <CardHeader className="bg-surface/50 border-b border-border/50 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <CardTitle className="text-base font-semibold text-primary">
                            Stock Movement #{adj.id}
                          </CardTitle>
                          <Badge variant={adj.reason === 'inbound' ? 'success' : adj.reason === 'outbound' ? 'warning' : 'default'} className="uppercase">
                            {adj.reason}
                          </Badge>
                          <Badge variant="warning">
                            Pending Approval
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-secondary">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            Submitted by <strong className="text-primary">{adj.performed_by_name || `User #${adj.performed_by}`}</strong>
                          </span>
                          {adj.created_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(adj.created_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-4">
                      {/* Movement Data Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-3 bg-surface rounded-lg border border-border text-sm">
                        <div>
                          <span className="text-xs uppercase text-secondary font-medium block">Product</span>
                          <span className="font-semibold text-primary">{adj.product_name || `Product #${adj.product_id}`}</span>
                          {adj.product_sku && (
                            <span className="text-xs text-secondary block font-mono">SKU: {adj.product_sku}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs uppercase text-secondary font-medium block">Quantity Change</span>
                          <span className={`text-base font-bold ${adj.change_qty > 0 ? 'text-success' : 'text-danger'}`}>
                            {adj.change_qty > 0 ? `+${adj.change_qty}` : adj.change_qty} units
                          </span>
                        </div>
                        <div>
                          <span className="text-xs uppercase text-secondary font-medium block">Movement Type</span>
                          <span className="capitalize font-medium text-primary">
                            {adj.reason === 'inbound' ? 'Inbound (Receive to Stock)' : 
                             adj.reason === 'outbound' ? 'Outbound (Pick & Dispatch)' : 
                             adj.reason === 'transfer' ? 'Warehouse Transfer' : adj.reason}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs uppercase text-secondary font-medium block">Routing</span>
                          <span className="text-xs text-secondary">
                            {adj.source_location_id && `From Loc #${adj.source_location_id}`}
                            {adj.destination_location_id && ` → To Loc #${adj.destination_location_id}`}
                            {!adj.source_location_id && !adj.destination_location_id && 'Default Location'}
                          </span>
                        </div>
                      </div>

                      {/* ACTION CONTROLS */}
                      {!isSelected ? (
                        /* Step 1: Default Buttons */
                        <div className="flex items-center justify-between pt-2">
                          <p className="text-xs text-secondary italic">
                            Click Approve or Reject to initiate double-check verification.
                          </p>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              className="text-danger border-danger hover:bg-danger/10 text-xs py-1.5 px-3 flex items-center gap-1.5"
                              onClick={() => handleInitiate(
                                'adjustment', 
                                adj.id, 
                                'reject', 
                                `Movement #${adj.id}`,
                                `${adj.change_qty > 0 ? `+${adj.change_qty}` : adj.change_qty} units of ${adj.product_name}`
                              )}
                              disabled={isPending}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                            <Button 
                              variant="success" 
                              className="text-xs py-1.5 px-4 flex items-center gap-1.5"
                              onClick={() => handleInitiate(
                                'adjustment', 
                                adj.id, 
                                'approve', 
                                `Movement #${adj.id}`,
                                `${adj.change_qty > 0 ? `+${adj.change_qty}` : adj.change_qty} units of ${adj.product_name}`
                              )}
                              disabled={isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Step 2: Double-Check Confirmation Card */
                        <div className={`p-4 rounded-lg border space-y-3 transition-all ${
                          isApproving ? 'bg-success/5 border-success/30' : 'bg-danger/5 border-danger/30'
                        }`}>
                          <div className="flex items-start gap-2">
                            {isApproving ? (
                              <ShieldAlert className="h-5 w-5 text-success shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                            )}
                            <div>
                              <h4 className="font-semibold text-sm text-primary">
                                Double-Check Required: Confirm {isApproving ? 'Approval' : 'Rejection'}
                              </h4>
                              <p className="text-xs text-secondary mt-0.5">
                                {isApproving 
                                  ? `You are about to approve ${adj.change_qty > 0 ? `+${adj.change_qty}` : adj.change_qty} units of ${adj.product_name}. Inventory will be updated immediately. Please click "Approve Again" to confirm.`
                                  : `You are about to reject this stock movement. Please state a reason below and click "Reject Again" to confirm.`
                                }
                              </p>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-secondary mb-1">
                              {isApproving ? 'Approval Remarks (Optional):' : 'Rejection Reason (Mandatory):'}
                            </label>
                            <input 
                              type="text"
                              className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary outline-none focus:border-accent"
                              placeholder={isApproving ? 'Optional remarks (e.g., Verified by Manager)...' : 'State reason for staff notification...'}
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              autoFocus
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleCancel}
                              disabled={isPending}
                            >
                              Cancel
                            </Button>

                            {isApproving ? (
                              <Button 
                                variant="success" 
                                size="sm"
                                onClick={handleExecuteDoubleCheck}
                                disabled={isPending}
                                className="font-semibold shadow-md animate-pulse"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                {isPending ? 'Approving...' : 'Approve Again'}
                              </Button>
                            ) : (
                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={handleExecuteDoubleCheck}
                                disabled={isPending}
                                className="font-semibold shadow-md"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                {isPending ? 'Rejecting...' : 'Reject Again'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Purchase Orders */}
      {activeTab === 'pos' && (
        <div className="space-y-6">
          {approvals?.purchase_orders?.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-accent">Purchase Orders Pending Your Approval</h2>
              {approvals.purchase_orders.map((po: any) => {
                const isSelected = confirmState?.type === 'po' && confirmState?.id === po.id;
                const isApproving = isSelected && confirmState?.action === 'approve';
                const isRejecting = isSelected && confirmState?.action === 'reject';
                const isPending = approveMutation.isPending || rejectMutation.isPending;

                return (
                  <Card key={`po-${po.id}`} className={`border transition-all ${
                    isSelected ? 'ring-2 ring-accent border-accent shadow-md' : 'border-accent/30'
                  }`}>
                    <CardHeader className="bg-accent/5">
                      <CardTitle className="flex justify-between items-center text-accent">
                        <span>Purchase Order #{po.id}</span>
                        <span className="text-sm font-normal text-secondary">Created by {po.created_by}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex justify-between text-sm">
                        <div><span className="font-semibold">Supplier:</span> {po.supplier || 'N/A'}</div>
                        <div><span className="font-semibold">Total:</span> ₹{po.total_amount?.toFixed(2)}</div>
                      </div>
                      
                      <div className="border border-border rounded-md overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-surface text-secondary">
                            <tr>
                              <th className="p-2 font-semibold border-b border-border">Product ID</th>
                              <th className="p-2 font-semibold border-b border-border">Requested Qty</th>
                              <th className="p-2 font-semibold border-b border-border bg-accent/5">Forecast</th>
                              <th className="p-2 font-semibold border-b border-border bg-accent/5">Safety Stock</th>
                              <th className="p-2 font-semibold border-b border-border bg-accent/5">On Hand</th>
                            </tr>
                          </thead>
                          <tbody>
                            {po.items.map((item: any, idx: number) => (
                              <tr key={idx} className="border-b border-border last:border-0 hover:bg-surface/50">
                                <td className="p-2 font-mono">{item.product_id}</td>
                                <td className="p-2">{item.quantity}</td>
                                <td className="p-2 bg-accent/5">{item.forecast_qty || '-'}</td>
                                <td className="p-2 bg-accent/5">{item.safety_stock || '-'}</td>
                                <td className="p-2 bg-accent/5">{item.on_hand || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Step 1 vs Step 2 Controls for PO */}
                      {!isSelected ? (
                        <div className="flex justify-end gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            className="text-danger border-danger hover:bg-danger/10 text-xs py-1.5"
                            onClick={() => handleInitiate(
                              'po', 
                              po.id, 
                              'reject', 
                              `PO #${po.id}`,
                              `Total ₹${po.total_amount?.toFixed(2)}`
                            )}
                            disabled={isPending}
                          >
                            Reject
                          </Button>
                          <Button 
                            variant="primary" 
                            className="text-xs py-1.5"
                            onClick={() => handleInitiate(
                              'po', 
                              po.id, 
                              'approve', 
                              `PO #${po.id}`,
                              `Total ₹${po.total_amount?.toFixed(2)}`
                            )}
                            disabled={isPending}
                          >
                            Approve
                          </Button>
                        </div>
                      ) : (
                        <div className={`p-4 rounded-lg border space-y-3 mt-4 ${
                          isApproving ? 'bg-success/5 border-success/30' : 'bg-danger/5 border-danger/30'
                        }`}>
                          <div className="flex items-start gap-2">
                            {isApproving ? (
                              <ShieldAlert className="h-5 w-5 text-success shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                            )}
                            <div>
                              <h4 className="font-semibold text-sm text-primary">
                                Double-Check Required: Confirm {isApproving ? 'Approval' : 'Rejection'} for PO #{po.id}
                              </h4>
                              <p className="text-xs text-secondary mt-0.5">
                                {isApproving 
                                  ? `Please double-check the order quantities and supplier before approving. Click "Approve Again" to execute.`
                                  : `Please enter a rejection reason below and click "Reject Again" to execute.`
                                }
                              </p>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-secondary mb-1">
                              {isApproving ? 'Remarks (Optional):' : 'Rejection Reason (Mandatory):'}
                            </label>
                            <input 
                              type="text"
                              className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary outline-none focus:border-accent"
                              placeholder={isApproving ? 'Optional remarks...' : 'Reason for rejection...'}
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              autoFocus
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleCancel}
                              disabled={isPending}
                            >
                              Cancel
                            </Button>

                            {isApproving ? (
                              <Button 
                                variant="success" 
                                size="sm"
                                onClick={handleExecuteDoubleCheck}
                                disabled={isPending}
                                className="font-semibold animate-pulse"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                {isPending ? 'Approving...' : 'Approve Again'}
                              </Button>
                            ) : (
                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={handleExecuteDoubleCheck}
                                disabled={isPending}
                                className="font-semibold"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                {isPending ? 'Rejecting...' : 'Reject Again'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <PurchaseOrders />
        </div>
      )}

      {/* TAB 3: Discrepancies */}
      {activeTab === 'discrepancies' && <Discrepancies />}
    </div>
  );
}
