import { Box, Row, Shape, Slider } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxWidth,
  height,
  Shapes,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { useTheme } from '@/hooks/use-theme';

export function CompactSlider({
  value,
  min,
  max,
  steps,
  onValueChange,
}: {
  value: number;
  min: number;
  max: number;
  steps: number;
  onValueChange: (value: number) => void;
}) {
  const colors = useTheme();
  const progress = (value - min) / (max - min);
  return (
    <Slider max={max} min={min} onValueChange={onValueChange} steps={steps} value={value}>
      <Slider.Thumb>
        <Box modifiers={[size(16, 16), clip(Shapes.Circle), background(colors.accent)]} />
      </Slider.Thumb>
      <Slider.Track>
        <Row modifiers={[fillMaxWidth(), height(4)]}>
          <Shape.RoundedCorner
            color={colors.accent}
            cornerRadii={{ topStart: 2, bottomStart: 2 }}
            modifiers={[weight(Math.max(progress, 0.001)), height(4)]}
          />
          <Shape.RoundedCorner
            color={colors.track}
            cornerRadii={{ topEnd: 2, bottomEnd: 2 }}
            modifiers={[weight(Math.max(1 - progress, 0.001)), height(4)]}
          />
        </Row>
      </Slider.Track>
    </Slider>
  );
}
