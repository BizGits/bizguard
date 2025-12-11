import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth, AppRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { 
  Shield, 
  User as UserIcon, 
  Chrome, 
  Globe, 
  Power, 
  PowerOff,
  Mail,
  Clock,
  Monitor,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserWithRole {
  id: string;
  email: string;
  display_name: string;
  last_seen_at: string;
  role: AppRole;
  extension_active: boolean | null;
  browser: string | null;
  browser_version: string | null;
  extension_version: string | null;
}

const getBrowserIcon = (browser: string | null) => {
  if (!browser) return <Globe className="w-4 h-4" />;
  const b = browser.toLowerCase();
  if (b.includes('chrome')) return <Chrome className="w-4 h-4" />;
  if (b.includes('edge')) return <Monitor className="w-4 h-4" />;
  if (b.includes('firefox')) return <Globe className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
};

export default function Users() {
  const { isAdmin, profile, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      fetchUsers();
    }
  }, [authLoading]);

  // Real-time subscription for profile updates
  useEffect(() => {
    const channel = supabase
      .channel('users-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        async (payload) => {
          setIsLive(true);
          
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setUsers(prev => prev.map(u => 
              u.id === updated.id 
                ? { 
                    ...u, 
                    display_name: updated.display_name,
                    last_seen_at: updated.last_seen_at,
                    extension_active: updated.extension_active,
                    browser: updated.browser,
                    browser_version: updated.browser_version,
                    extension_version: updated.extension_version,
                  }
                : u
            ));
          } else if (payload.eventType === 'INSERT') {
            // Refetch to get the complete user with roles
            await fetchUsers();
          }

          setTimeout(() => setIsLive(false), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Merge profiles with roles
      const usersWithRoles = profilesData?.map(profile => {
        const userRole = rolesData?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          display_name: profile.display_name,
          last_seen_at: profile.last_seen_at,
          role: (userRole?.role as AppRole) || 'MANAGEMENT',
          extension_active: profile.extension_active,
          browser: profile.browser,
          browser_version: profile.browser_version,
          extension_version: profile.extension_version,
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    if (userId === profile?.id) {
      toast({
        title: 'Error',
        description: "You cannot change your own role",
        variant: 'destructive',
      });
      return;
    }

    try {
      // Check if user has a role entry
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast({
        title: 'Role updated',
        description: `User role changed to ${newRole}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  const isUserOnline = (lastSeen: string) => {
    const tenMinsAgo = new Date();
    tenMinsAgo.setMinutes(tenMinsAgo.getMinutes() - 10);
    return new Date(lastSeen) >= tenMinsAgo;
  };

  const onlineCount = users.filter(u => isUserOnline(u.last_seen_at)).length;
  const activeExtensions = users.filter(u => u.extension_active).length;

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
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Users</h1>
            <p className="text-muted-foreground mt-1">Monitor extension users and their status</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
            isLive 
              ? 'bg-success/20 text-success animate-pulse' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <Zap className={`w-3 h-3 ${isLive ? 'animate-bounce' : ''}`} />
            {isLive ? 'Live Update' : 'Real-time'}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="glass" className="animate-slide-up">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-3xl font-semibold text-foreground mt-1">{users.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Online Now</p>
                  <p className="text-3xl font-semibold text-foreground mt-1">{onlineCount}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                  <div className="relative">
                    <Power className="w-6 h-6 text-success" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Extensions Active</p>
                  <p className="text-3xl font-semibold text-foreground mt-1">{activeExtensions}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-info/10 flex items-center justify-center">
                  <Chrome className="w-6 h-6 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users list */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">All Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-muted-foreground">No users found</p>
            ) : (
              <div className="space-y-4">
                {users.map((user, index) => (
                  <div 
                    key={user.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-2xl bg-card border border-border/50 hover:border-border transition-colors animate-slide-up gap-4"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* User info */}
                    <div className="flex items-start lg:items-center gap-4 flex-1">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
                          {user.role === 'ADMIN' ? (
                            <Shield className="w-6 h-6 text-primary" />
                          ) : (
                            <UserIcon className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        {/* Online indicator */}
                        <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card ${
                          isUserOnline(user.last_seen_at) ? 'bg-success' : 'bg-muted'
                        }`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{user.display_name}</p>
                          <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {isUserOnline(user.last_seen_at) 
                              ? 'Online now' 
                              : `Last seen ${formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true })}`
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Extension status */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-6">
                      {/* Browser info */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/50">
                        {getBrowserIcon(user.browser)}
                        <div className="text-xs">
                          <p className="font-medium text-foreground">
                            {user.browser || 'Unknown Browser'}
                          </p>
                          {user.browser_version && (
                            <p className="text-muted-foreground">v{user.browser_version}</p>
                          )}
                        </div>
                      </div>

                      {/* Extension status */}
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                        user.extension_active 
                          ? 'bg-success/10 text-success' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {user.extension_active ? (
                          <Power className="w-4 h-4" />
                        ) : (
                          <PowerOff className="w-4 h-4" />
                        )}
                        <div className="text-xs">
                          <p className="font-medium">
                            Extension {user.extension_active ? 'Active' : 'Inactive'}
                          </p>
                          {user.extension_version && (
                            <p className="opacity-70">v{user.extension_version}</p>
                          )}
                        </div>
                      </div>

                      {/* Role actions - Admin only */}
                      {isAdmin && user.id !== profile?.id && (
                        <div className="flex gap-2">
                          {user.role === 'MANAGEMENT' ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateUserRole(user.id, 'ADMIN')}
                            >
                              Make Admin
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => updateUserRole(user.id, 'MANAGEMENT')}
                            >
                              Remove Admin
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
