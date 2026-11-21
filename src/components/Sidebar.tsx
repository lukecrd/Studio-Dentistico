import { useState } from 'react';
import {
  Calendar,
  CalendarX2,
  Users,
  Stethoscope,
  UserCheck,
  ArrowUpRight,
  Mail,
  DoorOpen,
  ClipboardList,
  MoreHorizontal,
  LogOut,
  X,
} from 'lucide-react';
import type { PageKey, User } from '../types';
import { BrandMark } from './BrandMark';

interface SidebarProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  user: User;
  openCancellationsCount: number;
  pendingApprovalCount: number;
  preparedRemindersCount: number;
  onLogout: () => void;
}

interface NavItem {
  key: PageKey;
  label: string;
  section: 'operativita' | 'archivio' | 'sistema';
  icon: typeof Calendar;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'agenda', label: 'Agenda', section: 'operativita', icon: Calendar },
  { key: 'cancellations', label: 'Disdette', section: 'operativita', icon: CalendarX2 },
  { key: 'proposals', label: 'Anticipi', section: 'operativita', icon: ArrowUpRight },
  { key: 'reminders', label: 'Promemoria', section: 'operativita', icon: Mail },
  { key: 'patients', label: 'Clienti', section: 'archivio', icon: Users },
  { key: 'procedures', label: 'Trattamenti', section: 'archivio', icon: Stethoscope },
  { key: 'team', label: 'Professionisti', section: 'archivio', icon: UserCheck },
  { key: 'rooms', label: 'Stanze', section: 'archivio', icon: DoorOpen },
  { key: 'audit', label: 'Attività', section: 'sistema', icon: ClipboardList },
];

const MOBILE_PRIMARY_KEYS: PageKey[] = ['agenda', 'cancellations', 'proposals'];

export function Sidebar({
  currentPage,
  onNavigate,
  user,
  openCancellationsCount,
  pendingApprovalCount,
  preparedRemindersCount,
  onLogout,
}: SidebarProps) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const getCounter = (key: PageKey): number => {
    if (key === 'cancellations') return openCancellationsCount;
    if (key === 'proposals') return pendingApprovalCount;
    if (key === 'reminders') return preparedRemindersCount;
    return 0;
  };

  const renderGroup = (title: string, section: NavItem['section']) => {
    const items = NAV_ITEMS.filter((item) => item.section === section);
    return (
      <div className="mb-5">
        <div className="px-3 mb-1.5 text-[11px] font-medium text-[var(--color-muted)] tracking-tight">
          {title}
        </div>
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.key;
            const counter = getCounter(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`w-full min-h-[40px] flex items-center gap-3 px-3 rounded-lg text-[13.5px] transition-colors duration-150 whitespace-nowrap ${
                  active
                    ? 'bg-white text-[var(--color-clinical)] font-semibold border border-[var(--color-line)] shadow-[0_1px_2px_rgba(24,35,29,0.04)]'
                    : 'text-[var(--color-ink-soft)] hover:bg-[#e5eae2] hover:text-[var(--color-ink)] font-medium border border-transparent'
                }`}
              >
                <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={active ? 2 : 1.75} />
                <span className="truncate">{item.label}</span>
                {counter > 0 && (
                  <span
                    className={`ml-auto font-mono text-[11px] tabular-nums font-semibold ${
                      active ? 'text-[var(--color-clinical)]' : 'text-[var(--color-warn)]'
                    }`}
                  >
                    {counter}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const secondaryMobileItems = NAV_ITEMS.filter(
    (item) => !MOBILE_PRIMARY_KEYS.includes(item.key)
  );
  const isSecondaryActive = secondaryMobileItems.some((item) => item.key === currentPage);

  return (
    <>
      {/* Desktop Left Rail */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-[248px] flex-col bg-[var(--color-rail)] border-r border-[var(--color-line)] px-4 py-6">
        <div className="flex items-center gap-3 px-2 pb-6 mb-4 border-b border-[var(--color-line)]">
          <BrandMark />
          <div className="min-w-0">
            <div className="font-[var(--font-display)] text-[16px] font-bold tracking-[-0.025em] text-[var(--color-ink)] leading-tight whitespace-nowrap">
              AgendaSmart
            </div>
            <div className="text-[11px] text-[var(--color-muted)] leading-tight mt-0.5 truncate">
              Studio Odontoiatrico
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto" aria-label="Navigazione principale">
          {renderGroup('Operatività', 'operativita')}
          {renderGroup('Archivio clinico', 'archivio')}
          {renderGroup('Tracciabilità', 'sistema')}
        </nav>

        <div className="pt-4 mt-4 border-t border-[var(--color-line)] flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] flex items-center justify-center text-xs font-bold shrink-0">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--color-ink)] truncate">
                {user.username}
              </div>
              <div className="text-[11px] text-[var(--color-muted)] truncate">
                Segreteria · {user.role}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Esci dalla sessione"
            aria-label="Esci dalla sessione"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[#e5eae2] transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (compact <= 64px to stay well under 15% mobile sticky cap) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white border-t border-[var(--color-line)] px-2 grid grid-cols-4 items-center gap-1"
        aria-label="Navigazione mobile"
      >
        {MOBILE_PRIMARY_KEYS.map((key) => {
          const item = NAV_ITEMS.find((n) => n.key === key)!;
          const Icon = item.icon;
          const active = currentPage === key;
          const counter = getCounter(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onNavigate(key);
                setMobileMoreOpen(false);
              }}
              className={`min-h-[48px] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] font-semibold'
                  : 'text-[var(--color-muted)]'
              }`}
            >
              <div className="relative">
                <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2 : 1.75} />
                {counter > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 font-mono text-[10px] font-bold text-[var(--color-warn)] tabular-nums">
                    {counter}
                  </span>
                )}
              </div>
              <span className="truncate max-w-full px-1">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMoreOpen((v) => !v)}
          aria-expanded={mobileMoreOpen}
          className={`min-h-[48px] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            mobileMoreOpen || isSecondaryActive
              ? 'bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] font-semibold'
              : 'text-[var(--color-muted)]'
          }`}
        >
          {mobileMoreOpen ? (
            <X className="w-[18px] h-[18px]" />
          ) : (
            <MoreHorizontal className="w-[18px] h-[18px]" />
          )}
          <span>Altro</span>
        </button>
      </nav>

      {/* Mobile "Altro" Menu Popover */}
      {mobileMoreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/20"
          onClick={() => setMobileMoreOpen(false)}
        >
          <div
            className="absolute right-3 bottom-20 w-60 bg-white border border-[var(--color-line)] rounded-xl shadow-lg p-2 space-y-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {secondaryMobileItems.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.key;
              const counter = getCounter(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onNavigate(item.key);
                    setMobileMoreOpen(false);
                  }}
                  className={`w-full min-h-[44px] flex items-center gap-3 px-3 rounded-lg text-[13px] transition-colors ${
                    active
                      ? 'bg-[var(--color-clinical-tint)] text-[var(--color-clinical)] font-semibold'
                      : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-subtle)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {counter > 0 && (
                    <span className="ml-auto font-mono text-[11px] font-semibold text-[var(--color-warn)] tabular-nums">
                      {counter}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="my-1.5 border-t border-[var(--color-line)]" />
            <button
              type="button"
              onClick={onLogout}
              className="w-full min-h-[44px] flex items-center gap-3 px-3 rounded-lg text-[13px] text-[var(--color-alert)] hover:bg-[var(--color-alert-tint)] transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Esci ({user.username})</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
