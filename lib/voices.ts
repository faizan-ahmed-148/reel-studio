/** Free Microsoft Edge neural voices. `script` = which writing system the narration must use for that voice. */
export interface VoiceOption { id: string; name: string; script: "urdu" | "devanagari"; note: string }

export const VOICES: VoiceOption[] = [
  { id: "hi-IN-MadhurNeural", name: "Madhur (male)", script: "devanagari", note: "Natural Hindustani, English tech words saaf" },
  { id: "hi-IN-SwaraNeural", name: "Swara (female)", script: "devanagari", note: "Natural Hindustani, English tech words saaf" },
  { id: "en-US-AndrewMultilingualNeural", name: "Andrew Multilingual (male)", script: "devanagari", note: "Sab se expressive, warm" },
  { id: "en-US-BrianMultilingualNeural", name: "Brian Multilingual (male)", script: "devanagari", note: "Casual, conversational" },
  { id: "en-US-AvaMultilingualNeural", name: "Ava Multilingual (female)", script: "devanagari", note: "Expressive, friendly" },
  { id: "en-US-EmmaMultilingualNeural", name: "Emma Multilingual (female)", script: "devanagari", note: "Clear, cheerful" },
  { id: "ur-PK-AsadNeural", name: "Asad — Urdu PK (male)", script: "urdu", note: "Khalis Urdu lehja" },
  { id: "ur-PK-UzmaNeural", name: "Uzma — Urdu PK (female)", script: "urdu", note: "Khalis Urdu lehja" },
  { id: "ur-IN-SalmanNeural", name: "Salman — Urdu IN (male)", script: "urdu", note: "Urdu" },
];

export const GEMINI_VOICES: [string, string][] = [
  ["Puck", "Upbeat (male)"], ["Fenrir", "Excitable (male)"], ["Sadaltager", "Knowledgeable (male)"], ["Achird", "Friendly (male)"],
  ["Charon", "Informative (male)"], ["Orus", "Firm (male)"], ["Iapetus", "Clear (male)"], ["Algieba", "Smooth (male)"],
  ["Zubenelgenubi", "Casual (male)"], ["Umbriel", "Easy-going (male)"], ["Enceladus", "Breathy (male)"], ["Algenib", "Gravelly (male)"],
  ["Rasalgethi", "Informative (male)"], ["Alnilam", "Firm (male)"], ["Schedar", "Even (male)"], ["Gacrux", "Mature"],
  ["Sadachbia", "Lively"], ["Zephyr", "Bright (female)"], ["Kore", "Firm (female)"], ["Leda", "Youthful (female)"],
  ["Aoede", "Breezy (female)"], ["Callirrhoe", "Easy-going (female)"], ["Autonoe", "Bright (female)"], ["Despina", "Smooth (female)"],
  ["Erinome", "Clear (female)"], ["Laomedeia", "Upbeat (female)"], ["Achernar", "Soft (female)"], ["Pulcherrima", "Forward (female)"],
  ["Vindemiatrix", "Gentle (female)"], ["Sulafat", "Warm (female)"],
];

/** Which script the narration must be written in for the configured voice engine. */
export const narrationScript = (s: { ttsProvider?: string; geminiApiKey?: string; voice: string }) =>
  s.ttsProvider === "gemini" && s.geminiApiKey ? "devanagari" : voiceScript(s.voice);

export const voiceScript = (id: string) => VOICES.find((v) => v.id === id)?.script ?? (id.startsWith("ur-") ? "urdu" : "devanagari");

export const SAMPLE: Record<"urdu" | "devanagari", string> = {
  urdu: "دوستو، کبھی سوچا ہے کہ جب لاکھوں users ایک ساتھ website کھولتے ہیں تو server crash کیوں نہیں ہوتا؟ اس کا جواب ہے load balancer۔",
  devanagari: "दोस्तो, कभी सोचा है कि जब लाखों users एक साथ website खोलते हैं तो server crash क्यों नहीं होता? इसका जवाब है load balancer।",
};
