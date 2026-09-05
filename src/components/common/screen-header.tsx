import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type ScreenHeaderProps = {
  title: string;
  rightAction?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

export function ScreenHeader({
  title,
  rightAction,
  children,
  style,
  titleStyle,
}: ScreenHeaderProps) {
  const colors = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.bar}>
        <View style={styles.titleContainer}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }, titleStyle]}
          >
            {title}
          </Text>
        </View>
        {rightAction ? <View style={styles.actions}>{rightAction}</View> : null}
      </View>
      {children ? <View style={styles.bottomSlot}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  bar: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomSlot: {
    marginTop: 12,
  },
});
