import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Tags, 
  Users, 
  LogOut, 
  Menu,
  X,
  ChevronRight,
  Activity,
  Settings,
  FileBarChart,
  Puzzle,
  UserPlus
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import { NotificationBell } from '@/components/dashboard/NotificationBell';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Events', href: '/dashboard/events', icon: <Activity className="w-5 h-5" /> },
  { label: 'Users', href: '/dashboard/users', icon: <Users className="w-5 h-5" /> },
  { label: 'Brands', href: '/dashboard/brands', icon: <Tags className="w-5 h-5" /> },
  { label: 'Invitations', href: '/dashboard/invitations', icon: <UserPlus className="w-5 h-5" />, adminOnly: true },
  { label: 'Extensions', href: '/dashboard/extensions', icon: <Puzzle className="w-5 h-5" /> },
  { label: 'Reports', href: '/dashboard/reports', icon: <FileBarChart className="w-5 h-5" /> },
  { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="w-5 h-5" /> },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-72 glass-panel border-r border-glass-border/20 transform transition-transform duration-300 ease-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-glass-border/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={logo} alt="BizGuard" className="w-10 h-10 object-contain" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">BizGuard</h1>
                  <p className="text-xs text-muted-foreground">v5 Dashboard</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
                    isActive 
                      ? "bg-primary/15 text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <span className={cn(
                    "transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {item.icon}
                  </span>
                  {item.label}
                  {isActive && (
                    <ChevronRight className="w-4 h-4 ml-auto text-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-glass-border/20">
            <div className="glass-panel p-4 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-sm font-medium text-foreground">
                    {profile?.displayName?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile?.displayName || 'Loading...'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile?.role || 'User'}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Desktop header */}
        <header className="hidden lg:flex glass border-b border-glass-border/20 px-6 py-3 sticky top-0 z-30">
          <div className="flex items-center justify-end w-full">
            <NotificationBell />
          </div>
        </header>

        {/* Mobile header */}
        <header className="lg:hidden glass border-b border-glass-border/20 px-4 py-3 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={logo} alt="BizGuard" className="w-8 h-8 object-contain" />
              <span className="font-semibold">BizGuard</span>
            </div>
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 lg:p-8">
          {children}
        </div>

        {/* Footer */}
        <footer className="border-t border-glass-border/20 px-4 py-3">
          <div className="text-center">
            <Link 
              to="/privacy-policy" 
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
