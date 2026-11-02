export interface PresenceCopy {
  back: string;
  title: string;
  talk: string;
  stop: string;
  interrupt: string;
  send: string;
  placeholder: string;
  confirm: string;
  cancel: string;
  gesture: string;
  dismiss: string;
  mic: string;
  camera: string;
  cameraShort: string;
  cameraHint: string;
  noAsr: string;
  noTts: string;
  cameraOn: string;
  micOn: string;
  bothOn: string;
  measuring: string;
  performance: (fps: number, tier: string) => string;
  tiers: Record<'high' | 'medium' | 'low', string>;
  states: Record<string, string>;
  noWebgl: string;
  noHouse: string;
  simulated: string;
  sent: string;
  failed: string;
  point: string;
  gestureLine: string;
  caption: string;
  gestureNote: string;
  sleepHint: string;
  roleLink: string;
  sparkHere: string;
  voiceGap: string;
}

const spanish: PresenceCopy = {
  back: 'Inicio',
  title: 'Divine Spark',
  talk: 'Hablar',
  stop: 'Apagar micrófono',
  interrupt: 'Interrumpir',
  send: 'Enviar',
  placeholder: 'Escribe lo que quieres hacer',
  confirm: 'Confirmar',
  cancel: 'Cancelar',
  gesture: 'Probar el gesto',
  dismiss: 'Seguir',
  mic: 'Micrófono',
  camera: 'Usar la cámara para orientar la mirada',
  cameraShort: 'Cámara',
  cameraHint: 'Apagada salvo que la actives. El movimiento es aproximado y no interpreta emociones. No se guarda imagen ni audio.',
  noAsr: 'Este navegador no reconoce voz. Puedes escribir.',
  noTts: 'Este navegador no sintetiza voz. La respuesta queda en texto.',
  cameraOn: 'Cámara activa',
  micOn: 'Micrófono activo',
  bothOn: 'Micrófono y cámara activos',
  measuring: 'Midiendo rendimiento en este equipo…',
  performance: (fps, tier) => `Rendimiento medido aquí: ${fps} fps · ${tier}`,
  tiers: { high: 'alto', medium: 'medio', low: 'bajo' },
  states: {
    DORMANT: 'En reposo',
    AWAKENING: 'Despertando',
    IDLE: 'Disponible',
    LISTENING: 'Escuchando',
    THINKING: 'Pensando',
    SPEAKING: 'Hablando',
    ACTING: 'Esperando confirmación',
    ERROR: 'No pude completar eso',
    SLEEPING: 'En espera',
  },
  noWebgl: 'Este navegador no puede dibujar la figura. La conversación sigue en texto.',
  noHouse: 'Entra desde el inicio para preparar la casa.',
  simulated: 'Casa simulada',
  sent: 'Enviado. El dispositivo todavía no lo confirma.',
  failed: 'La acción no se completó.',
  point: 'Confirma aquí abajo.',
  gestureLine: 'Así se mueve la boca. Esto no es voz.',
  caption: 'Sin síntesis de voz',
  gestureNote: 'Gesto, sin audio',
  sleepHint: 'Toca para volver.',
  roleLink: 'Profesión',
  sparkHere: 'Estoy aquí.',
  voiceGap: 'No hay una voz femenina en español en este equipo. Piper no está instalado. La respuesta queda escrita.',
};

const english: PresenceCopy = {
  back: 'Home',
  title: 'Divine Spark',
  talk: 'Talk',
  stop: 'Turn microphone off',
  interrupt: 'Interrupt',
  send: 'Send',
  placeholder: 'Type what you want to do',
  confirm: 'Confirm',
  cancel: 'Cancel',
  gesture: 'Preview the gesture',
  dismiss: 'Continue',
  mic: 'Microphone',
  camera: 'Use the camera to steer gaze',
  cameraShort: 'Camera',
  cameraHint: 'Off unless you enable it. Motion is approximate and is not an emotion reading. Audio and video are not stored.',
  noAsr: 'This browser has no speech recognition. You can type.',
  noTts: 'This browser has no speech synthesis. The reply stays on screen.',
  cameraOn: 'Camera on',
  micOn: 'Microphone on',
  bothOn: 'Microphone and camera on',
  measuring: 'Measuring performance on this device…',
  performance: (fps, tier) => `Measured here: ${fps} fps · ${tier}`,
  tiers: { high: 'high', medium: 'medium', low: 'low' },
  states: {
    DORMANT: 'Dormant',
    AWAKENING: 'Awakening',
    IDLE: 'Available',
    LISTENING: 'Listening',
    THINKING: 'Thinking',
    SPEAKING: 'Speaking',
    ACTING: 'Waiting for confirmation',
    ERROR: 'That did not complete',
    SLEEPING: 'Waiting',
  },
  noWebgl: 'This browser cannot draw the figure. The conversation continues as text.',
  noHouse: 'Open the home screen once so the house is ready.',
  simulated: 'Simulated home',
  sent: 'Sent. The device has not confirmed it.',
  failed: 'The action did not complete.',
  point: 'Confirm here.',
  gestureLine: 'This is how the mouth moves. It is not speech.',
  caption: 'No speech synthesis',
  gestureNote: 'Gesture, no audio',
  sleepHint: 'Tap to return.',
  roleLink: 'Profession',
  sparkHere: 'I am here.',
  voiceGap: 'This device has no female Spanish voice. Piper is not installed. The reply stays on screen.',
};

export function presenceCopy(locale: 'en' | 'es'): PresenceCopy {
  return locale === 'es' ? spanish : english;
}
