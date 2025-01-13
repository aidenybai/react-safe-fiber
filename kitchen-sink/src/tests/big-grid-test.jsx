import { useEffect, useState } from 'react';
import 'bippy/dist/extract/index';

export default function SlowComponent() {
  const largeArray = Array.from({ length: 10 }, (_, i) => i);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((count) => count + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-wrap overflow-scroll gap-1">
      <div>{count}</div>
      {largeArray.map((value) => (
        <Box key={value} value={value} />
      ))}
    </div>
  );
}

export const Box = ({ value }) => {
  return (
    <div
      className="w-2 h-2 bg-neutral-700"
      style={{
        backgroundColor: `rgb(${value % 255}, ${(value * 2) % 255}, ${(value * 3) % 255})`,
      }}
    />
  );
};
