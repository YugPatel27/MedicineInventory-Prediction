import React from 'react';

function SvgWrapper({ children, className = 'h-5 w-5', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export const Menu = (props) => (
  <SvgWrapper {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </SvgWrapper>
);

export const Sun = (props) => (
  <SvgWrapper {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </SvgWrapper>
);

export const Moon = (props) => (
  <SvgWrapper {...props}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </SvgWrapper>
);

export const Bell = (props) => (
  <SvgWrapper {...props}>
    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </SvgWrapper>
);

export const LogOut = (props) => (
  <SvgWrapper {...props}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </SvgWrapper>
);

export const Home = (props) => (
  <SvgWrapper {...props}>
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z" />
  </SvgWrapper>
);

export const Box = (props) => (
  <SvgWrapper {...props}>
    <path d="M21 16V8a2 2 0 00-1-1.73L13 3a2 2 0 00-2 0L4 6.27A2 2 0 003 8v8a2 2 0 001 1.73L11 21a2 2 0 002 0l7-3.27A2 2 0 0021 16z" />
  </SvgWrapper>
);

export const TrendingUp = (props) => (
  <SvgWrapper {...props}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M14 7h7v7" />
  </SvgWrapper>
);

export const BarChart3 = (props) => (
  <SvgWrapper {...props}>
    <path d="M3 3v18h18" />
    <path d="M7 12v6M12 7v11M17 3v15" />
  </SvgWrapper>
);

export const UploadCloud = (props) => (
  <SvgWrapper {...props}>
    <path d="M16 16l-4-4-4 4" />
    <path d="M12 12v9" />
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 104 16.3" />
  </SvgWrapper>
);

export const Calendar = (props) => (
  <SvgWrapper {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 11h18" />
  </SvgWrapper>
);

export const Filter = (props) => (
  <SvgWrapper {...props}>
    <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
  </SvgWrapper>
);

export const Edit2 = (props) => (
  <SvgWrapper {...props}>
    <path d="M4 20h4l10.5-10.5a1.5 1.5 0 000-2.1l-1.9-1.9a1.5 1.5 0 00-2.1 0L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </SvgWrapper>
);

export const Trash2 = (props) => (
  <SvgWrapper {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
    <path d="M10 11v5M14 11v5" />
  </SvgWrapper>
);

export const Phone = (props) => (
  <SvgWrapper {...props}>
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.12.88.33 1.75.62 2.59a2 2 0 01-.45 2.11L8 9a16 16 0 006 6l.58-.3a2 2 0 012.11-.45c.84.29 1.71.5 2.59.62A2 2 0 0122 16.92z" />
  </SvgWrapper>
);

export const Mail = (props) => (
  <SvgWrapper {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </SvgWrapper>
);

export const Settings = (props) => (
  <SvgWrapper {...props}>
    <path d="M12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82L4.21 4.21A2 2 0 017 1.38l.06.06A1.65 1.65 0 009 1.77V1a2 2 0 014 0v.77c.37.1.72.28 1.02.53l.06-.06A2 2 0 0117 4.21l.06.06a1.65 1.65 0 00.33 1.82c.25.3.43.65.53 1.02H21a2 2 0 010 4h-.77c-.1.37-.28.72-.53 1.02z" />
  </SvgWrapper>
);

export const Info = (props) => (
  <SvgWrapper {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </SvgWrapper>
);

export const Sparkles = (props) => (
  <SvgWrapper {...props}>
    <path d="M12 3l1.5 3L17 8l-3.5 1L12 13l-1.5-4L7 8l3.5-2L12 3z" />
  </SvgWrapper>
);

export const Clock = (props) => (
  <SvgWrapper {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </SvgWrapper>
);

export const Activity = (props) => (
  <SvgWrapper {...props}>
    <path d="M3 12h3l3 8 4-16 3 8h4" />
  </SvgWrapper>
);

export const ArrowRight = (props) => (
  <SvgWrapper {...props}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </SvgWrapper>
);

export const ShieldCheck = (props) => (
  <SvgWrapper {...props}>
    <path d="M12 2l7 4v6c0 5-3.6 9.7-7 10-3.4-.3-7-5-7-10V6l7-4z" />
    <path d="M9.5 12.5l1.5 1.5 3-3" />
  </SvgWrapper>
);

export const Clock3 = Clock;
export const Database = (props) => (
  <SvgWrapper {...props}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v6c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
    <path d="M3 11v6c0 1.657 4.03 3 9 3s9-1.343 9-3v-6" />
  </SvgWrapper>
);

export const CheckCircle2 = (props) => (
  <SvgWrapper {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </SvgWrapper>
);

export const FileText = (props) => (
  <SvgWrapper {...props}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h6" />
  </SvgWrapper>
);

export const Download = (props) => (
  <SvgWrapper {...props}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <path d="M7 10l5 5 5-5M12 15V3" />
  </SvgWrapper>
);

export const RefreshCcw = (props) => (
  <SvgWrapper {...props}>
    <path d="M21 12a9 9 0 10-9 9" />
    <path d="M21 3v6h-6" />
  </SvgWrapper>
);

export const Plus = (props) => (
  <SvgWrapper {...props}>
    <path d="M12 5v14M5 12h14" />
  </SvgWrapper>
);

export const Search = (props) => (
  <SvgWrapper {...props}>
    <path d="M21 21l-4.35-4.35" />
    <circle cx="11" cy="11" r="6" />
  </SvgWrapper>
);

export default {
  Menu,
  Sun,
  Moon,
  Bell,
  LogOut,
  Home,
  Box,
  TrendingUp,
  BarChart3,
  UploadCloud,
  Calendar,
  Filter,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Settings,
  Info,
  Sparkles,
  ShieldCheck,
  Clock,
  Activity,
  ArrowRight,
  Clock3,
  Database,
  CheckCircle2,
  FileText,
  Download,
  RefreshCcw,
  Plus,
  Search,
};
