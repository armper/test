import L from 'leaflet';

const defaultPrecision = {
  km: 2,
  ha: 2,
  m: 0,
  mi: 2,
  ac: 2,
  yd: 0,
  ft: 0,
  nm: 2,
};

let patched = false;

export const patchLeafletDraw = () => {
  if (patched) {
    return;
  }

  const geometryUtil = (L as typeof L & { GeometryUtil?: any }).GeometryUtil;
  if (!geometryUtil || typeof geometryUtil.readableArea !== 'function') {
    return;
  }

  const formattedNumber: (value: number, precision: number) => string = geometryUtil.formattedNumber.bind(geometryUtil);

  geometryUtil.readableArea = function readableArea(area: number, isMetric: unknown, precision?: Record<string, number>) {
    const precisionOptions = L.Util.extend({}, defaultPrecision, precision);
    let areaStr: string;

    if (isMetric) {
      let units: string[] = ['ha', 'm'];
      const metricType = typeof isMetric;
      if (metricType === 'string') {
        units = [isMetric as string];
      } else if (metricType !== 'boolean') {
        units = Array.isArray(isMetric) ? (isMetric as string[]) : units;
      }

      if (area >= 1_000_000 && units.indexOf('km') !== -1) {
        areaStr = `${formattedNumber(area * 0.000001, precisionOptions.km)} km²`;
      } else if (area >= 10_000 && units.indexOf('ha') !== -1) {
        areaStr = `${formattedNumber(area * 0.0001, precisionOptions.ha)} ha`;
      } else {
        areaStr = `${formattedNumber(area, precisionOptions.m)} m²`;
      }
    } else {
      const yards = area / 0.836127;
      if (yards >= 3_097_600) {
        areaStr = `${formattedNumber(yards / 3_097_600, precisionOptions.mi)} mi²`;
      } else if (yards >= 4_840) {
        areaStr = `${formattedNumber(yards / 4_840, precisionOptions.ac)} acres`;
      } else {
        areaStr = `${formattedNumber(yards, precisionOptions.yd)} yd²`;
      }
    }

    return areaStr;
  };

  patched = true;
};
