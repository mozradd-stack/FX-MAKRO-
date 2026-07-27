import { NavLink } from 'react-router-dom';
import { LineChart, Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useDarkMode } from '@/hooks/useDarkMode';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/pairs', label: 'Pairs' },
  { to: '/central-banks', label: 'Central Banks' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/news', label: 'News' },
  { to: '/correlation', label: 'Korrelation' },
  { to: '/settings', label: 'Settings' },
];

export function Navbar() {
  const { dark, toggle } = useDarkMode();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <LineChart className="h-5 w-5 text-accent" />
            <span>FX Macro</span>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground',
                    isActive && 'bg-surface text-foreground'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Sun className={cn('h-4 w-4', dark ? 'text-muted' : 'text-warning')} />
          <Switch checked={dark} onCheckedChange={toggle} aria-label="Dark mode umschalten" />
          <Moon className={cn('h-4 w-4', dark ? 'text-accent' : 'text-muted')} />
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn('whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted', isActive && 'bg-surface text-foreground')
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
