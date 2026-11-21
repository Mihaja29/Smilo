import { Building2, Landmark, Search, Filter, ArrowRight, ArrowLeftRight, Plus, X, ChevronDown, ChevronLeft, ChevronRight, User, LogOut, MoreVertical, Eye, EyeOff, Trash2, RotateCcw, ShieldCheck, Lock, AlertCircle, Check, ArrowUpAZ, ArrowDownAZ, Calendar, Pencil, Info, Palette, Sun, Moon, Monitor, Mail, MessageCircle, Send, Bot, History, ImagePlus } from 'lucide-react';


interface IconProps {
  className?: string;
}

// Icones de navigation principales
export const HomeIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      className={`select-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
};

export const AssignmentIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      className={`select-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 18c0-2 2.2-3.5 5-3.5s5 1.5 5 3.5" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <line x1="16" y1="2" x2="16" y2="5" />
    </svg>
  );
};

export const DentistryIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      className={`select-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2C8.5 2 6 4.5 6 8.5c0 3 1.2 5 2 8 .6 2.2 1.2 4.5 2.5 4.5s2-3 2.5-5.5c.3-1.5 1-2 1-2s.7.5 1 2c.5 2.5 1.2 5.5 2.5 5.5s1.9-2.3 2.5-4.5c.8-3 2-5 2-8C20 4.5 17.5 2 14 2c-1 0-1.6.4-2 1-.4-.6-1-1-2-1z" />
    </svg>
  );
};

export const CoverageIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      className={`select-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
};

export const SettingsIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      className={`select-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
};

export const BuildingIcon = Building2;
export const BankIcon = Landmark;
export const SearchIcon = Search;
export const FilterIcon = Filter;
export const ArrowRightIcon = ArrowRight;
export const ArrowLeftIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <span
      className={`material-symbols-rounded inline-flex items-center justify-center leading-none select-none text-[18px] ${className}`}
      aria-hidden="true"
    >
      arrow_back_ios_new
    </span>
  );
};
export const DomainAddIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <span
      className={`material-symbols-rounded inline-flex items-center justify-center leading-none select-none text-[20px] ${className}`}
      aria-hidden="true"
    >
      domain_add
    </span>
  );
};
export const ScheduleIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <span
      className={`material-symbols-rounded inline-flex items-center justify-center leading-none select-none text-[16px] ${className}`}
      aria-hidden="true"
    >
      schedule
    </span>
  );
};
export const PlusIcon = Plus;
export const CloseIcon = X;
export const ChevronDownIcon = ChevronDown;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
export const UserIcon = User;
export const LogOutIcon = LogOut;
export const MoreVerticalIcon = MoreVertical;
export const EyeIcon = Eye;
export const EyeOffIcon = EyeOff;
export const TrashIcon = Trash2;
export const RestoreIcon = RotateCcw;
export const RotateCcwIcon = RotateCcw;
export const ShieldCheckIcon = ShieldCheck;
export const LockIcon = Lock;
export const AlertCircleIcon = AlertCircle;
export const CheckIcon = Check;
export const ArrowUpAZIcon = ArrowUpAZ;
export const ArrowDownAZIcon = ArrowDownAZ;
export const CalendarIcon = Calendar;
export const EditIcon = Pencil;
export const InfoIcon = Info;
export const ArrowLeftRightIcon = ArrowLeftRight;
export const PaletteIcon = Palette;
export const SunIcon = Sun;
export const MoonIcon = Moon;
export const MonitorIcon = Monitor;
export const MailIcon = Mail;
export const MessageCircleIcon = MessageCircle;
export const SendIcon = Send;
export const BotIcon = Bot;
export const HistoryIcon = History;
export const ImagePlusIcon = ImagePlus;

export const GoogleIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
};


