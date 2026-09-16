/**
 * Evis Speech Services: Text-to-Speech & Voice Input
 * Strictly client-side, offline-capable, standard Web APIs
 */

export class TextToSpeechService {
  private static activeUtterance: SpeechSynthesisUtterance | null = null;

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  static speak(text: string, onEnd?: () => void, onError?: () => void): boolean {
    if (!this.isSupported()) return false;

    this.stop();

    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~]/g, '')
      .trim();

    if (!cleanText) return false;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const isFrench = /[éàèùâêîôûç]/i.test(cleanText);
    const selectedVoice = voices.find((v) =>
      isFrench ? v.lang.startsWith('fr') : v.lang.startsWith('en')
    );
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      this.activeUtterance = null;
      onEnd?.();
    };

    utterance.onerror = () => {
      this.activeUtterance = null;
      onError?.();
    };

    this.activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  static stop(): void {
    if (!this.isSupported()) return;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterance = null;
  }

  static isSpeaking(): boolean {
    return this.isSupported() && (window.speechSynthesis.speaking || this.activeUtterance !== null);
  }
}

export type VoiceInputState = 'idle' | 'listening' | 'transcribing' | 'unsupported';

export class VoiceInputService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static activeRecognition: any = null;
  private static isExplicitlyStopped = false;

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  static startListening(
    onResult: (finalText: string, interimText: string) => void,
    onStateChange: (state: VoiceInputState) => void,
    onError: (err: string) => void
  ): () => void {
    if (!this.isSupported()) {
      onStateChange('unsupported');
      onError('Web Speech Recognition API is not supported in this browser.');
      return () => {};
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionConstructor();
      this.activeRecognition = recognition;
      this.isExplicitlyStopped = false;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'fr-FR';

      onStateChange('listening');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        onStateChange(interimTranscript ? 'transcribing' : 'listening');
        onResult(finalTranscript, interimTranscript);
      };

      recognition.onend = () => {
        if (!this.isExplicitlyStopped && this.activeRecognition === recognition) {
          // Restart gracefully if the browser stops on silence but the user didn't stop dictation
          try {
            recognition.start();
            return;
          } catch {
            // Fall through to idle
          }
        }
        this.activeRecognition = null;
        onStateChange('idle');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // Ignore no-speech pause events in continuous mode
          return;
        }

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.isExplicitlyStopped = true;
          this.activeRecognition = null;
          onStateChange('idle');
          onError('Microphone permission denied. Please allow microphone access in your browser.');
          return;
        }

        console.warn('Speech recognition warning:', event.error);
        if (event.error === 'aborted') {
          this.activeRecognition = null;
          onStateChange('idle');
        }
      };

      recognition.start();

      return () => {
        this.isExplicitlyStopped = true;
        try {
          if (this.activeRecognition) {
            this.activeRecognition.stop();
            this.activeRecognition = null;
          }
        } catch {
          // ignore
        }
        onStateChange('idle');
      };
    } catch (e: unknown) {
      this.isExplicitlyStopped = true;
      onStateChange('idle');
      onError((e as Error).message);
      return () => {};
    }
  }
}

