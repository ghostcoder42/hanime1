import { Ionicons } from '@expo/vector-icons';
import { styled } from 'nativewind';
import type { ComponentProps } from 'react';

const StyledIonicons = styled(Ionicons);

export type IconProps = ComponentProps<typeof Ionicons> & {
  className?: string;
};

export function Icon({ className, size = 22, ...props }: IconProps) {
  return <StyledIonicons className={className} size={size} {...props} />;
}
