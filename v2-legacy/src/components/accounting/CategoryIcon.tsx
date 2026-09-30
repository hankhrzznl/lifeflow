import {
  UtensilsCrossed, ShoppingBag, Package, Car, Leaf, Apple, Candy,
  Dumbbell, Gamepad2, Smartphone, Shirt, Sparkles, Banknote, Gift,
  TrendingUp, Trophy, Home, HelpCircle,
} from "lucide-react";

// ─── 分类图标映射（DB seed icon name → lucide 组件） ─────────

export const ICON_MAP: Record<string, React.ComponentType<any>> = {
  "utensils-crossed": UtensilsCrossed,
  "shopping-bag": ShoppingBag,
  package: Package,
  car: Car,
  leaf: Leaf,
  apple: Apple,
  candy: Candy,
  dumbbell: Dumbbell,
  "gamepad-2": Gamepad2,
  smartphone: Smartphone,
  shirt: Shirt,
  sparkles: Sparkles,
  banknote: Banknote,
  gift: Gift,
  "trending-up": TrendingUp,
  trophy: Trophy,
  home: Home,
  "help-circle": HelpCircle,
};

export function getIcon(iconName: string): React.ComponentType<any> {
  return ICON_MAP[iconName] || HelpCircle;
}

/** 分类圆形图标（彩色圆底 + 白色图标） */
export function CategoryIcon({
  icon,
  color,
  size = 48,
  iconSize = 24,
}: {
  icon: string;
  color: string;
  size?: number;
  iconSize?: number;
}) {
  const Icon = getIcon(icon);
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: color }}
    >
      <Icon style={{ width: iconSize, height: iconSize, color: "#FFFFFF" }} />
    </div>
  );
}
