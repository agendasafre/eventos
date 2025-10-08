import Swal from 'sweetalert2';

const baseStyle = {
  confirmButtonColor: '#1d3557', // azul oscuro
  cancelButtonColor: '#e63946',  // rojo UNSJ
  background: '#f1faee',         // crema
  color: '#1d3557',
  customClass: {
    popup: 'rounded-xl shadow-lg border border-azuloscuro/20',
    title: 'font-semibold text-azuloscuro',
  },
};

/**
 * Funciones simplificadas para mostrar alertas con estilo.
 */
export const ui = {
  loading: (msg = 'Procesando...') =>
    Swal.fire({
      ...baseStyle,
      title: msg,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    }),

  success: (msg) =>
    Swal.fire({
      ...baseStyle,
      icon: 'success',
      title: msg,
      showConfirmButton: false,
      timer: 2200,
    }),

  error: (msg) =>
    Swal.fire({
      ...baseStyle,
      icon: 'error',
      title: msg,
      showConfirmButton: true,
      confirmButtonText: 'Entendido',
    }),

  info: (msg) =>
    Swal.fire({
      ...baseStyle,
      icon: 'info',
      title: msg,
      showConfirmButton: true,
      confirmButtonText: 'OK',
    }),

  close: () => Swal.close(),
};