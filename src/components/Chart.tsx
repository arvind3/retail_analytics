import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const Chart = ({ option, height = 320 }: { option: echarts.EChartsOption; height?: number }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.setOption(option);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} style={{ height }} />;
};

export default Chart;
