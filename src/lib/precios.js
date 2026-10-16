export const PRECIO_ENTRADA = 80000;
export const PRECIO_ENTRADA_MANUAL = 70000;
export const CANTIDAD_CUOTAS = 3;

export function calcularPago(cantidad, esManual = false) {
  const precio = esManual ? PRECIO_ENTRADA_MANUAL : PRECIO_ENTRADA;
  const importeTotal = (parseInt(cantidad, 10) || 0) * precio;
  const centavosTotal = importeTotal * 100;
  const centavosCuota = Math.round(centavosTotal / CANTIDAD_CUOTAS);
  return {
    importeTotal,
    cuotas: CANTIDAD_CUOTAS,
    importeCuota: centavosCuota / 100,
    importeUltimaCuota: (centavosTotal - centavosCuota * (CANTIDAD_CUOTAS - 1)) / 100,
  };
}
