import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Search, Building2, Tag, Shield } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { sanitizeDbError } from '@/lib/errorUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Brand {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  terms: { id: string; term: string }[];
}

export default function Brands() {
  const { isLoading: authLoading } = useAuth();
  const canEdit = true; // Both ADMIN and MANAGEMENT can edit
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingName, setEditingName] = useState('');
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);

  useEffect(() => {
    if (!authLoading) {
      fetchBrands();
    }
  }, [authLoading]);

  useEffect(() => {
    if (selectedBrand) {
      setEditingName(selectedBrand.name);
    }
  }, [selectedBrand]);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select(`
          id,
          name,
          slug,
          is_active,
          brand_terms (id, term)
        `)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;

      setBrands(data?.map(b => ({
        ...b,
        terms: b.brand_terms || []
      })) || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast({
        title: 'Error',
        description: 'Failed to load brands',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createBrand = async () => {
    const trimmedName = newBrandName.trim();
    if (!trimmedName) return;

    // Input validation
    if (trimmedName.length > 100) {
      toast({
        title: 'Error',
        description: 'Brand name must be 100 characters or less',
        variant: 'destructive',
      });
      return;
    }

    const slug = trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    try {
      const { data, error } = await supabase
        .from('brands')
        .insert({ name: trimmedName, slug })
        .select()
        .single();

      if (error) throw error;

      // Log brand created event
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('events').insert({
          user_id: user.id,
          action: 'BRAND_CREATED',
          brand_id: data.id,
          term: trimmedName,
        });
      }

      const newBrand = { ...data, terms: [] };
      setBrands([...brands, newBrand]);
      setSelectedBrand(newBrand);
      setNewBrandName('');
      setIsCreating(false);
      toast({
        title: 'Brand created',
        description: `${trimmedName} has been created`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: sanitizeDbError(error, 'Failed to create brand'),
        variant: 'destructive',
      });
    }
  };

  const updateBrandName = async () => {
    const trimmedName = editingName.trim();
    if (!selectedBrand || !trimmedName || trimmedName === selectedBrand.name) return;

    // Input validation
    if (trimmedName.length > 100) {
      toast({
        title: 'Error',
        description: 'Brand name must be 100 characters or less',
        variant: 'destructive',
      });
      return;
    }

    const newSlug = trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    try {
      const { error } = await supabase
        .from('brands')
        .update({ name: trimmedName, slug: newSlug })
        .eq('id', selectedBrand.id);

      if (error) throw error;

      const updatedBrand = { ...selectedBrand, name: trimmedName, slug: newSlug };
      setSelectedBrand(updatedBrand);
      setBrands(brands.map(b => b.id === selectedBrand.id ? updatedBrand : b));
      toast({
        title: 'Brand updated',
        description: 'Brand name has been updated',
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: sanitizeDbError(error, 'Failed to update brand'),
        variant: 'destructive',
      });
    }
  };

  const toggleBrandActive = async (brand: Brand) => {
    try {
      const { error } = await supabase
        .from('brands')
        .update({ is_active: !brand.is_active })
        .eq('id', brand.id);

      if (error) throw error;

      const updatedBrand = { ...brand, is_active: !brand.is_active };
      setBrands(brands.map(b => b.id === brand.id ? updatedBrand : b));
      if (selectedBrand?.id === brand.id) {
        setSelectedBrand(updatedBrand);
      }
      toast({
        title: brand.is_active ? 'Brand deactivated' : 'Brand activated',
        description: `${brand.name} is now ${brand.is_active ? 'inactive' : 'active'}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update brand',
        variant: 'destructive',
      });
    }
  };

  const deleteBrand = async (brand: Brand) => {
    try {
      // Soft delete - set deleted_at timestamp
      const { error } = await supabase
        .from('brands')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', brand.id);

      if (error) throw error;

      // Log brand deleted event
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('events').insert({
          user_id: user.id,
          action: 'BRAND_DELETED',
          brand_id: brand.id,
          term: brand.name,
        });
      }

      setBrands(brands.filter(b => b.id !== brand.id));
      if (selectedBrand?.id === brand.id) setSelectedBrand(null);
      setBrandToDelete(null);
      toast({
        title: 'Brand deleted',
        description: `${brand.name} has been removed. You can restore it from the Events page.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete brand',
        variant: 'destructive',
      });
    }
  };

  const addTerm = async () => {
    if (!selectedBrand) return;
    
    const trimmedTerm = newTerm.trim().toLowerCase();
    if (!trimmedTerm) return;

    // Input validation
    if (trimmedTerm.length > 200) {
      toast({
        title: 'Error',
        description: 'Term must be 200 characters or less',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate before inserting
    const existingTerm = selectedBrand.terms.find(t => t.term === trimmedTerm);
    if (existingTerm) {
      toast({
        title: 'Error',
        description: 'This term already exists for this brand',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('brand_terms')
        .insert({ brand_id: selectedBrand.id, term: trimmedTerm })
        .select()
        .single();

      if (error) throw error;

      const updatedBrand = {
        ...selectedBrand,
        terms: [...selectedBrand.terms, data]
      };
      setSelectedBrand(updatedBrand);
      setBrands(brands.map(b => b.id === selectedBrand.id ? updatedBrand : b));
      setNewTerm('');
      toast({
        title: 'Term added',
        description: `"${trimmedTerm}" added to ${selectedBrand.name}`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: sanitizeDbError(error, 'Failed to add term'),
        variant: 'destructive',
      });
    }
  };

  const deleteTerm = async (termId: string) => {
    if (!selectedBrand) return;

    try {
      const { error } = await supabase
        .from('brand_terms')
        .delete()
        .eq('id', termId);

      if (error) throw error;

      const updatedBrand = {
        ...selectedBrand,
        terms: selectedBrand.terms.filter(t => t.id !== termId)
      };
      setSelectedBrand(updatedBrand);
      setBrands(brands.map(b => b.id === selectedBrand.id ? updatedBrand : b));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete term',
        variant: 'destructive',
      });
    }
  };

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Brands</h1>
            <p className="text-muted-foreground mt-1">
              Manage protected brands and their terms
            </p>
          </div>
          {canEdit && (
            <Button 
              onClick={() => setIsCreating(true)} 
              disabled={isCreating}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-150 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Brand
            </Button>
          )}
        </div>

        {/* Create brand modal/form */}
        {isCreating && canEdit && (
          <Card variant="glass" className="animate-scale-in border border-border/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Create New Brand</h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Brand name (e.g., Liquid Brokers)"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createBrand()}
                  autoFocus
                  className="bg-background/50"
                />
                <Button onClick={createBrand} className="bg-gradient-to-r from-primary to-primary/80">
                  Create
                </Button>
                <Button variant="ghost" onClick={() => { setIsCreating(false); setNewBrandName(''); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Brands list */}
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-border/50"
              />
            </div>

            {/* Brand cards */}
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {filteredBrands.length === 0 ? (
                <Card variant="glass" className="border border-border/30">
                  <CardContent className="p-6 text-center">
                    <Building2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No brands match your search.' : 'No brands yet.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredBrands.map((brand, index) => (
                  <Card 
                    key={brand.id} 
                    variant="glass"
                    className={`cursor-pointer transition-all duration-200 animate-slide-up border ${
                      selectedBrand?.id === brand.id 
                        ? 'ring-2 ring-primary border-primary/50 bg-primary/5' 
                        : 'border-border/30 hover:border-border/50 hover:bg-accent/20'
                    }`}
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => setSelectedBrand(brand)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-foreground truncate">{brand.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {brand.terms.length} term{brand.terms.length !== 1 ? 's' : ''}
                            </span>
                            <Badge 
                              variant={brand.is_active ? 'default' : 'secondary'}
                              className={`text-xs ${brand.is_active ? 'bg-success/20 text-success border-success/30' : 'bg-muted text-muted-foreground'}`}
                            >
                              {brand.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Brand detail panel */}
          <Card variant="glass" className="lg:col-span-2 animate-slide-up border border-border/30" style={{ animationDelay: '100ms' }}>
            {selectedBrand ? (
              <>
                <CardHeader className="border-b border-border/30 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {canEdit ? (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand Name</label>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={updateBrandName}
                            onKeyDown={(e) => e.key === 'Enter' && updateBrandName()}
                            className="text-xl font-semibold bg-background/50 border-border/50"
                          />
                        </div>
                      ) : (
                        <CardTitle className="text-2xl">{selectedBrand.name}</CardTitle>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          Slug: <code className="px-2 py-0.5 rounded bg-muted/50 text-xs">{selectedBrand.slug}</code>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canEdit && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Active</span>
                            <Switch
                              checked={selectedBrand.is_active}
                              onCheckedChange={() => toggleBrandActive(selectedBrand)}
                            />
                          </div>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => setBrandToDelete(selectedBrand)}
                            className="hover:scale-[1.02] transition-transform"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Add term - Admin only */}
                  {canEdit && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium text-foreground">Add Term</h4>
                      </div>
                      <div className="flex gap-3">
                        <Input
                          placeholder="Enter term (e.g., liquidbrokers.com)"
                          value={newTerm}
                          onChange={(e) => setNewTerm(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addTerm()}
                          className="bg-background/50 border-border/50"
                        />
                        <Button onClick={addTerm} className="bg-gradient-to-r from-primary to-primary/80">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Terms list */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium text-foreground">
                        Protected Terms ({selectedBrand.terms.length})
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These terms belong to this brand. When another brand is active in the extension, 
                      using these terms will trigger a brand mismatch alert.
                    </p>
                    {selectedBrand.terms.length === 0 ? (
                      <div className="p-6 rounded-xl bg-muted/20 border border-dashed border-border/50 text-center">
                        <Tag className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No terms added yet.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedBrand.terms.map((term) => (
                          <span 
                            key={term.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/50 border border-border/30 text-sm text-foreground group transition-all hover:bg-accent/70"
                          >
                            {term.term}
                            {canEdit && (
                              <button 
                                onClick={() => deleteTerm(term.id)}
                                className="w-4 h-4 rounded-full hover:bg-destructive/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="p-6 flex flex-col items-center justify-center h-[400px] text-center">
                <Building2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Brand Selected</h3>
                <p className="text-muted-foreground max-w-sm">
                  Select a brand from the list to view its details{canEdit ? ' or create a new one to begin.' : '.'}
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!brandToDelete} onOpenChange={(open) => !open && setBrandToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brand</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{brandToDelete?.name}</strong>? 
              This will remove the brand and all its terms from active use. 
              You can restore it later from the Events page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => brandToDelete && deleteBrand(brandToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Brand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
