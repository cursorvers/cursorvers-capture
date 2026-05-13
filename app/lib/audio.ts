

export interface AudioRecording {
  blob: Blob;
  durationMs: number;
}

export interface AudioRecorder {
  start: () => Promise<void>;
  stop: () => Promise<AudioRecording>;
  cancel: () => void;
  // Add an event listener to listen for stop events.
  onStop: (callback: (data: AudioRecording) => void) => void;
  // Add an event listener to listen for start events.
  onStart: (callback: () => void) => void;
  // Add an event listener to listen for an error event.
  onError: (callback: (error: DOMException) => void) => void;
}

export function isAudioRecordingSupported(): boolean {
  if (typeof window === "undefined" || !window.MediaRecorder) {
    return false;
  }

  // Basic check for common audio MIME types. iOS Safari 16+ supports 'audio/mp4'.
  // We prefer webm, but if not available, mp4 is a good fallback.
  return (
    MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ||
    MediaRecorder.isTypeSupported("audio/mp4")
  );
}

export function getPreferredMimeType(): string {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return "audio/mp4";
  }
  return "audio/webm"; // Fallback, might not be supported but won't crash
}

export function recordAudio(maxSec: number = 15): AudioRecorder {
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let startTime: number;
  let onStopCallback: (data: AudioRecording) => void = () => {};
  let onStartCallback: () => void = () => {};
  let onErrorCallback: (error: DOMException) => void = () => {};

  const start = async () => {
    if (!isAudioRecordingSupported()) {
      onErrorCallback(new DOMException("Audio recording not supported.", "NotSupportedError"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredMimeType();
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const durationMs = Date.now() - startTime;
        stream.getTracks().forEach((track) => track.stop());
        onStopCallback({ blob: audioBlob, durationMs });
      };

      mediaRecorder.onerror = (event) => {
        stream.getTracks().forEach((track) => track.stop());
        onErrorCallback(event.error as DOMException);
      };

      mediaRecorder.start();
      startTime = Date.now();
      onStartCallback();

      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, maxSec * 1000);
    } catch (err) {
      onErrorCallback(err as DOMException);
    }
  };

  const stop = async () => {
    return new Promise<AudioRecording>((resolve, reject) => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        const currentOnStopCallback = onStopCallback;
        onStopCallback = (data: AudioRecording) => {
          currentOnStopCallback(data);
          resolve(data);
        };
        mediaRecorder.stop();
      } else {
        reject(new Error("Recorder not active"));
      }
    });
  };

  const cancel = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      audioChunks = []; // Discard recorded chunks
    }
  };

  const onStop = (callback: (data: AudioRecording) => void) => {
    onStopCallback = callback;
  };

  const onStart = (callback: () => void) => {
    onStartCallback = callback;
  };

  const onError = (callback: (error: DOMException) => void) => {
    onErrorCallback = callback;
  };

  return { start, stop, cancel, onStop, onStart, onError };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result.split(",")[1]); // Remove data:mime/type;base64, prefix
      } else {
        reject(new Error("Failed to convert blob to base64."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
