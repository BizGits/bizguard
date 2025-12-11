import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

interface Brand {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  terms: { id: string; term: string }[];
}

export default function Brands() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard');
      return;
    }
    if (!authLoading && isAdmin) {
      fetchBrands();
    }
  }, [isAdmin, authLoading, navigate]);

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
    if (!newBrandName.trim()) return;

    const slug = newBrandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    try {
      const { data, error } = await supabase
        .from('brands')
        .insert({ name: newBrandName.trim(), slug })
        .select()
        .single();

      if (error) throw error;

      setBrands([...brands, { ...data, terms: [] }]);
      setNewBrandName('');
      setIsCreating(false);
      toast({
        title: 'Brand created',
        description: `${newBrandName} has been created`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create brand',
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

      setBrands(brands.map(b => 
        b.id === brand.id ? { ...b, is_active: !b.is_active } : b
      ));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update brand',
        variant: 'destructive',
      });
    }
  };

  const deleteBrand = async (brandId: string) => {
    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId);

      if (error) throw error;

      setBrands(brands.filter(b => b.id !== brandId));
      if (selectedBrand?.id === brandId) setSelectedBrand(null);
      toast({
        title: 'Brand deleted',
        description: 'Brand has been removed',
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
    if (!selectedBrand || !newTerm.trim()) return;

    try {
      const { data, error } = await supabase
        .from('brand_terms')
        .insert({ brand_id: selectedBrand.id, term: newTerm.trim().toLowerCase() })
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
        description: `"${newTerm}" added to ${selectedBrand.name}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add term',
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Brands</h1>
            <p className="text-muted-foreground mt-1">Manage protected brands and their terms</p>
          </div>
          <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
            <Plus className="w-4 h-4 mr-2" />
            Add Brand
          </Button>
        </div>

        {/* Create brand form */}
        {isCreating && (
          <Card variant="glass" className="animate-scale-in">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <Input
                  placeholder="Brand name (e.g., Liquid Brokers)"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createBrand()}
                  autoFocus
                />
                <Button onClick={createBrand}>
                  <Save className="w-4 h-4 mr-2" />
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
          <div className="space-y-3">
            {brands.length === 0 ? (
              <Card variant="glass">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No brands yet. Create your first brand.</p>
                </CardContent>
              </Card>
            ) : (
              brands.map((brand, index) => (
                <Card 
                  key={brand.id} 
                  variant="glass"
                  className={`cursor-pointer transition-all duration-200 animate-slide-up ${
                    selectedBrand?.id === brand.id 
                      ? 'ring-2 ring-primary' 
                      : 'hover:bg-accent/30'
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => setSelectedBrand(brand)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">{brand.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {brand.terms.length} term{brand.terms.length !== 1 ? 's' : ''} · {brand.slug}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBrandActive(brand); }}
                          className={`w-10 h-6 rounded-full transition-colors ${
                            brand.is_active ? 'bg-success' : 'bg-muted'
                          }`}
                        >
                          <span className={`block w-4 h-4 rounded-full bg-foreground transition-transform mx-1 ${
                            brand.is_active ? 'translate-x-4' : ''
                          }`} />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Brand detail panel */}
          <Card variant="glass" className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
            {selectedBrand ? (
              <>
                <CardHeader className="border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedBrand.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Slug: {selectedBrand.slug}
                      </p>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => deleteBrand(selectedBrand.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Add term */}
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Add Term</h4>
                    <div className="flex gap-3">
                      <Input
                        placeholder="Enter competitor term (e.g., sway markets)"
                        value={newTerm}
                        onChange={(e) => setNewTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTerm()}
                      />
                      <Button onClick={addTerm}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Terms list */}
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">
                      Terms ({selectedBrand.terms.length})
                    </h4>
                    {selectedBrand.terms.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No terms added. Terms are competitor brand names to watch for.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedBrand.terms.map((term) => (
                          <span 
                            key={term.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent text-sm text-foreground group"
                          >
                            {term.term}
                            <button 
                              onClick={() => deleteTerm(term.id)}
                              className="w-4 h-4 rounded-full hover:bg-destructive/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="p-6 flex items-center justify-center h-64">
                <p className="text-muted-foreground">Select a brand to view details</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
