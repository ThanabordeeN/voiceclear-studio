/** Minimal TH/EN string table — Thai is the primary language. */

export type Lang = "th" | "en";

type Dict = Record<string, { th: string; en: string }>;

const D: Dict = {
  appName: { th: "VoiceClear Studio", en: "VoiceClear Studio" },
  tagline: {
    th: "AI ตัดสัญญาณรบกวน + DSP เก็บละเอียด — ทำงานในเครื่องคุณ 100%",
    en: "AI denoising + studio mastering chain — 100% on-device",
  },
  startMic: { th: "เริ่มไมโครโฟน", en: "Start Microphone" },
  stopMic: { th: "หยุด", en: "Stop" },
  inputDevice: { th: "อุปกรณ์รับเสียง", en: "Input Device" },
  outputDevice: { th: "อุปกรณ์เล่นเสียง", en: "Output Device" },
  monitor: { th: "Live Monitor", en: "Live Monitor" },
  bypass: { th: "Bypass (A/B)", en: "Bypass (A/B)" },
  record: { th: "บันทึก", en: "Record" },
  stopRecord: { th: "หยุดบันทึก", en: "Stop" },
  exportWav: { th: "ดาวน์โหลด WAV", en: "Download WAV" },
  presets: { th: "โปรไฟล์เสียง", en: "Presets" },
  customEq: { th: "ปรับแต่งเอง (Custom)", en: "Custom EQ & Dynamics" },
  engine: { th: "AI Engine", en: "AI Engine" },
  latency: { th: "Latency", en: "Latency" },
  sampleRate: { th: "Sample Rate", en: "Sample Rate" },
  vad: { th: "Speech Activity", en: "Speech Activity" },
  spectrogram: { th: "Spectrogram", en: "Spectrogram" },
  waveform: { th: "Waveform", en: "Waveform" },
  outputLevel: { th: "ระดับเสียงขาออก", en: "Output Level" },
  micPermission: {
    th: "กรุณาอนุญาตการเข้าถึงไมโครโฟน",
    en: "Please allow microphone access",
  },
  privacyNote: {
    th: "เสียงทั้งหมดถูกประมวลผลในเครื่องของคุณ ไม่มีการส่งออกนอกอุปกรณ์",
    en: "All audio is processed locally. Nothing ever leaves your device.",
  },
  // EQ stage labels
  hp: { th: "Highpass", en: "Highpass" },
  bassShelf: { th: "Deep Bass Shelf", en: "Deep Bass Shelf" },
  vocalBody: { th: "Vocal Body", en: "Vocal Body" },
  mudCut: { th: "Anti-Mud Cut", en: "Anti-Mud Cut" },
  edgeSoftener: { th: "Edge Softener", en: "Edge Softener" },
  denoise: { th: "AI Denoise Strength", en: "AI Denoise Strength" },
  compThreshold: { th: "Compressor Threshold", en: "Compressor Threshold" },
  recordingHint: {
    th: "กำลังบันทึกเสียงหลังประมวลผล…",
    en: "Recording processed audio…",
  },
};

export function makeT(lang: Lang) {
  return (key: keyof typeof D | string): string => {
    const entry = D[key as string];
    return entry ? entry[lang] : (key as string);
  };
}

export type T = ReturnType<typeof makeT>;
