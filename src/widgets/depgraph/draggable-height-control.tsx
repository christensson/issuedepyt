import React, { useCallback, useEffect, useRef, useState } from "react";

interface DraggableHeightControlProps {
  minValue: number;
  maxValue: number;
  value: number;
  onChange: (value: number) => void;
}

const DraggableHeightControl: React.FunctionComponent<DraggableHeightControlProps> = ({
  minValue,
  maxValue,
  value,
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartValue = useRef<number>(0);
  const pointerIdRef = useRef<number | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      pointerIdRef.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartY.current = e.clientY;
      dragStartValue.current = value;
    },
    [value],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging) return;
      if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;

      // Calculate the delta:
      // - positive means moving down (increase height).
      // - negative means moving up (decrease height).
      const deltaY = e.clientY - dragStartY.current;
      const rawValue = dragStartValue.current + deltaY;
      // Snap to increments.
      const snapSize = 10;
      const snappedValue = Math.round(rawValue / snapSize) * snapSize;
      const newValue = Math.max(minValue, Math.min(maxValue, snappedValue));
      onChange(newValue);
    },
    [isDragging, minValue, maxValue, onChange],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    pointerIdRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerUp);

      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  return (
    <div
      className={`draggable-height-control ${isDragging ? "dragging" : ""}`}
      onPointerDown={handlePointerDown}
    />
  );
};

export default DraggableHeightControl;
