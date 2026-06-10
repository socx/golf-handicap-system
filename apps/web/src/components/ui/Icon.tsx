import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps {
  /** The lucide-react icon component to render. Import from `components/ui/icons`. */
  icon: LucideIcon;
  /** Pixel size preset. Defaults to `md` (16 px). */
  size?: IconSize;
  /** Extra Tailwind classes (e.g. colour overrides). */
  className?: string;
  /** Override aria-hidden; set false when the icon conveys standalone meaning. */
  'aria-hidden'?: boolean;
  /** Accessible title rendered as an SVG <title> element when provided. */
  title?: string;
}

const SIZE_PX: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

/**
 * Accessible, consistently-sized icon wrapper.
 *
 * Icons are aria-hidden by default so they never create duplicate
 * announcements when placed inside labelled buttons or headings.
 * Provide `title` (and set `aria-hidden={false}`) for standalone icons.
 *
 * @example
 * // Inside a button (icon decorative):
 * <Button><Icon icon={Plus} size="sm" /> Create Course</Button>
 *
 * // Standalone meaningful icon:
 * <Icon icon={ShieldCheck} size="lg" aria-hidden={false} title="Admin" />
 */
export const Icon: React.FC<IconProps> = ({
  icon: IconComponent,
  size = 'md',
  className,
  'aria-hidden': ariaHidden = true,
  title,
}) => {
  const px = SIZE_PX[size];
  return (
    <IconComponent
      width={px}
      height={px}
      strokeWidth={1.75}
      aria-hidden={ariaHidden}
      className={twMerge('shrink-0', className)}
      {...(title ? { title } : {})}
    />
  );
};

Icon.displayName = 'Icon';
