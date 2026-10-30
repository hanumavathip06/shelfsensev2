import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, ArrowUpDown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, adjustStock } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

export function Inventory() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = role === 'staff';

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('manual_adjustment');

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', page, debouncedSearch, categoryId, lowStockOnly],
    queryFn: () => getProducts({ page, limit: 10, q: debouncedSearch, category_id: categoryId ? Number(categoryId) : undefined, low_stock: lowStockOnly }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully');
      setIsProductModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to create product'),
  });

  const updateMutation = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully');
      setIsProductModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update product'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to delete product'),
  });

  const adjustMutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Stock adjusted successfully');
      setIsAdjustModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to adjust stock'),
  });

  const handleProductSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      sku: formData.get('sku'),
      category_id: Number(formData.get('category_id')),
      quantity: Number(formData.get('quantity')),
      reorder_threshold: Number(formData.get('reorder_threshold')),
      unit_price: Number(formData.get('unit_price')),
      supplier: formData.get('supplier'),
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    
    adjustMutation.mutate({
      id: adjustingProduct.id,
      data: { change_qty: Number(adjustQty), reason: adjustReason },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-primary">Inventory Management</h1>
        {!isStaff && (
          <button
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <input
            type="text"
            placeholder="Search by name, SKU, or category..."
            className="w-full pl-9 pr-8 py-2 rounded-md border border-border bg-surface text-primary focus:ring-2 focus:ring-accent focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary p-0.5"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          className="w-full sm:w-48 px-3 py-2 rounded-md border border-border bg-surface text-primary focus:ring-2 focus:ring-accent focus:outline-none"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value ? Number(e.target.value) : '');
            setPage(1);
          }}
        >
          <option value="">All Categories</option>
          {categoriesData?.items?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {!isStaff && (
          <button
            onClick={() => {
              setLowStockOnly(!lowStockOnly);
              setPage(1);
            }}
            className={`w-full sm:w-auto px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
              lowStockOnly 
                ? 'bg-danger/10 border-danger/20 text-danger' 
                : 'bg-surface border-border text-secondary hover:text-primary'
            }`}
          >
            Low Stock
          </button>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : productsData?.items?.length === 0 ? (
          <EmptyState title="No products found" description="Try adjusting your filters or adding a new product." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border">
                {productsData?.items?.map((product: any) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-primary">{product.name}</div>
                      <div className="text-sm text-secondary">{product.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      {categoriesData?.items?.find((c: any) => c.id === product.category_id)?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.quantity <= product.reorder_threshold ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                      }`}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      ₹{Number(product.unit_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setAdjustingProduct(product);
                          setAdjustQty('');
                          setIsAdjustModalOpen(true);
                        }}
                        className="text-accent hover:text-accent/80 mx-2"
                        title="Adjust Stock"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                      {!isStaff && (
                        <>
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setIsProductModalOpen(true);
                            }}
                            className="text-secondary hover:text-primary mx-2"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this product?')) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                            className="text-danger hover:text-danger/80 ml-2"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination (Simplified for MVP) */}
      <div className="flex justify-between items-center">
        <button
          disabled={page === 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          className="px-4 py-2 border border-border rounded-md bg-surface text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-secondary">
          Page {productsData?.page || 1} of {productsData?.pages || 1}
        </span>
        <button
          disabled={page >= (productsData?.pages || 1)}
          onClick={() => setPage(p => p + 1)}
          className="px-4 py-2 border border-border rounded-md bg-surface text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
      >
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Name</label>
            <input name="name" type="text" required defaultValue={editingProduct?.name} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">SKU</label>
            <input name="sku" type="text" required defaultValue={editingProduct?.sku} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Category</label>
            <select name="category_id" required defaultValue={editingProduct?.category_id || ''} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="" disabled>Select category</option>
              {categoriesData?.items?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Quantity</label>
              <input name="quantity" type="number" required defaultValue={editingProduct?.quantity || 0} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Threshold</label>
              <input name="reorder_threshold" type="number" required defaultValue={editingProduct?.reorder_threshold || 0} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Unit Price (₹)</label>
            <input name="unit_price" type="number" step="0.01" required defaultValue={editingProduct?.unit_price} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Supplier</label>
            <input name="supplier" type="text" defaultValue={editingProduct?.supplier} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-background">Cancel</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              {editingProduct ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Adjust Stock: ${adjustingProduct?.name}`}
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Quantity Change (use negative for decrease)</label>
            <input type="number" required value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent" placeholder="e.g. -5, 10" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Reason</label>
            <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="sale">Sale (Decrease)</option>
              <option value="restock">Restock (Increase)</option>
              <option value="manual_adjustment">Manual Adjustment</option>
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-background">Cancel</button>
            <button type="submit" disabled={adjustMutation.isPending} className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              Confirm Adjustment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
