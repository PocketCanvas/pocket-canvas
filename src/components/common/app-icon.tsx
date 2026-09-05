import { IconSizes, type IconSize, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  ArrowUpDown,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Dices,
  EllipsisVertical,
  Heart,
  Info,
  Layers,
  Moon,
  Plus,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react-native';

export const ICON_MAP = {
  ArrowUpDown,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Dices,
  EllipsisVertical,
  Heart,
  Info,
  Layers,
  Moon,
  Plus,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICON_MAP;

export interface AppIconProps extends Omit<LucideProps, 'size' | 'color'> {
  name: IconName;
  size?: IconSize | number;
  color?: ThemeColor | string;
  strokeWidth?: number;
}

export function AppIcon({
  name,
  size = 'md',
  color = 'text',
  strokeWidth = 2,
  style,
  ...props
}: AppIconProps) {
  const colors = useTheme();
  const IconComponent = ICON_MAP[name];

  const resolvedSize = typeof size === 'number' ? size : IconSizes[size];
  const resolvedColor = (colors as Record<string, string>)[color] ?? color;

  return (
    <IconComponent
      color={resolvedColor}
      size={resolvedSize}
      strokeWidth={strokeWidth}
      style={style}
      {...props}
    />
  );
}
