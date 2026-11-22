/* Detección automática de articulaciones (MediaPipe Pose Landmarker).
   Se carga solo cuando se usa. Todos los archivos están en ./vendor, así que
   tras la primera vez funciona sin conexión y el vídeo nunca sale del dispositivo. */
const BASE = new URL('./vendor/', import.meta.url).href;

export async function crearDetector() {
  const mod = await import('./vendor/mediapipe/vision_bundle.mjs');
  const { FilesetResolver, PoseLandmarker } = mod;
  const fileset = await FilesetResolver.forVisionTasks(BASE + 'mediapipe/wasm');
  const opciones = delegate => ({
    baseOptions: { modelAssetPath: BASE + 'models/pose_landmarker_full.task', delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.4,
    minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });
  try { return await PoseLandmarker.createFromOptions(fileset, opciones('GPU')); }
  catch (e) { return await PoseLandmarker.createFromOptions(fileset, opciones('CPU')); }
}
