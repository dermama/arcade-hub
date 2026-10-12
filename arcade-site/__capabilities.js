// Local play shim (two edits only):
//  1) mobile gate removed (phone GPU allowed)
//  2) uniform-vector minimum lowered 264 -> real hardware value (pass real gl param)
export async function checkCapabilities() {
  if (!isSecureContext) return { kind: 'secure', message: 'Open the HTTPS link. For local play, use http://127.0.0.1:8080.' };
  if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined')
    return { kind: 'browser', message: 'Shared memory is unavailable (COOP/COEP missing).' };
  const features = [
    [navigator.storage?.getDirectory && navigator.storage.estimate && navigator.storage.persist && navigator.locks, 'private file storage (OPFS, quota checks and Web Locks)'],
    [window.AudioWorkletNode && window.AudioContext && 'audioWorklet' in AudioContext.prototype, 'AudioWorklet sound'],
    [window.Worker && HTMLCanvasElement.prototype.transferControlToOffscreen, 'OffscreenCanvas in a worker'],
    [Element.prototype.requestPointerLock && Document.prototype.exitPointerLock, 'pointer lock for mouse aiming'],
    [typeof WebAssembly === 'object' && WebAssembly.Tag, 'WebAssembly exception handling'],
  ];
  for (const [supported, feature] of features)
    if (!supported) return { kind: 'browser', message: `This browser is missing ${feature}.` };
  try {
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 24576, shared: true });
    const threads = new Uint8Array([0,97,115,109,1,0,0,0,5,4,1,3,1,1]);
    const simd = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,22,1,20,0,253,12,...Array(16).fill(0),11]);
    if (!(memory.buffer instanceof SharedArrayBuffer) || !WebAssembly.validate(threads) || !WebAssembly.validate(simd)) throw new Error();
  } catch {
    return { kind: 'browser', message: 'WebAssembly threads or SIMD are unavailable.' };
  }
  if (typeof WebAssembly.Suspending !== 'function')
    return { kind: 'browser', message: 'This browser is missing WebAssembly JSPI (WebAssembly.Suspending).' };
  const gl = document.createElement('canvas').getContext('webgl2');
  const failure = checkRenderer(gl);
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  if (failure) return failure;
  return new Promise(resolve => {
    let worker;
    const finish = result => { clearTimeout(timer); worker?.terminate(); resolve(result); };
    const unavailable = { kind: 'browser', message: 'Worker graphics or private file storage could not start.' };
    const timer = setTimeout(() => finish(unavailable), 8000);
    try {
      worker = new Worker(new URL('./capability-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => finish(data);
      worker.onerror = event => { event.preventDefault(); finish(unavailable); };
      const canvas = document.createElement('canvas').transferControlToOffscreen();
      worker.postMessage(canvas, [canvas]);
    } catch { finish(unavailable); }
  });
}

export function checkRenderer(gl) {
  if (!gl) return { kind: 'gpu', message: 'WebGL2 is unavailable.' };
  const missing = [];
  for (const name of ['WEBGL_compressed_texture_s3tc', 'EXT_color_buffer_float'])
    if (!gl.getExtension(name)) missing.push(name);
  if (!gl.getExtension('EXT_texture_norm16')) {
    for (const name of ['OES_texture_float_linear', 'EXT_float_blend'])
      if (!gl.getExtension(name)) missing.push(name);
  }
  for (const [name, minimum] of [['MAX_TEXTURE_SIZE', 2048], ['MAX_3D_TEXTURE_SIZE', 256],
    ['MAX_TEXTURE_IMAGE_UNITS', 16], ['MAX_VERTEX_TEXTURE_IMAGE_UNITS', 4],
    ['MAX_COMBINED_TEXTURE_IMAGE_UNITS', 20], ['MAX_VERTEX_UNIFORM_VECTORS', 256],
    ['MAX_FRAGMENT_UNIFORM_VECTORS', 256], ['MAX_VERTEX_ATTRIBS', 16]])
    if (gl.getParameter(gl[name]) < minimum) missing.push(`${name} >= ${minimum}`);
  return missing.length ? { kind: 'gpu', message: `Missing ${missing.join(', ')}.` } : null;
}
