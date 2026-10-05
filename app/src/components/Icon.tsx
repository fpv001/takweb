import {
  LayoutDashboard, Building2, Users, HandCoins, Star, Split, Trophy, Settings, LogOut, Menu, X, Plus,
  Download, Copy, Check, Search, ChevronDown, ChevronRight, ArrowLeft, ExternalLink, Trash2, Pencil,
  Camera, Phone, Calendar, CircleAlert, TriangleAlert, Info, UserPlus, MessageCircle, CreditCard,
  ChartColumn, TrendingUp, Crown, History, KeyRound, Hotel, Coins, CircleCheck, Bell, Gift, type LucideIcon,
} from 'lucide-react'

// Un solo estilo de iconos: línea redondeada, trazo 2 px (sistema de diseño tak!, §6).
const ICONS = {
  resumen: LayoutDashboard,
  hotel: Building2,
  users: Users,
  tip: HandCoins,
  star: Star,
  split: Split,
  trophy: Trophy,
  settings: Settings,
  logout: LogOut,
  menu: Menu,
  close: X,
  plus: Plus,
  download: Download,
  copy: Copy,
  check: Check,
  search: Search,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  back: ArrowLeft,
  external: ExternalLink,
  trash: Trash2,
  edit: Pencil,
  camera: Camera,
  phone: Phone,
  calendar: Calendar,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  userPlus: UserPlus,
  message: MessageCircle,
  card: CreditCard,
  chart: ChartColumn,
  trend: TrendingUp,
  crown: Crown,
  history: History,
  key: KeyRound,
  building: Hotel,
  coins: Coins,
  success: CircleCheck,
  bell: Bell,
  gift: Gift,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export function Icon({ name, className, size }: { name: IconName | string; className?: string; size?: number }) {
  const Cmp = (ICONS as Record<string, LucideIcon>)[name] ?? Info
  return <Cmp className={className} size={size} strokeWidth={2} aria-hidden="true" focusable="false" />
}
