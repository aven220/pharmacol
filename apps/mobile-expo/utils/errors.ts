import { isAxiosError } from 'axios';

const TRADUCCIONES: Array<[RegExp | string, string]> = [
  [/serialize a BigInt/i, 'Error al procesar datos del servidor'],
  [/Network Error/i, 'Sin conexión al servidor'],
  [/timeout/i, 'Tiempo de espera agotado'],
  [/Unauthorized/i, 'Sesión expirada — inicia sesión de nuevo'],
  [/Credenciales inválidas/i, 'Correo o contraseña incorrectos'],
  [/Medicamento no encontrado/i, 'Medicamento no encontrado'],
  [/CUM no encontrado/i, 'Código CUM no encontrado'],
  [/Sin conexión y sin datos en caché/i, 'Sin conexión y sin datos guardados offline'],
  ['Request failed with status code 401', 'Sesión expirada — inicia sesión de nuevo'],
  ['Request failed with status code 404', 'Recurso no encontrado'],
  ['Request failed with status code 500', 'Error interno del servidor'],
];

function traducir(mensaje: string): string {
  for (const [patron, texto] of TRADUCCIONES) {
    if (typeof patron === 'string' ? mensaje.includes(patron) : patron.test(mensaje)) {
      return texto;
    }
  }
  return mensaje;
}

export function getErrorMessage(err: unknown, fallback = 'Ocurrió un error'): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as { error?: string; message?: string } | undefined;
    if (body?.error) return traducir(body.error);
    if (body?.message) return traducir(body.message);
    if (!err.response) {
      return traducir(`Sin conexión (${err.code ?? 'red'})`);
    }
    return traducir(`Error del servidor (${err.response.status})`);
  }
  if (err instanceof Error) return traducir(err.message);
  return fallback;
}
