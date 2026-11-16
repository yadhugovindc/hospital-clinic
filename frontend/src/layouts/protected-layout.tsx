import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, Archive, BookOpenCheck, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined,
  ChevronDown, CircleUserRound, ClipboardList, FileClock, House, Layers3, LogOut, Menu,
  PanelLeftClose, PanelLeftOpen, Pill, Settings2, ShieldCheck, Stethoscope, UsersRound, Wallet, X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth, roleHome } from '../app/auth-context';
import { titleCase } from '../lib/format';
import type { Role } from '../types';

interface NavItem {
  to: string;
  adminTo?: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  { id: 'patients', label: 'Patient Management', icon: UsersRound, items: [
    { to: '/reception/patients', adminTo: '/admin/patients', label: 'Patients', icon: UsersRound, roles: ['admin', 'receptionist'] },
    { to: '/reception/tokens', adminTo: '/admin/tokens', label: 'Token queue', icon: CalendarDays, roles: ['admin', 'receptionist'] },
  ] },
  { id: 'clinical', label: 'Clinical Management', icon: Stethoscope, items: [
    { to: '/doctor/queue', adminTo: '/admin/doctor/queue', label: 'Doctor queue', icon: ClipboardList, roles: ['admin', 'doctor'] },
    { to: '/doctor/visits', label: 'Consultations', icon: BookOpenCheck, roles: ['admin', 'doctor'] },
  ] },
  { id: 'pharmacy', label: 'Pharmacy', icon: Pill, items: [
    { to: '/pharmacy/medicines', adminTo: '/admin/pharmacy/medicines', label: 'Medicines', icon: Pill, roles: ['admin', 'pharmacist'] },
    { to: '/pharmacy/stock', adminTo: '/admin/pharmacy/stock', label: 'Stock & expiry', icon: Archive, roles: ['admin', 'pharmacist'] },
    { to: '/pharmacy/suppliers', adminTo: '/admin/pharmacy/suppliers', label: 'Suppliers', icon: BriefcaseBusiness, roles: ['admin', 'pharmacist'] },
    { to: '/pharmacy/purchases', adminTo: '/admin/pharmacy/purchases', label: 'Purchases', icon: ClipboardList, roles: ['admin', 'pharmacist'] },
    { to: '/pharmacy/bills', adminTo: '/admin/pharmacy/bills', label: 'Pharmacy bills', icon: Wallet, roles: ['admin', 'pharmacist'] },
  ] },
  { id: 'therapy', label: 'Therapy', icon: Activity, items: [
    { to: '/doctor/procedures/catalog', adminTo: '/admin/procedures/catalog', label: 'Procedure catalog', icon: Layers3, roles: ['admin', 'doctor'] },
    { to: '/doctor/plans', adminTo: '/admin/procedures/plans', label: 'Therapy plans', icon: BookOpenCheck, roles: ['admin', 'doctor'] },
    { to: '/therapist/plans', adminTo: '/admin/procedures/plans', label: 'Assigned plans', icon: BookOpenCheck, roles: ['therapist'] },
    { to: '/doctor/sessions', adminTo: '/admin/procedures/sessions', label: 'Therapy sessions', icon: CalendarDays, roles: ['admin', 'doctor'] },
    { to: '/therapist/sessions', adminTo: '/admin/procedures/sessions', label: 'My sessions', icon: CalendarDays, roles: ['therapist'] },
  ] },
  { id: 'finance', label: 'Finance', icon: Wallet, items: [
    { to: '/accounts/daybook', adminTo: '/admin/accounts/daybook', label: 'Day book', icon: FileClock, roles: ['admin', 'accountant'] },
    { to: '/accounts/expenses', adminTo: '/admin/accounts/expenses', label: 'Expenses', icon: Wallet, roles: ['admin', 'accountant'] },
    { to: '/accounts/reports', adminTo: '/admin/accounts/reports', label: 'Financial reports', icon: ChartNoAxesCombined, roles: ['admin', 'accountant'] },
  ] },
  { id: 'administration', label: 'Administration', icon: ShieldCheck, items: [
    { to: '/admin/users', label: 'Staff accounts', icon: UsersRound, roles: ['admin'] },
    { to: '/admin/settings', label: 'Clinic settings', icon: Settings2, roles: ['admin'] },
    { to: '/admin/audit', label: 'Audit log', icon: FileClock, roles: ['admin'] },
  ] },
];

export default function ProtectedLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sections = SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => user && item.roles.includes(user.role)) })).filter((section) => section.items.length > 0);
  const compact = collapsed && !open;

  useEffect(() => {
    const activeSection = sections.find((section) => section.items.some((item) => location.pathname.startsWith(user?.role === 'admin' ? item.adminTo ?? item.to : item.to)));
    if (activeSection) setExpanded((current) => ({ ...current, [activeSection.id]: true }));
  }, [location.pathname, user?.role]);

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white text-gray-800 shadow-xl transition-all duration-200 lg:static lg:translate-x-0 lg:shadow-none ${compact ? 'lg:w-[76px]' : 'lg:w-64'} ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex h-16 shrink-0 items-center border-b border-gray-100 px-4 ${compact ? 'lg:justify-center lg:px-2' : 'gap-3'}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-700 text-white"><Stethoscope size={19} /></span>
          <div className={compact ? 'lg:hidden' : ''}>
            <p className="text-sm font-semibold leading-tight text-gray-900">Ayurvedic Clinic</p>
            <p className="mt-0.5 text-[11px] text-gray-500">{titleCase(user?.role)} workspace</p>
          </div>
          <button className="ml-auto rounded p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          <NavItem to={roleHome(user?.role)} label="Dashboard" icon={House} compact={compact} onClick={() => setOpen(false)} />
          <div className="space-y-4">
            {sections.map((section) => {
              const expandedSection = expanded[section.id] ?? true;
              const SectionIcon = section.icon;
              const sectionActive = section.items.some((item) => location.pathname.startsWith(user?.role === 'admin' ? item.adminTo ?? item.to : item.to));
              return <section key={section.id}>
                <button
                  type="button"
                  title={compact ? section.label : undefined}
                  aria-expanded={expandedSection}
                  onClick={() => setExpanded((current) => ({ ...current, [section.id]: !(current[section.id] ?? true) }))}
                  className={`flex w-full items-center rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${sectionActive ? 'text-brand-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'} ${compact ? 'lg:justify-center lg:px-0' : 'gap-2'}`}
                >
                  <SectionIcon size={16} className="shrink-0" />
                  <span className={compact ? 'lg:hidden' : ''}>{section.label}</span>
                  <ChevronDown size={14} className={`ml-auto transition-transform ${expandedSection ? '' : '-rotate-90'} ${compact ? 'lg:hidden' : ''}`} />
                </button>
                {expandedSection && <div className={`mt-1 space-y-1 ${compact ? 'lg:mt-1' : 'pl-2'}`}>
                  {section.items.map((item) => <NavItem key={`${section.id}-${item.label}`} to={user?.role === 'admin' ? item.adminTo ?? item.to : item.to} label={item.label} icon={item.icon} compact={compact} onClick={() => setOpen(false)} />)}
                </div>}
              </section>;
            })}
          </div>
        </nav>
        <div className={`hidden shrink-0 border-t border-gray-100 p-3 lg:block ${compact ? 'text-center' : ''}`}>
          <button type="button" onClick={() => setCollapsed((value) => !value)} title={compact ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} className={`inline-flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 ${compact ? 'justify-center px-0' : 'gap-2'}`}>
            {compact ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} /><span>Collapse sidebar</span></>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
          <button className="rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <div className="hidden text-right sm:block"><p className="text-sm font-medium text-gray-900">{user.name}</p><p className="text-xs text-gray-500">{titleCase(user.role)}</p></div>
            )}
            <NavLink to="/profile" aria-label="My profile" title="My profile" className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><CircleUserRound size={17} /></NavLink>
            <button onClick={() => void handleLogout()} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"><LogOut size={14} /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}

function NavItem({ to, label, icon: Icon, compact, onClick }: { to: string; label: string; icon: LucideIcon; compact: boolean; onClick: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={compact ? label : undefined}
      className={({ isActive }) => `flex items-center rounded-md px-3 py-2 text-sm transition-colors ${compact ? 'lg:justify-center lg:px-0' : 'gap-3'} ${isActive ? 'bg-brand-50 font-medium text-brand-800 ring-1 ring-inset ring-brand-100' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
    >
      <Icon size={17} className="shrink-0" />
      <span className={compact ? 'lg:hidden' : ''}>{label}</span>
    </NavLink>
  );
}
