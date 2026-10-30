import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordStockMovement, getProducts } from '../lib/api';
import { toast } from 'react-hot-toast';

export function StockMovements() {
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [reason, setReason] = useState('inbound');
  const [qty, setQty] = useState('');
  const [destLocation, setDestLocation] = useState('');
  
  const queryClient = useQueryClient();

  // Search products
  const { data: products } = useQuery({
    queryKey: ['products-search', productQuery],
    queryFn: () => getProducts({ q: productQuery, limit: 5 }),
    enabled: productQuery.length > 2
  });

  const recordMutation = useMutation({
    mutationFn: recordStockMovement,
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Movement recorded successfully');
      setSelectedProduct(null);
      setQty('');
      queryClient.invalidateQueries({ queryKey: ['my-activity'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to record movement');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !qty || parseInt(qty) <= 0) {
      toast.error('Please fill all required fields');
      return;
    }
    
    recordMutation.mutate({
      product_id: selectedProduct.id,
      change_qty: parseInt(qty),
      reason,
      destination_location_id: reason === 'transfer' ? parseInt(destLocation) : undefined
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif text-primary">Record Stock Movement</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Movement Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Select Product (Search SKU or Name)</label>
                {selectedProduct ? (
                  <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-md">
                    <div>
                      <p className="font-semibold text-primary">{selectedProduct.name}</p>
                      <p className="text-xs text-secondary">SKU: {selectedProduct.sku}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>Change</Button>
                  </div>
                ) : (
                  <div>
                    <input 
                      type="text" 
                      className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary focus:border-accent outline-none"
                      placeholder="Type at least 3 chars..."
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                    />
                    {products && products.data && products.data.length > 0 && (
                      <div className="mt-2 border border-border rounded-md bg-surface max-h-40 overflow-y-auto">
                        {products.data.map((p: any) => (
                          <div 
                            key={p.id} 
                            className="p-2 hover:bg-background cursor-pointer text-sm"
                            onClick={() => setSelectedProduct(p)}
                          >
                            <span className="font-semibold">{p.sku}</span> - {p.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Type of Movement</label>
                <select 
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary outline-none"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="inbound">Inbound (Receive)</option>
                  <option value="outbound">Outbound (Pick/Ship)</option>
                  <option value="transfer">Transfer to Location</option>
                </select>
              </div>
              
              {reason === 'transfer' && (
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Destination Location ID</label>
                  <input 
                    type="number" 
                    className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary outline-none"
                    value={destLocation}
                    onChange={(e) => setDestLocation(e.target.value)}
                    required
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Quantity</label>
                <input 
                  type="number" 
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-primary outline-none"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  min="1"
                  required
                />
              </div>
              
              <Button type="submit" variant="primary" className="w-full" disabled={recordMutation.isPending || !selectedProduct}>
                {recordMutation.isPending ? 'Recording...' : 'Submit Movement'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
